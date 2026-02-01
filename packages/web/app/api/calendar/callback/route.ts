import {
  exchangeCodeForTokens,
  getGoogleUserEmail,
  upsertCalendarConnection,
} from "@/lib/calendar";
import { routeHandler } from "@/lib/route";
import { env } from "@/web-env";
import { NextResponse } from "next/server";

interface OAuthState {
  userId: string;
  timestamp: number;
}

// Maximum age for state parameter (10 minutes)
const STATE_MAX_AGE_MS = 10 * 60 * 1000;

/**
 * GET /api/calendar/callback
 *
 * Handles the OAuth callback from Google after user grants calendar access.
 * Exchanges the authorization code for tokens and stores them securely.
 */
export const GET = routeHandler(
  async (req, user) => {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    // Handle error from Google (e.g., user denied access)
    if (error) {
      req.log.warn("Google OAuth error", { error });
      return NextResponse.redirect(
        `${env.NEXT_PUBLIC_APP_URL}/settings/calendar?error=access_denied`
      );
    }

    // Validate code is present
    if (!code) {
      req.log.warn("Missing authorization code");
      return NextResponse.redirect(
        `${env.NEXT_PUBLIC_APP_URL}/settings/calendar?error=missing_code`
      );
    }

    // Validate and parse state
    if (!stateParam) {
      req.log.warn("Missing state parameter");
      return NextResponse.redirect(
        `${env.NEXT_PUBLIC_APP_URL}/settings/calendar?error=invalid_state`
      );
    }

    let state: OAuthState;
    try {
      state = JSON.parse(Buffer.from(stateParam, "base64url").toString());
    } catch {
      req.log.warn("Invalid state format");
      return NextResponse.redirect(
        `${env.NEXT_PUBLIC_APP_URL}/settings/calendar?error=invalid_state`
      );
    }

    // Verify state is not expired
    if (Date.now() - state.timestamp > STATE_MAX_AGE_MS) {
      req.log.warn("State expired");
      return NextResponse.redirect(
        `${env.NEXT_PUBLIC_APP_URL}/settings/calendar?error=state_expired`
      );
    }

    // Verify user matches the one who initiated the flow
    if (state.userId !== user.uid) {
      req.log.warn("User ID mismatch", {
        stateUserId: state.userId,
        currentUserId: user.uid,
      });
      return NextResponse.redirect(
        `${env.NEXT_PUBLIC_APP_URL}/settings/calendar?error=user_mismatch`
      );
    }

    try {
      // Exchange authorization code for tokens
      const tokens = await exchangeCodeForTokens(code);

      if (
        !tokens.access_token ||
        !tokens.refresh_token ||
        !tokens.expiry_date
      ) {
        req.log.error("Missing required tokens from Google", { tokens });
        return NextResponse.redirect(
          `${env.NEXT_PUBLIC_APP_URL}/settings/calendar?error=token_error`
        );
      }

      // Get user's Google email
      const googleEmail = await getGoogleUserEmail(tokens.access_token);

      // Store the connection
      await upsertCalendarConnection(user.uid, {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: tokens.expiry_date,
        googleEmail,
        calendarIds: [], // User will select calendars later
      });

      req.log.info("Calendar connection created", { googleEmail });

      // Redirect to calendar settings page on success
      return NextResponse.redirect(
        `${env.NEXT_PUBLIC_APP_URL}/settings/calendar?success=connected`
      );
    } catch (err) {
      req.log.error("Failed to exchange code for tokens", { error: err });
      return NextResponse.redirect(
        `${env.NEXT_PUBLIC_APP_URL}/settings/calendar?error=exchange_failed`
      );
    }
  },
  true // Enable redirect on unauthenticated
);
