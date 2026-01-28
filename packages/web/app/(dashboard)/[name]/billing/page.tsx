import { notFound, redirect } from "next/navigation";

import { planToSubscriptionPlan } from "@/config/subscriptions";
import { DashboardHeader } from "@/custom-components/header";
import { OrgBillingForm } from "@/custom-components/org-billing-form";
import { DashboardShell } from "@/custom-components/shell";
import { getOrgUserForOrgName } from "@/lib/org";
import { getCurrentServerUser } from "@/lib/session";
import { cookies } from "next/headers";
import { Role, hasPermission } from "shared/src/types/role";

// Cant do this in app dir:

// export const config = {
//   runtime: "edge",
//   unstable_allowDynamic: [
//     // Stripe imports this, but does not use it, so tell build to ignore
//     // use a glob to allow anything in the function-bind 3rd party module
//     "**/node_modules/function-bind/**",
//   ],
// };

export const metadata = {
  title: "Billing",
  description: "Manage billing and your subscription plan.",
};

export default async function BillingPage({
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

  const subscriptionPlan = planToSubscriptionPlan(userInOrg.orgPlan);

  return (
    <DashboardShell>
      <DashboardHeader
        heading="Billing"
        text="Manage billing and your subscription plan."
      />
      <div className="grid gap-8">
        <OrgBillingForm
          orgName={params.name}
          orgPlan={userInOrg.orgPlan}
          subscriptionPlan={subscriptionPlan}
        />
      </div>
    </DashboardShell>
  );
}
