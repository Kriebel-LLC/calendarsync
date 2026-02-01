/**
 * Google Calendar OAuth utilities
 */
import { env } from "@/web-env";
import { google } from "googleapis";

// OAuth2 scopes for Google Calendar
export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

/**
 * Creates a Google OAuth2 client
 */
export function createOAuth2Client(redirectUri?: string) {
  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    redirectUri || `${env.NEXT_PUBLIC_APP_URL}/api/calendar/callback`
  );
}

/**
 * Generates the Google OAuth authorization URL
 */
export function getAuthorizationUrl(state?: string): string {
  const oauth2Client = createOAuth2Client();

  return oauth2Client.generateAuthUrl({
    access_type: "offline", // Get refresh token
    scope: GOOGLE_CALENDAR_SCOPES,
    prompt: "consent", // Always show consent screen to ensure refresh token
    state,
  });
}

/**
 * Exchanges an authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string) {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

/**
 * Refreshes an access token using a refresh token
 */
export async function refreshAccessToken(refreshToken: string) {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const { credentials } = await oauth2Client.refreshAccessToken();
  return credentials;
}

/**
 * Gets the user's email from Google using the access token
 */
export async function getGoogleUserEmail(accessToken: string): Promise<string> {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });

  const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
  const { data } = await oauth2.userinfo.get();

  if (!data.email) {
    throw new Error("Could not get user email from Google");
  }

  return data.email;
}

/**
 * Lists the user's calendars
 */
export async function listCalendars(accessToken: string) {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });
  const { data } = await calendar.calendarList.list();

  return data.items || [];
}
