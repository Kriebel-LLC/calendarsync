"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "components/ui/card";
import { Badge } from "components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "components/ui/tabs";
import { toast } from "components/ui/use-toast";
import {
  Calendar,
  Destination,
  DestinationType,
  SyncConfig,
} from "shared/src/db/schema";
import { UsageStats } from "@/lib/plan-gating";
import { ConnectGoogleButton } from "./connect-google-button";
import { AddCalendarDialog } from "./add-calendar-dialog";
import { AddDestinationDialog } from "./add-destination-dialog";
import { CreateSyncDialog } from "./create-sync-dialog";
import { SyncHistoryPanel } from "./sync-history-panel";
import { FieldMappingDisplay } from "./field-mapping-display";

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

function getDestinationTypeLabel(type: string): string {
  switch (type) {
    case DestinationType.GOOGLE_SHEETS:
      return "Google Sheets";
    case DestinationType.NOTION:
      return "Notion";
    case DestinationType.AIRTABLE:
      return "Airtable";
    default:
      return type;
  }
}

function getDestinationDetail(destination: Destination): string {
  switch (destination.type) {
    case DestinationType.GOOGLE_SHEETS:
      return [destination.spreadsheetName, destination.sheetName]
        .filter(Boolean)
        .join(" - ");
    case DestinationType.NOTION:
      return destination.notionDatabaseName || "No database selected";
    case DestinationType.AIRTABLE:
      return [destination.airtableBaseName, destination.airtableTableName]
        .filter(Boolean)
        .join(" - ");
    default:
      return "";
  }
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
  const router = useRouter();
  const [isAddCalendarOpen, setIsAddCalendarOpen] = useState(false);
  const [isAddDestinationOpen, setIsAddDestinationOpen] = useState(false);
  const [isCreateSyncOpen, setIsCreateSyncOpen] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const hasConnections = connections.length > 0;
  const hasCalendars = calendars.length > 0;
  const hasDestinations = destinations.length > 0;

  async function handleDisconnectGoogle(connectionId: string) {
    if (
      !confirm(
        "Are you sure you want to disconnect this Google account? This will remove all associated calendars, destinations, and sync configurations."
      )
    ) {
      return;
    }

    setDisconnectingId(connectionId);
    try {
      const response = await fetch(`/api/google/connections/${connectionId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "Failed to disconnect");
      }

      toast({
        title: "Disconnected",
        description: "Google account has been disconnected.",
      });
      router.refresh();
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to disconnect",
        variant: "destructive",
      });
    } finally {
      setDisconnectingId(null);
    }
  }

  async function handleTriggerSync(syncConfigId: string) {
    setSyncingId(syncConfigId);
    try {
      const response = await fetch(`/api/sync-configs/${syncConfigId}/sync`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "Failed to trigger sync");
      }

      const result = (await response.json()) as {
        success: boolean;
        eventsAdded: number;
        eventsUpdated: number;
        eventsDeleted: number;
        errors: string[];
      };

      if (result.success) {
        toast({
          title: "Sync complete",
          description: `Added: ${result.eventsAdded}, Updated: ${result.eventsUpdated}, Deleted: ${result.eventsDeleted}`,
        });
      } else {
        toast({
          title: "Sync completed with errors",
          description: result.errors.join(", "),
          variant: "destructive",
        });
      }
      router.refresh();
    } catch (err) {
      toast({
        title: "Sync failed",
        description:
          err instanceof Error ? err.message : "Failed to trigger sync",
        variant: "destructive",
      });
    } finally {
      setSyncingId(null);
    }
  }

  return (
    <Tabs defaultValue="overview" className="space-y-6">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="sync-config">Sync Configuration</TabsTrigger>
        <TabsTrigger value="history">Sync History</TabsTrigger>
      </TabsList>

      {/* Overview Tab */}
      <TabsContent value="overview" className="space-y-6">
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
              {canWrite && (
                <ConnectGoogleButton orgId={orgId} orgName={orgName} />
              )}
            </div>
          </CardHeader>
          <CardContent>
            {connections.length === 0 ? (
              <p className="text-muted-foreground">
                No Google accounts connected yet. Connect an account to get
                started.
              </p>
            ) : (
              <div className="space-y-2">
                {connections.map((connection) => (
                  <div
                    key={connection.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                        <span className="text-sm font-medium text-blue-600">
                          {connection.email[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium">{connection.email}</span>
                        <p className="text-xs text-muted-foreground">
                          Connected{" "}
                          {new Date(connection.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Connected</Badge>
                      {canWrite && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleDisconnectGoogle(connection.id)
                          }
                          disabled={disconnectingId === connection.id}
                        >
                          {disconnectingId === connection.id
                            ? "Disconnecting..."
                            : "Disconnect"}
                        </Button>
                      )}
                    </div>
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
                    <Badge
                      variant={calendar.isEnabled ? "default" : "secondary"}
                    >
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
                  Where your calendar events will be synced to
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
                No destinations added yet. Add a destination to sync events to.
              </p>
            ) : (
              <div className="space-y-2">
                {destinations.map((destination) => (
                  <div
                    key={destination.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{destination.name}</span>
                        <Badge variant="outline">
                          {getDestinationTypeLabel(destination.type)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {getDestinationDetail(destination)}
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
                Add at least one calendar and one destination to create sync
                configurations.
              </p>
            ) : syncConfigs.length === 0 ? (
              <p className="text-muted-foreground">
                No sync configurations yet. Create one to start syncing.
              </p>
            ) : (
              <div className="space-y-3">
                {syncConfigs.map((config) => {
                  const calendar = calendars.find(
                    (c) => c.id === config.calendarId
                  );
                  const destination = destinations.find(
                    (d) => d.id === config.destinationId
                  );
                  return (
                    <div
                      key={config.id}
                      className="space-y-2 rounded-lg border p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium">
                            {calendar?.name || "Unknown Calendar"}
                          </span>
                          <span className="mx-2 text-muted-foreground">
                            &rarr;
                          </span>
                          <span className="font-medium">
                            {destination?.name || "Unknown Destination"}
                          </span>
                          {destination && (
                            <Badge variant="outline" className="ml-2">
                              {getDestinationTypeLabel(destination.type)}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              config.isEnabled ? "default" : "secondary"
                            }
                          >
                            {config.isEnabled ? "Active" : "Paused"}
                          </Badge>
                          {canWrite && config.isEnabled && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleTriggerSync(config.id)}
                              disabled={syncingId === config.id}
                            >
                              {syncingId === config.id
                                ? "Syncing..."
                                : "Sync Now"}
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {config.lastSyncAt ? (
                          <span>
                            Last synced:{" "}
                            {new Date(config.lastSyncAt).toLocaleString()}
                          </span>
                        ) : (
                          <span>Never synced</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Sync Configuration Tab */}
      <TabsContent value="sync-config" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Sync Configuration</CardTitle>
            <CardDescription>
              Configure which calendars sync to which destinations and how fields
              are mapped.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {syncConfigs.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-muted-foreground">
                  No sync configurations yet. Go to the Overview tab to create
                  one.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {syncConfigs.map((config) => {
                  const calendar = calendars.find(
                    (c) => c.id === config.calendarId
                  );
                  const destination = destinations.find(
                    (d) => d.id === config.destinationId
                  );
                  return (
                    <div
                      key={config.id}
                      className="space-y-4 rounded-lg border p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">
                            {calendar?.name || "Unknown Calendar"}
                            <span className="mx-2 font-normal text-muted-foreground">
                              &rarr;
                            </span>
                            {destination?.name || "Unknown Destination"}
                          </h3>
                          {destination && (
                            <p className="text-sm text-muted-foreground">
                              {getDestinationTypeLabel(destination.type)}{" "}
                              &middot; {getDestinationDetail(destination)}
                            </p>
                          )}
                        </div>
                        <Badge
                          variant={config.isEnabled ? "default" : "secondary"}
                        >
                          {config.isEnabled ? "Active" : "Paused"}
                        </Badge>
                      </div>

                      {/* Calendar Selection Info */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Source Calendar</h4>
                        <div className="flex items-center gap-2 rounded-md bg-muted p-2">
                          {calendar?.color && (
                            <div
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: calendar.color }}
                            />
                          )}
                          <span className="text-sm">
                            {calendar?.name || "Unknown"}
                          </span>
                        </div>
                      </div>

                      {/* Target Destination Info */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">
                          Target Destination
                        </h4>
                        <div className="rounded-md bg-muted p-2">
                          <span className="text-sm">
                            {destination?.name || "Unknown"}{" "}
                            {destination && (
                              <span className="text-muted-foreground">
                                ({getDestinationTypeLabel(destination.type)})
                              </span>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Field Mapping */}
                      {destination && (
                        <FieldMappingDisplay
                          destinationType={destination.type}
                        />
                      )}

                      {/* Sync Actions */}
                      {canWrite && config.isEnabled && (
                        <div className="flex items-center gap-2 border-t pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTriggerSync(config.id)}
                            disabled={syncingId === config.id}
                          >
                            {syncingId === config.id
                              ? "Syncing..."
                              : "Sync Now"}
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Sync History Tab */}
      <TabsContent value="history" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Sync History</CardTitle>
            <CardDescription>
              View recent sync activity and event status across all
              configurations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {syncConfigs.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-muted-foreground">
                  No sync configurations yet. Create one to see sync history.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {syncConfigs.map((config) => {
                  const calendar = calendars.find(
                    (c) => c.id === config.calendarId
                  );
                  const destination = destinations.find(
                    (d) => d.id === config.destinationId
                  );
                  return (
                    <SyncHistoryPanel
                      key={config.id}
                      syncConfigId={config.id}
                      calendarName={calendar?.name || "Unknown Calendar"}
                      destinationName={
                        destination?.name || "Unknown Destination"
                      }
                      destinationType={destination?.type}
                      lastSyncAt={config.lastSyncAt}
                      isEnabled={config.isEnabled}
                    />
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

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
    </Tabs>
  );
}
