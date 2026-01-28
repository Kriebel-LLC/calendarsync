import { CalendarEvent } from "../google-calendar";

export interface DestinationAdapter {
  pushEvents(events: CalendarEvent[]): Promise<DestinationPushResult>;
  deleteEvents(eventIds: string[]): Promise<number>;
}

export interface DestinationPushResult {
  created: number;
  updated: number;
  errors: string[];
}

// Transformed event row for spreadsheet/database destinations
export interface EventRow {
  eventId: string;
  title: string;
  description: string;
  location: string;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  duration: number; // in minutes
  organizer: string;
  attendees: string;
  status: string;
  created: string;
  updated: string;
}

export function transformEventToRow(event: CalendarEvent): EventRow {
  const startDateTime = event.start?.dateTime || event.start?.date || "";
  const endDateTime = event.end?.dateTime || event.end?.date || "";
  const isAllDay = !event.start?.dateTime;

  let duration = 0;
  if (startDateTime && endDateTime) {
    const start = new Date(startDateTime);
    const end = new Date(endDateTime);
    duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
  }

  return {
    eventId: event.id,
    title: event.summary || "",
    description: event.description || "",
    location: event.location || "",
    startTime: startDateTime,
    endTime: endDateTime,
    isAllDay,
    duration,
    organizer: event.organizer?.email || event.organizer?.displayName || "",
    attendees:
      event.attendees
        ?.map((a) => a.email || a.displayName || "")
        .filter(Boolean)
        .join(", ") || "",
    status: event.status || "",
    created: event.created || "",
    updated: event.updated || "",
  };
}

export const EVENT_ROW_HEADERS = [
  "Event ID",
  "Title",
  "Description",
  "Location",
  "Start Time",
  "End Time",
  "All Day",
  "Duration (min)",
  "Organizer",
  "Attendees",
  "Status",
  "Created",
  "Updated",
];
