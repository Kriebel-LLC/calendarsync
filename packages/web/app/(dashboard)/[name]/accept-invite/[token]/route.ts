import { db } from "@/db";
import {
  RedirectQueryParameterKey,
  toastQueryParameterKey,
} from "@/lib/constants";
import { getOrgIdForOrgName } from "@/lib/org";
import { noAuthRouteHandler } from "@/lib/route";
import { getCurrentServerUser } from "@/lib/session";
import { and, eq, gt } from "drizzle-orm";
import { nanoid } from "nanoid";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { NextResponse } from "next/server";
import { orgInvites, orgUsers } from "shared/src/db/schema";

// NOTE: this is using noAuthRouteHandler because we want custom redirection logic for unauth'd users
export const GET = noAuthRouteHandler<{
  params: { name: string; token: string };
}>(async (req, context) => {
  const { name, token } = context.params;
  const user = await getCurrentServerUser(await cookies());
  if (!user) {
    const completionUrl = `/${name}/accept-invite/${token}`;
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = `${RedirectQueryParameterKey}=${encodeURIComponent(
      completionUrl
    )}&${toastQueryParameterKey}=${encodeURIComponent(
      "Please sign up or in to join this organization!"
    )}`;
    return NextResponse.redirect(redirectUrl);
  }

  if (!user.email) {
    throw new Error("User without email");
  }

  const orgId = await getOrgIdForOrgName(name);
  if (!orgId) {
    notFound();
  }

  const [invite] = await db()
    .select()
    .from(orgInvites)
    .where(
      and(
        eq(orgInvites.token, token),
        gt(orgInvites.expires, new Date()),
        eq(orgInvites.email, user.email),
        eq(orgInvites.orgId, orgId)
      )
    );

  if (!invite) {
    notFound();
  }

  await db().batch([
    db().insert(orgUsers).values({
      id: nanoid(),
      role: invite.role,
      orgId,
      userId: user.uid,
    }),
    db().delete(orgInvites).where(eq(orgInvites.id, invite.id)),
  ]);

  const redirectUrl = req.nextUrl.clone();
  redirectUrl.pathname = `/${name}`;
  redirectUrl.search = "";
  return NextResponse.redirect(redirectUrl);
});
