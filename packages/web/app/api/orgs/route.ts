import { db } from "@/db";
import { logError } from "@/lib/logger";
import { createOrg, OrgNameTakenError } from "@/lib/org";
import { routeHandler } from "@/lib/route";
import { orgCreateSchema } from "@/lib/validations/orgs";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { orgs, orgUsers } from "shared/src/db/schema";
import * as z from "zod";

export const GET = routeHandler(async (_, user) => {
  const { uid } = user;

  const orgRecords = await db()
    .select({
      id: orgs.id,
      name: orgs.name,
      plan: orgs.plan,
      stripeCustomerId: orgs.stripeCustomerId,
      createdAt: orgs.createdAt,
      updatedAt: orgs.updatedAt,
    })
    .from(orgs)
    .innerJoin(orgUsers, eq(orgs.id, orgUsers.orgId))
    .where(eq(orgUsers.userId, uid));

  return NextResponse.json(orgRecords);
});

export const POST = routeHandler(async (req, user) => {
  const json = await req.json();
  try {
    const body = orgCreateSchema.parse(json);
    const { name, orgId } = await createOrg(body.name, user.uid, false);

    return new NextResponse(JSON.stringify({ id: orgId, name }));
  } catch (error) {
    logError(error, req);
    if (error instanceof z.ZodError) {
      return NextResponse.json(error.issues, {
        status: 422,
      });
    }
    if (error instanceof OrgNameTakenError) {
      return NextResponse.json(
        { error: "Organization name is taken" },
        {
          status: 422,
        }
      );
    }
  }

  return new NextResponse(null, { status: 500 });
});
