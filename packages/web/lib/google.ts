import { db } from "@/db";
import { env } from "@/web-env";
import { eq } from "drizzle-orm";
import { GoogleConnection, googleConnections } from "shared/src/db/schema";
import { refreshAccessToken } from "shared/src/google-oauth";

const TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export async function getValidAccessToken(
  connection: GoogleConnection
): Promise<string> {
  const now = Date.now();
  const expiresAt = connection.expiresAt.getTime();

  // If token is still valid (with threshold), return it
  if (expiresAt - now > TOKEN_REFRESH_THRESHOLD_MS) {
    return connection.accessToken;
  }

  // Refresh the token
  const tokens = await refreshAccessToken(
    {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri: `${env.NEXT_PUBLIC_APP_URL}/api/google/callback`,
    },
    connection.refreshToken
  );

  const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  // Update the connection with new token
  await db()
    .update(googleConnections)
    .set({
      accessToken: tokens.access_token,
      expiresAt: newExpiresAt,
    })
    .where(eq(googleConnections.id, connection.id));

  return tokens.access_token;
}
