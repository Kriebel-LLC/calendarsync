import { WorkerEnv } from "../types";

// Google Calendar API types
export interface CalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  status?: string;
  created?: string;
  updated?: string;
  organizer?: {
    email?: string;
    displayName?: string;
  };
  attendees?: Array<{
    email?: string;
    displayName?: string;
    responseStatus?: string;
  }>;
  recurrence?: string[];
  recurringEventId?: string;
}

export interface CalendarEventListResponse {
  kind: string;
  etag: string;
  summary: string;
  updated: string;
  timeZone: string;
  accessRole: string;
  nextPageToken?: string;
  nextSyncToken?: string;
  items: CalendarEvent[];
}

export interface CalendarSyncResult {
  events: CalendarEvent[];
  nextSyncToken: string | null;
  deletedEventIds: string[];
}

const GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

export class GoogleCalendarClient {
  private accessToken: string;
  private env: WorkerEnv;

  constructor(accessToken: string, env: WorkerEnv) {
    this.accessToken = accessToken;
    this.env = env;
  }

  private async fetchWithAuth(url: string): Promise<Response> {
    return fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
    });
  }

  async listCalendars(): Promise<
    Array<{ id: string; summary: string; primary?: boolean }>
  > {
    const response = await this.fetchWithAuth(
      `${GOOGLE_CALENDAR_API_BASE}/users/me/calendarList`
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `Failed to list calendars: ${response.status} - ${error}`
      );
    }

    const data = (await response.json()) as {
      items: Array<{ id: string; summary: string; primary?: boolean }>;
    };
    return data.items || [];
  }

  async syncEvents(
    calendarId: string,
    syncToken?: string | null
  ): Promise<CalendarSyncResult> {
    const events: CalendarEvent[] = [];
    const deletedEventIds: string[] = [];
    let nextPageToken: string | undefined;
    let nextSyncToken: string | null = null;

    do {
      const params = new URLSearchParams();

      if (syncToken) {
        // Incremental sync - use syncToken
        params.set("syncToken", syncToken);
      } else {
        // Full sync - get events from now onwards
        params.set("timeMin", new Date().toISOString());
        params.set("maxResults", "250");
        params.set("singleEvents", "true");
        params.set("orderBy", "startTime");
      }

      if (nextPageToken) {
        params.set("pageToken", nextPageToken);
      }

      const url = `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(
        calendarId
      )}/events?${params.toString()}`;
      const response = await this.fetchWithAuth(url);

      if (response.status === 410) {
        // Sync token is invalid (Gone) - need to do a full sync
        // This happens when the sync token expires or too many changes occurred
        console.log("Sync token expired, performing full sync");
        return this.syncEvents(calendarId, null);
      }

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to sync events: ${response.status} - ${error}`);
      }

      const data = (await response.json()) as CalendarEventListResponse;

      // Separate deleted events from updated/created events
      for (const event of data.items || []) {
        if (event.status === "cancelled") {
          deletedEventIds.push(event.id);
        } else {
          events.push(event);
        }
      }

      nextPageToken = data.nextPageToken;
      nextSyncToken = data.nextSyncToken || null;
    } while (nextPageToken);

    return {
      events,
      nextSyncToken,
      deletedEventIds,
    };
  }
}

export async function refreshAccessToken(
  refreshToken: string,
  env: WorkerEnv
): Promise<{ accessToken: string; expiresIn: number }> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `Failed to refresh access token: ${response.status} - ${error}`
    );
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}
