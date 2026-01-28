import { db } from "@/db";
import { EventNames, track } from "@/lib/amplitude";
import { logError } from "@/lib/logger";
import { getOrgUserForOrgName } from "@/lib/org";
import { routeHandler } from "@/lib/route";
import {
  orgNameRouteContextSchema,
  orgNameRouteContextSchemaType,
} from "@/lib/validations/orgs";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { orgUsers } from "shared/src/db/schema";
import { Role, hasPermission } from "shared/src/types/role";
import * as z from "zod";

const orgUserUpdateSchema = z.object({
  org_user_id: z.string().min(1),
  role: z.nativeEnum(Role),
});

export const PATCH = routeHandler<orgNameRouteContextSchemaType>(
  async (req, user, context) => {
    const json = await req.json();
    let orgUserId: string, role: Role, orgName: string;
    try {
      const body = orgUserUpdateSchema.parse(json);
      orgUserId = body.org_user_id;
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
      .update(orgUsers)
      .set({ role })
      .where(
        and(eq(orgUsers.id, orgUserId), eq(orgUsers.orgId, userInOrg.orgId))
      );

    track(EventNames.ORG_MEMBER_MODIFIED, user.uid, {
      "org member id": orgUserId,
      "org id": userInOrg.orgId,
      role,
    });

    return new NextResponse(null);
  }
);

const orgUserDeleteSchema = z.object({
  org_user_id: z.string().min(1),
});

export const DELETE = routeHandler<orgNameRouteContextSchemaType>(
  async (req, user, context) => {
    const json = await req.json();
    let orgUserId: string, orgName: string;
    try {
      const body = orgUserDeleteSchema.parse(json);
      orgUserId = body.org_user_id;

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
      .delete(orgUsers)
      .where(
        and(eq(orgUsers.id, orgUserId), eq(orgUsers.orgId, userInOrg.orgId))
      );

    track(EventNames.ORG_MEMBER_DELETED, user.uid, {
      "org member id": orgUserId,
      "org id": userInOrg.orgId,
    });

    return new NextResponse(null);
  }
);
