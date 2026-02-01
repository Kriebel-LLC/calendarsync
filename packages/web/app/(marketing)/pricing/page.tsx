import Link from "next/link";

import {
  getPlanFeatures,
  PRO_PLAN_PRICE_MONTHLY,
} from "@/config/subscriptions";
import { Icons } from "@/custom-components/icons";
import { cn } from "components/lib/utils";
import { buttonVariants } from "components/ui/button";
import { Plan } from "shared/src/types/plan";

export const metadata = {
  title: "Pricing - CalendarSync",
  description:
    "Simple, transparent pricing. Start free, upgrade when you need more.",
};

export default function PricingPage() {
  const freeFeatures = getPlanFeatures(Plan.FREE);
  const proFeatures = getPlanFeatures(Plan.PRO);

  return (
    <section className="container flex flex-col gap-6 py-8 md:max-w-[64rem] md:py-12 lg:py-24">
      <div className="mx-auto flex w-full flex-col gap-4 text-center md:max-w-[58rem]">
        <h1 className="font-heading text-3xl leading-[1.1] sm:text-3xl md:text-6xl">
          Simple, transparent pricing
        </h1>
        <p className="mx-auto max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
          Start free and upgrade when you need more. No hidden fees, cancel
          anytime.
        </p>
      </div>

      <div className="mx-auto grid max-w-[64rem] gap-6 md:grid-cols-2">
        {/* Free Plan */}
        <div className="relative overflow-hidden rounded-lg border bg-background p-8">
          <div className="flex flex-col gap-6">
            <div>
              <h3 className="text-2xl font-bold">Free</h3>
              <p className="mt-1 text-muted-foreground">
                Perfect for getting started
              </p>
            </div>
            <div>
              <span className="text-5xl font-bold">$0</span>
              <span className="text-muted-foreground">/month</span>
            </div>
            <ul className="space-y-3 text-sm">
              {freeFeatures.map((feature, i) => (
                <li key={i} className="flex items-center">
                  <Icons.check className="mr-2 h-4 w-4 text-primary" />
                  {feature}
                </li>
              ))}
            </ul>
            <Link
              href="/register"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "mt-auto"
              )}
            >
              Start Free
            </Link>
          </div>
        </div>

        {/* Pro Plan */}
        <div className="relative overflow-hidden rounded-lg border-2 border-primary bg-background p-8">
          <div className="absolute right-4 top-4 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
            Popular
          </div>
          <div className="flex flex-col gap-6">
            <div>
              <h3 className="text-2xl font-bold">Pro</h3>
              <p className="mt-1 text-muted-foreground">
                For professionals and teams
              </p>
            </div>
            <div>
              <span className="text-5xl font-bold">
                ${PRO_PLAN_PRICE_MONTHLY}
              </span>
              <span className="text-muted-foreground">/month</span>
            </div>
            <ul className="space-y-3 text-sm">
              {proFeatures.map((feature, i) => (
                <li key={i} className="flex items-center">
                  <Icons.check className="mr-2 h-4 w-4 text-primary" />
                  {feature}
                </li>
              ))}
            </ul>
            <Link
              href="/register"
              className={cn(buttonVariants({ size: "lg" }), "mt-auto")}
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </div>

      {/* FAQ or Additional Info */}
      <div className="mx-auto mt-8 max-w-[58rem] text-center">
        <h2 className="mb-4 text-2xl font-bold">Frequently Asked Questions</h2>
        <div className="grid gap-4 text-left md:grid-cols-2">
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">Can I cancel anytime?</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Yes, you can cancel your subscription at any time. You&apos;ll
              continue to have access until the end of your billing period.
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">What happens when I upgrade?</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              You&apos;ll immediately get access to all Pro features. Your
              billing will be prorated for the remainder of the month.
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">
              What payment methods do you accept?
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              We accept all major credit cards through Stripe, including Visa,
              Mastercard, and American Express.
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">Is there a free trial?</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              The Free plan lets you try CalendarSync with 1 calendar and 1
              destination. Upgrade to Pro when you&apos;re ready for more.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
