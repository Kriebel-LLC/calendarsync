import { db } from "@/db";
import { eq, sql, count } from "drizzle-orm";
import { orgs, calendars, destinations } from "shared/src/db/schema";
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
  // Get org plan and counts in parallel
  const [orgResult, calendarsResult, destinationsResult] = await Promise.all([
    db().select({ plan: orgs.plan }).from(orgs).where(eq(orgs.id, orgId)),
    db()
      .select({ count: count() })
      .from(calendars)
      .where(eq(calendars.orgId, orgId)),
    db()
      .select({ count: count() })
      .from(destinations)
      .where(eq(destinations.orgId, orgId)),
  ]);

  const plan = orgResult[0]?.plan || Plan.FREE;
  const limits = getPlanLimits(plan);

  return {
    calendarsCount: calendarsResult[0]?.count ?? 0,
    destinationsCount: destinationsResult[0]?.count ?? 0,
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
      reason: `You've reached the maximum of ${stats.maxCalendars} calendar${
        stats.maxCalendars === 1 ? "" : "s"
      } on your current plan. Upgrade to Pro for unlimited calendars.`,
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
      reason: `You've reached the maximum of ${
        stats.maxDestinations
      } destination${
        stats.maxDestinations === 1 ? "" : "s"
      } on your current plan. Upgrade to Pro for unlimited destinations.`,
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

export {
  canAddCalendar,
  canAddDestination,
  getPlanLimits,
} from "shared/src/types/plan";
