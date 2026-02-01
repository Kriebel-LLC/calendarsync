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
import { Input } from "components/ui/input";
import { Label } from "components/ui/label";

interface GoogleConnectionInfo {
  id: string;
  email: string;
}

interface SpreadsheetInfo {
  id: string;
  name: string;
}

interface SheetInfo {
  id: number;
  name: string;
  index: number;
}

interface AddDestinationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  connections: GoogleConnectionInfo[];
}

export function AddDestinationDialog({
  open,
  onOpenChange,
  orgId,
  connections,
}: AddDestinationDialogProps) {
  const router = useRouter();
  const [selectedConnection, setSelectedConnection] = useState<string>("");
  const [selectedSpreadsheet, setSelectedSpreadsheet] = useState<string>("");
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [destinationName, setDestinationName] = useState<string>("");
  const [spreadsheets, setSpreadsheets] = useState<SpreadsheetInfo[]>([]);
  const [sheets, setSheets] = useState<SheetInfo[]>([]);
  const [spreadsheetName, setSpreadsheetName] = useState<string>("");
  const [isLoadingSpreadsheets, setIsLoadingSpreadsheets] = useState(false);
  const [isLoadingSheets, setIsLoadingSheets] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setSelectedConnection("");
      setSelectedSpreadsheet("");
      setSelectedSheet("");
      setDestinationName("");
      setSpreadsheets([]);
      setSheets([]);
      setSpreadsheetName("");
      setError(null);
    }
  }, [open]);

  // Fetch spreadsheets when connection is selected
  useEffect(() => {
    if (!selectedConnection) {
      setSpreadsheets([]);
      return;
    }

    async function fetchSpreadsheets() {
      setIsLoadingSpreadsheets(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/google/spreadsheets?orgId=${orgId}&connectionId=${selectedConnection}`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch spreadsheets");
        }
        const data = (await response.json()) as { spreadsheets: SpreadsheetInfo[] };
        setSpreadsheets(data.spreadsheets);
      } catch (err) {
        setError("Failed to load spreadsheets. Please try again.");
        console.error(err);
      } finally {
        setIsLoadingSpreadsheets(false);
      }
    }

    fetchSpreadsheets();
  }, [selectedConnection, orgId]);

  // Fetch sheets when spreadsheet is selected
  useEffect(() => {
    if (!selectedSpreadsheet || !selectedConnection) {
      setSheets([]);
      return;
    }

    async function fetchSheets() {
      setIsLoadingSheets(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/google/spreadsheets?orgId=${orgId}&connectionId=${selectedConnection}&spreadsheetId=${selectedSpreadsheet}`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch sheets");
        }
        const data = (await response.json()) as {
          spreadsheet: { name: string; sheets: SheetInfo[] };
        };
        setSheets(data.spreadsheet.sheets);
        setSpreadsheetName(data.spreadsheet.name);

        // Auto-generate destination name
        if (!destinationName) {
          setDestinationName(data.spreadsheet.name);
        }
      } catch (err) {
        setError("Failed to load sheets. Please try again.");
        console.error(err);
      } finally {
        setIsLoadingSheets(false);
      }
    }

    fetchSheets();
  }, [selectedSpreadsheet, selectedConnection, orgId, destinationName]);

  async function handleSubmit() {
    if (
      !selectedConnection ||
      !selectedSpreadsheet ||
      !selectedSheet ||
      !destinationName
    )
      return;

    const sheet = sheets.find((s) => s.id.toString() === selectedSheet);
    if (!sheet) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/destinations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          googleConnectionId: selectedConnection,
          name: destinationName,
          spreadsheetId: selectedSpreadsheet,
          spreadsheetName,
          sheetId: sheet.id,
          sheetName: sheet.name,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "Failed to add destination");
      }

      onOpenChange(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add destination");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Destination</DialogTitle>
          <DialogDescription>
            Select a Google Sheet to sync calendar events to.
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
              <Label>Spreadsheet</Label>
              <Select
                value={selectedSpreadsheet}
                onValueChange={setSelectedSpreadsheet}
                disabled={isLoadingSpreadsheets}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      isLoadingSpreadsheets
                        ? "Loading spreadsheets..."
                        : "Select a spreadsheet"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {spreadsheets.map((spreadsheet) => (
                    <SelectItem key={spreadsheet.id} value={spreadsheet.id}>
                      {spreadsheet.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedSpreadsheet && (
            <div className="space-y-2">
              <Label>Sheet</Label>
              <Select
                value={selectedSheet}
                onValueChange={setSelectedSheet}
                disabled={isLoadingSheets}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      isLoadingSheets ? "Loading sheets..." : "Select a sheet"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {sheets.map((sheet) => (
                    <SelectItem key={sheet.id} value={sheet.id.toString()}>
                      {sheet.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedSheet && (
            <div className="space-y-2">
              <Label>Destination Name</Label>
              <Input
                value={destinationName}
                onChange={(e) => setDestinationName(e.target.value)}
                placeholder="My Calendar Events"
              />
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
            disabled={
              !selectedSheet || !destinationName.trim() || isSubmitting
            }
          >
            {isSubmitting ? "Adding..." : "Add Destination"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
