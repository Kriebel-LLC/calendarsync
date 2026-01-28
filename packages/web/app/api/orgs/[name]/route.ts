import { db } from "@/db";
import { EventNames, track } from "@/lib/amplitude";
import { getOrgUserForOrgName } from "@/lib/org";
import { routeHandler } from "@/lib/route";
import {
  orgNameRouteContextSchema,
  orgNameRouteContextSchemaType,
  orgNameUpdateSchema,
} from "@/lib/validations/orgs";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { orgs } from "shared/src/db/schema";
import { Role, hasPermission } from "shared/src/types/role";

// TODO: enable when we want this
// export async function DELETE() {
//   const user = await getCurrentServerUser(cookies());

//   if (!user) {
//     return new Response("Unauthorized", { status: 403 });
//   }
// }

export const PATCH = routeHandler<orgNameRouteContextSchemaType>(
  async (req, user, context) => {
    const json = await req.json();
    let newOrgName: string, orgName: string;
    try {
      const body = orgNameUpdateSchema.parse(json);
      newOrgName = body.name;

      const { params } = orgNameRouteContextSchema.parse(context);
      orgName = params.name;
    } catch (error) {
      return new NextResponse(null, { status: 400 });
    }

    const userInOrg = await getOrgUserForOrgName(user.uid, orgName);
    if (!userInOrg || !hasPermission(userInOrg.role, Role.ADMIN)) {
      return new NextResponse("Unauthorized", { status: 403 });
    }

    await db()
      .update(orgs)
      .set({ name: newOrgName })
      .where(eq(orgs.id, userInOrg.orgId));

    getCloudflareContext().ctx.waitUntil(
      track(EventNames.ORG_MODIFIED, user.uid, {
        "org id": userInOrg.orgId,
        "org plan": userInOrg.orgPlan,
        "org name": orgName,
        "new org name": newOrgName,
      })
    );

    return NextResponse.json({ name: newOrgName });
  }
);
