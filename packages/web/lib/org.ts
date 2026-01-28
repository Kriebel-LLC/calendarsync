import { db } from "@/db";
import { sanitizeOrgName } from "@/lib/utils";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { Org, orgUsers, orgs } from "shared/src/db/schema";
import { Plan } from "shared/src/types/plan";
import { Role, hasPermission } from "shared/src/types/role";
import { EventNames, track } from "./amplitude";
import { PersonalDashboardRoute } from "./constants";
import { orgCreateSchema } from "./validations/orgs";

export async function verifyUserHasPermissionForOrgId(
  uid: string,
  orgId: string,
  role: Role
): Promise<boolean> {
  const [roleRecord] = await db()
    .select({
      role: orgUsers.role,
    })
    .from(orgUsers)
    .where(and(eq(orgUsers.userId, uid), eq(orgUsers.orgId, orgId)));

  if (!roleRecord) {
    return false;
  }

  return hasPermission(roleRecord.role, role);
}

interface OrgUserResult {
  orgId: string;
  orgPlan: Plan;
  role: Role;
  orgStripeCustomerId: string | null;
}

export async function getOrgUserForOrgName(
  uid: string,
  orgName: string
): Promise<OrgUserResult | null> {
  const orgUserResultRecord = await db()
    .select({
      orgId: orgs.id,
      orgPlan: orgs.plan,
      role: orgUsers.role,
      orgStripeCustomerId: orgs.stripeCustomerId,
    })
    .from(orgs)
    .innerJoin(orgUsers, eq(orgs.id, orgUsers.orgId))
    .where(and(eq(orgs.name, orgName), eq(orgUsers.userId, uid)));

  if (!orgUserResultRecord || orgUserResultRecord.length <= 0) {
    return null;
  }

  return orgUserResultRecord[0];
}

export async function getOrgIdForOrgName(
  orgName: string
): Promise<string | null> {
  const ids = await db()
    .select({ id: orgs.id })
    .from(orgs)
    .where(eq(orgs.name, orgName));
  return ids.length > 0 ? ids[0].id : null;
}

export async function getOrgNameForOrgId(
  orgId: string
): Promise<string | null> {
  const names = await db()
    .select({ name: orgs.name })
    .from(orgs)
    .where(eq(orgs.id, orgId));
  return names.length > 0 ? names[0].name : null;
}

const RESERVED_ORG_NAMES = new Set([
  "blog",
  "terms",
  "privacy",
  PersonalDashboardRoute,
  "api",
  "pricing",
  "404",
  "docs",
  "guides",
  "editor",
  "login",
  "register",
  "public",
  "settings",
  "destinations",
  "sources",
]);

export async function isOrgNameTaken(name: string): Promise<boolean> {
  return (
    !RESERVED_ORG_NAMES.has(name) &&
    (
      await db()
        .select({ name: orgs.name })
        .from(orgs)
        .where(eq(orgs.name, name))
    ).length >= 1
  );
}

export class OrgNameTakenError extends Error {}

export async function createOrg(
  name: string,
  userId: string,
  skipNameCheck?: boolean
): Promise<{ name: string; orgId: string }> {
  orgCreateSchema.parse({ name });

  if (!skipNameCheck) {
    const isTaken = await isOrgNameTaken(name);
    if (isTaken) throw new OrgNameTakenError();
  }

  const orgId = nanoid();

  await db().batch([
    db().insert(orgs).values({
      id: orgId,
      name,
    }),
    db().insert(orgUsers).values({
      id: nanoid(),
      role: Role.ADMIN,
      orgId,
      userId,
    }),
  ]);

  track(EventNames.ORG_CREATED, userId, {
    "org id": orgId,
    "org name": name,
  });

  return { name, orgId };
}

export async function generateInitialOrgBasedOnEmail(
  email: string,
  userId: string
): Promise<ReturnType<typeof createOrg>> {
  // TODO: modify this to use domain when domain is not a public email domain
  const emailParts = email.split("@");
  const username = sanitizeOrgName(emailParts[0]);
  if (!(await isOrgNameTaken(username))) {
    return await createOrg(username, userId);
  }

  const domain = emailParts[1].split(".")[0];
  const emailAndDomain = sanitizeOrgName(`${username}-${domain}`);
  if (!(await isOrgNameTaken(emailAndDomain))) {
    return await createOrg(emailAndDomain, userId);
  }

  const fallback = sanitizeOrgName(`${emailAndDomain}-${nanoid()}`);
  return await createOrg(fallback, userId);
}

export async function getOrgsForUser(userId: string): Promise<Org[]> {
  return db()
    .select({
      // TODO: figure out how to just expand the Org type
      id: orgs.id,
      name: orgs.name,
      plan: orgs.plan,
      stripeCustomerId: orgs.stripeCustomerId,
      createdAt: orgs.createdAt,
      updatedAt: orgs.updatedAt,
    })
    .from(orgs)
    .innerJoin(orgUsers, eq(orgs.id, orgUsers.orgId))
    .where(eq(orgUsers.userId, userId))
    .orderBy(orgs.updatedAt);
}
