import { db } from "@/db";
import { noAuthRouteHandler } from "@/lib/route";
import { env } from "@/web-env";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { airtableConnections } from "shared/src/db/schema";
import {
  exchangeAirtableCodeForTokens,
  getAirtableUserInfo,
} from "shared/src/airtable-oauth";

interface OAuthState {
  orgId: string;
  userId: string;
  returnUrl: string;
}

export const GET = noAuthRouteHandler(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  if (error) {
    console.error("Airtable OAuth error:", error, errorDescription);
    return NextResponse.redirect(
      new URL(`/dashboard?error=airtable_oauth_denied`, env.NEXT_PUBLIC_APP_URL)
    );
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(
      new URL(`/dashboard?error=airtable_oauth_invalid`, env.NEXT_PUBLIC_APP_URL)
    );
  }

  // Get code verifier from cookie
  const cookieStore = await cookies();
  const codeVerifier = cookieStore.get("airtable_code_verifier")?.value;

  if (!codeVerifier) {
    return NextResponse.redirect(
      new URL(`/dashboard?error=airtable_oauth_invalid`, env.NEXT_PUBLIC_APP_URL)
    );
  }

  // Clear the code verifier cookie
  cookieStore.delete("airtable_code_verifier");

  let state: OAuthState;
  try {
    state = JSON.parse(Buffer.from(stateParam, "base64").toString());
  } catch {
    return NextResponse.redirect(
      new URL(`/dashboard?error=airtable_oauth_invalid`, env.NEXT_PUBLIC_APP_URL)
    );
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeAirtableCodeForTokens(
      {
        clientId: env.AIRTABLE_CLIENT_ID,
        clientSecret: env.AIRTABLE_CLIENT_SECRET,
        redirectUri: `${env.NEXT_PUBLIC_APP_URL}/api/airtable/callback`,
      },
      code,
      codeVerifier
    );

    // Get user info to get Airtable user ID
    const userInfo = await getAirtableUserInfo(tokens.access_token);

    // Calculate token expiry times
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    const refreshExpiresAt = new Date(Date.now() + tokens.refresh_expires_in * 1000);

    // Check if connection already exists
    const existing = await db()
      .select()
      .from(airtableConnections)
      .where(
        and(
          eq(airtableConnections.orgId, state.orgId),
          eq(airtableConnections.airtableUserId, userInfo.id)
        )
      );

    if (existing.length > 0) {
      // Update existing connection
      await db()
        .update(airtableConnections)
        .set({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt,
          refreshExpiresAt,
          scopes: tokens.scope,
        })
        .where(eq(airtableConnections.id, existing[0].id));
    } else {
      // Create new connection
      await db().insert(airtableConnections).values({
        id: nanoid(),
        orgId: state.orgId,
        airtableUserId: userInfo.id,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
        refreshExpiresAt,
        scopes: tokens.scope,
      });
    }

    return NextResponse.redirect(
      new URL(
        `${state.returnUrl}?success=airtable_connected`,
        env.NEXT_PUBLIC_APP_URL
      )
    );
  } catch (err) {
    console.error("Airtable OAuth error:", err);
    return NextResponse.redirect(
      new URL(
        `${state.returnUrl}?error=airtable_oauth_failed`,
        env.NEXT_PUBLIC_APP_URL
      )
    );
  }
});
