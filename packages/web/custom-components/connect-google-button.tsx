"use client";

import { useState } from "react";
import { Button } from "components/ui/button";

interface ConnectGoogleButtonProps {
  orgId: string;
  orgName: string;
}

export function ConnectGoogleButton({ orgId, orgName }: ConnectGoogleButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  async function handleConnect() {
    setIsLoading(true);
    try {
      const response = await fetch("/api/google/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          returnUrl: `/${orgName}`,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to initiate Google connection");
      }

      const data = (await response.json()) as { url: string };
      window.location.href = data.url;
    } catch (error) {
      console.error("Failed to connect Google:", error);
      setIsLoading(false);
    }
  }

  return (
    <Button onClick={handleConnect} disabled={isLoading}>
      {isLoading ? "Connecting..." : "Connect Google Account"}
    </Button>
  );
}
