import { siteConfig } from "@/config/site";
import { db } from "@/db";
import { EventNames, track } from "@/lib/amplitude";
import { logError } from "@/lib/logger";
import { getOrgUserForOrgName } from "@/lib/org";
import { routeHandler } from "@/lib/route";
import {
  orgNameRouteContextSchema,
  orgNameRouteContextSchemaType,
} from "@/lib/validations/orgs";
import { userOrgInviteCreateSchema } from "@/lib/validations/user";
import { env } from "@/web-env";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq, gt } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { orgInvites } from "shared/src/db/schema";
import Email from "shared/src/email";
import { Role, hasPermission } from "shared/src/types/role";
import * as z from "zod";

export const GET = routeHandler<orgNameRouteContextSchemaType>(
  async (req, user, context) => {
    let orgName: string;
    try {
      const { params } = orgNameRouteContextSchema.parse(context);
      orgName = params.name;
    } catch (error) {
      logError(error, req);
      return new NextResponse(null, { status: 400 });
    }

    const userInOrg = await getOrgUserForOrgName(user.uid, orgName);
    if (!userInOrg || !hasPermission(userInOrg.role, Role.READ)) {
      return new NextResponse("Unauthorized", { status: 403 });
    }

    const invites = await db()
      .select()
      .from(orgInvites)
      .where(
        and(
          eq(orgInvites.orgId, userInOrg.orgId),
          gt(orgInvites.expires, new Date())
        )
      );

    return NextResponse.json(invites);
  }
);

export const POST = routeHandler<orgNameRouteContextSchemaType>(
  async (req, user, context) => {
    const json = await req.json();
    let inviteeEmail: string, role: Role, orgName: string;
    try {
      const body = userOrgInviteCreateSchema.parse(json);
      inviteeEmail = body.invitee_email;
      role = body.role;

      const { params } = orgNameRouteContextSchema.parse(context);
      orgName = params.name;
    } catch (error) {
      logError(error, req);
      return new NextResponse(null, { status: 400 });
    }

    const userInOrg = await getOrgUserForOrgName(user.uid, orgName);
    if (!userInOrg || !hasPermission(userInOrg.role, Role.ADMIN)) {
      return new NextResponse("Unauthorized", { status: 403 });
    }

    const existingInvitation = await db()
      .select({ id: orgInvites.id })
      .from(orgInvites)
      .where(
        and(
          eq(orgInvites.email, inviteeEmail),
          gt(orgInvites.expires, new Date())
        )
      );

    if (existingInvitation.length > 0) {
      return NextResponse.json(
        { error: "invitation already exists" },
        { status: 409 }
      );
    }

    const token = nanoid(64);
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const invitation = {
      id: nanoid(),
      email: inviteeEmail,
      token,
      expires,
      senderUserId: user.uid,
      orgId: userInOrg.orgId,
      role,
    };

    await db().insert(orgInvites).values(invitation);

    try {
      await Email.send(env, {
        to: inviteeEmail,
        from: env.SMTP_FROM,
        subject: `[${siteConfig.name}] ${user.email} has invited you to join the ${orgName} organization`,
        html: `<p>Hello,</p>
<p>You've been invited to join the ${orgName} organization on ${siteConfig.name}. If you want to accept this invitaion and get access to this organization, click this link:</p>
<p><a href='${env.NEXT_PUBLIC_APP_URL}/${orgName}/accept-invite/${token}'>Join ${user.email} in ${orgName} on ${siteConfig.name}</a></p>
<p>If you don't have an account created yet, you will be asked to make one.</p>
<p>Thanks,</p>
<p>${siteConfig.name} team</p>`,
      });
    } catch (error) {
      logError(error);
      await db().delete(orgInvites).where(eq(orgInvites.id, invitation.id)); // remove so user can re-invite

      throw error;
    }

    getCloudflareContext().ctx.waitUntil(
      track(EventNames.INVITE_CREATED, user.uid, {
        "invite id": invitation.id,
        "org id": invitation.orgId,
        "invitee email": invitation.email,
        role,
        expires: expires.toDateString(),
      })
    );

    return NextResponse.json(invitation);
  }
);

const orgInviteUpdateSchema = z.object({
  invite_id: z.string().min(1),
  role: z.nativeEnum(Role),
});

export const PATCH = routeHandler(async (req, user, context) => {
  const json = await req.json();
  let inviteId: string, role: Role, orgName: string;
  try {
    const body = orgInviteUpdateSchema.parse(json);
    inviteId = body.invite_id;
    role = body.role;

    const { params } = orgNameRouteContextSchema.parse(context);
    orgName = params.name;
  } catch (error) {
    logError(error, req);
    return new NextResponse(null, { status: 400 });
  }

  const userInOrg = await getOrgUserForOrgName(user.uid, orgName);
  if (!userInOrg || !hasPermission(userInOrg.role, Role.ADMIN)) {
    return new NextResponse("Unauthorized", { status: 403 });
  }

  await db()
    .update(orgInvites)
    .set({ role })
    .where(
      and(eq(orgInvites.id, inviteId), eq(orgInvites.orgId, userInOrg.orgId))
    );

  track(EventNames.INVITE_MODIFIED, user.uid, {
    "invite id": inviteId,
    "org id": userInOrg.orgId,
    "new role": role,
  });

  return new NextResponse(null);
});

const orgInvitesDeleteSchema = z.object({
  invite_id: z.string().min(1),
});

export const DELETE = routeHandler<orgNameRouteContextSchemaType>(
  async (req, user, context) => {
    const json = await req.json();
    let inviteId: string, orgName: string;
    try {
      const body = orgInvitesDeleteSchema.parse(json);
      inviteId = body.invite_id;

      const { params } = orgNameRouteContextSchema.parse(context);
      orgName = params.name;
    } catch (error) {
      logError(error, req);
      return new NextResponse(null, { status: 400 });
    }

    const userInOrg = await getOrgUserForOrgName(user.uid, orgName);
    if (!userInOrg || !hasPermission(userInOrg.role, Role.ADMIN)) {
      return new NextResponse("Unauthorized", { status: 403 });
    }

    await db()
      .delete(orgInvites)
      .where(
        and(eq(orgInvites.id, inviteId), eq(orgInvites.orgId, userInOrg.orgId))
      );

    track(EventNames.INVITE_DELETED, user.uid, {
      "invite id": inviteId,
      "org id": userInOrg.orgId,
    });

    return new NextResponse(null);
  }
);
