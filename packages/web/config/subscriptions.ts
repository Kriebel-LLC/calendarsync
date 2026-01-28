import { env } from "@/web-env";
import { Plan, getPlanLimits } from "shared/src/types/plan";
import { assertNever } from "shared/src/utils";
import { SubscriptionPlan } from "types";

export const freePlan: SubscriptionPlan = {
  name: "Free",
  description:
    "1 calendar, 1 destination, and daily sync. Perfect for getting started.",
  stripePriceId: "",
};

export const proPlan: SubscriptionPlan = {
  name: "Pro",
  description:
    "Unlimited calendars, unlimited destinations, 15-minute sync, and priority support.",
  stripePriceId: env.STRIPE_PRO_MONTHLY_PLAN_ID || "",
};

export const PRO_PLAN_PRICE_MONTHLY = 8; // $8/month

export function planToSubscriptionPlan(plan: Plan): SubscriptionPlan {
  switch (plan) {
    case Plan.FREE:
      return freePlan;
    case Plan.PRO:
      return proPlan;
    default:
      assertNever(plan);
  }
}

export function getPlanFeatures(plan: Plan): string[] {
  const limits = getPlanLimits(plan);

  if (plan === Plan.FREE) {
    return [
      `${limits.maxCalendars} calendar connection`,
      `${limits.maxDestinations} destination`,
      "Daily sync",
      "30-day history",
    ];
  }

  return [
    "Unlimited calendar connections",
    "Unlimited destinations",
    "15-minute sync interval",
    "Unlimited history",
    "Priority support",
  ];
}
