"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "components/ui/select";
import { Label } from "components/ui/label";
import { Input } from "components/ui/input";
import { Separator } from "components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "components/ui/collapsible";
import {
  Calendar,
  Destination,
  SyncInterval,
  DestinationType,
} from "shared/src/db/schema";
import { ChevronDown, ChevronUp } from "lucide-react";

interface CreateSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  calendars: Calendar[];
  destinations: Destination[];
}

// Default column mapping for Google Sheets
const defaultColumnMapping = {
  title: "A",
  start: "B",
  end: "C",
  description: "D",
  location: "E",
  attendees: "F",
  organizer: "G",
  status: "H",
};

// Sync interval options
const syncIntervalOptions = [
  { value: SyncInterval.FIFTEEN_MINUTES, label: "Every 15 minutes" },
  { value: SyncInterval.HOURLY, label: "Hourly" },
  { value: SyncInterval.DAILY, label: "Daily" },
];

export function CreateSyncDialog({
  open,
  onOpenChange,
  orgId,
  calendars,
  destinations,
}: CreateSyncDialogProps) {
  const router = useRouter();
  const [selectedCalendar, setSelectedCalendar] = useState<string>("");
  const [selectedDestination, setSelectedDestination] = useState<string>("");
  const [syncInterval, setSyncInterval] = useState<number>(SyncInterval.HOURLY);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Column mapping state
  const [columnMapping, setColumnMapping] = useState(defaultColumnMapping);
  const [showColumnMapping, setShowColumnMapping] = useState(false);

  // Filter configuration state
  const [showFilters, setShowFilters] = useState(false);
  const [timeRangeStart, setTimeRangeStart] = useState<string>("");
  const [timeRangeEnd, setTimeRangeEnd] = useState<string>("");
  const [keywords, setKeywords] = useState<string>("");

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setSelectedCalendar("");
      setSelectedDestination("");
      setSyncInterval(SyncInterval.HOURLY);
      setColumnMapping(defaultColumnMapping);
      setShowColumnMapping(false);
      setShowFilters(false);
      setTimeRangeStart("");
      setTimeRangeEnd("");
      setKeywords("");
      setError(null);
    }
  }, [open]);

  // Get the selected destination to check its type
  const selectedDest = destinations.find((d) => d.id === selectedDestination);
  const isGoogleSheets = selectedDest?.type === DestinationType.GOOGLE_SHEETS;

  async function handleSubmit() {
    if (!selectedCalendar || !selectedDestination) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Build filter config
      const filterConfig: Record<string, unknown> = {};
      if (timeRangeStart) filterConfig.timeRangeStart = timeRangeStart;
      if (timeRangeEnd) filterConfig.timeRangeEnd = timeRangeEnd;
      if (keywords.trim()) {
        filterConfig.keywords = keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean);
      }

      const response = await fetch("/api/sync-configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          calendarId: selectedCalendar,
          destinationId: selectedDestination,
          syncIntervalMinutes: syncInterval,
          columnMapping: isGoogleSheets ? columnMapping : undefined,
          filterConfig:
            Object.keys(filterConfig).length > 0 ? filterConfig : undefined,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "Failed to create sync configuration");
      }

      onOpenChange(false);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create sync configuration"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const enabledCalendars = calendars.filter((c) => c.isEnabled);
  const enabledDestinations = destinations.filter((d) => d.isEnabled);

  const updateColumnMapping = (field: string, value: string) => {
    setColumnMapping((prev) => ({ ...prev, [field]: value.toUpperCase() }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Sync Configuration</DialogTitle>
          <DialogDescription>
            Link a calendar to a destination to start syncing events.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Calendar Selection */}
          <div className="space-y-2">
            <Label>Calendar</Label>
            <Select
              value={selectedCalendar}
              onValueChange={setSelectedCalendar}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a calendar" />
              </SelectTrigger>
              <SelectContent>
                {enabledCalendars.map((calendar) => (
                  <SelectItem key={calendar.id} value={calendar.id}>
                    <div className="flex items-center gap-2">
                      {calendar.color && (
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: calendar.color }}
                        />
                      )}
                      {calendar.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Destination Selection */}
          <div className="space-y-2">
            <Label>Destination</Label>
            <Select
              value={selectedDestination}
              onValueChange={setSelectedDestination}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a destination" />
              </SelectTrigger>
              <SelectContent>
                {enabledDestinations.map((destination) => (
                  <SelectItem key={destination.id} value={destination.id}>
                    <div>
                      <div>{destination.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {destination.spreadsheetName
                          ? `${destination.spreadsheetName} - ${destination.sheetName}`
                          : destination.notionDatabaseName ||
                            destination.airtableTableName ||
                            destination.type}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Sync Frequency */}
          <div className="space-y-2">
            <Label>Sync Frequency</Label>
            <Select
              value={syncInterval.toString()}
              onValueChange={(v) => setSyncInterval(parseInt(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                {syncIntervalOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value.toString()}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              How often calendar events will be synced to the destination.
            </p>
          </div>

          <Separator />

          {/* Column Mapping (for Google Sheets) */}
          {isGoogleSheets && (
            <Collapsible
              open={showColumnMapping}
              onOpenChange={setShowColumnMapping}
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex h-auto w-full justify-between p-0 font-normal"
                >
                  <Label className="cursor-pointer">Column Mapping</Label>
                  {showColumnMapping ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-2">
                <p className="text-xs text-muted-foreground">
                  Map calendar event fields to spreadsheet columns (A, B, C,
                  etc.)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Title</Label>
                    <Input
                      value={columnMapping.title}
                      onChange={(e) =>
                        updateColumnMapping("title", e.target.value)
                      }
                      placeholder="A"
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Start Time</Label>
                    <Input
                      value={columnMapping.start}
                      onChange={(e) =>
                        updateColumnMapping("start", e.target.value)
                      }
                      placeholder="B"
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">End Time</Label>
                    <Input
                      value={columnMapping.end}
                      onChange={(e) =>
                        updateColumnMapping("end", e.target.value)
                      }
                      placeholder="C"
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Description</Label>
                    <Input
                      value={columnMapping.description}
                      onChange={(e) =>
                        updateColumnMapping("description", e.target.value)
                      }
                      placeholder="D"
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Location</Label>
                    <Input
                      value={columnMapping.location}
                      onChange={(e) =>
                        updateColumnMapping("location", e.target.value)
                      }
                      placeholder="E"
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Attendees</Label>
                    <Input
                      value={columnMapping.attendees}
                      onChange={(e) =>
                        updateColumnMapping("attendees", e.target.value)
                      }
                      placeholder="F"
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Organizer</Label>
                    <Input
                      value={columnMapping.organizer}
                      onChange={(e) =>
                        updateColumnMapping("organizer", e.target.value)
                      }
                      placeholder="G"
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Status</Label>
                    <Input
                      value={columnMapping.status}
                      onChange={(e) =>
                        updateColumnMapping("status", e.target.value)
                      }
                      placeholder="H"
                      className="h-8"
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Filters */}
          <Collapsible open={showFilters} onOpenChange={setShowFilters}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="flex h-auto w-full justify-between p-0 font-normal"
              >
                <Label className="cursor-pointer">Filters (Optional)</Label>
                {showFilters ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              <p className="text-xs text-muted-foreground">
                Filter which events get synced based on date range or keywords.
              </p>

              {/* Time Range */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Start Date</Label>
                  <Input
                    type="date"
                    value={timeRangeStart}
                    onChange={(e) => setTimeRangeStart(e.target.value)}
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">End Date</Label>
                  <Input
                    type="date"
                    value={timeRangeEnd}
                    onChange={(e) => setTimeRangeEnd(e.target.value)}
                    className="h-8"
                  />
                </div>
              </div>

              {/* Keywords */}
              <div className="space-y-1">
                <Label className="text-xs">Keywords</Label>
                <Input
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="meeting, standup, review (comma-separated)"
                  className="h-8"
                />
                <p className="text-xs text-muted-foreground">
                  Only sync events containing at least one of these keywords in
                  the title. Leave empty to sync all events.
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedCalendar || !selectedDestination || isSubmitting}
          >
            {isSubmitting ? "Creating..." : "Create Sync"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
