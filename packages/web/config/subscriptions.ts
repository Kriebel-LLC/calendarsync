import { env } from "@/web-env";
import { Plan } from "shared/src/types/plan";
import { assertNever } from "shared/src/utils";
import { SubscriptionPlan } from "types";

export const freePlan: SubscriptionPlan = {
  name: "Free",
  description:
    "The free plan is limited to 3 posts. Upgrade to the PRO plan for unlimited posts.",
  stripePriceId: "",
};

export const proPlan: SubscriptionPlan = {
  name: "PRO",
  description: "The PRO plan has unlimited posts.",
  stripePriceId: env.STRIPE_PRO_MONTHLY_PLAN_ID || "",
};

export function planToSubscriptionPlan(plan: Plan): SubscriptionPlan {
  switch (plan) {
    case Plan.FREE:
      return freePlan;
    case Plan.PAID:
      return proPlan;
    default:
      assertNever(plan);
  }
}
