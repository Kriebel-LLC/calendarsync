import { describe, it, expect } from "vitest";
import {
  transformEventToRow,
  EVENT_ROW_HEADERS,
} from "../services/destinations/types";
import { CalendarEvent } from "../services/google-calendar";

describe("transformEventToRow", () => {
  it("should transform a full event correctly", () => {
    const event: CalendarEvent = {
      id: "event123",
      summary: "Team Meeting",
      description: "Weekly sync meeting",
      location: "Conference Room A",
      start: { dateTime: "2024-01-15T10:00:00Z" },
      end: { dateTime: "2024-01-15T11:00:00Z" },
      status: "confirmed",
      created: "2024-01-10T08:00:00Z",
      updated: "2024-01-14T09:00:00Z",
      organizer: { email: "organizer@example.com", displayName: "John Doe" },
      attendees: [
        { email: "alice@example.com", responseStatus: "accepted" },
        { email: "bob@example.com", responseStatus: "tentative" },
      ],
    };

    const row = transformEventToRow(event);

    expect(row.eventId).toBe("event123");
    expect(row.title).toBe("Team Meeting");
    expect(row.description).toBe("Weekly sync meeting");
    expect(row.location).toBe("Conference Room A");
    expect(row.startTime).toBe("2024-01-15T10:00:00Z");
    expect(row.endTime).toBe("2024-01-15T11:00:00Z");
    expect(row.isAllDay).toBe(false);
    expect(row.duration).toBe(60);
    expect(row.organizer).toBe("organizer@example.com");
    expect(row.attendees).toBe("alice@example.com, bob@example.com");
    expect(row.status).toBe("confirmed");
    expect(row.created).toBe("2024-01-10T08:00:00Z");
    expect(row.updated).toBe("2024-01-14T09:00:00Z");
  });

  it("should handle all-day events", () => {
    const event: CalendarEvent = {
      id: "allday123",
      summary: "Company Holiday",
      start: { date: "2024-01-01" },
      end: { date: "2024-01-02" },
    };

    const row = transformEventToRow(event);

    expect(row.isAllDay).toBe(true);
    expect(row.startTime).toBe("2024-01-01");
    expect(row.endTime).toBe("2024-01-02");
    expect(row.duration).toBe(1440); // 24 hours in minutes
  });

  it("should handle missing optional fields", () => {
    const event: CalendarEvent = {
      id: "minimal123",
    };

    const row = transformEventToRow(event);

    expect(row.eventId).toBe("minimal123");
    expect(row.title).toBe("");
    expect(row.description).toBe("");
    expect(row.location).toBe("");
    expect(row.startTime).toBe("");
    expect(row.endTime).toBe("");
    expect(row.duration).toBe(0);
    expect(row.organizer).toBe("");
    expect(row.attendees).toBe("");
    expect(row.status).toBe("");
  });

  it("should use displayName as fallback for organizer", () => {
    const event: CalendarEvent = {
      id: "event456",
      organizer: { displayName: "Jane Smith" },
    };

    const row = transformEventToRow(event);

    expect(row.organizer).toBe("Jane Smith");
  });
});

describe("EVENT_ROW_HEADERS", () => {
  it("should have all expected headers", () => {
    expect(EVENT_ROW_HEADERS).toEqual([
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
    ]);
  });

  it("should have 13 columns", () => {
    expect(EVENT_ROW_HEADERS).toHaveLength(13);
  });
});
