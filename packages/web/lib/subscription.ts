// @ts-nocheck
// TODO: Fix this when we turn strict mode on.
import { freePlan, proPlan } from "@/config/subscriptions";
import { UserSubscriptionPlan } from "types";
import { getOrCreateUserRecord } from "./auth";

export async function getUserSubscriptionPlan(
  userId: string
): Promise<UserSubscriptionPlan> {
  const user = await getOrCreateUserRecord(userId);

  if (!user) {
    throw new Error("User not found");
  }

  // Check if user is on a pro plan.
  const isPro =
    user.stripePriceId &&
    user.stripeCurrentPeriodEnd?.getTime() + 86_400_000 > Date.now();

  const plan = isPro ? proPlan : freePlan;

  return {
    ...plan,
    ...user,
    stripeCurrentPeriodEnd: user.stripeCurrentPeriodEnd?.getTime(),
    isPro,
  };
}
