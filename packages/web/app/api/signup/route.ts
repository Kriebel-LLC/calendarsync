import {
  authConfig,
  getAuthorizationTokenFromHeader,
  getOrCreateUserRecord,
} from "@/lib/auth";
import { logError } from "@/lib/logger";
import { generateInitialOrgBasedOnEmail } from "@/lib/org";
import { noAuthRouteHandler } from "@/lib/route";
import { getFirebaseAuth } from "next-firebase-auth-edge/lib/auth";
import { setAuthCookies } from "next-firebase-auth-edge/lib/next/cookies";
import { NextResponse } from "next/server";

/**
 * Signs a user up, taking an authorization token fetched directly from signing in with firebase on our frontend
 * From the firebase/next-firebase-auth-edge perspective, this is identical to logging in.
 *
 * Signup was created as a separate endpoint so we can call getOrCreateUserRecord in DB rather than only adding cookies
 * must stay in sync with https://github.com/awinogrodzki/next-firebase-auth-edge/blob/main/src/next/middleware.ts#L70
 */
export const GET = noAuthRouteHandler(async (req) => {
  const token = getAuthorizationTokenFromHeader(req.headers);
  if (!token) {
    return new NextResponse(null, { status: 401 });
  }
  const firebaseAuth = getFirebaseAuth(authConfig);

  try {
    // verifyIdToken is called within setAuthCookies, but we duplicate it here to pull out the decodedToken
    const decodedToken = await firebaseAuth.verifyIdToken(token);

    const response = setAuthCookies(req.headers, {
      cookieName: authConfig.cookieName,
      cookieSerializeOptions: authConfig.cookieSerializeOptions,
      cookieSignatureKeys: authConfig.cookieSignatureKeys,
      serviceAccount: authConfig.serviceAccount,
      apiKey: authConfig.apiKey,
    });

    if (!decodedToken.email) {
      throw new Error("Firebase token did not include email");
    }

    await Promise.all([
      getOrCreateUserRecord(decodedToken.uid),
      generateInitialOrgBasedOnEmail(decodedToken.email, decodedToken.uid),
    ]);

    return response;
  } catch (error) {
    logError(error, req);
    return new NextResponse(null, { status: 401 });
  }
});
