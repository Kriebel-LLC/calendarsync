import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GoogleCalendarClient, CalendarEvent } from "../services/google-calendar";
import { WorkerEnv } from "../types";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("GoogleCalendarClient", () => {
  const mockEnv: WorkerEnv = {
    GOOGLE_CLIENT_ID: "test-client-id",
    GOOGLE_CLIENT_SECRET: "test-client-secret",
    DB: {} as D1Database,
    QUEUE: {} as Queue<unknown>,
  } as WorkerEnv;

  let client: GoogleCalendarClient;

  beforeEach(() => {
    client = new GoogleCalendarClient("test-access-token", mockEnv);
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("listCalendars", () => {
    it("should return list of calendars", async () => {
      const mockCalendars = [
        { id: "primary", summary: "Primary Calendar", primary: true },
        { id: "work@example.com", summary: "Work Calendar" },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: mockCalendars }),
      });

      const calendars = await client.listCalendars();

      expect(calendars).toEqual(mockCalendars);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://www.googleapis.com/calendar/v3/users/me/calendarList",
        expect.objectContaining({
          headers: {
            Authorization: "Bearer test-access-token",
            "Content-Type": "application/json",
          },
        })
      );
    });

    it("should throw error on failed request", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      });

      await expect(client.listCalendars()).rejects.toThrow(
        "Failed to list calendars: 401 - Unauthorized"
      );
    });
  });

  describe("syncEvents", () => {
    it("should perform full sync when no syncToken provided", async () => {
      const mockEvents: CalendarEvent[] = [
        {
          id: "event1",
          summary: "Test Event",
          start: { dateTime: "2024-01-01T10:00:00Z" },
          end: { dateTime: "2024-01-01T11:00:00Z" },
          status: "confirmed",
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: mockEvents,
          nextSyncToken: "new-sync-token",
        }),
      });

      const result = await client.syncEvents("primary", null);

      expect(result.events).toEqual(mockEvents);
      expect(result.nextSyncToken).toBe("new-sync-token");
      expect(result.deletedEventIds).toEqual([]);

      // Verify full sync parameters were used
      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain("timeMin=");
      expect(callUrl).toContain("maxResults=250");
      expect(callUrl).toContain("singleEvents=true");
    });

    it("should perform incremental sync when syncToken provided", async () => {
      const mockEvents: CalendarEvent[] = [
        {
          id: "event1",
          summary: "Updated Event",
          status: "confirmed",
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: mockEvents,
          nextSyncToken: "new-sync-token-2",
        }),
      });

      const result = await client.syncEvents("primary", "old-sync-token");

      expect(result.events).toEqual(mockEvents);
      expect(result.nextSyncToken).toBe("new-sync-token-2");

      // Verify syncToken was used
      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain("syncToken=old-sync-token");
    });

    it("should separate deleted events from updated events", async () => {
      const mockEvents: CalendarEvent[] = [
        { id: "event1", summary: "Active Event", status: "confirmed" },
        { id: "event2", status: "cancelled" },
        { id: "event3", status: "cancelled" },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: mockEvents,
          nextSyncToken: "token",
        }),
      });

      const result = await client.syncEvents("primary", "sync-token");

      expect(result.events).toHaveLength(1);
      expect(result.events[0].id).toBe("event1");
      expect(result.deletedEventIds).toEqual(["event2", "event3"]);
    });

    it("should perform full sync when syncToken is expired (410 Gone)", async () => {
      // First call returns 410
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 410,
      });

      // Second call (full sync) returns events
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [{ id: "event1", summary: "Event", status: "confirmed" }],
          nextSyncToken: "fresh-token",
        }),
      });

      const result = await client.syncEvents("primary", "expired-token");

      expect(result.nextSyncToken).toBe("fresh-token");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should handle pagination", async () => {
      // First page
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [{ id: "event1", summary: "Event 1", status: "confirmed" }],
          nextPageToken: "page2",
        }),
      });

      // Second page
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [{ id: "event2", summary: "Event 2", status: "confirmed" }],
          nextSyncToken: "final-token",
        }),
      });

      const result = await client.syncEvents("primary", null);

      expect(result.events).toHaveLength(2);
      expect(result.nextSyncToken).toBe("final-token");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
