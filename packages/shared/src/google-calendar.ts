// Google Calendar API v3 client

export interface GoogleCalendar {
  id: string;
  summary: string;
  description?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  primary?: boolean;
  accessRole: "freeBusyReader" | "reader" | "writer" | "owner";
}

export interface GoogleCalendarListResponse {
  kind: string;
  etag: string;
  nextPageToken?: string;
  nextSyncToken?: string;
  items: GoogleCalendar[];
}

export interface GoogleCalendarEventDateTime {
  date?: string; // For all-day events (YYYY-MM-DD)
  dateTime?: string; // For timed events (RFC 3339)
  timeZone?: string;
}

export interface GoogleCalendarEventAttendee {
  email: string;
  displayName?: string;
  responseStatus?: "needsAction" | "declined" | "tentative" | "accepted";
  self?: boolean;
  organizer?: boolean;
}

export interface GoogleCalendarEvent {
  id: string;
  status: "confirmed" | "tentative" | "cancelled";
  htmlLink?: string;
  created?: string;
  updated?: string;
  summary?: string;
  description?: string;
  location?: string;
  start: GoogleCalendarEventDateTime;
  end: GoogleCalendarEventDateTime;
  attendees?: GoogleCalendarEventAttendee[];
  organizer?: {
    email: string;
    displayName?: string;
    self?: boolean;
  };
  recurringEventId?: string;
}

export interface GoogleCalendarEventsResponse {
  kind: string;
  etag: string;
  summary: string;
  updated: string;
  timeZone: string;
  accessRole: string;
  nextPageToken?: string;
  nextSyncToken?: string;
  items: GoogleCalendarEvent[];
}

const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

export async function listCalendars(accessToken: string): Promise<GoogleCalendar[]> {
  const calendars: GoogleCalendar[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({ minAccessRole: "reader" });
    if (pageToken) {
      params.set("pageToken", pageToken);
    }

    const response = await fetch(`${CALENDAR_API_BASE}/users/me/calendarList?${params}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to list calendars: ${response.statusText}`);
    }

    const data: GoogleCalendarListResponse = await response.json();
    calendars.push(...data.items);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return calendars;
}

export interface ListEventsOptions {
  calendarId: string;
  accessToken: string;
  syncToken?: string;
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
}

export interface ListEventsResult {
  events: GoogleCalendarEvent[];
  nextSyncToken?: string;
  fullSyncRequired: boolean;
}

export async function listEvents(options: ListEventsOptions): Promise<ListEventsResult> {
  const { calendarId, accessToken, syncToken, timeMin, timeMax, maxResults = 250 } = options;

  const events: GoogleCalendarEvent[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;
  let fullSyncRequired = false;

  do {
    const params = new URLSearchParams({
      maxResults: maxResults.toString(),
      singleEvents: "true",
      orderBy: "startTime",
    });

    if (syncToken) {
      params.set("syncToken", syncToken);
    } else {
      // Only set time bounds for initial sync (not incremental)
      if (timeMin) params.set("timeMin", timeMin);
      if (timeMax) params.set("timeMax", timeMax);
    }

    if (pageToken) {
      params.set("pageToken", pageToken);
    }

    const response = await fetch(
      `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (response.status === 410) {
      // Sync token expired - need full sync
      fullSyncRequired = true;
      break;
    }

    if (!response.ok) {
      throw new Error(`Failed to list events: ${response.statusText}`);
    }

    const data: GoogleCalendarEventsResponse = await response.json();
    events.push(...data.items);
    pageToken = data.nextPageToken;
    nextSyncToken = data.nextSyncToken;
  } while (pageToken);

  return { events, nextSyncToken, fullSyncRequired };
}
