import { notFound, redirect } from "next/navigation";

import { DashboardHeader } from "@/custom-components/header";
import { DashboardShell } from "@/custom-components/shell";
import { CalendarSyncDashboard } from "@/custom-components/calendar-sync-dashboard";
import { getOrgUserForOrgName } from "@/lib/org";
import { getCurrentServerUser } from "@/lib/session";
import { getOrgUsageStats } from "@/lib/plan-gating";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import {
  googleConnections,
  calendars,
  destinations,
  syncConfigs,
} from "shared/src/db/schema";
import { cookies } from "next/headers";
import { Role, hasPermission } from "shared/src/types/role";

export const metadata = {
  title: "Dashboard",
};

export default async function DashboardPage({
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

  // Fetch org data in parallel
  const [usageStats, connections, cals, dests, configs] = await Promise.all([
    getOrgUsageStats(userInOrg.orgId),
    db()
      .select({
        id: googleConnections.id,
        email: googleConnections.email,
        createdAt: googleConnections.createdAt,
      })
      .from(googleConnections)
      .where(eq(googleConnections.orgId, userInOrg.orgId)),
    db()
      .select()
      .from(calendars)
      .where(eq(calendars.orgId, userInOrg.orgId)),
    db()
      .select()
      .from(destinations)
      .where(eq(destinations.orgId, userInOrg.orgId)),
    db()
      .select()
      .from(syncConfigs)
      .where(eq(syncConfigs.orgId, userInOrg.orgId)),
  ]);

  return (
    <DashboardShell>
      <DashboardHeader
        heading="CalendarSync"
        text="Sync your Google Calendar events to Google Sheets."
      />
      <CalendarSyncDashboard
        orgId={userInOrg.orgId}
        orgName={name}
        connections={connections}
        calendars={cals}
        destinations={dests}
        syncConfigs={configs}
        usageStats={usageStats}
        canWrite={hasPermission(userInOrg.role, Role.WRITE)}
      />
    </DashboardShell>
  );
}
