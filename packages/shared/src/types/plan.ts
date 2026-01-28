export enum Plan {
  FREE = "free",
  PAID = "paid",
}

export function stripePriceIdToPlan(
  stripePriceId: string,
  env: { STRIPE_PRO_MONTHLY_PLAN_ID: string }
): Plan | null {
  switch (stripePriceId) {
    case env.STRIPE_PRO_MONTHLY_PLAN_ID:
      return Plan.PAID;
    default:
      return null;
  }
}
