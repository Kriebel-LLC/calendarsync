import Link from "next/link";

import { siteConfig } from "@/config/site";
import { authConfig } from "@/lib/auth";
import { cn } from "components/lib/utils";
import { buttonVariants } from "components/ui/button";
import { cookies } from "next/headers";
import { Icons } from "@/custom-components/icons";

export const metadata = {
  title: "CalendarSync - Google Calendar to Spreadsheet Automation",
  description:
    "Automatically sync your Google Calendar events to spreadsheets and databases. Perfect for time tracking, project billing, event reporting, and attendance logging.",
  keywords: [
    "calendar to spreadsheet",
    "google calendar export automation",
    "calendar sync",
    "time tracking",
    "event reporting",
  ],
};

export default async function IndexPage() {
  const isLoggedIn = cookies().has(authConfig.cookieName);

  return (
    <>
      {/* Hero Section */}
      <section className="space-y-6 pb-8 pt-6 md:pb-12 md:pt-10 lg:py-32">
        <div className="container flex max-w-[64rem] flex-col items-center gap-4 text-center">
          <span className="rounded-2xl bg-muted px-4 py-1.5 text-sm font-medium">
            Automate Your Calendar Exports
          </span>
          <h1 className="font-heading text-3xl sm:text-5xl md:text-6xl lg:text-7xl">
            Sync Google Calendar to{" "}
            <span className="text-primary">Spreadsheets</span> Automatically
          </h1>
          <p className="max-w-[42rem] leading-normal text-muted-foreground sm:text-xl sm:leading-8">
            Automatically sync your Google Calendar events to spreadsheets and
            databases. No more manual exports. No more missed entries.
          </p>
          <div className="space-y-4 md:space-x-4 md:space-y-0">
            <Link
              href={isLoggedIn ? "/dashboard" : "/register"}
              className={cn(buttonVariants({ size: "lg" }))}
            >
              {isLoggedIn ? "Go to Dashboard" : "Get Started Free"}
            </Link>
            <Link
              href="#how-it-works"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            >
              See How It Works
            </Link>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section
        id="use-cases"
        className="container space-y-6 bg-slate-50 py-8 dark:bg-transparent md:py-12 lg:py-24"
      >
        <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center">
          <h2 className="font-heading text-3xl leading-[1.1] sm:text-3xl md:text-6xl">
            Built for Teams That Track Time
          </h2>
          <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
            From freelancers to enterprises, CalendarSync helps you turn
            calendar events into actionable data.
          </p>
        </div>
        <div className="mx-auto grid justify-center gap-4 sm:grid-cols-2 md:max-w-[64rem]">
          <div className="relative overflow-hidden rounded-lg border bg-background p-2">
            <div className="flex h-[180px] flex-col justify-between rounded-md p-6">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-12 w-12"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <div className="space-y-2">
                <h3 className="font-bold">Time Tracking</h3>
                <p className="text-sm text-muted-foreground">
                  Track billable hours automatically. Every calendar event
                  becomes a time entry in your spreadsheet.
                </p>
              </div>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-lg border bg-background p-2">
            <div className="flex h-[180px] flex-col justify-between rounded-md p-6">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-12 w-12"
              >
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              <div className="space-y-2">
                <h3 className="font-bold">Project Billing</h3>
                <p className="text-sm text-muted-foreground">
                  Generate accurate invoices from calendar data. Match events to
                  clients and projects effortlessly.
                </p>
              </div>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-lg border bg-background p-2">
            <div className="flex h-[180px] flex-col justify-between rounded-md p-6">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-12 w-12"
              >
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <line x1="10" y1="9" x2="8" y2="9" />
              </svg>
              <div className="space-y-2">
                <h3 className="font-bold">Event Reporting</h3>
                <p className="text-sm text-muted-foreground">
                  Create detailed reports on meetings, calls, and appointments.
                  Analyze patterns and optimize schedules.
                </p>
              </div>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-lg border bg-background p-2">
            <div className="flex h-[180px] flex-col justify-between rounded-md p-6">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-12 w-12"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <div className="space-y-2">
                <h3 className="font-bold">Attendance Logging</h3>
                <p className="text-sm text-muted-foreground">
                  Track meeting attendance automatically. Know who showed up and
                  who missed events.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="container py-8 md:py-12 lg:py-24">
        <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center">
          <h2 className="font-heading text-3xl leading-[1.1] sm:text-3xl md:text-6xl">
            How It Works
          </h2>
          <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
            Get started in three simple steps. No complex setup required.
          </p>
        </div>
        <div className="mx-auto mt-12 grid max-w-[64rem] gap-8 md:grid-cols-3">
          <div className="relative flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-3xl font-bold text-primary-foreground">
              1
            </div>
            <h3 className="mt-4 text-xl font-bold">Connect Your Calendar</h3>
            <p className="mt-2 text-muted-foreground">
              Sign in with Google and authorize CalendarSync to read your
              calendar events. Your data stays secure.
            </p>
          </div>
          <div className="relative flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-3xl font-bold text-primary-foreground">
              2
            </div>
            <h3 className="mt-4 text-xl font-bold">Choose Your Destination</h3>
            <p className="mt-2 text-muted-foreground">
              Select where you want your events synced: Google Sheets, Airtable,
              Notion, or other popular databases.
            </p>
          </div>
          <div className="relative flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-3xl font-bold text-primary-foreground">
              3
            </div>
            <h3 className="mt-4 text-xl font-bold">Sync Automatically</h3>
            <p className="mt-2 text-muted-foreground">
              Configure your sync schedule and let CalendarSync do the rest.
              Events sync automatically on your schedule.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Teaser Section */}
      <section
        id="pricing"
        className="container space-y-6 bg-slate-50 py-8 dark:bg-transparent md:py-12 lg:py-24"
      >
        <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center">
          <h2 className="font-heading text-3xl leading-[1.1] sm:text-3xl md:text-6xl">
            Simple, Transparent Pricing
          </h2>
          <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
            Start free, upgrade when you need more. No hidden fees.
          </p>
        </div>
        <div className="mx-auto grid max-w-[64rem] gap-6 md:grid-cols-2">
          <div className="relative overflow-hidden rounded-lg border bg-background p-8">
            <div className="flex flex-col gap-4">
              <h3 className="text-2xl font-bold">Free</h3>
              <p className="text-4xl font-bold">$0</p>
              <p className="text-muted-foreground">Perfect for getting started</p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center">
                  <Icons.check className="mr-2 h-4 w-4 text-primary" /> 1
                  calendar connection
                </li>
                <li className="flex items-center">
                  <Icons.check className="mr-2 h-4 w-4 text-primary" /> Daily
                  sync
                </li>
                <li className="flex items-center">
                  <Icons.check className="mr-2 h-4 w-4 text-primary" /> Google
                  Sheets export
                </li>
                <li className="flex items-center">
                  <Icons.check className="mr-2 h-4 w-4 text-primary" /> 30-day
                  history
                </li>
              </ul>
              <Link
                href="/register"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "mt-4"
                )}
              >
                Start Free
              </Link>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-lg border-2 border-primary bg-background p-8">
            <div className="absolute right-4 top-4 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
              Popular
            </div>
            <div className="flex flex-col gap-4">
              <h3 className="text-2xl font-bold">Pro</h3>
              <p className="text-4xl font-bold">
                $9<span className="text-lg font-normal">/month</span>
              </p>
              <p className="text-muted-foreground">For professionals and teams</p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center">
                  <Icons.check className="mr-2 h-4 w-4 text-primary" /> Unlimited
                  calendar connections
                </li>
                <li className="flex items-center">
                  <Icons.check className="mr-2 h-4 w-4 text-primary" /> Real-time
                  sync
                </li>
                <li className="flex items-center">
                  <Icons.check className="mr-2 h-4 w-4 text-primary" /> All
                  export destinations
                </li>
                <li className="flex items-center">
                  <Icons.check className="mr-2 h-4 w-4 text-primary" /> Unlimited
                  history
                </li>
                <li className="flex items-center">
                  <Icons.check className="mr-2 h-4 w-4 text-primary" /> Priority
                  support
                </li>
              </ul>
              <Link
                href="/register"
                className={cn(buttonVariants({ size: "lg" }), "mt-4")}
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container py-8 md:py-12 lg:py-24">
        <div className="mx-auto flex max-w-[58rem] flex-col items-center justify-center gap-4 text-center">
          <h2 className="font-heading text-3xl leading-[1.1] sm:text-3xl md:text-6xl">
            Ready to Automate Your Calendar Exports?
          </h2>
          <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
            Join thousands of professionals who save hours every week with
            automatic calendar sync. Get started in under 2 minutes.
          </p>
          <div className="mt-4 space-y-4 md:space-x-4 md:space-y-0">
            <Link
              href={isLoggedIn ? "/dashboard" : "/register"}
              className={cn(buttonVariants({ size: "lg" }))}
            >
              {isLoggedIn ? "Go to Dashboard" : "Get Started Free"}
              <Icons.arrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            No credit card required. Free plan available forever.
          </p>
        </div>
      </section>
    </>
  );
}
