import {
  deleteCalendarConnection,
  getCalendarConnection,
  getCalendarTokens,
  listCalendars,
  updateCalendarIds,
} from "@/lib/calendar";
import { routeHandler } from "@/lib/route";
import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * GET /api/calendar/connection
 *
 * Gets the current user's calendar connection status and available calendars.
 */
export const GET = routeHandler(async (req, user) => {
  const connection = await getCalendarConnection(user.uid);

  if (!connection) {
    return NextResponse.json({ connected: false });
  }

  // Get tokens (will auto-refresh if expired)
  const tokens = await getCalendarTokens(user.uid);

  if (!tokens) {
    return NextResponse.json({ connected: false });
  }

  // Fetch available calendars from Google
  let calendars;
  let calendarFetchError = false;
  try {
    calendars = await listCalendars(tokens.accessToken);
  } catch (err) {
    req.log.error("Failed to list calendars", { error: err });
    calendars = [];
    calendarFetchError = true;
  }

  return NextResponse.json({
    connected: true,
    googleEmail: tokens.googleEmail,
    selectedCalendarIds: tokens.calendarIds,
    availableCalendars: calendars.map((cal) => ({
      id: cal.id,
      summary: cal.summary,
      primary: cal.primary,
      backgroundColor: cal.backgroundColor,
    })),
    // Indicates if calendar list fetch failed so UI can show appropriate message
    calendarFetchError,
  });
});

const updateCalendarsSchema = z.object({
  calendarIds: z.array(z.string()),
});

/**
 * PATCH /api/calendar/connection
 *
 * Updates the selected calendar IDs for the current user's connection.
 */
export const PATCH = routeHandler(async (req, user) => {
  const body = await req.json();

  const parsed = updateCalendarsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const connection = await getCalendarConnection(user.uid);
  if (!connection) {
    return NextResponse.json(
      { error: "No calendar connection found" },
      { status: 404 }
    );
  }

  await updateCalendarIds(user.uid, parsed.data.calendarIds);

  return NextResponse.json({ success: true });
});

/**
 * DELETE /api/calendar/connection
 *
 * Disconnects the current user's Google Calendar.
 */
export const DELETE = routeHandler(async (req, user) => {
  await deleteCalendarConnection(user.uid);
  return NextResponse.json({ success: true });
});
