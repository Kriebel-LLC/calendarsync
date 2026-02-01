import { WorkerEnv } from "../types";
import { db } from "shared/src/db";
import { eq, and, lte, or, isNull } from "drizzle-orm";
import {
  syncConfigs,
  calendars,
  destinations,
  googleConnections,
  syncedEvents,
  orgs,
  SyncedEventStatus,
} from "shared/src/db/schema";
import { getPlanLimits, Plan } from "shared/src/types/plan";
import { syncCalendarToSheet, SyncedEventRecord } from "shared/src/sync-service";
import { refreshAccessToken, GoogleOAuthConfig } from "shared/src/google-oauth";
import { nanoid } from "nanoid";

const TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

async function getValidAccessToken(
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

export async function handleCron(env: WorkerEnv) {
  console.log("Starting sync cron job");

  const oauthConfig: GoogleOAuthConfig = {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: `${env.NEXT_PUBLIC_APP_URL}/api/google/callback`,
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

      // Get connection
      const [connection] = await db(env)
        .select()
        .from(googleConnections)
        .where(eq(googleConnections.id, calendar.googleConnectionId));

      if (!connection) {
        console.error(
          `Connection not found for sync config ${syncConfig.id}`
        );
        continue;
      }

      // Run sync
      const result = await syncCalendarToSheet(
        {
          syncConfigId: syncConfig.id,
          calendarId: calendar.googleCalendarId,
          calendarName: calendar.name,
          spreadsheetId: destination.spreadsheetId!,
          sheetName: destination.sheetName!,
          syncToken: syncConfig.syncToken,
        },
        {
          getAccessToken: () =>
            getValidAccessToken(connection, oauthConfig, env),
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
        `Sync ${syncConfig.id} completed: added=${result.eventsAdded}, updated=${result.eventsUpdated}, deleted=${result.eventsDeleted}, errors=${result.errors.length}`
      );

      if (result.errors.length > 0) {
        console.error(`Sync errors for ${syncConfig.id}:`, result.errors);
      }
    } catch (error) {
      console.error(`Error syncing config ${syncConfig.id}:`, error);
    }
  }

  console.log("Sync cron job completed");
}
