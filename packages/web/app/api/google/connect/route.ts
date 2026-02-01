import { routeHandler } from "@/lib/route";
import { env } from "@/web-env";
import { NextResponse } from "next/server";
import { buildGoogleOAuthUrl } from "shared/src/google-oauth";
import { z } from "zod";

const connectSchema = z.object({
  orgId: z.string().min(1),
  returnUrl: z.string().optional(),
});

export const POST = routeHandler(async (req, user) => {
  const json = await req.json();
  const body = connectSchema.safeParse(json);

  if (!body.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { orgId, returnUrl } = body.data;

  // Create state with org ID and return URL for callback
  const state = Buffer.from(
    JSON.stringify({
      orgId,
      userId: user.uid,
      returnUrl: returnUrl || `/${orgId}`,
    })
  ).toString("base64");

  const oauthUrl = buildGoogleOAuthUrl(
    {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri: `${env.NEXT_PUBLIC_APP_URL}/api/google/callback`,
    },
    state
  );

  return NextResponse.json({ url: oauthUrl });
});
