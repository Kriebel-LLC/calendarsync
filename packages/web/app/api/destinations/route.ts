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
  airtableConnections,
} from "shared/src/db/schema";
import { Role } from "shared/src/types/role";
import { z } from "zod";

const querySchema = z.object({
  orgId: z.string().min(1),
});

// Schema for Google Sheets destination
const createGoogleSheetsSchema = z.object({
  orgId: z.string().min(1),
  type: z.literal(DestinationType.GOOGLE_SHEETS),
  googleConnectionId: z.string().min(1),
  name: z.string().min(1),
  spreadsheetId: z.string().min(1),
  spreadsheetName: z.string().min(1),
  sheetId: z.number(),
  sheetName: z.string().min(1),
});

// Schema for Airtable destination
const createAirtableSchema = z.object({
  orgId: z.string().min(1),
  type: z.literal(DestinationType.AIRTABLE),
  airtableConnectionId: z.string().min(1),
  name: z.string().min(1),
  airtableBaseId: z.string().min(1),
  airtableBaseName: z.string().min(1),
  airtableTableId: z.string().min(1),
  airtableTableName: z.string().min(1),
});

// Legacy schema (backwards compatible - assumes Google Sheets)
const createLegacySchema = z.object({
  orgId: z.string().min(1),
  googleConnectionId: z.string().min(1),
  name: z.string().min(1),
  spreadsheetId: z.string().min(1),
  spreadsheetName: z.string().min(1),
  sheetId: z.number(),
  sheetName: z.string().min(1),
});

const createSchema = z.union([
  createGoogleSheetsSchema,
  createAirtableSchema,
  createLegacySchema,
]);

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

  const hasAccess = await verifyUserHasPermissionForOrgId(
    user.uid,
    orgId,
    Role.READ
  );
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

  const data = body.data;

  // Determine the type
  const destinationType =
    "type" in data ? data.type : DestinationType.GOOGLE_SHEETS;

  const hasAccess = await verifyUserHasPermissionForOrgId(
    user.uid,
    data.orgId,
    Role.WRITE
  );
  if (!hasAccess) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Check plan limits
  const canAdd = await checkCanAddDestination(data.orgId);
  if (!canAdd.allowed) {
    return NextResponse.json({ error: canAdd.reason }, { status: 403 });
  }

  if (destinationType === DestinationType.AIRTABLE) {
    // Airtable destination
    const airtableData = data as z.infer<typeof createAirtableSchema>;

    // Verify Airtable connection belongs to org
    const [connection] = await db()
      .select()
      .from(airtableConnections)
      .where(
        and(
          eq(airtableConnections.id, airtableData.airtableConnectionId),
          eq(airtableConnections.orgId, airtableData.orgId)
        )
      );

    if (!connection) {
      return NextResponse.json(
        { error: "Airtable connection not found" },
        { status: 404 }
      );
    }

    const destination = {
      id: nanoid(),
      orgId: airtableData.orgId,
      airtableConnectionId: airtableData.airtableConnectionId,
      type: DestinationType.AIRTABLE,
      name: airtableData.name,
      airtableBaseId: airtableData.airtableBaseId,
      airtableBaseName: airtableData.airtableBaseName,
      airtableTableId: airtableData.airtableTableId,
      airtableTableName: airtableData.airtableTableName,
      isEnabled: true,
    };

    await db().insert(destinations).values(destination);
    return NextResponse.json({ destination });
  } else {
    // Google Sheets destination (default)
    const googleData = "googleConnectionId" in data ? data : null;

    if (!googleData) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Verify Google connection belongs to org
    const [connection] = await db()
      .select()
      .from(googleConnections)
      .where(
        and(
          eq(googleConnections.id, googleData.googleConnectionId),
          eq(googleConnections.orgId, googleData.orgId)
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
      orgId: googleData.orgId,
      googleConnectionId: googleData.googleConnectionId,
      type: DestinationType.GOOGLE_SHEETS,
      name: googleData.name,
      spreadsheetId: googleData.spreadsheetId,
      spreadsheetName: googleData.spreadsheetName,
      sheetId: googleData.sheetId,
      sheetName: googleData.sheetName,
      isEnabled: true,
    };

    await db().insert(destinations).values(destination);
    return NextResponse.json({ destination });
  }
});
