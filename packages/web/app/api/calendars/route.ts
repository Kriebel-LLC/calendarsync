import { db } from "@/db";
import { verifyUserHasPermissionForOrgId } from "@/lib/org";
import { checkCanAddCalendar } from "@/lib/plan-gating";
import { routeHandler } from "@/lib/route";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { calendars, googleConnections } from "shared/src/db/schema";
import { Role } from "shared/src/types/role";
import { z } from "zod";

const querySchema = z.object({
  orgId: z.string().min(1),
});

const createSchema = z.object({
  orgId: z.string().min(1),
  googleConnectionId: z.string().min(1),
  googleCalendarId: z.string().min(1),
  name: z.string().min(1),
  color: z.string().optional(),
});

// Get calendars for an org
export const GET = routeHandler(async (req, user) => {
  const url = new URL(req.url);
  const query = querySchema.safeParse({
    orgId: url.searchParams.get("orgId"),
  });

  if (!query.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { orgId } = query.data;

  const hasAccess = await verifyUserHasPermissionForOrgId(user.uid, orgId, Role.READ);
  if (!hasAccess) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const orgCalendars = await db()
    .select()
    .from(calendars)
    .where(eq(calendars.orgId, orgId));

  return NextResponse.json({ calendars: orgCalendars });
});

// Add a calendar to sync
export const POST = routeHandler(async (req, user) => {
  const json = await req.json();
  const body = createSchema.safeParse(json);

  if (!body.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { orgId, googleConnectionId, googleCalendarId, name, color } = body.data;

  const hasAccess = await verifyUserHasPermissionForOrgId(user.uid, orgId, Role.WRITE);
  if (!hasAccess) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Check plan limits
  const canAdd = await checkCanAddCalendar(orgId);
  if (!canAdd.allowed) {
    return NextResponse.json({ error: canAdd.reason }, { status: 403 });
  }

  // Verify connection belongs to org
  const [connection] = await db()
    .select()
    .from(googleConnections)
    .where(
      and(
        eq(googleConnections.id, googleConnectionId),
        eq(googleConnections.orgId, orgId)
      )
    );

  if (!connection) {
    return NextResponse.json(
      { error: "Google connection not found" },
      { status: 404 }
    );
  }

  // Check if calendar already exists
  const [existing] = await db()
    .select()
    .from(calendars)
    .where(
      and(
        eq(calendars.orgId, orgId),
        eq(calendars.googleCalendarId, googleCalendarId)
      )
    );

  if (existing) {
    return NextResponse.json(
      { error: "Calendar already connected" },
      { status: 409 }
    );
  }

  const calendar = {
    id: nanoid(),
    orgId,
    googleConnectionId,
    googleCalendarId,
    name,
    color: color || null,
    isEnabled: true,
  };

  await db().insert(calendars).values(calendar);

  return NextResponse.json({ calendar });
});
