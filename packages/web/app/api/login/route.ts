import { authConfig, getAuthorizationTokenFromHeader } from "@/lib/auth";
import { logError } from "@/lib/logger";
import { noAuthRouteHandler } from "@/lib/route";
import { setAuthCookies } from "next-firebase-auth-edge/lib/next/cookies";
import { NextResponse } from "next/server";

/**
 * Logs a user in, taking an authorization token fetched directly from signing in with firebase on our frontend
 * This token is then verified, and custom cookie headers are created from it.
 * API's response then sets those cookies in the user's browser.
 *
 * Taken from next-firebase-auth-edge to not be within a middleware (slow, additional worker invocation)
 * must stay in sync with https://github.com/awinogrodzki/next-firebase-auth-edge/blob/main/src/next/middleware.ts#L70
 */
export const GET = noAuthRouteHandler(async (req) => {
  if (!getAuthorizationTokenFromHeader(req.headers)) {
    return new NextResponse(null, { status: 401 });
  }

  try {
    return setAuthCookies(req.headers, {
      cookieName: authConfig.cookieName,
      cookieSerializeOptions: authConfig.cookieSerializeOptions,
      cookieSignatureKeys: authConfig.cookieSignatureKeys,
      serviceAccount: authConfig.serviceAccount,
      apiKey: authConfig.apiKey,
    });
  } catch (error) {
    logError(error, req);
    return new NextResponse(null, { status: 401 });
  }
});
