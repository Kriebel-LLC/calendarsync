import {
  generateOAuthState,
  getAuthorizationUrl,
} from "@/lib/notion/notion-oauth";
import { routeHandler } from "@/lib/route";
import { NextResponse } from "next/server";

/**
 * GET /api/destinations/notion/authorize
 * Initiates the Notion OAuth flow by redirecting to Notion's authorization page.
 */
export const GET = routeHandler(async (req, user) => {
  const state = generateOAuthState(user.uid);
  const authUrl = getAuthorizationUrl(state);

  return NextResponse.redirect(authUrl);
});
