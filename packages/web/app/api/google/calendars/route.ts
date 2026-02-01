import { db } from "@/db";
import { getValidAccessToken } from "@/lib/google";
import { verifyUserHasPermissionForOrgId } from "@/lib/org";
import { routeHandler } from "@/lib/route";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { googleConnections } from "shared/src/db/schema";
import { listCalendars } from "shared/src/google-calendar";
import { Role } from "shared/src/types/role";
import { z } from "zod";

const querySchema = z.object({
  orgId: z.string().min(1),
  connectionId: z.string().min(1),
});

export const GET = routeHandler(async (req, user) => {
  const url = new URL(req.url);
  const query = querySchema.safeParse({
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

  // Get connection
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
    const calendars = await listCalendars(accessToken);

    return NextResponse.json({
      calendars: calendars.map((cal) => ({
        id: cal.id,
        name: cal.summary,
        description: cal.description,
        color: cal.backgroundColor,
        primary: cal.primary,
        accessRole: cal.accessRole,
      })),
    });
  } catch (err) {
    console.error("Failed to list calendars:", err);
    return NextResponse.json(
      { error: "Failed to fetch calendars from Google" },
      { status: 500 }
    );
  }
});
