"use client";

import * as React from "react";
import { clientFetch } from "@/lib/fetch";
import { cn } from "components/lib/utils";
import { Button } from "components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "components/ui/select";
import { toast } from "components/ui/use-toast";

interface NotionConnectionInfo {
  connected: boolean;
  workspaceId?: string;
  workspaceName?: string;
  workspaceIcon?: string;
  selectedDatabaseId?: string;
  selectedDatabaseName?: string;
}

interface DatabaseInfo {
  id: string;
  title: string;
  icon?: string;
}

interface NotionSettingsProps extends React.HTMLAttributes<HTMLDivElement> {
  initialConnection?: NotionConnectionInfo;
}

export function NotionSettings({
  initialConnection,
  className,
  ...props
}: NotionSettingsProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [isLoadingDatabases, setIsLoadingDatabases] = React.useState(false);
  const [connection, setConnection] = React.useState<NotionConnectionInfo>(
    initialConnection || { connected: false }
  );
  const [databases, setDatabases] = React.useState<DatabaseInfo[]>([]);
  const [selectedDatabaseId, setSelectedDatabaseId] = React.useState<string>(
    initialConnection?.selectedDatabaseId || ""
  );

  React.useEffect(() => {
    if (connection.connected && databases.length === 0) {
      loadDatabases();
    }
  }, [connection.connected]);

  async function loadDatabases() {
    setIsLoadingDatabases(true);
    await clientFetch<{ databases: DatabaseInfo[] }>(
      "/api/destinations/notion/databases",
      undefined,
      {
        afterRequestFinish: () => setIsLoadingDatabases(false),
        onRequestSuccess: (response) => {
          setDatabases(response.databases);
        },
      }
    );
  }

  async function handleConnect() {
    setIsLoading(true);
    window.location.href = "/api/destinations/notion/authorize";
  }

  async function handleDisconnect() {
    setIsLoading(true);
    await clientFetch(
      "/api/destinations/notion/connection",
      {
        method: "DELETE",
      },
      {
        afterRequestFinish: () => setIsLoading(false),
        onRequestSuccess: () => {
          setConnection({ connected: false });
          setDatabases([]);
          setSelectedDatabaseId("");
          toast({
            title: "Disconnected",
            description: "Your Notion workspace has been disconnected.",
          });
        },
      }
    );
  }

  async function handleDatabaseSelect(databaseId: string) {
    const database = databases.find((db) => db.id === databaseId);
    if (!database) return;

    setIsLoading(true);
    await clientFetch(
      "/api/destinations/notion/connection",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          databaseId: database.id,
          databaseName: database.title,
        }),
      },
      {
        afterRequestFinish: () => setIsLoading(false),
        onRequestSuccess: () => {
          setSelectedDatabaseId(databaseId);
          setConnection((prev) => ({
            ...prev,
            selectedDatabaseId: database.id,
            selectedDatabaseName: database.title,
          }));
          toast({
            title: "Database selected",
            description: `Calendar events will sync to "${database.title}".`,
          });
        },
      }
    );
  }

  return (
    <div className={cn(className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Notion Destination</CardTitle>
          <CardDescription>
            Sync your calendar events to a Notion database.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {connection.connected ? (
            <>
              <div className="flex items-center space-x-2">
                {connection.workspaceIcon && (
                  <span className="text-2xl">{connection.workspaceIcon}</span>
                )}
                <div>
                  <p className="text-sm font-medium">
                    Connected to {connection.workspaceName || "Notion"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Workspace ID: {connection.workspaceId}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Target Database</label>
                <Select
                  value={selectedDatabaseId}
                  onValueChange={handleDatabaseSelect}
                  disabled={isLoading || isLoadingDatabases}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        isLoadingDatabases
                          ? "Loading databases..."
                          : "Select a database"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {databases.map((db) => (
                      <SelectItem key={db.id} value={db.id}>
                        {db.icon && <span className="mr-2">{db.icon}</span>}
                        {db.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Choose the Notion database where calendar events will be
                  synced. Make sure the database has been shared with the
                  integration.
                </p>
              </div>

              {connection.selectedDatabaseName && (
                <div className="rounded-md bg-muted p-3">
                  <p className="text-sm">
                    <strong>Currently syncing to:</strong>{" "}
                    {connection.selectedDatabaseName}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-medium">Field Mapping</p>
                <div className="rounded-md border p-3 text-xs text-muted-foreground">
                  <p className="mb-2">
                    Your calendar events will be mapped to Notion properties:
                  </p>
                  <ul className="list-inside list-disc space-y-1">
                    <li>
                      <strong>Title</strong> (title) - Event title
                    </li>
                    <li>
                      <strong>Start</strong> (date) - Event start date/time
                    </li>
                    <li>
                      <strong>End</strong> (date) - Event end date/time
                    </li>
                    <li>
                      <strong>Duration</strong> (number) - Duration in hours
                    </li>
                    <li>
                      <strong>Calendar</strong> (select) - Source calendar name
                    </li>
                    <li>
                      <strong>Description</strong> (rich_text) - Event
                      description
                    </li>
                    <li>
                      <strong>Location</strong> (rich_text) - Event location
                    </li>
                    <li>
                      <strong>Attendees</strong> (multi_select) - Event
                      attendees
                    </li>
                    <li>
                      <strong>Status</strong> (select) - Event status
                    </li>
                  </ul>
                </div>
              </div>
            </>
          ) : (
            <div className="py-4 text-center">
              <p className="mb-4 text-sm text-muted-foreground">
                Connect your Notion workspace to sync calendar events to a
                database.
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          {connection.connected ? (
            <>
              <Button
                variant="outline"
                onClick={loadDatabases}
                disabled={isLoading || isLoadingDatabases}
              >
                Refresh Databases
              </Button>
              <Button
                variant="destructive"
                onClick={handleDisconnect}
                disabled={isLoading}
              >
                Disconnect
              </Button>
            </>
          ) : (
            <Button onClick={handleConnect} loading={isLoading}>
              Connect Notion
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
