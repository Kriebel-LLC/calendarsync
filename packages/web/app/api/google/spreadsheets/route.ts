import { db } from "@/db";
import { getValidAccessToken } from "@/lib/google";
import { verifyUserHasPermissionForOrgId } from "@/lib/org";
import { routeHandler } from "@/lib/route";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { googleConnections } from "shared/src/db/schema";
import { listSpreadsheets, getSpreadsheet } from "shared/src/google-sheets";
import { Role } from "shared/src/types/role";
import { z } from "zod";

const listQuerySchema = z.object({
  orgId: z.string().min(1),
  connectionId: z.string().min(1),
});

const getQuerySchema = z.object({
  orgId: z.string().min(1),
  connectionId: z.string().min(1),
  spreadsheetId: z.string().min(1),
});

export const GET = routeHandler(async (req, user) => {
  const url = new URL(req.url);
  const spreadsheetId = url.searchParams.get("spreadsheetId");

  // If spreadsheetId is provided, get details for that specific spreadsheet
  if (spreadsheetId) {
    const query = getQuerySchema.safeParse({
      orgId: url.searchParams.get("orgId"),
      connectionId: url.searchParams.get("connectionId"),
      spreadsheetId,
    });

    if (!query.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { orgId, connectionId } = query.data;

    const hasAccess = await verifyUserHasPermissionForOrgId(
      user.uid,
      orgId,
      Role.READ
    );
    if (!hasAccess) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const [connection] = await db()
      .select()
      .from(googleConnections)
      .where(
        and(
          eq(googleConnections.id, connectionId),
          eq(googleConnections.orgId, orgId)
        )
      );

    if (!connection) {
      return NextResponse.json(
        { error: "Connection not found" },
        { status: 404 }
      );
    }

    try {
      const accessToken = await getValidAccessToken(connection);
      const spreadsheet = await getSpreadsheet(accessToken, spreadsheetId);

      return NextResponse.json({
        spreadsheet: {
          id: spreadsheet.spreadsheetId,
          name: spreadsheet.properties.title,
          sheets: spreadsheet.sheets.map((sheet) => ({
            id: sheet.properties.sheetId,
            name: sheet.properties.title,
            index: sheet.properties.index,
          })),
        },
      });
    } catch (err) {
      console.error("Failed to get spreadsheet:", err);
      return NextResponse.json(
        { error: "Failed to fetch spreadsheet details" },
        { status: 500 }
      );
    }
  }

  // Otherwise, list all spreadsheets
  const query = listQuerySchema.safeParse({
    orgId: url.searchParams.get("orgId"),
    connectionId: url.searchParams.get("connectionId"),
  });

  if (!query.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { orgId, connectionId } = query.data;

  const hasAccess = await verifyUserHasPermissionForOrgId(
    user.uid,
    orgId,
    Role.READ
  );
  if (!hasAccess) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const [connection] = await db()
    .select()
    .from(googleConnections)
    .where(
      and(
        eq(googleConnections.id, connectionId),
        eq(googleConnections.orgId, orgId)
      )
    );

  if (!connection) {
    return NextResponse.json(
      { error: "Connection not found" },
      { status: 404 }
    );
  }

  try {
    const accessToken = await getValidAccessToken(connection);
    const spreadsheets = await listSpreadsheets(accessToken);

    return NextResponse.json({
      spreadsheets: spreadsheets.map((sheet) => ({
        id: sheet.id,
        name: sheet.name,
      })),
    });
  } catch (err) {
    console.error("Failed to list spreadsheets:", err);
    return NextResponse.json(
      { error: "Failed to fetch spreadsheets from Google" },
      { status: 500 }
    );
  }
});
