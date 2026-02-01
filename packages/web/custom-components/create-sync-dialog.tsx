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
import { Calendar, Destination } from "shared/src/db/schema";

interface CreateSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  calendars: Calendar[];
  destinations: Destination[];
}

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setSelectedCalendar("");
      setSelectedDestination("");
      setError(null);
    }
  }, [open]);

  async function handleSubmit() {
    if (!selectedCalendar || !selectedDestination) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/sync-configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          calendarId: selectedCalendar,
          destinationId: selectedDestination,
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
        err instanceof Error ? err.message : "Failed to create sync configuration"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const enabledCalendars = calendars.filter((c) => c.isEnabled);
  const enabledDestinations = destinations.filter((d) => d.isEnabled);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Sync Configuration</DialogTitle>
          <DialogDescription>
            Link a calendar to a destination to start syncing events.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
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
                        {destination.spreadsheetName} - {destination.sheetName}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
