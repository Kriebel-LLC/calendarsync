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
import { DestinationType } from "shared/src/db/schema";

interface AirtableConnectionInfo {
  id: string;
  airtableUserId: string;
}

interface BaseInfo {
  id: string;
  name: string;
}

interface TableInfo {
  id: string;
  name: string;
}

interface AddAirtableDestinationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  connections: AirtableConnectionInfo[];
}

export function AddAirtableDestinationDialog({
  open,
  onOpenChange,
  orgId,
  connections,
}: AddAirtableDestinationDialogProps) {
  const router = useRouter();
  const [selectedConnection, setSelectedConnection] = useState<string>("");
  const [selectedBase, setSelectedBase] = useState<string>("");
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [destinationName, setDestinationName] = useState<string>("");
  const [bases, setBases] = useState<BaseInfo[]>([]);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [baseName, setBaseName] = useState<string>("");
  const [isLoadingBases, setIsLoadingBases] = useState(false);
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setSelectedConnection("");
      setSelectedBase("");
      setSelectedTable("");
      setDestinationName("");
      setBases([]);
      setTables([]);
      setBaseName("");
      setError(null);
    }
  }, [open]);

  // Fetch bases when connection is selected
  useEffect(() => {
    if (!selectedConnection) {
      setBases([]);
      return;
    }

    async function fetchBases() {
      setIsLoadingBases(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/airtable/bases?orgId=${orgId}&connectionId=${selectedConnection}`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch bases");
        }
        const data = (await response.json()) as { bases: BaseInfo[] };
        setBases(data.bases);
      } catch (err) {
        setError("Failed to load Airtable bases. Please try again.");
        console.error(err);
      } finally {
        setIsLoadingBases(false);
      }
    }

    fetchBases();
  }, [selectedConnection, orgId]);

  // Fetch tables when base is selected
  useEffect(() => {
    if (!selectedBase || !selectedConnection) {
      setTables([]);
      return;
    }

    async function fetchTables() {
      setIsLoadingTables(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/airtable/bases?orgId=${orgId}&connectionId=${selectedConnection}&baseId=${selectedBase}`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch tables");
        }
        const data = (await response.json()) as {
          base: { id: string; tables: TableInfo[] };
        };
        setTables(data.base.tables);

        // Get base name from bases list
        const base = bases.find((b) => b.id === selectedBase);
        if (base) {
          setBaseName(base.name);
          // Auto-generate destination name
          if (!destinationName) {
            setDestinationName(base.name);
          }
        }
      } catch (err) {
        setError("Failed to load tables. Please try again.");
        console.error(err);
      } finally {
        setIsLoadingTables(false);
      }
    }

    fetchTables();
  }, [selectedBase, selectedConnection, orgId, bases, destinationName]);

  async function handleSubmit() {
    if (
      !selectedConnection ||
      !selectedBase ||
      !selectedTable ||
      !destinationName
    )
      return;

    const table = tables.find((t) => t.id === selectedTable);
    if (!table) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/destinations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          type: DestinationType.AIRTABLE,
          airtableConnectionId: selectedConnection,
          name: destinationName,
          airtableBaseId: selectedBase,
          airtableBaseName: baseName,
          airtableTableId: table.id,
          airtableTableName: table.name,
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
          <DialogTitle>Add Airtable Destination</DialogTitle>
          <DialogDescription>
            Select an Airtable base and table to sync calendar events to.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Airtable Account</Label>
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
                    Airtable ({connection.airtableUserId.slice(0, 8)}...)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedConnection && (
            <div className="space-y-2">
              <Label>Base</Label>
              <Select
                value={selectedBase}
                onValueChange={setSelectedBase}
                disabled={isLoadingBases}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      isLoadingBases
                        ? "Loading bases..."
                        : "Select a base"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {bases.map((base) => (
                    <SelectItem key={base.id} value={base.id}>
                      {base.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedBase && (
            <div className="space-y-2">
              <Label>Table</Label>
              <Select
                value={selectedTable}
                onValueChange={setSelectedTable}
                disabled={isLoadingTables}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      isLoadingTables ? "Loading tables..." : "Select a table"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {tables.map((table) => (
                    <SelectItem key={table.id} value={table.id}>
                      {table.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedTable && (
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
              !selectedTable || !destinationName.trim() || isSubmitting
            }
          >
            {isSubmitting ? "Adding..." : "Add Destination"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
