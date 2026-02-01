import { routeHandler } from "@/lib/route";
import { env } from "@/web-env";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  buildAirtableOAuthUrl,
  generateCodeChallenge,
  generateCodeVerifier,
} from "shared/src/airtable-oauth";
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

  // Generate PKCE code verifier and challenge
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // Create state with org ID and return URL for callback
  const state = Buffer.from(
    JSON.stringify({
      orgId,
      userId: user.uid,
      returnUrl: returnUrl || `/${orgId}`,
    })
  ).toString("base64");

  // Store code verifier in a cookie for the callback
  // This is needed for PKCE - the callback needs the verifier to exchange the code
  const cookieStore = await cookies();
  cookieStore.set("airtable_code_verifier", codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  const oauthUrl = buildAirtableOAuthUrl(
    {
      clientId: env.AIRTABLE_CLIENT_ID,
      clientSecret: env.AIRTABLE_CLIENT_SECRET,
      redirectUri: `${env.NEXT_PUBLIC_APP_URL}/api/airtable/callback`,
    },
    state,
    codeChallenge
  );

  return NextResponse.json({ url: oauthUrl });
});
