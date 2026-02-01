import { searchDatabases, NotionDatabase } from "@/lib/notion/notion-api";
import { getNotionAccessToken } from "@/lib/notion/notion-connection";
import { routeHandler } from "@/lib/route";
import { NextResponse } from "next/server";

export interface DatabaseInfo {
  id: string;
  title: string;
  icon?: string;
}

/**
 * GET /api/destinations/notion/databases
 * Lists all databases the user has shared with the Notion integration.
 */
export const GET = routeHandler(async (req, user) => {
  const accessToken = await getNotionAccessToken(user.uid);

  if (!accessToken) {
    return NextResponse.json(
      { error: "No Notion connection found" },
      { status: 404 }
    );
  }

  try {
    const databases = await searchDatabases(accessToken);

    const databaseList: DatabaseInfo[] = databases.map(
      (db: NotionDatabase) => ({
        id: db.id,
        title:
          db.title.map((t) => t.plain_text).join("") || "Untitled Database",
        icon: db.icon?.emoji || db.icon?.external?.url,
      })
    );

    return NextResponse.json({ databases: databaseList });
  } catch (err) {
    req.log.error("Failed to fetch Notion databases", { error: err });
    return NextResponse.json(
      { error: "Failed to fetch databases from Notion" },
      { status: 500 }
    );
  }
});
