import { db } from "@/db";
import { env } from "@/web-env";
import { eq } from "drizzle-orm";
import { AirtableConnection, airtableConnections } from "shared/src/db/schema";
import { refreshAirtableAccessToken } from "shared/src/airtable-oauth";

const TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export async function getValidAirtableAccessToken(
  connection: AirtableConnection
): Promise<string> {
  const now = Date.now();
  const expiresAt = connection.expiresAt.getTime();

  // If token is still valid (with threshold), return it
  if (expiresAt - now > TOKEN_REFRESH_THRESHOLD_MS) {
    return connection.accessToken;
  }

  // Check if refresh token is still valid
  const refreshExpiresAt = connection.refreshExpiresAt.getTime();
  if (now > refreshExpiresAt) {
    throw new Error(
      "Airtable refresh token has expired. Please reconnect your Airtable account."
    );
  }

  // Refresh the token
  const tokens = await refreshAirtableAccessToken(
    {
      clientId: env.AIRTABLE_CLIENT_ID,
      clientSecret: env.AIRTABLE_CLIENT_SECRET,
      redirectUri: `${env.NEXT_PUBLIC_APP_URL}/api/airtable/callback`,
    },
    connection.refreshToken
  );

  const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  const newRefreshExpiresAt = new Date(
    Date.now() + tokens.refresh_expires_in * 1000
  );

  // Update the connection with new tokens
  await db()
    .update(airtableConnections)
    .set({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: newExpiresAt,
      refreshExpiresAt: newRefreshExpiresAt,
    })
    .where(eq(airtableConnections.id, connection.id));

  return tokens.access_token;
}
