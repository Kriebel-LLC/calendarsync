export enum Plan {
  FREE = "free",
  PRO = "pro",
}

export interface PlanEnv {
  STRIPE_PRO_MONTHLY_PLAN_ID: string;
}

export function stripePriceIdToPlan(
  stripePriceId: string,
  env: PlanEnv
): Plan | null {
  switch (stripePriceId) {
    case env.STRIPE_PRO_MONTHLY_PLAN_ID:
      return Plan.PRO;
    default:
      return null;
  }
}

/**
 * Plan feature limits for CalendarSync
 * Free: 1 calendar, 1 destination, daily sync
 * Pro ($8/month): unlimited calendars, unlimited destinations, 15-min sync, priority support
 */
export interface PlanLimits {
  maxCalendars: number;
  maxDestinations: number;
  syncIntervalMinutes: number;
  hasPrioritySupport: boolean;
}

export function getPlanLimits(plan: Plan): PlanLimits {
  switch (plan) {
    case Plan.FREE:
      return {
        maxCalendars: 1,
        maxDestinations: 1,
        syncIntervalMinutes: 1440, // 24 hours (daily)
        hasPrioritySupport: false,
      };
    case Plan.PRO:
      return {
        maxCalendars: Infinity,
        maxDestinations: Infinity,
        syncIntervalMinutes: 15,
        hasPrioritySupport: true,
      };
  }
}

export function canAddCalendar(
  plan: Plan,
  currentCalendarCount: number
): boolean {
  const limits = getPlanLimits(plan);
  return currentCalendarCount < limits.maxCalendars;
}

export function canAddDestination(
  plan: Plan,
  currentDestinationCount: number
): boolean {
  const limits = getPlanLimits(plan);
  return currentDestinationCount < limits.maxDestinations;
}

export function isPaidPlan(plan: Plan): boolean {
  return plan === Plan.PRO;
}
