/**
 * Notion API utilities for interacting with Notion databases and pages.
 */

const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_API_VERSION = "2022-06-28";

export interface NotionDatabase {
  id: string;
  title: Array<{ plain_text: string }>;
  icon?: {
    type: string;
    emoji?: string;
    external?: { url: string };
  };
  properties: Record<string, NotionPropertySchema>;
}

export interface NotionPropertySchema {
  id: string;
  name: string;
  type: string;
}

export interface NotionSearchResult {
  object: string;
  results: NotionDatabase[];
  has_more: boolean;
  next_cursor?: string;
}

export interface NotionPage {
  id: string;
  object: string;
  created_time: string;
  last_edited_time: string;
  properties: Record<string, NotionPropertyValue>;
}

export type NotionPropertyValue =
  | { type: "title"; title: Array<{ text: { content: string } }> }
  | { type: "rich_text"; rich_text: Array<{ text: { content: string } }> }
  | { type: "number"; number: number | null }
  | { type: "select"; select: { name: string } | null }
  | { type: "multi_select"; multi_select: Array<{ name: string }> }
  | { type: "date"; date: { start: string; end?: string } | null }
  | { type: "checkbox"; checkbox: boolean }
  | { type: "url"; url: string | null };

/**
 * Makes an authenticated request to the Notion API.
 */
async function notionRequest<T>(
  accessToken: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${NOTION_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Notion-Version": NOTION_API_VERSION,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Notion API error: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Searches for databases the user has shared with the integration.
 */
export async function searchDatabases(
  accessToken: string
): Promise<NotionDatabase[]> {
  const result = await notionRequest<NotionSearchResult>(
    accessToken,
    "/search",
    {
      method: "POST",
      body: JSON.stringify({
        filter: { value: "database", property: "object" },
        page_size: 100,
      }),
    }
  );

  return result.results;
}

/**
 * Gets a specific database by ID.
 */
export async function getDatabase(
  accessToken: string,
  databaseId: string
): Promise<NotionDatabase> {
  return notionRequest<NotionDatabase>(accessToken, `/databases/${databaseId}`);
}

/**
 * Queries a database to find existing pages.
 */
export async function queryDatabase(
  accessToken: string,
  databaseId: string,
  filter?: object,
  sorts?: object[]
): Promise<{ results: NotionPage[]; has_more: boolean; next_cursor?: string }> {
  return notionRequest(accessToken, `/databases/${databaseId}/query`, {
    method: "POST",
    body: JSON.stringify({
      ...(filter && { filter }),
      ...(sorts && { sorts }),
      page_size: 100,
    }),
  });
}

/**
 * Creates a new page in a database.
 */
export async function createPage(
  accessToken: string,
  databaseId: string,
  properties: Record<string, NotionPropertyValue>
): Promise<NotionPage> {
  return notionRequest<NotionPage>(accessToken, "/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { database_id: databaseId },
      properties,
    }),
  });
}

/**
 * Updates an existing page's properties.
 */
export async function updatePage(
  accessToken: string,
  pageId: string,
  properties: Record<string, NotionPropertyValue>
): Promise<NotionPage> {
  return notionRequest<NotionPage>(accessToken, `/pages/${pageId}`, {
    method: "PATCH",
    body: JSON.stringify({ properties }),
  });
}

/**
 * Archives (soft-deletes) a page.
 */
export async function archivePage(
  accessToken: string,
  pageId: string
): Promise<NotionPage> {
  return notionRequest<NotionPage>(accessToken, `/pages/${pageId}`, {
    method: "PATCH",
    body: JSON.stringify({ archived: true }),
  });
}
