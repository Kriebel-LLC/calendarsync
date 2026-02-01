/**
 * Notion sync service for syncing calendar events to Notion databases.
 * Handles field mapping, incremental sync, and event updates.
 */

import { db } from "@/db";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  syncedEvents,
  SyncedEvent,
  notionConnections,
} from "shared/src/db/schema";
import {
  createPage,
  updatePage,
  NotionPropertyValue,
  queryDatabase,
} from "./notion-api";
import { getNotionAccessToken } from "./notion-connection";

/**
 * Calendar event structure from a source (e.g., Google Calendar)
 */
export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  start: Date;
  end: Date;
  calendarId: string;
  calendarName?: string;
  attendees?: string[];
  status?: string;
}

/**
 * Notion property mapping for calendar events.
 * Maps calendar event fields to Notion database properties.
 */
export interface NotionPropertyMapping {
  title: string; // Property name for event title (title type)
  start: string; // Property name for start date (date type)
  end?: string; // Property name for end date (date type) - optional, can use date range
  duration?: string; // Property name for duration in hours (number type)
  calendar?: string; // Property name for calendar source (select type)
  description?: string; // Property name for description (rich_text type)
  location?: string; // Property name for location (rich_text type)
  attendees?: string; // Property name for attendees (multi_select type)
  status?: string; // Property name for event status (select type)
  eventId?: string; // Property name to store external event ID (rich_text type)
}

// Default property mapping that matches common Notion database structures
const DEFAULT_PROPERTY_MAPPING: NotionPropertyMapping = {
  title: "Title",
  start: "Start",
  end: "End",
  duration: "Duration",
  calendar: "Calendar",
  description: "Description",
  location: "Location",
  attendees: "Attendees",
  status: "Status",
  eventId: "Event ID",
};

/**
 * Calculates duration in hours between two dates.
 */
function calculateDurationHours(start: Date, end: Date): number {
  const diffMs = end.getTime() - start.getTime();
  return Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10; // Round to 1 decimal
}

/**
 * Generates a hash of event data for change detection.
 */
async function hashEventData(event: CalendarEvent): Promise<string> {
  const data = JSON.stringify({
    title: event.title,
    description: event.description,
    location: event.location,
    start: event.start.toISOString(),
    end: event.end.toISOString(),
    attendees: event.attendees?.sort(),
    status: event.status,
  });

  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Converts a calendar event to Notion properties.
 */
function eventToNotionProperties(
  event: CalendarEvent,
  mapping: NotionPropertyMapping = DEFAULT_PROPERTY_MAPPING
): Record<string, NotionPropertyValue> {
  const properties: Record<string, NotionPropertyValue> = {};

  // Title (required)
  properties[mapping.title] = {
    type: "title",
    title: [{ text: { content: event.title || "Untitled Event" } }],
  };

  // Start date
  properties[mapping.start] = {
    type: "date",
    date: {
      start: event.start.toISOString(),
      end: mapping.end ? undefined : event.end.toISOString(),
    },
  };

  // End date (if separate property)
  if (mapping.end) {
    properties[mapping.end] = {
      type: "date",
      date: { start: event.end.toISOString() },
    };
  }

  // Duration in hours
  if (mapping.duration) {
    properties[mapping.duration] = {
      type: "number",
      number: calculateDurationHours(event.start, event.end),
    };
  }

  // Calendar source
  if (mapping.calendar && event.calendarName) {
    properties[mapping.calendar] = {
      type: "select",
      select: { name: event.calendarName },
    };
  }

  // Description
  if (mapping.description && event.description) {
    properties[mapping.description] = {
      type: "rich_text",
      rich_text: [{ text: { content: event.description.substring(0, 2000) } }],
    };
  }

  // Location
  if (mapping.location && event.location) {
    properties[mapping.location] = {
      type: "rich_text",
      rich_text: [{ text: { content: event.location } }],
    };
  }

  // Attendees
  if (mapping.attendees && event.attendees && event.attendees.length > 0) {
    properties[mapping.attendees] = {
      type: "multi_select",
      multi_select: event.attendees.map((attendee) => ({ name: attendee })),
    };
  }

  // Status
  if (mapping.status && event.status) {
    properties[mapping.status] = {
      type: "select",
      select: { name: event.status },
    };
  }

  // Store external event ID for future lookups
  if (mapping.eventId) {
    properties[mapping.eventId] = {
      type: "rich_text",
      rich_text: [{ text: { content: event.id } }],
    };
  }

  return properties;
}

/**
 * Gets existing synced event record by external event ID.
 */
async function getSyncedEvent(
  userId: string,
  externalEventId: string
): Promise<SyncedEvent | undefined> {
  return db()
    .select()
    .from(syncedEvents)
    .where(
      and(
        eq(syncedEvents.userId, userId),
        eq(syncedEvents.externalEventId, externalEventId)
      )
    )
    .get();
}

/**
 * Creates a synced event record.
 */
async function createSyncedEvent(
  userId: string,
  event: CalendarEvent,
  notionPageId: string,
  eventHash: string
): Promise<SyncedEvent> {
  const created = await db()
    .insert(syncedEvents)
    .values({
      id: nanoid(),
      userId,
      externalEventId: event.id,
      notionPageId,
      calendarId: event.calendarId,
      calendarName: event.calendarName,
      eventTitle: event.title,
      eventStart: event.start,
      eventEnd: event.end,
      eventHash,
    })
    .returning();

  return created[0];
}

/**
 * Updates a synced event record.
 */
async function updateSyncedEvent(
  id: string,
  event: CalendarEvent,
  eventHash: string
): Promise<void> {
  await db()
    .update(syncedEvents)
    .set({
      eventTitle: event.title,
      eventStart: event.start,
      eventEnd: event.end,
      eventHash,
      lastSyncedAt: new Date(),
    })
    .where(eq(syncedEvents.id, id));
}

export interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ eventId: string; error: string }>;
}

/**
 * Syncs calendar events to Notion database.
 * Creates new pages for new events, updates existing pages for changed events.
 */
export async function syncEventsToNotion(
  userId: string,
  events: CalendarEvent[],
  propertyMapping: NotionPropertyMapping = DEFAULT_PROPERTY_MAPPING
): Promise<SyncResult> {
  const result: SyncResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  // Get user's Notion connection
  const connection = await db()
    .select()
    .from(notionConnections)
    .where(eq(notionConnections.userId, userId))
    .get();

  if (!connection || !connection.selectedDatabaseId) {
    throw new Error("No Notion database selected for sync");
  }

  const accessToken = await getNotionAccessToken(userId);
  if (!accessToken) {
    throw new Error("Failed to get Notion access token");
  }

  for (const event of events) {
    try {
      const eventHash = await hashEventData(event);
      const existingSync = await getSyncedEvent(userId, event.id);

      if (existingSync && existingSync.notionPageId) {
        // Check if event has changed
        if (existingSync.eventHash === eventHash) {
          result.skipped++;
          continue;
        }

        // Update existing Notion page
        const properties = eventToNotionProperties(event, propertyMapping);
        await updatePage(accessToken, existingSync.notionPageId, properties);
        await updateSyncedEvent(existingSync.id, event, eventHash);
        result.updated++;
      } else {
        // Create new Notion page
        const properties = eventToNotionProperties(event, propertyMapping);
        const page = await createPage(
          accessToken,
          connection.selectedDatabaseId,
          properties
        );
        await createSyncedEvent(userId, event, page.id, eventHash);
        result.created++;
      }
    } catch (err) {
      result.errors.push({
        eventId: event.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}

/**
 * Gets all synced events for a user.
 */
export async function getUserSyncedEvents(
  userId: string
): Promise<SyncedEvent[]> {
  return db()
    .select()
    .from(syncedEvents)
    .where(eq(syncedEvents.userId, userId))
    .all();
}

/**
 * Deletes synced event records for events that no longer exist.
 * Returns the IDs of deleted sync records.
 */
export async function cleanupDeletedEvents(
  userId: string,
  currentEventIds: string[]
): Promise<string[]> {
  const allSynced = await getUserSyncedEvents(userId);
  const currentIdSet = new Set(currentEventIds);

  const toDelete = allSynced.filter(
    (synced) => !currentIdSet.has(synced.externalEventId)
  );

  for (const synced of toDelete) {
    await db().delete(syncedEvents).where(eq(syncedEvents.id, synced.id));
  }

  return toDelete.map((s) => s.id);
}
