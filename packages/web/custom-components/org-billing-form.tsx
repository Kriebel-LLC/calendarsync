"use client";

import * as React from "react";

import {
  getPlanFeatures,
  PRO_PLAN_PRICE_MONTHLY,
} from "@/config/subscriptions";
import { Icons } from "@/custom-components/icons";
import { clientFetch } from "@/lib/fetch";
import { cn } from "components/lib/utils";
import { Badge } from "components/ui/badge";
import { Button } from "components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "components/ui/card";
import { Progress } from "components/ui/progress";
import { Separator } from "components/ui/separator";
import { Plan, isPaidPlan, getPlanLimits } from "shared/src/types/plan";
import { SubscriptionPlan } from "types";

interface BillingFormProps extends React.HTMLAttributes<HTMLFormElement> {
  orgName: string;
  orgPlan: Plan;
  subscriptionPlan: SubscriptionPlan;
  currentPeriodEnd?: Date | null;
  calendarsCount?: number;
  destinationsCount?: number;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatSyncInterval(minutes: number): string {
  if (minutes >= 1440) {
    return "Daily";
  } else if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return `Every ${hours} hour${hours === 1 ? "" : "s"}`;
  } else {
    return `Every ${minutes} minute${minutes === 1 ? "" : "s"}`;
  }
}

export function OrgBillingForm({
  orgName,
  subscriptionPlan,
  orgPlan,
  currentPeriodEnd,
  calendarsCount = 0,
  destinationsCount = 0,
  className,
  ...props
}: BillingFormProps) {
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const isPro = isPaidPlan(orgPlan);
  const limits = getPlanLimits(orgPlan);
  const features = getPlanFeatures(orgPlan);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    clientFetch<{ url: string }>(`/api/orgs/${orgName}/stripe`, undefined, {
      beforeRequestStart: () => setIsLoading(true),
      afterRequestFinish: () => setIsLoading(false),
      onRequestSuccess: (response) => {
        window.location.href = response.url;
      },
      defaultErrorMessage: "Please refresh the page and try again.",
    });
  }

  const calendarsProgress =
    limits.maxCalendars === Infinity
      ? 0
      : (calendarsCount / limits.maxCalendars) * 100;
  const destinationsProgress =
    limits.maxDestinations === Infinity
      ? 0
      : (destinationsCount / limits.maxDestinations) * 100;

  return (
    <div className={cn("space-y-6", className)}>
      {/* Current Plan Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Current Plan
                <Badge variant={isPro ? "default" : "secondary"}>
                  {subscriptionPlan.name}
                </Badge>
              </CardTitle>
              <CardDescription className="mt-1">
                {subscriptionPlan.description}
              </CardDescription>
            </div>
            {isPro && (
              <div className="text-right">
                <p className="text-2xl font-bold">${PRO_PLAN_PRICE_MONTHLY}</p>
                <p className="text-sm text-muted-foreground">per month</p>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="mb-2 font-medium">Plan Features</h4>
              <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                {features.map((feature, i) => (
                  <li key={i} className="flex items-center">
                    <Icons.check className="mr-2 h-4 w-4 text-primary" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            {isPro && currentPeriodEnd && (
              <div className="rounded-md bg-muted p-3">
                <p className="text-sm">
                  Your subscription renews on{" "}
                  <strong>{formatDate(currentPeriodEnd)}</strong>
                </p>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <form onSubmit={onSubmit}>
            <Button type="submit" loading={isLoading}>
              {isPro ? "Manage Subscription" : "Upgrade to Pro"}
            </Button>
          </form>
        </CardFooter>
      </Card>

      {/* Usage Card */}
      <Card>
        <CardHeader>
          <CardTitle>Usage</CardTitle>
          <CardDescription>
            Your current usage against plan limits
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Calendars */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Connected Calendars</span>
              <span className="text-muted-foreground">
                {calendarsCount} /{" "}
                {limits.maxCalendars === Infinity
                  ? "Unlimited"
                  : limits.maxCalendars}
              </span>
            </div>
            {limits.maxCalendars !== Infinity && (
              <Progress value={calendarsProgress} className="h-2" />
            )}
          </div>

          {/* Destinations */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Destinations</span>
              <span className="text-muted-foreground">
                {destinationsCount} /{" "}
                {limits.maxDestinations === Infinity
                  ? "Unlimited"
                  : limits.maxDestinations}
              </span>
            </div>
            {limits.maxDestinations !== Infinity && (
              <Progress value={destinationsProgress} className="h-2" />
            )}
          </div>

          {/* Sync Interval */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Sync Frequency</span>
              <span className="text-muted-foreground">
                {formatSyncInterval(limits.syncIntervalMinutes)}
              </span>
            </div>
          </div>

          {/* Priority Support */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Priority Support</span>
              <span className="text-muted-foreground">
                {limits.hasPrioritySupport ? (
                  <Icons.check className="h-4 w-4 text-primary" />
                ) : (
                  <Icons.x className="h-4 w-4 text-muted-foreground" />
                )}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upgrade CTA for Free users */}
      {!isPro && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icons.sparkles className="h-5 w-5 text-primary" />
              Upgrade to Pro
            </CardTitle>
            <CardDescription>
              Unlock the full power of CalendarSync
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold">
                  ${PRO_PLAN_PRICE_MONTHLY}
                </span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <ul className="space-y-2 text-sm">
                {getPlanFeatures(Plan.PRO).map((feature, i) => (
                  <li key={i} className="flex items-center">
                    <Icons.check className="mr-2 h-4 w-4 text-primary" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
          <CardFooter>
            <form onSubmit={onSubmit} className="w-full">
              <Button type="submit" loading={isLoading} className="w-full">
                Upgrade Now
              </Button>
            </form>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
