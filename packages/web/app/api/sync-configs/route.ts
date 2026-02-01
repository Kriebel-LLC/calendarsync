import { db } from "@/db";
import { verifyUserHasPermissionForOrgId } from "@/lib/org";
import { routeHandler } from "@/lib/route";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import {
  syncConfigs,
  calendars,
  destinations,
  SyncInterval,
} from "shared/src/db/schema";
import { Role } from "shared/src/types/role";
import { z } from "zod";

const querySchema = z.object({
  orgId: z.string().min(1),
});

const columnMappingSchema = z
  .object({
    title: z.string().optional(),
    start: z.string().optional(),
    end: z.string().optional(),
    description: z.string().optional(),
    location: z.string().optional(),
    attendees: z.string().optional(),
    organizer: z.string().optional(),
    status: z.string().optional(),
  })
  .optional();

const filterConfigSchema = z
  .object({
    timeRangeStart: z.string().optional(),
    timeRangeEnd: z.string().optional(),
    keywords: z.array(z.string()).optional(),
  })
  .optional();

const createSchema = z.object({
  orgId: z.string().min(1),
  calendarId: z.string().min(1),
  destinationId: z.string().min(1),
  syncIntervalMinutes: z
    .number()
    .refine(
      (val) =>
        val === SyncInterval.FIFTEEN_MINUTES ||
        val === SyncInterval.HOURLY ||
        val === SyncInterval.DAILY,
      { message: "Invalid sync interval" }
    )
    .optional()
    .default(SyncInterval.HOURLY),
  columnMapping: columnMappingSchema,
  filterConfig: filterConfigSchema,
});

// Get sync configs for an org
export const GET = routeHandler(async (req, user) => {
  const url = new URL(req.url);
  const query = querySchema.safeParse({
    orgId: url.searchParams.get("orgId"),
  });

  if (!query.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { orgId } = query.data;

  const hasAccess = await verifyUserHasPermissionForOrgId(
    user.uid,
    orgId,
    Role.READ
  );
  if (!hasAccess) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const configs = await db()
    .select()
    .from(syncConfigs)
    .where(eq(syncConfigs.orgId, orgId));

  return NextResponse.json({ syncConfigs: configs });
});

// Create a new sync config
export const POST = routeHandler(async (req, user) => {
  const json = await req.json();
  const body = createSchema.safeParse(json);

  if (!body.success) {
    return NextResponse.json(
      { error: body.error.errors[0]?.message || "Invalid request" },
      { status: 400 }
    );
  }

  const {
    orgId,
    calendarId,
    destinationId,
    syncIntervalMinutes,
    columnMapping,
    filterConfig,
  } = body.data;

  const hasAccess = await verifyUserHasPermissionForOrgId(
    user.uid,
    orgId,
    Role.WRITE
  );
  if (!hasAccess) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Verify calendar and destination belong to org
  const [calendar] = await db()
    .select()
    .from(calendars)
    .where(and(eq(calendars.id, calendarId), eq(calendars.orgId, orgId)));

  if (!calendar) {
    return NextResponse.json({ error: "Calendar not found" }, { status: 404 });
  }

  const [destination] = await db()
    .select()
    .from(destinations)
    .where(
      and(eq(destinations.id, destinationId), eq(destinations.orgId, orgId))
    );

  if (!destination) {
    return NextResponse.json(
      { error: "Destination not found" },
      { status: 404 }
    );
  }

  // Check if sync config already exists
  const [existing] = await db()
    .select()
    .from(syncConfigs)
    .where(
      and(
        eq(syncConfigs.calendarId, calendarId),
        eq(syncConfigs.destinationId, destinationId)
      )
    );

  if (existing) {
    return NextResponse.json(
      { error: "Sync configuration already exists" },
      { status: 409 }
    );
  }

  const config = {
    id: nanoid(),
    orgId,
    calendarId,
    destinationId,
    syncIntervalMinutes,
    columnMapping: columnMapping ? JSON.stringify(columnMapping) : null,
    filterConfig: filterConfig ? JSON.stringify(filterConfig) : null,
    isEnabled: true,
  };

  await db().insert(syncConfigs).values(config);

  return NextResponse.json({ syncConfig: config });
});
