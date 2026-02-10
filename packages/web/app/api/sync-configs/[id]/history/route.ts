import { db } from "@/db";
import { verifyUserHasPermissionForOrgId } from "@/lib/org";
import { routeHandler } from "@/lib/route";
import { eq, and, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { syncConfigs, syncedEvents } from "shared/src/db/schema";
import { Role } from "shared/src/types/role";
import { z } from "zod";

const routeContextSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
});

type RouteContext = z.infer<typeof routeContextSchema>;

// GET /api/sync-configs/[id]/history - Get sync history for a sync config
export const GET = routeHandler<RouteContext>(async (req, user, context) => {
  const parsed = routeContextSchema.safeParse(context);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const syncConfigId = parsed.data.params.id;

  // Get the sync config
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
    Role.READ
  );
  if (!hasAccess) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Get synced events for this config, ordered by last synced time
  const events = await db()
    .select()
    .from(syncedEvents)
    .where(eq(syncedEvents.syncConfigId, syncConfigId))
    .orderBy(desc(syncedEvents.lastSyncedAt))
    .limit(100);

  return NextResponse.json({
    syncConfig: {
      id: config.id,
      lastSyncAt: config.lastSyncAt?.toISOString() ?? null,
      isEnabled: config.isEnabled,
    },
    events: events.map((event) => ({
      id: event.id,
      externalEventId: event.externalEventId,
      eventTitle: event.eventTitle,
      calendarName: event.calendarName,
      eventStart: event.eventStart?.toISOString() ?? null,
      eventEnd: event.eventEnd?.toISOString() ?? null,
      status: event.status,
      notionPageId: event.notionPageId,
      airtableRecordId: event.airtableRecordId,
      sheetRowNumber: event.sheetRowNumber,
      lastSyncedAt: event.lastSyncedAt?.toISOString() ?? null,
    })),
    totalEvents: events.length,
  });
});
