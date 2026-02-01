import {
  GoogleCalendarEvent,
  listEvents,
  ListEventsResult,
} from "./google-calendar";
import {
  appendSheetValues,
  batchUpdateSheetValues,
  clearSheetRow,
  EVENT_HEADERS,
  initializeSheet,
} from "./google-sheets";

export interface SyncContext {
  syncConfigId: string;
  calendarId: string;
  calendarName: string;
  spreadsheetId: string;
  sheetName: string;
  syncToken?: string | null;
}

export interface SyncedEventRecord {
  id: string;
  syncConfigId: string;
  googleEventId: string;
  sheetRowNumber: number | null;
  eventHash: string | null;
  status: "active" | "cancelled";
}

export interface SyncResult {
  eventsAdded: number;
  eventsUpdated: number;
  eventsDeleted: number;
  newSyncToken?: string;
  fullSyncRequired: boolean;
  errors: string[];
}

// Generate a hash for event data to detect changes
export function hashEvent(event: GoogleCalendarEvent): string {
  const data = JSON.stringify({
    summary: event.summary,
    description: event.description,
    location: event.location,
    start: event.start,
    end: event.end,
    status: event.status,
    attendees: event.attendees?.map((a) => a.email).sort(),
  });

  // Simple hash function for edge runtime compatibility
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}

// Format event for spreadsheet row
export function formatEventRow(
  event: GoogleCalendarEvent,
  calendarName: string
): string[] {
  const startTime = event.start.dateTime || event.start.date || "";
  const endTime = event.end.dateTime || event.end.date || "";

  // Calculate duration in minutes
  let durationMinutes = 0;
  if (event.start.dateTime && event.end.dateTime) {
    const start = new Date(event.start.dateTime);
    const end = new Date(event.end.dateTime);
    durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
  } else if (event.start.date && event.end.date) {
    // All-day events
    const start = new Date(event.start.date);
    const end = new Date(event.end.date);
    durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
  }

  const attendees =
    event.attendees
      ?.filter((a) => !a.self)
      .map((a) => a.displayName || a.email)
      .join(", ") || "";

  return [
    event.summary || "(No title)",
    startTime,
    endTime,
    durationMinutes.toString(),
    calendarName,
    event.description || "",
    event.location || "",
    attendees,
    event.status || "confirmed",
    event.id, // Event ID for tracking
  ];
}

export interface SyncDependencies {
  getAccessToken: () => Promise<string>;
  getSyncedEvents: (syncConfigId: string) => Promise<SyncedEventRecord[]>;
  upsertSyncedEvent: (event: {
    id: string;
    syncConfigId: string;
    googleEventId: string;
    sheetRowNumber: number | null;
    eventHash: string | null;
    status: "active" | "cancelled";
  }) => Promise<void>;
  deleteSyncedEvent: (id: string) => Promise<void>;
  updateSyncConfig: (
    syncConfigId: string,
    updates: { syncToken?: string; lastSyncAt?: Date }
  ) => Promise<void>;
  generateId: () => string;
}

export async function syncCalendarToSheet(
  context: SyncContext,
  deps: SyncDependencies
): Promise<SyncResult> {
  const result: SyncResult = {
    eventsAdded: 0,
    eventsUpdated: 0,
    eventsDeleted: 0,
    fullSyncRequired: false,
    errors: [],
  };

  try {
    const accessToken = await deps.getAccessToken();

    // Initialize sheet with headers if needed
    await initializeSheet(accessToken, context.spreadsheetId, context.sheetName);

    // Get existing synced events
    const existingSyncedEvents = await deps.getSyncedEvents(context.syncConfigId);
    const syncedEventsByGoogleId = new Map(
      existingSyncedEvents.map((e) => [e.googleEventId, e])
    );

    // Fetch events from Google Calendar
    let eventsResult: ListEventsResult;

    if (context.syncToken) {
      // Incremental sync
      eventsResult = await listEvents({
        calendarId: context.calendarId,
        accessToken,
        syncToken: context.syncToken,
      });

      if (eventsResult.fullSyncRequired) {
        // Sync token expired, need full sync
        result.fullSyncRequired = true;
        // Clear all existing synced events and do a fresh sync
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const oneYearFromNow = new Date();
        oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

        eventsResult = await listEvents({
          calendarId: context.calendarId,
          accessToken,
          timeMin: thirtyDaysAgo.toISOString(),
          timeMax: oneYearFromNow.toISOString(),
        });
      }
    } else {
      // Initial sync - get events from last 30 days to 1 year in the future
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

      eventsResult = await listEvents({
        calendarId: context.calendarId,
        accessToken,
        timeMin: thirtyDaysAgo.toISOString(),
        timeMax: oneYearFromNow.toISOString(),
      });
    }

    result.newSyncToken = eventsResult.nextSyncToken;

    // Process events
    const eventsToAdd: GoogleCalendarEvent[] = [];
    const eventsToUpdate: Array<{
      event: GoogleCalendarEvent;
      syncedRecord: SyncedEventRecord;
    }> = [];
    const eventsToDelete: SyncedEventRecord[] = [];

    for (const event of eventsResult.events) {
      const existingSynced = syncedEventsByGoogleId.get(event.id);

      if (event.status === "cancelled") {
        // Event was cancelled/deleted
        if (existingSynced && existingSynced.status === "active") {
          eventsToDelete.push(existingSynced);
        }
      } else if (!existingSynced) {
        // New event
        eventsToAdd.push(event);
      } else {
        // Check if event changed
        const newHash = hashEvent(event);
        if (existingSynced.eventHash !== newHash) {
          eventsToUpdate.push({ event, syncedRecord: existingSynced });
        }
      }
    }

    // Add new events
    if (eventsToAdd.length > 0) {
      const rows = eventsToAdd.map((event) =>
        formatEventRow(event, context.calendarName)
      );

      const appendResult = await appendSheetValues(
        accessToken,
        context.spreadsheetId,
        `${context.sheetName}!A:${String.fromCharCode(64 + EVENT_HEADERS.length)}`,
        rows
      );

      // Parse the updated range to get row numbers
      const rangeMatch = appendResult.updates.updatedRange.match(
        /!A(\d+):/
      );
      const startRow = rangeMatch ? parseInt(rangeMatch[1], 10) : 2;

      // Save synced event records
      for (let i = 0; i < eventsToAdd.length; i++) {
        const event = eventsToAdd[i];
        await deps.upsertSyncedEvent({
          id: deps.generateId(),
          syncConfigId: context.syncConfigId,
          googleEventId: event.id,
          sheetRowNumber: startRow + i,
          eventHash: hashEvent(event),
          status: "active",
        });
      }

      result.eventsAdded = eventsToAdd.length;
    }

    // Update existing events
    if (eventsToUpdate.length > 0) {
      const updates = eventsToUpdate
        .filter((u) => u.syncedRecord.sheetRowNumber)
        .map((u) => ({
          range: `${context.sheetName}!A${u.syncedRecord.sheetRowNumber}:${String.fromCharCode(64 + EVENT_HEADERS.length)}${u.syncedRecord.sheetRowNumber}`,
          values: [formatEventRow(u.event, context.calendarName)],
        }));

      if (updates.length > 0) {
        await batchUpdateSheetValues(
          accessToken,
          context.spreadsheetId,
          updates
        );
      }

      // Update synced event records
      for (const { event, syncedRecord } of eventsToUpdate) {
        await deps.upsertSyncedEvent({
          ...syncedRecord,
          eventHash: hashEvent(event),
        });
      }

      result.eventsUpdated = eventsToUpdate.length;
    }

    // Handle deleted events (clear rows and mark as cancelled)
    for (const syncedRecord of eventsToDelete) {
      if (syncedRecord.sheetRowNumber) {
        try {
          await clearSheetRow(
            accessToken,
            context.spreadsheetId,
            context.sheetName,
            syncedRecord.sheetRowNumber
          );
        } catch (err) {
          result.errors.push(
            `Failed to clear row for event ${syncedRecord.googleEventId}: ${err}`
          );
        }
      }

      await deps.upsertSyncedEvent({
        ...syncedRecord,
        status: "cancelled",
      });
    }

    result.eventsDeleted = eventsToDelete.length;

    // Update sync config with new sync token
    await deps.updateSyncConfig(context.syncConfigId, {
      syncToken: eventsResult.nextSyncToken,
      lastSyncAt: new Date(),
    });

    return result;
  } catch (error) {
    result.errors.push(
      `Sync failed: ${error instanceof Error ? error.message : String(error)}`
    );
    return result;
  }
}
