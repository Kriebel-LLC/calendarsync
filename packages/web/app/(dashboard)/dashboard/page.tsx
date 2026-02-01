import { redirect } from "next/navigation";
import Link from "next/link";

import { DashboardHeader } from "@/custom-components/header";
import { DashboardShell } from "@/custom-components/shell";
import { Icons } from "@/custom-components/icons";
import { getCurrentServerUser } from "@/lib/session";
import { Button } from "components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "components/ui/card";
import { cookies } from "next/headers";
import { db } from "@/db";
import {
  googleConnections,
  calendars,
  destinations,
  syncConfigs,
  DestinationType,
} from "shared/src/db/schema";
import { eq, desc } from "drizzle-orm";
import { getOrCreateUserRecord } from "@/lib/auth";
import { Badge } from "components/ui/badge";
import { getOrgsForUser } from "@/lib/org";

export const metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const user = await getCurrentServerUser(cookies());

  if (!user) {
    redirect("/login");
  }

  await getOrCreateUserRecord(user.uid);

  // Get user's orgs to fetch their connections
  const userOrgs = await getOrgsForUser(user.uid);

  if (userOrgs.length === 0) {
    return (
      <DashboardShell>
        <DashboardHeader
          heading="Dashboard"
          text="Overview of your calendar syncs."
        />
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Icons.calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No organization found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Create an organization to start syncing calendars.
              </p>
            </div>
          </CardContent>
        </Card>
      </DashboardShell>
    );
  }

  const orgId = userOrgs[0].id;
  const orgName = userOrgs[0].name;

  // Fetch user's Google connections (calendars)
  const connections = await db()
    .select()
    .from(googleConnections)
    .where(eq(googleConnections.orgId, orgId))
    .orderBy(desc(googleConnections.createdAt));

  // Fetch user's calendars
  const userCalendars = await db()
    .select()
    .from(calendars)
    .where(eq(calendars.orgId, orgId))
    .orderBy(desc(calendars.createdAt));

  // Fetch user's destinations
  const userDestinations = await db()
    .select()
    .from(destinations)
    .where(eq(destinations.orgId, orgId))
    .orderBy(desc(destinations.createdAt));

  // Fetch user's sync configs
  const userSyncs = await db()
    .select({
      syncConfig: syncConfigs,
      calendar: calendars,
      destination: destinations,
    })
    .from(syncConfigs)
    .leftJoin(calendars, eq(syncConfigs.calendarId, calendars.id))
    .leftJoin(destinations, eq(syncConfigs.destinationId, destinations.id))
    .where(eq(syncConfigs.orgId, orgId))
    .orderBy(desc(syncConfigs.createdAt))
    .limit(5);

  const activeSyncs = userSyncs.filter((s) => s.syncConfig.isEnabled);

  return (
    <DashboardShell>
      <DashboardHeader
        heading="Dashboard"
        text="Overview of your calendar syncs."
      >
        <Link href={`/${orgName}`}>
          <Button>
            <Icons.add className="mr-2 h-4 w-4" />
            Manage Syncs
          </Button>
        </Link>
      </DashboardHeader>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Google Accounts
            </CardTitle>
            <Icons.google className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{connections.length}</div>
            <p className="text-xs text-muted-foreground">
              {userCalendars.length} calendars connected
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Destinations</CardTitle>
            <Icons.spreadsheet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userDestinations.length}</div>
            <p className="text-xs text-muted-foreground">
              Sheets, Notion, Airtable
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Syncs</CardTitle>
            <Icons.refresh className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSyncs.length}</div>
            <p className="text-xs text-muted-foreground">
              of {userSyncs.length} total syncs
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Google Connections */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Google Accounts</CardTitle>
            <CardDescription>
              Connected Google accounts for syncing calendar events.
            </CardDescription>
          </div>
          <Link href={`/${orgName}`}>
            <Button variant="outline" size="sm">
              <Icons.add className="mr-2 h-4 w-4" />
              Connect
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {connections.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Icons.google className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No accounts connected</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Connect your Google account to start syncing calendar events.
              </p>
              <Link href={`/${orgName}`}>
                <Button>
                  <Icons.google className="mr-2 h-4 w-4" />
                  Connect Google Account
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {connections.slice(0, 3).map((connection) => (
                <div
                  key={connection.id}
                  className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <Icons.google className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{connection.email}</p>
                      <p className="text-sm text-muted-foreground">
                        Connected {formatRelativeTime(connection.createdAt)}
                      </p>
                    </div>
                  </div>
                  <Badge variant="default">Connected</Badge>
                </div>
              ))}
              {connections.length > 3 && (
                <Link
                  href={`/${orgName}`}
                  className="text-sm text-muted-foreground hover:underline"
                >
                  View all {connections.length} connections
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Syncs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Syncs</CardTitle>
            <CardDescription>
              Your calendar sync configurations and their status.
            </CardDescription>
          </div>
          <Link href={`/${orgName}`}>
            <Button variant="outline" size="sm">
              View All
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {userSyncs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Icons.refresh className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No syncs configured</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Create a sync to start exporting calendar events.
              </p>
              <Link href={`/${orgName}`}>
                <Button>
                  <Icons.add className="mr-2 h-4 w-4" />
                  Create Sync
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {userSyncs.map(({ syncConfig, calendar, destination }) => (
                <Link
                  key={syncConfig.id}
                  href={`/${orgName}`}
                  className="block"
                >
                  <div className="flex items-center justify-between border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Icons.calendar className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {calendar?.name || "Calendar"}
                        </span>
                      </div>
                      <Icons.arrowRight className="h-4 w-4 text-muted-foreground" />
                      <div className="flex items-center gap-2">
                        {destination?.type ===
                        DestinationType.GOOGLE_SHEETS ? (
                          <Icons.spreadsheet className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <Icons.page className="h-5 w-5 text-muted-foreground" />
                        )}
                        <span className="text-sm font-medium">
                          {destination?.name || "Destination"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {syncConfig.lastSyncAt && (
                        <p className="text-xs text-muted-foreground">
                          Last sync {formatRelativeTime(syncConfig.lastSyncAt)}
                        </p>
                      )}
                      <Badge
                        variant={syncConfig.isEnabled ? "default" : "secondary"}
                      >
                        {syncConfig.isEnabled ? "Active" : "Paused"}
                      </Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}
