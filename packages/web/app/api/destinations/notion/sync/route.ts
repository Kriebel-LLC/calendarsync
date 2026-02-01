import { getUserSyncedEvents } from "@/lib/notion/notion-sync";
import { routeHandler } from "@/lib/route";
import { NextResponse } from "next/server";

/**
 * GET /api/destinations/notion/sync
 * Returns sync status and history for the user's Notion destination.
 */
export const GET = routeHandler(async (req, user) => {
  const syncedEvents = await getUserSyncedEvents(user.uid);

  return NextResponse.json({
    totalSynced: syncedEvents.length,
    events: syncedEvents.map((event) => ({
      id: event.id,
      externalEventId: event.externalEventId,
      notionPageId: event.notionPageId,
      title: event.eventTitle,
      calendarName: event.calendarName,
      lastSyncedAt: event.lastSyncedAt?.toISOString(),
    })),
  });
});
