import { db } from "@/db";
import { verifyUserHasPermissionForOrgId } from "@/lib/org";
import { routeHandler } from "@/lib/route";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import {
  googleConnections,
  calendars,
  syncConfigs,
  destinations,
  syncedEvents,
} from "shared/src/db/schema";
import { Role } from "shared/src/types/role";
import { z } from "zod";

const routeContextSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
});

type RouteContext = z.infer<typeof routeContextSchema>;

// DELETE /api/google/connections/[id] - Disconnect a Google account
export const DELETE = routeHandler<RouteContext>(async (req, user, context) => {
  const parsed = routeContextSchema.safeParse(context);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const connectionId = parsed.data.params.id;

  // Get the connection
  const [connection] = await db()
    .select()
    .from(googleConnections)
    .where(eq(googleConnections.id, connectionId));

  if (!connection) {
    return NextResponse.json(
      { error: "Connection not found" },
      { status: 404 }
    );
  }

  // Verify user has write access to the org
  const hasAccess = await verifyUserHasPermissionForOrgId(
    user.uid,
    connection.orgId,
    Role.WRITE
  );
  if (!hasAccess) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Get all calendars for this connection
  const connectionCalendars = await db()
    .select({ id: calendars.id })
    .from(calendars)
    .where(eq(calendars.googleConnectionId, connectionId));

  const calendarIds = connectionCalendars.map((c) => c.id);

  // Delete in order: synced events -> sync configs -> calendars -> destinations -> connection
  if (calendarIds.length > 0) {
    for (const calId of calendarIds) {
      // Delete sync configs and their synced events
      const configs = await db()
        .select({ id: syncConfigs.id })
        .from(syncConfigs)
        .where(eq(syncConfigs.calendarId, calId));

      for (const config of configs) {
        await db()
          .delete(syncedEvents)
          .where(eq(syncedEvents.syncConfigId, config.id));
      }

      await db().delete(syncConfigs).where(eq(syncConfigs.calendarId, calId));
    }

    // Delete calendars
    await db()
      .delete(calendars)
      .where(eq(calendars.googleConnectionId, connectionId));
  }

  // Delete destinations linked to this Google connection
  await db()
    .delete(destinations)
    .where(eq(destinations.googleConnectionId, connectionId));

  // Delete the connection itself
  await db()
    .delete(googleConnections)
    .where(eq(googleConnections.id, connectionId));

  return NextResponse.json({ success: true });
});
