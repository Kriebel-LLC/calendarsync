import { db } from "@/db";
import { getValidAccessToken } from "@/lib/google";
import { getValidAirtableAccessToken } from "@/lib/airtable";
import { verifyUserHasPermissionForOrgId } from "@/lib/org";
import { routeHandler } from "@/lib/route";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import {
  syncConfigs,
  calendars,
  destinations,
  googleConnections,
  airtableConnections,
  syncedEvents,
  SyncedEventStatus,
  DestinationType,
} from "shared/src/db/schema";
import {
  syncCalendarToSheet,
  SyncedEventRecord,
} from "shared/src/sync-service";
import {
  syncCalendarToAirtable,
  AirtableSyncedEventRecord,
} from "shared/src/airtable-sync-service";
import { Role } from "shared/src/types/role";
import { z } from "zod";

const routeContextSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
});

type RouteContext = z.infer<typeof routeContextSchema>;

export const POST = routeHandler<RouteContext>(async (req, user, context) => {
  const parsed = routeContextSchema.safeParse(context);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const syncConfigId = parsed.data.params.id;

  // Get sync config with related data
  const [config] = await db()
    .select()
    .from(syncConfigs)
    .where(eq(syncConfigs.id, syncConfigId));

  if (!config) {
    return NextResponse.json(
      { error: "Sync configuration not found" },
      { status: 404 }
    );
  }

  // Verify user has access
  const hasAccess = await verifyUserHasPermissionForOrgId(
    user.uid,
    config.orgId,
    Role.WRITE
  );
  if (!hasAccess) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Get calendar and destination
  const [calendar] = await db()
    .select()
    .from(calendars)
    .where(eq(calendars.id, config.calendarId));

  const [destination] = await db()
    .select()
    .from(destinations)
    .where(eq(destinations.id, config.destinationId));

  if (!calendar || !destination) {
    return NextResponse.json(
      { error: "Calendar or destination not found" },
      { status: 404 }
    );
  }

  // Get Google connection for calendar
  const [googleConnection] = await db()
    .select()
    .from(googleConnections)
    .where(eq(googleConnections.id, calendar.googleConnectionId));

  if (!googleConnection) {
    return NextResponse.json(
      { error: "Google connection not found" },
      { status: 404 }
    );
  }

  // Handle different destination types
  if (destination.type === DestinationType.AIRTABLE) {
    // Airtable sync
    if (
      !destination.airtableConnectionId ||
      !destination.airtableBaseId ||
      !destination.airtableTableId
    ) {
      return NextResponse.json(
        { error: "Airtable destination missing required configuration" },
        { status: 400 }
      );
    }

    const [airtableConnection] = await db()
      .select()
      .from(airtableConnections)
      .where(eq(airtableConnections.id, destination.airtableConnectionId));

    if (!airtableConnection) {
      return NextResponse.json(
        { error: "Airtable connection not found" },
        { status: 404 }
      );
    }

    // Parse filter config from sync config
    const filterConfig = config.filterConfig
      ? JSON.parse(config.filterConfig)
      : null;

    const result = await syncCalendarToAirtable(
      {
        syncConfigId: config.id,
        calendarId: calendar.googleCalendarId,
        calendarName: calendar.name,
        baseId: destination.airtableBaseId,
        tableId: destination.airtableTableId,
        syncToken: config.syncToken,
        filterConfig,
      },
      {
        getGoogleAccessToken: () => getValidAccessToken(googleConnection),
        getAirtableAccessToken: () =>
          getValidAirtableAccessToken(airtableConnection),
        getSyncedEvents: async (
          configId: string
        ): Promise<AirtableSyncedEventRecord[]> => {
          const events = await db()
            .select()
            .from(syncedEvents)
            .where(eq(syncedEvents.syncConfigId, configId));
          return events.map((e) => ({
            id: e.id,
            syncConfigId: e.syncConfigId!,
            googleEventId: e.externalEventId,
            airtableRecordId: e.airtableRecordId,
            eventHash: e.eventHash,
            status: e.status as "active" | "cancelled",
          }));
        },
        upsertSyncedEvent: async (event) => {
          const existing = await db()
            .select()
            .from(syncedEvents)
            .where(
              and(
                eq(syncedEvents.syncConfigId, event.syncConfigId),
                eq(syncedEvents.externalEventId, event.googleEventId)
              )
            );

          if (existing.length > 0) {
            await db()
              .update(syncedEvents)
              .set({
                airtableRecordId: event.airtableRecordId,
                eventHash: event.eventHash,
                status: event.status as SyncedEventStatus,
              })
              .where(eq(syncedEvents.id, existing[0].id));
          } else {
            await db()
              .insert(syncedEvents)
              .values({
                id: event.id,
                syncConfigId: event.syncConfigId,
                externalEventId: event.googleEventId,
                airtableRecordId: event.airtableRecordId,
                eventHash: event.eventHash,
                status: event.status as SyncedEventStatus,
              });
          }
        },
        deleteSyncedEvent: async (id: string) => {
          await db().delete(syncedEvents).where(eq(syncedEvents.id, id));
        },
        updateSyncConfig: async (configId, updates) => {
          await db()
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

    return NextResponse.json({
      success: result.errors.length === 0,
      eventsAdded: result.eventsAdded,
      eventsUpdated: result.eventsUpdated,
      eventsDeleted: result.eventsDeleted,
      errors: result.errors,
    });
  } else {
    // Google Sheets sync (default)
    if (!destination.spreadsheetId || !destination.sheetName) {
      return NextResponse.json(
        { error: "Google Sheets destination missing required configuration" },
        { status: 400 }
      );
    }

    // Parse filter and column mapping config from sync config
    const filterConfig = config.filterConfig
      ? JSON.parse(config.filterConfig)
      : null;
    const columnMapping = config.columnMapping
      ? JSON.parse(config.columnMapping)
      : null;

    const result = await syncCalendarToSheet(
      {
        syncConfigId: config.id,
        calendarId: calendar.googleCalendarId,
        calendarName: calendar.name,
        spreadsheetId: destination.spreadsheetId,
        sheetName: destination.sheetName,
        syncToken: config.syncToken,
        filterConfig,
        columnMapping,
      },
      {
        getAccessToken: () => getValidAccessToken(googleConnection),
        getSyncedEvents: async (
          configId: string
        ): Promise<SyncedEventRecord[]> => {
          const events = await db()
            .select()
            .from(syncedEvents)
            .where(eq(syncedEvents.syncConfigId, configId));
          return events.map((e) => ({
            id: e.id,
            syncConfigId: e.syncConfigId!,
            googleEventId: e.externalEventId,
            sheetRowNumber: e.sheetRowNumber,
            eventHash: e.eventHash,
            status: e.status as "active" | "cancelled",
          }));
        },
        upsertSyncedEvent: async (event) => {
          const existing = await db()
            .select()
            .from(syncedEvents)
            .where(
              and(
                eq(syncedEvents.syncConfigId, event.syncConfigId),
                eq(syncedEvents.externalEventId, event.googleEventId)
              )
            );

          if (existing.length > 0) {
            await db()
              .update(syncedEvents)
              .set({
                sheetRowNumber: event.sheetRowNumber,
                eventHash: event.eventHash,
                status: event.status as SyncedEventStatus,
              })
              .where(eq(syncedEvents.id, existing[0].id));
          } else {
            await db()
              .insert(syncedEvents)
              .values({
                id: event.id,
                syncConfigId: event.syncConfigId,
                externalEventId: event.googleEventId,
                sheetRowNumber: event.sheetRowNumber,
                eventHash: event.eventHash,
                status: event.status as SyncedEventStatus,
              });
          }
        },
        deleteSyncedEvent: async (id: string) => {
          await db().delete(syncedEvents).where(eq(syncedEvents.id, id));
        },
        updateSyncConfig: async (configId, updates) => {
          await db()
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

    return NextResponse.json({
      success: result.errors.length === 0,
      eventsAdded: result.eventsAdded,
      eventsUpdated: result.eventsUpdated,
      eventsDeleted: result.eventsDeleted,
      errors: result.errors,
    });
  }
});
