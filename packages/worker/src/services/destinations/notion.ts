import { CalendarEvent } from "../google-calendar";
import {
  DestinationAdapter,
  DestinationPushResult,
  transformEventToRow,
} from "./types";

const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

interface NotionPage {
  id: string;
  properties: {
    [key: string]: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [type: string]: any;
    };
  };
}

interface NotionQueryResponse {
  results: NotionPage[];
  next_cursor: string | null;
  has_more: boolean;
}

export class NotionAdapter implements DestinationAdapter {
  private accessToken: string;
  private databaseId: string;
  private existingPages: Map<string, string> = new Map(); // eventId -> pageId

  constructor(accessToken: string, databaseId: string) {
    this.accessToken = accessToken;
    this.databaseId = databaseId;
  }

  private async fetchWithAuth(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    return fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        "Notion-Version": NOTION_VERSION,
        ...options.headers,
      },
    });
  }

  async initialize(): Promise<void> {
    // Query existing pages to build index of eventIds to pageIds
    let cursor: string | null = null;

    do {
      const body: {
        filter: { property: string; rich_text: { is_not_empty: boolean } };
        start_cursor?: string;
      } = {
        filter: {
          property: "Event ID",
          rich_text: {
            is_not_empty: true,
          },
        },
      };

      if (cursor) {
        body.start_cursor = cursor;
      }

      const response = await this.fetchWithAuth(
        `${NOTION_API_BASE}/databases/${this.databaseId}/query`,
        {
          method: "POST",
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(
          `Failed to query Notion database: ${response.status} - ${error}`
        );
      }

      const data = (await response.json()) as NotionQueryResponse;

      for (const page of data.results) {
        const eventIdProp = page.properties["Event ID"];
        if (eventIdProp?.rich_text?.[0]?.text?.content) {
          this.existingPages.set(
            eventIdProp.rich_text[0].text.content,
            page.id
          );
        }
      }

      cursor = data.has_more ? data.next_cursor : null;
    } while (cursor);
  }

  private eventToNotionProperties(
    event: CalendarEvent
  ): Record<string, unknown> {
    const row = transformEventToRow(event);

    return {
      "Event ID": {
        rich_text: [{ text: { content: row.eventId } }],
      },
      Title: {
        title: [{ text: { content: row.title || "Untitled Event" } }],
      },
      Description: {
        rich_text: [
          { text: { content: (row.description || "").substring(0, 2000) } },
        ],
      },
      Location: {
        rich_text: [{ text: { content: row.location || "" } }],
      },
      "Start Time": row.startTime
        ? {
            date: { start: row.startTime },
          }
        : { date: null },
      "End Time": row.endTime
        ? {
            date: { start: row.endTime },
          }
        : { date: null },
      "All Day": {
        checkbox: row.isAllDay,
      },
      "Duration (min)": {
        number: row.duration,
      },
      Organizer: {
        rich_text: [{ text: { content: row.organizer || "" } }],
      },
      Attendees: {
        rich_text: [
          { text: { content: (row.attendees || "").substring(0, 2000) } },
        ],
      },
      Status: {
        select: row.status ? { name: row.status } : null,
      },
    };
  }

  async pushEvents(events: CalendarEvent[]): Promise<DestinationPushResult> {
    await this.initialize();

    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const event of events) {
      try {
        const properties = this.eventToNotionProperties(event);
        const existingPageId = this.existingPages.get(event.id);

        if (existingPageId) {
          // Update existing page
          const response = await this.fetchWithAuth(
            `${NOTION_API_BASE}/pages/${existingPageId}`,
            {
              method: "PATCH",
              body: JSON.stringify({ properties }),
            }
          );

          if (!response.ok) {
            const error = await response.text();
            errors.push(`Failed to update event ${event.id}: ${error}`);
          } else {
            updated++;
          }
        } else {
          // Create new page
          const response = await this.fetchWithAuth(
            `${NOTION_API_BASE}/pages`,
            {
              method: "POST",
              body: JSON.stringify({
                parent: { database_id: this.databaseId },
                properties,
              }),
            }
          );

          if (!response.ok) {
            const error = await response.text();
            errors.push(`Failed to create event ${event.id}: ${error}`);
          } else {
            const newPage = (await response.json()) as NotionPage;
            this.existingPages.set(event.id, newPage.id);
            created++;
          }
        }
      } catch (error) {
        errors.push(`Failed to process event ${event.id}: ${error}`);
      }
    }

    return { created, updated, errors };
  }

  async deleteEvents(eventIds: string[]): Promise<number> {
    await this.initialize();

    let deleted = 0;

    for (const eventId of eventIds) {
      const pageId = this.existingPages.get(eventId);
      if (!pageId) continue;

      try {
        // Archive the page (Notion's way of "deleting")
        const response = await this.fetchWithAuth(
          `${NOTION_API_BASE}/pages/${pageId}`,
          {
            method: "PATCH",
            body: JSON.stringify({ archived: true }),
          }
        );

        if (response.ok) {
          deleted++;
          this.existingPages.delete(eventId);
        } else {
          const error = await response.text();
          console.error(`Failed to delete event ${eventId}: ${error}`);
        }
      } catch (error) {
        console.error(`Failed to delete event ${eventId}: ${error}`);
      }
    }

    return deleted;
  }
}
