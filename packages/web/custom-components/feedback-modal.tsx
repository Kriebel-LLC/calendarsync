import { siteConfig } from "@/config/site";
import { clientFetch } from "@/lib/fetch";
import { Button } from "components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "components/ui/dialog";
import { Textarea } from "components/ui/textarea";
import { toast } from "components/ui/use-toast";
import React from "react";

interface FeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
}

export default function FeedbackModal({
  open,
  onOpenChange,
  title,
  description,
}: FeedbackModalProps) {
  const [loading, setLoading] = React.useState(false);
  const [feedback, setFeedback] = React.useState<string | undefined>();

  const sendFeedback = React.useCallback(async () => {
    clientFetch(
      `/api/feedback`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ feedback }),
      },
      {
        beforeRequestStart: () => setLoading(true),
        afterRequestFinish: () => setLoading(false),
        onRequestSuccess: () => {
          toast({
            title: "Feedback Sent. Thank you!",
          });

          onOpenChange(false);
        },
        defaultErrorMessage: "Something went wrong!",
      }
    );
  }, [feedback, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title ?? "Send Feedback"}</DialogTitle>
          <DialogDescription>
            {description ??
              `Help ${siteConfig.name} improve by letting us know what we can do
            better.`}
          </DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder="Type your feedback here."
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
        />
        <DialogFooter>
          <Button
            type="submit"
            onClick={sendFeedback}
            disabled={!feedback}
            loading={loading}
          >
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
