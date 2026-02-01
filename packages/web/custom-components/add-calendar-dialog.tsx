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

interface GoogleConnectionInfo {
  id: string;
  email: string;
}

interface GoogleCalendarInfo {
  id: string;
  name: string;
  color?: string;
  primary?: boolean;
}

interface AddCalendarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  connections: GoogleConnectionInfo[];
}

export function AddCalendarDialog({
  open,
  onOpenChange,
  orgId,
  connections,
}: AddCalendarDialogProps) {
  const router = useRouter();
  const [selectedConnection, setSelectedConnection] = useState<string>("");
  const [selectedCalendar, setSelectedCalendar] = useState<string>("");
  const [calendars, setCalendars] = useState<GoogleCalendarInfo[]>([]);
  const [isLoadingCalendars, setIsLoadingCalendars] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setSelectedConnection("");
      setSelectedCalendar("");
      setCalendars([]);
      setError(null);
    }
  }, [open]);

  // Fetch calendars when connection is selected
  useEffect(() => {
    if (!selectedConnection) {
      setCalendars([]);
      return;
    }

    async function fetchCalendars() {
      setIsLoadingCalendars(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/google/calendars?orgId=${orgId}&connectionId=${selectedConnection}`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch calendars");
        }
        const data = (await response.json()) as {
          calendars: GoogleCalendarInfo[];
        };
        setCalendars(data.calendars);
      } catch (err) {
        setError("Failed to load calendars. Please try again.");
        console.error(err);
      } finally {
        setIsLoadingCalendars(false);
      }
    }

    fetchCalendars();
  }, [selectedConnection, orgId]);

  async function handleSubmit() {
    if (!selectedConnection || !selectedCalendar) return;

    const calendar = calendars.find((c) => c.id === selectedCalendar);
    if (!calendar) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/calendars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          googleConnectionId: selectedConnection,
          googleCalendarId: calendar.id,
          name: calendar.name,
          color: calendar.color,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "Failed to add calendar");
      }

      onOpenChange(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add calendar");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Calendar</DialogTitle>
          <DialogDescription>
            Select a Google Calendar to sync events from.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Google Account</Label>
            <Select
              value={selectedConnection}
              onValueChange={setSelectedConnection}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an account" />
              </SelectTrigger>
              <SelectContent>
                {connections.map((connection) => (
                  <SelectItem key={connection.id} value={connection.id}>
                    {connection.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedConnection && (
            <div className="space-y-2">
              <Label>Calendar</Label>
              <Select
                value={selectedCalendar}
                onValueChange={setSelectedCalendar}
                disabled={isLoadingCalendars}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      isLoadingCalendars
                        ? "Loading calendars..."
                        : "Select a calendar"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {calendars.map((calendar) => (
                    <SelectItem key={calendar.id} value={calendar.id}>
                      <div className="flex items-center gap-2">
                        {calendar.color && (
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: calendar.color }}
                          />
                        )}
                        {calendar.name}
                        {calendar.primary && (
                          <span className="text-xs text-muted-foreground">
                            (Primary)
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedCalendar || isSubmitting}
          >
            {isSubmitting ? "Adding..." : "Add Calendar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
