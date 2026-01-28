import { proPlan } from "@/config/subscriptions";
import { EventNames, track } from "@/lib/amplitude";
import { PersonalDashboardRoute } from "@/lib/constants";
import { logError } from "@/lib/logger";
import { routeHandler } from "@/lib/route";
import { stripe } from "@/lib/stripe";
import { getUserSubscriptionPlan } from "@/lib/subscription";
import { absoluteUrl } from "@/lib/utils";
import { NextResponse } from "next/server";
import { z } from "zod";

export const config = {
  unstable_allowDynamic: [
    // Stripe imports this, but does not use it, so tell build to ignore
    // use a glob to allow anything in the function-bind 3rd party module
    "**/node_modules/function-bind/**",
  ],
};

const billingUrl = absoluteUrl(`/${PersonalDashboardRoute}/billing`);

const handler = routeHandler(async (req, user) => {
  if (req.method !== "GET") {
    return new NextResponse(null, { status: 405 });
  }

  try {
    const subscriptionPlan = await getUserSubscriptionPlan(user.uid);

    // The user is on the pro plan.
    // Create a portal session to manage subscription.
    if (subscriptionPlan.isPro && subscriptionPlan.stripeCustomerId) {
      const stripeSession = await stripe.billingPortal.sessions.create({
        customer: subscriptionPlan.stripeCustomerId,
        return_url: billingUrl,
      });

      track(EventNames.USER_BILLING_PORTAL_VIEWED, user.uid, {
        "stripe customer id": subscriptionPlan.stripeCustomerId,
      });

      return NextResponse.json({ url: stripeSession.url });
    }

    // The user is on the free plan.
    // Create a checkout session to upgrade.
    const stripeSession = await stripe.checkout.sessions.create({
      success_url: billingUrl,
      cancel_url: billingUrl,
      customer: subscriptionPlan.stripeCustomerId || undefined,
      mode: "subscription",
      billing_address_collection: "auto",
      customer_email: user.email,
      line_items: [
        {
          price: proPlan.stripePriceId,
          quantity: 1,
        },
      ],
      metadata: {
        userId: user.uid,
      },
      subscription_data: {
        metadata: {
          userId: user.uid,
        },
      },
    });

    track(EventNames.USER_CHECKOUT_STARTED, user.uid, {
      "price id": proPlan.stripePriceId,
    });

    return NextResponse.json({ url: stripeSession.url });
  } catch (error) {
    logError(error, req);
    if (error instanceof z.ZodError) {
      return NextResponse.json(error.issues, { status: 422 });
    }

    return new NextResponse(null, { status: 500 });
  }
});

export default handler;
