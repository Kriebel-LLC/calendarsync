import { clientFetch } from "@/lib/fetch";
import { orgNameRegex } from "@/lib/validations/orgs";
import { Button } from "components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "components/ui/dialog";
import { Input } from "components/ui/input";
import { Label } from "components/ui/label";
import { toast } from "components/ui/use-toast";
import { useRouter } from "next/navigation";
import React from "react";

interface CreateOrgModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateOrgModal({
  open,
  onOpenChange,
}: CreateOrgModalProps) {
  const router = useRouter();

  const [name, setName] = React.useState<string | undefined>();
  const [loading, setLoading] = React.useState<boolean>();

  const createOrg = React.useCallback(async () => {
    clientFetch<{ name: string }>(
      `/api/orgs`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      },
      {
        beforeRequestStart: () => setLoading(true),
        afterRequestFinish: () => setLoading(false),
        onRequestSuccess: (response) => {
          toast({
            title: "Organization created. Redirecting...",
          });

          window.location.href = `/${response.name}`;
        },
      }
    );
  }, [name, router]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>New organization</DialogTitle>
        </DialogHeader>
        <Label htmlFor="create-org-name">Name</Label>
        <Input
          id="create-org-name"
          value={name}
          type="text"
          onChange={(e) => {
            const newValue = e.target.value
              .replace(" ", "-")
              .toLocaleLowerCase();
            if (newValue === "" || orgNameRegex.test(newValue)) {
              setName(newValue);
            }
          }}
        />
        <DialogFooter>
          <Button
            type="submit"
            onClick={createOrg}
            disabled={!name}
            loading={loading}
          >
            Create organization
          </Button>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
