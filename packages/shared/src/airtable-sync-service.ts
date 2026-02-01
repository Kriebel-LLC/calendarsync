import {
  GoogleCalendarEvent,
  listEvents,
  ListEventsResult,
} from "./google-calendar";
import {
  createRecords,
  updateRecords,
  deleteRecords,
  listRecords,
  initializeTableForCalendarSync,
  getBaseSchema,
  AirtableCreateRecordRequest,
  AirtableUpdateRecordRequest,
} from "./airtable-api";

export interface FilterConfig {
  timeRangeStart?: string; // ISO date string
  timeRangeEnd?: string; // ISO date string
  keywords?: string[]; // Keywords to filter event titles
}

export interface AirtableSyncContext {
  syncConfigId: string;
  calendarId: string;
  calendarName: string;
  baseId: string;
  tableId: string;
  syncToken?: string | null;
  filterConfig?: FilterConfig | null;
}

export interface AirtableSyncedEventRecord {
  id: string;
  syncConfigId: string;
  googleEventId: string;
  airtableRecordId: string | null;
  eventHash: string | null;
  status: "active" | "cancelled";
}

export interface AirtableSyncResult {
  eventsAdded: number;
  eventsUpdated: number;
  eventsDeleted: number;
  newSyncToken?: string;
  fullSyncRequired: boolean;
  errors: string[];
}

// Check if event matches filter config
export function eventMatchesFilter(
  event: GoogleCalendarEvent,
  filterConfig?: FilterConfig | null
): boolean {
  if (!filterConfig) return true;

  // Check time range
  const eventStart = event.start.dateTime || event.start.date;
  if (eventStart) {
    const eventDate = new Date(eventStart);

    if (filterConfig.timeRangeStart) {
      const startDate = new Date(filterConfig.timeRangeStart);
      if (eventDate < startDate) return false;
    }

    if (filterConfig.timeRangeEnd) {
      const endDate = new Date(filterConfig.timeRangeEnd);
      // Set to end of day for inclusive comparison
      endDate.setHours(23, 59, 59, 999);
      if (eventDate > endDate) return false;
    }
  }

  // Check keywords (if any keyword matches, event passes)
  if (filterConfig.keywords && filterConfig.keywords.length > 0) {
    const title = (event.summary || "").toLowerCase();
    const hasMatch = filterConfig.keywords.some((keyword) =>
      title.includes(keyword.toLowerCase())
    );
    if (!hasMatch) return false;
  }

  return true;
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

// Format event for Airtable record fields
export function formatEventFields(
  event: GoogleCalendarEvent,
  calendarName: string
): Record<string, unknown> {
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
      .map((a) => a.displayName || a.email) || [];

  return {
    "Event Title": event.summary || "(No title)",
    "Start": startTime || null,
    "End": endTime || null,
    "Duration (minutes)": durationMinutes,
    "Calendar": calendarName,
    "Description": event.description || "",
    "Location": event.location || "",
    "Attendees": attendees,
    "Status": event.status || "confirmed",
    "Event ID": event.id,
  };
}

export interface AirtableSyncDependencies {
  getGoogleAccessToken: () => Promise<string>;
  getAirtableAccessToken: () => Promise<string>;
  getSyncedEvents: (syncConfigId: string) => Promise<AirtableSyncedEventRecord[]>;
  upsertSyncedEvent: (event: {
    id: string;
    syncConfigId: string;
    googleEventId: string;
    airtableRecordId: string | null;
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

export async function syncCalendarToAirtable(
  context: AirtableSyncContext,
  deps: AirtableSyncDependencies
): Promise<AirtableSyncResult> {
  const result: AirtableSyncResult = {
    eventsAdded: 0,
    eventsUpdated: 0,
    eventsDeleted: 0,
    fullSyncRequired: false,
    errors: [],
  };

  try {
    const googleAccessToken = await deps.getGoogleAccessToken();
    const airtableAccessToken = await deps.getAirtableAccessToken();

    // Initialize table with calendar event fields if needed
    const tables = await getBaseSchema(airtableAccessToken, context.baseId);
    const targetTable = tables.find((t) => t.id === context.tableId);
    if (targetTable) {
      await initializeTableForCalendarSync(
        airtableAccessToken,
        context.baseId,
        context.tableId,
        targetTable.fields
      );
    }

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
        accessToken: googleAccessToken,
        syncToken: context.syncToken,
      });

      if (eventsResult.fullSyncRequired) {
        // Sync token expired, need full sync
        result.fullSyncRequired = true;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const oneYearFromNow = new Date();
        oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

        eventsResult = await listEvents({
          calendarId: context.calendarId,
          accessToken: googleAccessToken,
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
        accessToken: googleAccessToken,
        timeMin: thirtyDaysAgo.toISOString(),
        timeMax: oneYearFromNow.toISOString(),
      });
    }

    result.newSyncToken = eventsResult.nextSyncToken;

    // Process events
    const eventsToAdd: GoogleCalendarEvent[] = [];
    const eventsToUpdate: Array<{
      event: GoogleCalendarEvent;
      syncedRecord: AirtableSyncedEventRecord;
    }> = [];
    const eventsToDelete: AirtableSyncedEventRecord[] = [];

    for (const event of eventsResult.events) {
      const existingSynced = syncedEventsByGoogleId.get(event.id);

      if (event.status === "cancelled") {
        // Event was cancelled/deleted
        if (existingSynced && existingSynced.status === "active") {
          eventsToDelete.push(existingSynced);
        }
      } else if (!eventMatchesFilter(event, context.filterConfig)) {
        // Event doesn't match filter - skip it, but if it was synced before, delete it
        if (existingSynced && existingSynced.status === "active") {
          eventsToDelete.push(existingSynced);
        }
      } else if (!existingSynced) {
        // New event that matches filter
        eventsToAdd.push(event);
      } else {
        // Check if event changed
        const newHash = hashEvent(event);
        if (existingSynced.eventHash !== newHash) {
          eventsToUpdate.push({ event, syncedRecord: existingSynced });
        }
      }
    }

    // Add new events to Airtable
    if (eventsToAdd.length > 0) {
      const records: AirtableCreateRecordRequest[] = eventsToAdd.map((event) => ({
        fields: formatEventFields(event, context.calendarName),
      }));

      try {
        const createdRecords = await createRecords(
          airtableAccessToken,
          context.baseId,
          context.tableId,
          records
        );

        // Save synced event records
        for (let i = 0; i < eventsToAdd.length; i++) {
          const event = eventsToAdd[i];
          const airtableRecord = createdRecords[i];
          await deps.upsertSyncedEvent({
            id: deps.generateId(),
            syncConfigId: context.syncConfigId,
            googleEventId: event.id,
            airtableRecordId: airtableRecord?.id || null,
            eventHash: hashEvent(event),
            status: "active",
          });
        }

        result.eventsAdded = eventsToAdd.length;
      } catch (error) {
        result.errors.push(
          `Failed to add events: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Update existing events in Airtable
    if (eventsToUpdate.length > 0) {
      const recordsToUpdate = eventsToUpdate
        .filter((u) => u.syncedRecord.airtableRecordId)
        .map((u) => ({
          id: u.syncedRecord.airtableRecordId!,
          fields: formatEventFields(u.event, context.calendarName),
        }));

      if (recordsToUpdate.length > 0) {
        try {
          await updateRecords(
            airtableAccessToken,
            context.baseId,
            context.tableId,
            recordsToUpdate
          );
        } catch (error) {
          result.errors.push(
            `Failed to update events: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      // Update synced event records with new hash
      for (const { event, syncedRecord } of eventsToUpdate) {
        await deps.upsertSyncedEvent({
          ...syncedRecord,
          eventHash: hashEvent(event),
        });
      }

      result.eventsUpdated = eventsToUpdate.length;
    }

    // Handle deleted events (delete from Airtable and mark as cancelled)
    if (eventsToDelete.length > 0) {
      const recordIdsToDelete = eventsToDelete
        .filter((r) => r.airtableRecordId)
        .map((r) => r.airtableRecordId!);

      if (recordIdsToDelete.length > 0) {
        try {
          await deleteRecords(
            airtableAccessToken,
            context.baseId,
            context.tableId,
            recordIdsToDelete
          );
        } catch (error) {
          result.errors.push(
            `Failed to delete events: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      // Mark synced events as cancelled
      for (const syncedRecord of eventsToDelete) {
        await deps.upsertSyncedEvent({
          ...syncedRecord,
          status: "cancelled",
        });
      }

      result.eventsDeleted = eventsToDelete.length;
    }

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
