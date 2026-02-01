import { db } from "@/db";
import { verifyUserHasPermissionForOrgId } from "@/lib/org";
import { routeHandler } from "@/lib/route";
import { getValidAirtableAccessToken } from "@/lib/airtable";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { airtableConnections } from "shared/src/db/schema";
import { listBases, getBaseSchema } from "shared/src/airtable-api";
import { Role } from "shared/src/types/role";
import { z } from "zod";

const querySchema = z.object({
  orgId: z.string().min(1),
  connectionId: z.string().min(1),
  baseId: z.string().optional(),
});

export const GET = routeHandler(async (req, user) => {
  const url = new URL(req.url);
  const query = querySchema.safeParse({
    orgId: url.searchParams.get("orgId"),
    connectionId: url.searchParams.get("connectionId"),
    baseId: url.searchParams.get("baseId"),
  });

  if (!query.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { orgId, connectionId, baseId } = query.data;

  const hasAccess = await verifyUserHasPermissionForOrgId(
    user.uid,
    orgId,
    Role.READ
  );
  if (!hasAccess) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Get connection and verify it belongs to this org
  const [connection] = await db()
    .select()
    .from(airtableConnections)
    .where(
      and(
        eq(airtableConnections.id, connectionId),
        eq(airtableConnections.orgId, orgId)
      )
    );

  if (!connection) {
    return NextResponse.json(
      { error: "Airtable connection not found" },
      { status: 404 }
    );
  }

  // Get a valid access token (refreshes if needed)
  const accessToken = await getValidAirtableAccessToken(connection);

  if (baseId) {
    // Get specific base with tables
    try {
      const tables = await getBaseSchema(accessToken, baseId);
      return NextResponse.json({
        base: {
          id: baseId,
          tables: tables.map((table) => ({
            id: table.id,
            name: table.name,
            fields: table.fields,
          })),
        },
      });
    } catch (error) {
      console.error("Error fetching Airtable base:", error);
      return NextResponse.json(
        { error: "Failed to fetch Airtable base" },
        { status: 500 }
      );
    }
  } else {
    // List all bases
    try {
      const bases = await listBases(accessToken);
      return NextResponse.json({
        bases: bases.map((base) => ({
          id: base.id,
          name: base.name,
        })),
      });
    } catch (error) {
      console.error("Error fetching Airtable bases:", error);
      return NextResponse.json(
        { error: "Failed to fetch Airtable bases" },
        { status: 500 }
      );
    }
  }
});
