import { authConfig } from "@/lib/auth";
import { noAuthRouteHandler } from "@/lib/route";
import { refreshNextResponseCookiesWithToken } from "next-firebase-auth-edge/lib/next/cookies";
import { getTokens } from "next-firebase-auth-edge/lib/next/tokens";
import { NextResponse } from "next/server";

/**
 * Refreshes the provided auth tokens in request's cookies.
 * Neccessary to pick up any changes that may have happened within Firebase auth
 *
 * Requires authentication to refresh the provided tokens
 * Does not use routeHandler since we need token, not decodedToken
 */
export const GET = noAuthRouteHandler(async (request) => {
  // Does not use getCurrentServerUser since we need token, not decodedToken
  const tokens = await getTokens(request.cookies, authConfig);
  if (!tokens) {
    return new NextResponse("Unauthorized", { status: 403 });
  }

  const response = new NextResponse(null, {
    status: 200,
    headers: { "content-type": "application/json" },
  });

  // Attach `Set-Cookie` headers with token containing new custom claims
  await refreshNextResponseCookiesWithToken(
    tokens.token,
    request,
    response,
    authConfig
  );

  return response;
});
