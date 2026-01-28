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
import { Plan } from "shared/src/types/plan";
import { SubscriptionPlan } from "types";

interface BillingFormProps extends React.HTMLAttributes<HTMLFormElement> {
  orgName: string;
  orgPlan: Plan;
  subscriptionPlan: SubscriptionPlan;
}

export function OrgBillingForm({
  orgName,
  subscriptionPlan,
  orgPlan,
  className,
  ...props
}: BillingFormProps) {
  const [isLoading, setIsLoading] = React.useState<boolean>(false);

  async function onSubmit(event) {
    event.preventDefault();
    clientFetch<{ url: string }>(`/api/orgs/${orgName}/stripe`, undefined, {
      beforeRequestStart: () => setIsLoading(!isLoading),
      afterRequestFinish: () => setIsLoading(false),
      onRequestSuccess: (response) => {
        // Redirect to the Stripe session.
        // This could be a checkout page for initial upgrade.
        // Or portal to manage existing subscription.
        window.location.href = response.url;
      },
      defaultErrorMessage: "Please refresh the page and try again.",
    });
  }

  return (
    <form className={cn(className)} onSubmit={onSubmit} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Subscription Plan</CardTitle>
          <CardDescription>
            You are currently on the <strong>{subscriptionPlan.name}</strong>{" "}
            plan.
          </CardDescription>
        </CardHeader>
        <CardContent>{subscriptionPlan.description}</CardContent>
        <CardFooter className="flex flex-col items-start space-y-2 md:flex-row md:justify-between md:space-x-0">
          <Button type="submit" loading={isLoading}>
            {orgPlan === Plan.PAID ? "Manage Subscription" : "Upgrade to PRO"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
