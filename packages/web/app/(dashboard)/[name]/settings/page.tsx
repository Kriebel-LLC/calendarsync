import { notFound, redirect } from "next/navigation";

import { DashboardHeader } from "@/custom-components/header";
import { db } from "@/db";
import { getOrgUserForOrgName } from "@/lib/org";
import { getCurrentServerUser } from "@/lib/session";
import { env } from "@/web-env";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { OrgUserWithDetail, orgInvites, orgUsers } from "shared/src/db/schema";
import { getUserDetails } from "shared/src/firebase-api";
import { Role, hasPermission } from "shared/src/types/role";
import { OrgNameForm } from "./org-name-form";
import { OrgUsers } from "./org-users";

export const metadata = {
  title: "Settings",
  description: "Manage account and website settings.",
};

export default async function SettingsPage({
  params,
}: {
  params: { name: string };
}) {
  const user = await getCurrentServerUser(cookies());
  if (!user) {
    redirect("/login");
  }

  const userInOrg = await getOrgUserForOrgName(user.uid, params.name);
  if (!userInOrg || !hasPermission(userInOrg.role, Role.READ)) {
    notFound();
  }

  const [members, invites] = await Promise.all([
    db().select().from(orgUsers).where(eq(orgUsers.orgId, userInOrg.orgId)),
    db().select().from(orgInvites).where(eq(orgInvites.orgId, userInOrg.orgId)),
  ]);

  // TODO: consider moving this to the frontend and exposing an API for a single org user, to not delay page loads
  //       and progressively load more
  const userDetail = await getUserDetails(
    env,
    members.map((member) => member.userId)
  );
  const membersWithDetail: OrgUserWithDetail[] = members.map((member) => {
    return { ...member, ...userDetail[member.userId] };
  });

  return (
    <>
      {/* // Dashboard shell should be used here, but breaks overflow-x scroll */}
      <div className="mb-8">
        <DashboardHeader
          heading="Settings"
          text="Manage account and website settings."
        />
      </div>
      <div className="mb-8">
        <OrgUsers
          members={membersWithDetail}
          invites={invites}
          orgName={params.name}
          currentUserId={user.uid}
        />
      </div>
      <OrgNameForm
        orgId={userInOrg.orgId}
        orgName={params.name}
        role={userInOrg.role}
      />
    </>
  );
}
