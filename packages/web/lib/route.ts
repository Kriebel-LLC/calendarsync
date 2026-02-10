import { authConfig, loginPath, logoutPath } from "@/lib/auth";
import { env } from "@/web-env";
import { withAxiomRouteHandler, type AxiomRequest } from "next-axiom";
import { authMiddleware } from "next-firebase-auth-edge";
import { DecodedIdToken } from "next-firebase-auth-edge/lib/auth";
import { InvalidTokenReason } from "next-firebase-auth-edge/lib/auth/error";
import { NextResponse } from "next/server";
import { Environment } from "shared/src/environment";
import { logError } from "./logger";

// Uses authMiddleware within this API request rather than through middleware to avoid an additional hop between middleware & API
async function withAuthentication<ContextType>(
  request: AxiomRequest,
  handler: (
    request: AxiomRequest,
    user: DecodedIdToken,
    context?: ContextType
  ) => Promise<NextResponse>,
  context?: ContextType,
  shouldRedirect?: boolean
): Promise<NextResponse> {
  return authMiddleware(request, {
    debug: env.NEXT_PUBLIC_ENVIRONMENT !== Environment.Production, // TODO: use env.NEXT_PUBLIC_ENVIRONMENT here and only enable for non-prod
    loginPath,
    logoutPath,
    ...authConfig,
    handleValidToken: async ({ decodedToken }) => {
      request.log = request.log.with({ userId: decodedToken.uid });
      const response = await handler(request, decodedToken, context);
      return response;
    },
    handleInvalidToken: async (reason: InvalidTokenReason) => {
      request.log.warn(
        `Invalid authenticated API route call with reason: ${reason}`
      );

      return shouldRedirect
        ? NextResponse.redirect(new URL("/login", request.url))
        : new NextResponse("Unauthorized", { status: 403 });
    },
    handleError: async (error: Error) => {
      logError(error, request);
      throw error;
    },
  });
}

type AuthenticatedHandler<ContextType> = (
  request: AxiomRequest,
  user: DecodedIdToken,
  context: ContextType
) => Promise<NextResponse>;

// Resolve async params from Next.js 15 route context
async function resolveContext<T>(context: Record<string, unknown>): Promise<T> {
  if (context && typeof context === "object" && "params" in context) {
    return { ...context, params: await context.params } as T;
  }
  return context as T;
}

// Handler to log request info, inject logger, and check auth if required
export function routeHandler<ContextType>(
  handler: AuthenticatedHandler<ContextType>,
  shouldRedirect?: boolean
): ReturnType<typeof withAxiomRouteHandler> {
  return withAxiomRouteHandler(async (req, context) => {
    req.log = req.log.with({ requestId: crypto.randomUUID() });
    req.log.info("Request started"); // TODO: ideally we have userId logged when this is logged

    const resolvedContext = await resolveContext<ContextType>(context);
    const start = Date.now();
    const result = await withAuthentication<ContextType>(
      req,
      handler,
      resolvedContext,
      shouldRedirect
    );

    req.log.info("Request ended", {
      latency: Date.now() - start,
      status: result.status,
    });
    return result;
  });
}

type UnAuthenticatedHandler<ContextType> = (
  request: AxiomRequest,
  context: ContextType
) => Promise<NextResponse>;

// TODO: ideally DRY this up with routeHandler
export function noAuthRouteHandler<ContextType>(
  handler: UnAuthenticatedHandler<ContextType>
): ReturnType<typeof withAxiomRouteHandler> {
  return withAxiomRouteHandler(async (req, context) => {
    req.log = req.log.with({ requestId: crypto.randomUUID() });
    req.log.info("Request started");

    const resolvedContext = await resolveContext<ContextType>(context);
    const start = Date.now();
    const result = await handler(req, resolvedContext);

    req.log.info("Request ended", {
      latency: Date.now() - start,
      status: result.status,
    });
    return result;
  });
}
