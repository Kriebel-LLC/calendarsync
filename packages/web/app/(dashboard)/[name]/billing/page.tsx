import { notFound, redirect } from "next/navigation";

import { planToSubscriptionPlan } from "@/config/subscriptions";
import { DashboardHeader } from "@/custom-components/header";
import { OrgBillingForm } from "@/custom-components/org-billing-form";
import { DashboardShell } from "@/custom-components/shell";
import { getOrgUserForOrgName } from "@/lib/org";
import { getOrgUsageStats } from "@/lib/plan-gating";
import { getCurrentServerUser } from "@/lib/session";
import { cookies } from "next/headers";
import { Role, hasPermission } from "shared/src/types/role";

export const metadata = {
  title: "Billing",
  description: "Manage billing and your subscription plan.",
};

export default async function BillingPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const user = await getCurrentServerUser(await cookies());
  if (!user) {
    redirect("/login");
  }

  const userInOrg = await getOrgUserForOrgName(user.uid, name);
  if (!userInOrg || !hasPermission(userInOrg.role, Role.READ)) {
    notFound();
  }

  const subscriptionPlan = planToSubscriptionPlan(userInOrg.orgPlan);
  const usageStats = await getOrgUsageStats(userInOrg.orgId);

  return (
    <DashboardShell>
      <DashboardHeader
        heading="Billing"
        text="Manage billing and your subscription plan."
      />
      <div className="grid gap-8">
        <OrgBillingForm
          orgName={name}
          orgPlan={userInOrg.orgPlan}
          subscriptionPlan={subscriptionPlan}
          currentPeriodEnd={userInOrg.orgStripeCurrentPeriodEnd}
          calendarsCount={usageStats.calendarsCount}
          destinationsCount={usageStats.destinationsCount}
        />
      </div>
    </DashboardShell>
  );
}
