import { db } from "@/db";
import { verifyUserHasPermissionForOrgId } from "@/lib/org";
import { routeHandler } from "@/lib/route";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { googleConnections } from "shared/src/db/schema";
import { Role } from "shared/src/types/role";
import { z } from "zod";

const querySchema = z.object({
  orgId: z.string().min(1),
});

export const GET = routeHandler(async (req, user) => {
  const url = new URL(req.url);
  const query = querySchema.safeParse({
    orgId: url.searchParams.get("orgId"),
  });

  if (!query.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { orgId } = query.data;

  // Verify user has access to org
  const hasAccess = await verifyUserHasPermissionForOrgId(user.uid, orgId, Role.READ);
  if (!hasAccess) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const connections = await db()
    .select({
      id: googleConnections.id,
      email: googleConnections.email,
      createdAt: googleConnections.createdAt,
    })
    .from(googleConnections)
    .where(eq(googleConnections.orgId, orgId));

  return NextResponse.json({ connections });
});
