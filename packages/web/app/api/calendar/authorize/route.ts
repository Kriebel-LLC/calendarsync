import { getAuthorizationUrl } from "@/lib/calendar";
import { routeHandler } from "@/lib/route";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";

/**
 * GET /api/calendar/authorize
 *
 * Initiates the Google Calendar OAuth flow by redirecting to Google's consent screen.
 * The user ID is encoded in the state parameter to verify on callback.
 */
export const GET = routeHandler(async (req, user) => {
  // Create state with user ID and nonce for CSRF protection
  // The nonce adds randomness to make state unguessable
  const state = Buffer.from(
    JSON.stringify({
      userId: user.uid,
      timestamp: Date.now(),
      nonce: nanoid(),
    })
  ).toString("base64url");

  const authUrl = getAuthorizationUrl(state);

  return NextResponse.redirect(authUrl);
});
