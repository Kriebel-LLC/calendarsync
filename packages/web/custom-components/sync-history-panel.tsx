"use client";

import { useState, useEffect } from "react";
import { Badge } from "components/ui/badge";
import { Button } from "components/ui/button";
import { DestinationType } from "shared/src/db/schema";

interface SyncedEventInfo {
  id: string;
  externalEventId: string;
  eventTitle: string | null;
  calendarName: string | null;
  eventStart: string | null;
  eventEnd: string | null;
  status: string;
  notionPageId: string | null;
  airtableRecordId: string | null;
  sheetRowNumber: number | null;
  lastSyncedAt: string | null;
}

interface SyncHistoryResponse {
  syncConfig: {
    id: string;
    lastSyncAt: string | null;
    isEnabled: boolean;
  };
  events: SyncedEventInfo[];
  totalEvents: number;
}

interface SyncHistoryPanelProps {
  syncConfigId: string;
  calendarName: string;
  destinationName: string;
  destinationType?: string;
  lastSyncAt: Date | null;
  isEnabled: boolean;
}

export function SyncHistoryPanel({
  syncConfigId,
  calendarName,
  destinationName,
  destinationType,
  lastSyncAt,
  isEnabled,
}: SyncHistoryPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [data, setData] = useState<SyncHistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isExpanded && !data) {
      loadHistory();
    }
  }, [isExpanded]);

  async function loadHistory() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/sync-configs/${syncConfigId}/history`
      );
      if (!response.ok) {
        throw new Error("Failed to load sync history");
      }
      const result = (await response.json()) as SyncHistoryResponse;
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load sync history"
      );
    } finally {
      setIsLoading(false);
    }
  }

  function getDestinationRef(event: SyncedEventInfo): string | null {
    if (destinationType === DestinationType.NOTION && event.notionPageId) {
      return `Notion page: ${event.notionPageId.slice(0, 8)}...`;
    }
    if (
      destinationType === DestinationType.AIRTABLE &&
      event.airtableRecordId
    ) {
      return `Airtable record: ${event.airtableRecordId.slice(0, 8)}...`;
    }
    if (
      destinationType === DestinationType.GOOGLE_SHEETS &&
      event.sheetRowNumber
    ) {
      return `Sheet row: ${event.sheetRowNumber}`;
    }
    return null;
  }

  return (
    <div className="rounded-lg border">
      <button
        className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div>
          <h4 className="font-medium">
            {calendarName} &rarr; {destinationName}
          </h4>
          <p className="text-sm text-muted-foreground">
            {lastSyncAt
              ? `Last synced: ${new Date(lastSyncAt).toLocaleString()}`
              : "Never synced"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isEnabled ? "default" : "secondary"}>
            {isEnabled ? "Active" : "Paused"}
          </Badge>
          {data && (
            <Badge variant="outline">{data.totalEvents} events</Badge>
          )}
          <span className="text-muted-foreground">
            {isExpanded ? "\u25B2" : "\u25BC"}
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t px-4 pb-4 pt-2">
          {isLoading ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Loading sync history...
            </p>
          ) : error ? (
            <div className="py-4 text-center">
              <p className="text-sm text-red-500">{error}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadHistory}
                className="mt-2"
              >
                Retry
              </Button>
            </div>
          ) : data && data.events.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No synced events yet. Run a sync to see history here.
            </p>
          ) : data ? (
            <div className="space-y-1">
              <div className="grid grid-cols-12 gap-2 py-2 text-xs font-medium text-muted-foreground">
                <div className="col-span-4">Event</div>
                <div className="col-span-3">Date</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-3">Last Synced</div>
              </div>
              {data.events.map((event) => (
                <div
                  key={event.id}
                  className="grid grid-cols-12 items-center gap-2 rounded-md py-2 text-sm hover:bg-muted/30"
                >
                  <div className="col-span-4 truncate">
                    <span className="font-medium">
                      {event.eventTitle || "Untitled Event"}
                    </span>
                    {getDestinationRef(event) && (
                      <p className="truncate text-xs text-muted-foreground">
                        {getDestinationRef(event)}
                      </p>
                    )}
                  </div>
                  <div className="col-span-3 text-muted-foreground">
                    {event.eventStart
                      ? new Date(event.eventStart).toLocaleDateString()
                      : "-"}
                  </div>
                  <div className="col-span-2">
                    <Badge
                      variant={
                        event.status === "active" ? "default" : "secondary"
                      }
                      className="text-xs"
                    >
                      {event.status === "active" ? "Synced" : "Cancelled"}
                    </Badge>
                  </div>
                  <div className="col-span-3 text-xs text-muted-foreground">
                    {event.lastSyncedAt
                      ? new Date(event.lastSyncedAt).toLocaleString()
                      : "-"}
                  </div>
                </div>
              ))}
              {data.totalEvents >= 100 && (
                <p className="pt-2 text-center text-xs text-muted-foreground">
                  Showing most recent 100 events
                </p>
              )}
            </div>
          ) : null}

          {data && (
            <div className="mt-2 flex justify-end">
              <Button variant="ghost" size="sm" onClick={loadHistory}>
                Refresh
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
