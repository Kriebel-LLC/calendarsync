import { Environment } from "./environment";
import { Env } from "./types";

export function authConfig(env: Env) {
  return {
    apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
    serviceAccount: {
      projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      privateKey: env.FIREBASE_PRIVATE_KEY,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
    },
    cookieName: "AuthToken",
    // next-firebase-auth-edge will always sign cookies with 1st value, but will verify against all vaules
    // to rotate keys, swap secret1 & 2's position in this array, so that new cookies are created with the 2nd key, but still validated against the first
    // then, remove the old key by replacing it ONLY after all cookies have expired that were signed with the old key (should be maxAge value)
    cookieSignatureKeys: [
      env.AUTH_COOKIE_SIGNATURE_1,
      env.AUTH_COOKIE_SIGNATURE_2,
    ],
    cookieSerializeOptions: {
      path: "/",
      httpOnly: true,
      secure: env.NEXT_PUBLIC_ENVIRONMENT !== Environment.Development, // Set this to true on HTTPS environments
      // lax is needed so that requests to this site, from other domains, send these cookies
      // for example, when coming back from checkout.stripe.com after initiating checkout
      // without this, cookies will not be sent, making it seem like the user is not auth'd
      sameSite: "lax" as const,
      maxAge: 12 * 60 * 60 * 24, // twelve days
    },
  };
}
