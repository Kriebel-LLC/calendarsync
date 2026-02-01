import { db } from "@/db";
import { noAuthRouteHandler } from "@/lib/route";
import { env } from "@/web-env";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { googleConnections } from "shared/src/db/schema";
import {
  exchangeCodeForTokens,
  getGoogleUserInfo,
} from "shared/src/google-oauth";

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

  if (error) {
    return NextResponse.redirect(
      new URL(`/dashboard?error=google_oauth_denied`, env.NEXT_PUBLIC_APP_URL)
    );
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(
      new URL(`/dashboard?error=google_oauth_invalid`, env.NEXT_PUBLIC_APP_URL)
    );
  }

  let state: OAuthState;
  try {
    state = JSON.parse(Buffer.from(stateParam, "base64").toString());
  } catch {
    return NextResponse.redirect(
      new URL(`/dashboard?error=google_oauth_invalid`, env.NEXT_PUBLIC_APP_URL)
    );
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(
      {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        redirectUri: `${env.NEXT_PUBLIC_APP_URL}/api/google/callback`,
      },
      code
    );

    // Get user info to get email
    const userInfo = await getGoogleUserInfo(tokens.access_token);

    // Calculate token expiry
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Check if connection already exists
    const existing = await db()
      .select()
      .from(googleConnections)
      .where(
        and(
          eq(googleConnections.orgId, state.orgId),
          eq(googleConnections.email, userInfo.email)
        )
      );

    if (existing.length > 0) {
      // Update existing connection
      await db()
        .update(googleConnections)
        .set({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || existing[0].refreshToken,
          expiresAt,
          scopes: tokens.scope,
        })
        .where(eq(googleConnections.id, existing[0].id));
    } else {
      // Create new connection
      if (!tokens.refresh_token) {
        return NextResponse.redirect(
          new URL(
            `${state.returnUrl}?error=google_oauth_no_refresh_token`,
            env.NEXT_PUBLIC_APP_URL
          )
        );
      }

      await db().insert(googleConnections).values({
        id: nanoid(),
        orgId: state.orgId,
        email: userInfo.email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
        scopes: tokens.scope,
      });
    }

    return NextResponse.redirect(
      new URL(
        `${state.returnUrl}?success=google_connected`,
        env.NEXT_PUBLIC_APP_URL
      )
    );
  } catch (err) {
    console.error("Google OAuth error:", err);
    return NextResponse.redirect(
      new URL(
        `${state.returnUrl}?error=google_oauth_failed`,
        env.NEXT_PUBLIC_APP_URL
      )
    );
  }
});
