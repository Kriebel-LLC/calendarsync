import { redirect } from "next/navigation";

import { BillingForm } from "@/custom-components/billing-form";
import { DashboardHeader } from "@/custom-components/header";
import { DashboardShell } from "@/custom-components/shell";
import { getCurrentServerUser } from "@/lib/session";
import { stripe } from "@/lib/stripe";
import { getUserSubscriptionPlan } from "@/lib/subscription";
import { cookies } from "next/headers";

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

export default async function BillingPage() {
  const user = await getCurrentServerUser(await cookies());

  if (!user) {
    redirect("/login");
  }

  const subscriptionPlan = await getUserSubscriptionPlan(user.uid);

  // If user has a pro plan, check cancel status on Stripe.
  let isCanceled = false;
  if (subscriptionPlan.isPro && subscriptionPlan.stripeSubscriptionId) {
    const stripePlan = await stripe.subscriptions.retrieve(
      subscriptionPlan.stripeSubscriptionId
    );
    isCanceled = stripePlan.cancel_at_period_end;
  }

  return (
    <DashboardShell>
      <DashboardHeader
        heading="Billing"
        text="Manage billing and your subscription plan."
      />
      <div className="grid gap-8">
        <BillingForm
          subscriptionPlan={{
            ...subscriptionPlan,
            isCanceled,
          }}
        />
      </div>
    </DashboardShell>
  );
}
