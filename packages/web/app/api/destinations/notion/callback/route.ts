import { upsertNotionConnection } from "@/lib/notion/notion-connection";
import {
  exchangeCodeForTokens,
  validateOAuthState,
} from "@/lib/notion/notion-oauth";
import { routeHandler } from "@/lib/route";
import { env } from "@/web-env";
import { NextResponse } from "next/server";

/**
 * GET /api/destinations/notion/callback
 * Handles the OAuth callback from Notion after user authorization.
 */
export const GET = routeHandler(
  async (req, user) => {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    const settingsUrl = `${env.NEXT_PUBLIC_APP_URL}/dashboard/settings`;

    // Handle user denial or errors from Notion
    if (error) {
      req.log.warn("Notion OAuth error", { error });
      return NextResponse.redirect(
        `${settingsUrl}?notion_error=${encodeURIComponent(error)}`
      );
    }

    // Validate required parameters
    if (!code || !state) {
      req.log.warn("Missing code or state in Notion OAuth callback");
      return NextResponse.redirect(
        `${settingsUrl}?notion_error=missing_params`
      );
    }

    // Validate state parameter
    const validatedState = validateOAuthState(state, user.uid);
    if (!validatedState) {
      req.log.warn("Invalid or expired Notion OAuth state");
      return NextResponse.redirect(`${settingsUrl}?notion_error=invalid_state`);
    }

    try {
      // Exchange code for tokens
      const tokenResponse = await exchangeCodeForTokens(code);

      // Store the connection
      await upsertNotionConnection(user.uid, tokenResponse);

      req.log.info("Notion connection established", {
        workspaceId: tokenResponse.workspace_id,
        workspaceName: tokenResponse.workspace_name,
      });

      return NextResponse.redirect(`${settingsUrl}?notion_connected=true`);
    } catch (err) {
      req.log.error("Failed to complete Notion OAuth", { error: err });
      return NextResponse.redirect(
        `${settingsUrl}?notion_error=token_exchange_failed`
      );
    }
  },
  true // shouldRedirect: true so unauthenticated users get redirected to login
);
