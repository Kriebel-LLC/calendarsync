import { db } from "./db";
import { getUserDetails } from "./firebase-api";
import { DBEnv, Env } from "./types";
import { and, eq, inArray } from "drizzle-orm";
import { orgUsers } from "shared/src/db/schema";
import Email, { IEmail } from "shared/src/email";
import { Role, roleEqualToOrAbove } from "shared/src/types/role";

export async function emailUsersInOrg(
  env: Env,
  dbEnv: DBEnv,
  orgId: string,
  emailBody: Omit<IEmail, "to">,
  minimumRole?: Role
) {
  const allUserIdInOrgRecords = await db(dbEnv)
    .select({ userId: orgUsers.userId })
    .from(orgUsers)
    .where(
      and(
        eq(orgUsers.orgId, orgId),
        minimumRole
          ? inArray(orgUsers.role, roleEqualToOrAbove(minimumRole))
          : undefined
      )
    );

  if (allUserIdInOrgRecords.length <= 0) {
    return;
  }

  const userDetails = await getUserDetails(
    env,
    allUserIdInOrgRecords.map((member) => member.userId)
  );

  if (Object.keys(userDetails).length !== allUserIdInOrgRecords.length) {
    console.warn(
      "Fetched user details from Firebase don't match User IDs return in org from DB!"
    );
  }

  await Promise.all(
    Object.keys(userDetails).map((userId) =>
      Email.send(env, { to: userDetails[userId].email, ...emailBody })
    )
  );
}
