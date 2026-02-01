import { WorkerEnv } from "../types";
import { db } from "shared/src/db";
import { eq, and } from "drizzle-orm";
import {
  syncConfigs,
  calendars,
  destinations,
  googleConnections,
  airtableConnections,
  syncedEvents,
  orgs,
  SyncedEventStatus,
  DestinationType,
} from "shared/src/db/schema";
import { getPlanLimits, Plan } from "shared/src/types/plan";
import { syncCalendarToSheet, SyncedEventRecord } from "shared/src/sync-service";
import {
  syncCalendarToAirtable,
  AirtableSyncedEventRecord,
} from "shared/src/airtable-sync-service";
import { refreshAccessToken, GoogleOAuthConfig } from "shared/src/google-oauth";
import {
  refreshAirtableAccessToken,
  AirtableOAuthConfig,
} from "shared/src/airtable-oauth";
import { nanoid } from "nanoid";

const TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

async function getValidGoogleAccessToken(
  connection: {
    id: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  },
  oauthConfig: GoogleOAuthConfig,
  env: WorkerEnv
): Promise<string> {
  const now = Date.now();
  const expiresAt = connection.expiresAt.getTime();

  // If token is still valid (with threshold), return it
  if (expiresAt - now > TOKEN_REFRESH_THRESHOLD_MS) {
    return connection.accessToken;
  }

  // Refresh the token
  const tokens = await refreshAccessToken(oauthConfig, connection.refreshToken);

  const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  // Update the connection with new token
  await db(env)
    .update(googleConnections)
    .set({
      accessToken: tokens.access_token,
      expiresAt: newExpiresAt,
    })
    .where(eq(googleConnections.id, connection.id));

  return tokens.access_token;
}

async function getValidAirtableAccessToken(
  connection: {
    id: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
    refreshExpiresAt: Date;
  },
  oauthConfig: AirtableOAuthConfig,
  env: WorkerEnv
): Promise<string> {
  const now = Date.now();
  const expiresAt = connection.expiresAt.getTime();

  // If token is still valid (with threshold), return it
  if (expiresAt - now > TOKEN_REFRESH_THRESHOLD_MS) {
    return connection.accessToken;
  }

  // Check if refresh token is still valid
  const refreshExpiresAt = connection.refreshExpiresAt.getTime();
  if (now > refreshExpiresAt) {
    throw new Error("Airtable refresh token has expired. Please reconnect your Airtable account.");
  }

  // Refresh the token
  const tokens = await refreshAirtableAccessToken(oauthConfig, connection.refreshToken);

  const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  const newRefreshExpiresAt = new Date(Date.now() + tokens.refresh_expires_in * 1000);

  // Update the connection with new tokens
  await db(env)
    .update(airtableConnections)
    .set({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: newExpiresAt,
      refreshExpiresAt: newRefreshExpiresAt,
    })
    .where(eq(airtableConnections.id, connection.id));

  return tokens.access_token;
}

export async function handleCron(env: WorkerEnv) {
  console.log("Starting sync cron job");

  const googleOAuthConfig: GoogleOAuthConfig = {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: `${env.NEXT_PUBLIC_APP_URL}/api/google/callback`,
  };

  const airtableOAuthConfig: AirtableOAuthConfig = {
    clientId: env.AIRTABLE_CLIENT_ID,
    clientSecret: env.AIRTABLE_CLIENT_SECRET,
    redirectUri: `${env.NEXT_PUBLIC_APP_URL}/api/airtable/callback`,
  };

  // Get all enabled sync configs that are due for sync
  const now = new Date();

  // Get all sync configs with their org's plan
  const configsWithOrgs = await db(env)
    .select({
      syncConfig: syncConfigs,
      orgPlan: orgs.plan,
    })
    .from(syncConfigs)
    .innerJoin(orgs, eq(syncConfigs.orgId, orgs.id))
    .where(eq(syncConfigs.isEnabled, true));

  console.log(`Found ${configsWithOrgs.length} enabled sync configs`);

  for (const { syncConfig, orgPlan } of configsWithOrgs) {
    try {
      // Check if sync is due based on plan's sync interval
      const limits = getPlanLimits(orgPlan as Plan);
      const syncIntervalMs = limits.syncIntervalMinutes * 60 * 1000;

      if (syncConfig.lastSyncAt) {
        const lastSyncTime = syncConfig.lastSyncAt.getTime();
        const nextSyncDue = lastSyncTime + syncIntervalMs;

        if (now.getTime() < nextSyncDue) {
          console.log(
            `Skipping sync ${syncConfig.id}: next sync due at ${new Date(nextSyncDue).toISOString()}`
          );
          continue;
        }
      }

      console.log(`Running sync for config ${syncConfig.id}`);

      // Get calendar and destination
      const [calendar] = await db(env)
        .select()
        .from(calendars)
        .where(eq(calendars.id, syncConfig.calendarId));

      const [destination] = await db(env)
        .select()
        .from(destinations)
        .where(eq(destinations.id, syncConfig.destinationId));

      if (!calendar || !destination) {
        console.error(
          `Calendar or destination not found for sync config ${syncConfig.id}`
        );
        continue;
      }

      if (!calendar.isEnabled || !destination.isEnabled) {
        console.log(
          `Skipping sync ${syncConfig.id}: calendar or destination disabled`
        );
        continue;
      }

      // Get Google connection for calendar
      const [googleConnection] = await db(env)
        .select()
        .from(googleConnections)
        .where(eq(googleConnections.id, calendar.googleConnectionId));

      if (!googleConnection) {
        console.error(
          `Google connection not found for sync config ${syncConfig.id}`
        );
        continue;
      }

      // Handle different destination types
      if (destination.type === DestinationType.AIRTABLE) {
        // Airtable sync
        if (!destination.airtableConnectionId || !destination.airtableBaseId || !destination.airtableTableId) {
          console.error(`Airtable destination ${destination.id} missing required fields`);
          continue;
        }

        const [airtableConnection] = await db(env)
          .select()
          .from(airtableConnections)
          .where(eq(airtableConnections.id, destination.airtableConnectionId));

        if (!airtableConnection) {
          console.error(`Airtable connection not found for destination ${destination.id}`);
          continue;
        }

        const result = await syncCalendarToAirtable(
          {
            syncConfigId: syncConfig.id,
            calendarId: calendar.googleCalendarId,
            calendarName: calendar.name,
            baseId: destination.airtableBaseId,
            tableId: destination.airtableTableId,
            syncToken: syncConfig.syncToken,
          },
          {
            getGoogleAccessToken: () =>
              getValidGoogleAccessToken(googleConnection, googleOAuthConfig, env),
            getAirtableAccessToken: () =>
              getValidAirtableAccessToken(airtableConnection, airtableOAuthConfig, env),
            getSyncedEvents: async (
              configId: string
            ): Promise<AirtableSyncedEventRecord[]> => {
              const events = await db(env)
                .select()
                .from(syncedEvents)
                .where(eq(syncedEvents.syncConfigId, configId));
              return events.map((e) => ({
                id: e.id,
                syncConfigId: e.syncConfigId,
                googleEventId: e.googleEventId,
                airtableRecordId: e.airtableRecordId,
                eventHash: e.eventHash,
                status: e.status as "active" | "cancelled",
              }));
            },
            upsertSyncedEvent: async (event) => {
              const existing = await db(env)
                .select()
                .from(syncedEvents)
                .where(
                  and(
                    eq(syncedEvents.syncConfigId, event.syncConfigId),
                    eq(syncedEvents.googleEventId, event.googleEventId)
                  )
                );

              if (existing.length > 0) {
                await db(env)
                  .update(syncedEvents)
                  .set({
                    airtableRecordId: event.airtableRecordId,
                    eventHash: event.eventHash,
                    status: event.status as SyncedEventStatus,
                  })
                  .where(eq(syncedEvents.id, existing[0].id));
              } else {
                await db(env)
                  .insert(syncedEvents)
                  .values({
                    id: event.id,
                    syncConfigId: event.syncConfigId,
                    googleEventId: event.googleEventId,
                    airtableRecordId: event.airtableRecordId,
                    eventHash: event.eventHash,
                    status: event.status as SyncedEventStatus,
                  });
              }
            },
            deleteSyncedEvent: async (id: string) => {
              await db(env)
                .delete(syncedEvents)
                .where(eq(syncedEvents.id, id));
            },
            updateSyncConfig: async (configId, updates) => {
              await db(env)
                .update(syncConfigs)
                .set({
                  syncToken: updates.syncToken,
                  lastSyncAt: updates.lastSyncAt,
                })
                .where(eq(syncConfigs.id, configId));
            },
            generateId: () => nanoid(),
          }
        );

        console.log(
          `Airtable sync ${syncConfig.id} completed: added=${result.eventsAdded}, updated=${result.eventsUpdated}, deleted=${result.eventsDeleted}, errors=${result.errors.length}`
        );

        if (result.errors.length > 0) {
          console.error(`Sync errors for ${syncConfig.id}:`, result.errors);
        }
      } else {
        // Google Sheets sync (default)
        if (!destination.spreadsheetId || !destination.sheetName) {
          console.error(`Google Sheets destination ${destination.id} missing required fields`);
          continue;
        }

        const result = await syncCalendarToSheet(
          {
            syncConfigId: syncConfig.id,
            calendarId: calendar.googleCalendarId,
            calendarName: calendar.name,
            spreadsheetId: destination.spreadsheetId,
            sheetName: destination.sheetName,
            syncToken: syncConfig.syncToken,
          },
          {
            getAccessToken: () =>
              getValidGoogleAccessToken(googleConnection, googleOAuthConfig, env),
            getSyncedEvents: async (
              configId: string
            ): Promise<SyncedEventRecord[]> => {
              const events = await db(env)
                .select()
                .from(syncedEvents)
                .where(eq(syncedEvents.syncConfigId, configId));
              return events.map((e) => ({
                id: e.id,
                syncConfigId: e.syncConfigId,
                googleEventId: e.googleEventId,
                sheetRowNumber: e.sheetRowNumber,
                eventHash: e.eventHash,
                status: e.status as "active" | "cancelled",
              }));
            },
            upsertSyncedEvent: async (event) => {
              const existing = await db(env)
                .select()
                .from(syncedEvents)
                .where(
                  and(
                    eq(syncedEvents.syncConfigId, event.syncConfigId),
                    eq(syncedEvents.googleEventId, event.googleEventId)
                  )
                );

              if (existing.length > 0) {
                await db(env)
                  .update(syncedEvents)
                  .set({
                    sheetRowNumber: event.sheetRowNumber,
                    eventHash: event.eventHash,
                    status: event.status as SyncedEventStatus,
                  })
                  .where(eq(syncedEvents.id, existing[0].id));
              } else {
                await db(env)
                  .insert(syncedEvents)
                  .values({
                    id: event.id,
                    syncConfigId: event.syncConfigId,
                    googleEventId: event.googleEventId,
                    sheetRowNumber: event.sheetRowNumber,
                    eventHash: event.eventHash,
                    status: event.status as SyncedEventStatus,
                  });
              }
            },
            deleteSyncedEvent: async (id: string) => {
              await db(env)
                .delete(syncedEvents)
                .where(eq(syncedEvents.id, id));
            },
            updateSyncConfig: async (configId, updates) => {
              await db(env)
                .update(syncConfigs)
                .set({
                  syncToken: updates.syncToken,
                  lastSyncAt: updates.lastSyncAt,
                })
                .where(eq(syncConfigs.id, configId));
            },
            generateId: () => nanoid(),
          }
        );

        console.log(
          `Sheets sync ${syncConfig.id} completed: added=${result.eventsAdded}, updated=${result.eventsUpdated}, deleted=${result.eventsDeleted}, errors=${result.errors.length}`
        );

        if (result.errors.length > 0) {
          console.error(`Sync errors for ${syncConfig.id}:`, result.errors);
        }
      }
    } catch (error) {
      console.error(`Error syncing config ${syncConfig.id}:`, error);
    }
  }

  console.log("Sync cron job completed");
}
