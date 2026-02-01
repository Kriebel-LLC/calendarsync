import {
  deleteNotionConnection,
  getNotionConnectionInfo,
  updateSelectedDatabase,
} from "@/lib/notion/notion-connection";
import { routeHandler } from "@/lib/route";
import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * GET /api/destinations/notion/connection
 * Returns the current user's Notion connection status and info.
 */
export const GET = routeHandler(async (req, user) => {
  const connectionInfo = await getNotionConnectionInfo(user.uid);
  return NextResponse.json(connectionInfo);
});

const updateDatabaseSchema = z.object({
  databaseId: z.string().min(1),
  databaseName: z.string().min(1),
});

/**
 * PATCH /api/destinations/notion/connection
 * Updates the selected database for the user's Notion connection.
 */
export const PATCH = routeHandler(async (req, user) => {
  const connectionInfo = await getNotionConnectionInfo(user.uid);

  if (!connectionInfo.connected) {
    return NextResponse.json(
      { error: "No Notion connection found" },
      { status: 404 }
    );
  }

  const body = await req.json();
  const parsed = updateDatabaseSchema.safeParse(body);

  if (!parsed.success) {
    return new NextResponse(null, { status: 400 });
  }

  await updateSelectedDatabase(
    user.uid,
    parsed.data.databaseId,
    parsed.data.databaseName
  );

  return NextResponse.json({ success: true });
});

/**
 * DELETE /api/destinations/notion/connection
 * Removes the user's Notion connection.
 */
export const DELETE = routeHandler(async (req, user) => {
  await deleteNotionConnection(user.uid);
  return NextResponse.json({ success: true });
});
