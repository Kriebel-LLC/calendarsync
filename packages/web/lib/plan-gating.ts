import { db } from "@/db";
import { eq, sql } from "drizzle-orm";
import { orgs } from "shared/src/db/schema";
import {
  Plan,
  getPlanLimits,
  canAddCalendar,
  canAddDestination,
} from "shared/src/types/plan";

export interface UsageStats {
  calendarsCount: number;
  destinationsCount: number;
  maxCalendars: number;
  maxDestinations: number;
  syncIntervalMinutes: number;
  hasPrioritySupport: boolean;
}

export async function getOrgUsageStats(orgId: string): Promise<UsageStats> {
  // Get org plan
  const [orgRecord] = await db()
    .select({ plan: orgs.plan })
    .from(orgs)
    .where(eq(orgs.id, orgId));

  const plan = orgRecord?.plan || Plan.FREE;
  const limits = getPlanLimits(plan);

  // TODO: Once calendars and destinations tables are created, query actual counts
  // For now, return mock counts of 0
  const calendarsCount = 0;
  const destinationsCount = 0;

  return {
    calendarsCount,
    destinationsCount,
    maxCalendars: limits.maxCalendars,
    maxDestinations: limits.maxDestinations,
    syncIntervalMinutes: limits.syncIntervalMinutes,
    hasPrioritySupport: limits.hasPrioritySupport,
  };
}

export async function checkCanAddCalendar(
  orgId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const stats = await getOrgUsageStats(orgId);

  if (stats.calendarsCount >= stats.maxCalendars) {
    return {
      allowed: false,
      reason: `You've reached the maximum of ${stats.maxCalendars} calendar${stats.maxCalendars === 1 ? "" : "s"} on your current plan. Upgrade to Pro for unlimited calendars.`,
    };
  }

  return { allowed: true };
}

export async function checkCanAddDestination(
  orgId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const stats = await getOrgUsageStats(orgId);

  if (stats.destinationsCount >= stats.maxDestinations) {
    return {
      allowed: false,
      reason: `You've reached the maximum of ${stats.maxDestinations} destination${stats.maxDestinations === 1 ? "" : "s"} on your current plan. Upgrade to Pro for unlimited destinations.`,
    };
  }

  return { allowed: true };
}

export function formatSyncInterval(minutes: number): string {
  if (minutes >= 1440) {
    const days = Math.floor(minutes / 1440);
    return `${days} day${days === 1 ? "" : "s"}`;
  } else if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  } else {
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }
}

export { canAddCalendar, canAddDestination, getPlanLimits } from "shared/src/types/plan";
