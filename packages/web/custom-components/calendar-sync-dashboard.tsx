"use client";

import { useState } from "react";
import { Button } from "components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "components/ui/card";
import { Badge } from "components/ui/badge";
import {
  Calendar,
  Destination,
  SyncConfig,
} from "shared/src/db/schema";
import { UsageStats } from "@/lib/plan-gating";
import { ConnectGoogleButton } from "./connect-google-button";
import { AddCalendarDialog } from "./add-calendar-dialog";
import { AddDestinationDialog } from "./add-destination-dialog";
import { CreateSyncDialog } from "./create-sync-dialog";

interface GoogleConnectionInfo {
  id: string;
  email: string;
  createdAt: Date;
}

interface CalendarSyncDashboardProps {
  orgId: string;
  orgName: string;
  connections: GoogleConnectionInfo[];
  calendars: Calendar[];
  destinations: Destination[];
  syncConfigs: SyncConfig[];
  usageStats: UsageStats;
  canWrite: boolean;
}

export function CalendarSyncDashboard({
  orgId,
  orgName,
  connections,
  calendars,
  destinations,
  syncConfigs,
  usageStats,
  canWrite,
}: CalendarSyncDashboardProps) {
  const [isAddCalendarOpen, setIsAddCalendarOpen] = useState(false);
  const [isAddDestinationOpen, setIsAddDestinationOpen] = useState(false);
  const [isCreateSyncOpen, setIsCreateSyncOpen] = useState(false);

  const hasConnections = connections.length > 0;
  const hasCalendars = calendars.length > 0;
  const hasDestinations = destinations.length > 0;

  return (
    <div className="space-y-6">
      {/* Usage Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Usage</CardTitle>
          <CardDescription>
            Your current plan limits and usage
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Calendars</p>
              <p className="text-2xl font-bold">
                {usageStats.calendarsCount} /{" "}
                {usageStats.maxCalendars === Infinity
                  ? "Unlimited"
                  : usageStats.maxCalendars}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Destinations</p>
              <p className="text-2xl font-bold">
                {usageStats.destinationsCount} /{" "}
                {usageStats.maxDestinations === Infinity
                  ? "Unlimited"
                  : usageStats.maxDestinations}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Sync Interval</p>
              <p className="text-2xl font-bold">
                {usageStats.syncIntervalMinutes >= 60
                  ? `${usageStats.syncIntervalMinutes / 60}h`
                  : `${usageStats.syncIntervalMinutes}m`}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Google Connections */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Google Account Connections</CardTitle>
              <CardDescription>
                Connect your Google account to access Calendar and Sheets
              </CardDescription>
            </div>
            {canWrite && <ConnectGoogleButton orgId={orgId} orgName={orgName} />}
          </div>
        </CardHeader>
        <CardContent>
          {connections.length === 0 ? (
            <p className="text-muted-foreground">
              No Google accounts connected yet. Connect an account to get started.
            </p>
          ) : (
            <div className="space-y-2">
              {connections.map((connection) => (
                <div
                  key={connection.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-blue-600 text-sm font-medium">
                        {connection.email[0].toUpperCase()}
                      </span>
                    </div>
                    <span className="font-medium">{connection.email}</span>
                  </div>
                  <Badge variant="secondary">Connected</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Calendars */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Calendars</CardTitle>
              <CardDescription>
                Google Calendars to sync events from
              </CardDescription>
            </div>
            {canWrite && hasConnections && (
              <Button onClick={() => setIsAddCalendarOpen(true)}>
                Add Calendar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!hasConnections ? (
            <p className="text-muted-foreground">
              Connect a Google account first to add calendars.
            </p>
          ) : calendars.length === 0 ? (
            <p className="text-muted-foreground">
              No calendars added yet. Add a calendar to start syncing events.
            </p>
          ) : (
            <div className="space-y-2">
              {calendars.map((calendar) => (
                <div
                  key={calendar.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    {calendar.color && (
                      <div
                        className="h-4 w-4 rounded-full"
                        style={{ backgroundColor: calendar.color }}
                      />
                    )}
                    <span className="font-medium">{calendar.name}</span>
                  </div>
                  <Badge variant={calendar.isEnabled ? "default" : "secondary"}>
                    {calendar.isEnabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Destinations */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Destinations</CardTitle>
              <CardDescription>
                Google Sheets where events will be synced
              </CardDescription>
            </div>
            {canWrite && hasConnections && (
              <Button onClick={() => setIsAddDestinationOpen(true)}>
                Add Destination
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!hasConnections ? (
            <p className="text-muted-foreground">
              Connect a Google account first to add destinations.
            </p>
          ) : destinations.length === 0 ? (
            <p className="text-muted-foreground">
              No destinations added yet. Add a Google Sheet to sync events to.
            </p>
          ) : (
            <div className="space-y-2">
              {destinations.map((destination) => (
                <div
                  key={destination.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <span className="font-medium">{destination.name}</span>
                    <p className="text-sm text-muted-foreground">
                      {destination.spreadsheetName} - {destination.sheetName}
                    </p>
                  </div>
                  <Badge
                    variant={destination.isEnabled ? "default" : "secondary"}
                  >
                    {destination.isEnabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync Configurations */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Sync Configurations</CardTitle>
              <CardDescription>
                Link calendars to destinations for syncing
              </CardDescription>
            </div>
            {canWrite && hasCalendars && hasDestinations && (
              <Button onClick={() => setIsCreateSyncOpen(true)}>
                Create Sync
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!hasCalendars || !hasDestinations ? (
            <p className="text-muted-foreground">
              Add at least one calendar and one destination to create sync configurations.
            </p>
          ) : syncConfigs.length === 0 ? (
            <p className="text-muted-foreground">
              No sync configurations yet. Create one to start syncing.
            </p>
          ) : (
            <div className="space-y-2">
              {syncConfigs.map((config) => {
                const calendar = calendars.find((c) => c.id === config.calendarId);
                const destination = destinations.find(
                  (d) => d.id === config.destinationId
                );
                return (
                  <div
                    key={config.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <span className="font-medium">
                        {calendar?.name || "Unknown Calendar"} →{" "}
                        {destination?.name || "Unknown Destination"}
                      </span>
                      {config.lastSyncAt && (
                        <p className="text-sm text-muted-foreground">
                          Last synced: {new Date(config.lastSyncAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <Badge variant={config.isEnabled ? "default" : "secondary"}>
                      {config.isEnabled ? "Active" : "Paused"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <AddCalendarDialog
        open={isAddCalendarOpen}
        onOpenChange={setIsAddCalendarOpen}
        orgId={orgId}
        connections={connections}
      />
      <AddDestinationDialog
        open={isAddDestinationOpen}
        onOpenChange={setIsAddDestinationOpen}
        orgId={orgId}
        connections={connections}
      />
      <CreateSyncDialog
        open={isCreateSyncOpen}
        onOpenChange={setIsCreateSyncOpen}
        orgId={orgId}
        calendars={calendars}
        destinations={destinations}
      />
    </div>
  );
}
