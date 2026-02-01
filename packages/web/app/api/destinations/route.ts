import { db } from "@/db";
import { verifyUserHasPermissionForOrgId } from "@/lib/org";
import { checkCanAddDestination } from "@/lib/plan-gating";
import { routeHandler } from "@/lib/route";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import {
  destinations,
  DestinationType,
  googleConnections,
} from "shared/src/db/schema";
import { Role } from "shared/src/types/role";
import { z } from "zod";

const querySchema = z.object({
  orgId: z.string().min(1),
});

const createSchema = z.object({
  orgId: z.string().min(1),
  googleConnectionId: z.string().min(1),
  name: z.string().min(1),
  spreadsheetId: z.string().min(1),
  spreadsheetName: z.string().min(1),
  sheetId: z.number(),
  sheetName: z.string().min(1),
});

// Get destinations for an org
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

  const orgDestinations = await db()
    .select()
    .from(destinations)
    .where(eq(destinations.orgId, orgId));

  return NextResponse.json({ destinations: orgDestinations });
});

// Create a new destination
export const POST = routeHandler(async (req, user) => {
  const json = await req.json();
  const body = createSchema.safeParse(json);

  if (!body.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const {
    orgId,
    googleConnectionId,
    name,
    spreadsheetId,
    spreadsheetName,
    sheetId,
    sheetName,
  } = body.data;

  const hasAccess = await verifyUserHasPermissionForOrgId(user.uid, orgId, Role.WRITE);
  if (!hasAccess) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Check plan limits
  const canAdd = await checkCanAddDestination(orgId);
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

  const destination = {
    id: nanoid(),
    orgId,
    googleConnectionId,
    type: DestinationType.GOOGLE_SHEETS,
    name,
    spreadsheetId,
    spreadsheetName,
    sheetId,
    sheetName,
    isEnabled: true,
  };

  await db().insert(destinations).values(destination);

  return NextResponse.json({ destination });
});
