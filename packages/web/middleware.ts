// middleware.ts
import { authConfig, loginPath, logoutPath } from "@/lib/auth";
import {
  // PersonalDashboardRoute,
  RedirectQueryParameterKey,
} from "@/lib/constants";
import { authMiddleware } from "next-firebase-auth-edge/lib/next/middleware";
import { NextRequest, NextResponse } from "next/server";
import { Environment } from "shared/src/environment";
import { env } from "./web-env";

export async function middleware(request: NextRequest) {
  // TODO: this causes more trouble than it's worth right now due to redirect loops
  // instead, we can handle this at the time of click, and not in middleware
  // We could fix all loops by validating the token, but then we'd have to do that 2x
  // if (
  //   request.nextUrl.pathname === "/login" ||
  //   request.nextUrl.pathname === "/register"
  // ) {
  //   // TODO: there may be a bug here where this cookie is invalid, cannot be refreshed
  //   //   handleError is called, to redirect to /login, but then handleError is hit again, causing a loop
  //   //   this may not be a real issue because of cookie weirdness in test environments... but maybe not
  //   if (!!request.cookies.get(authConfig.cookieName)) {
  //     // if already auth'd redirect to dashboard from auth pages
  //     const url = request.nextUrl.clone();
  //     url.pathname = `/${PersonalDashboardRoute}`;
  //     return NextResponse.redirect(url);
  //   }
  //   // if not auth'd, proceed normally
  //   return NextResponse.next();
  // }

  // NOTE: `/api/login` is not used here, and is instead in the dir: /pages/api/login.ts
  //       this is because the next-firebase-auth-edge middleware does not have good error handling, so we make our own
  return authMiddleware(request, {
    debug: env.NEXT_PUBLIC_ENVIRONMENT !== Environment.Production, // TODO: use env.NEXT_PUBLIC_ENVIRONMENT here and only enable for non-prod
    loginPath,
    logoutPath,
    ...authConfig,
    handleValidToken: async () => {
      console.log("Successfully authenticated via middleware");
      return NextResponse.next();
    },
    handleInvalidToken: async () => {
      console.log("Failed authentication via middleware");

      // Avoid redirect loop
      if (request.nextUrl.pathname === "/login") {
        return NextResponse.next();
      }

      // Redirect to /login?redirect=/prev-path when request is unauthenticated
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = `${RedirectQueryParameterKey}=${encodeURIComponent(
        request.nextUrl.pathname
      )}${url.search}`;
      return NextResponse.redirect(url);
    },
    handleError: async (error: Error) => {
      console.error("Unhandled authentication error ", error);

      // Avoid redirect loop
      if (request.nextUrl.pathname === "/login") {
        return NextResponse.next();
      }

      // Redirect to /login?redirect=/prev-path on unhandled authentication error
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = `${RedirectQueryParameterKey}=${encodeURIComponent(
        request.nextUrl.pathname
      )}${url.search}`;
      return NextResponse.redirect(url);
    },
  });
}

export const config = {
  matcher: [
    "/api/logout",
    // "/login",
    // "/register",
  ],
};
