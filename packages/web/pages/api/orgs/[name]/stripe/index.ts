import { proPlan } from "@/config/subscriptions";
import { EventNames, track } from "@/lib/amplitude";
import { getOrgUserForOrgName } from "@/lib/org";
import { routeHandler } from "@/lib/route";
import { stripe } from "@/lib/stripe";
import { absoluteUrl } from "@/lib/utils";
import { NextResponse } from "next/server";
import { Plan } from "shared/src/types/plan";
import { Role, hasPermission } from "shared/src/types/role";

export const config = {
  unstable_allowDynamic: [
    // Stripe imports this, but does not use it, so tell build to ignore
    // use a glob to allow anything in the function-bind 3rd party module
    "**/node_modules/function-bind/**",
  ],
};

const handler = routeHandler(async (req, user) => {
  if (req.method !== "GET") {
    return new NextResponse(null, { status: 405 });
  }

  const url = new URL(req.url);
  const orgName = url.searchParams.get("name");
  if (!orgName) {
    return new NextResponse(null, { status: 400 });
  }

  const userInOrg = await getOrgUserForOrgName(user.uid, orgName);
  if (!userInOrg || !hasPermission(userInOrg.role, Role.READ)) {
    // TODO: allow readers to purchase?
    return new NextResponse("Unauthorized", { status: 403 });
  }

  const billingUrl = absoluteUrl(`/${orgName}/billing`);

  // The user is on the pro plan.
  // Create a portal session to manage subscription.
  if (userInOrg.orgPlan !== Plan.FREE && userInOrg.orgStripeCustomerId) {
    const stripeSession = await stripe.billingPortal.sessions.create({
      customer: userInOrg.orgStripeCustomerId,
      return_url: billingUrl,
    });

    track(EventNames.ORG_BILLING_PORTAL_VIEWED, user.uid, {
      "org id": userInOrg.orgId,
      "stripe customer id": userInOrg.orgStripeCustomerId,
    });

    return NextResponse.json({ url: stripeSession.url });
  }

  // The user is on the free plan.
  // Create a checkout session to upgrade.

  // Stripe errors when both customer & customer_email are set, so prefer Id when set
  const customerDetails = userInOrg.orgStripeCustomerId
    ? { customer: userInOrg.orgStripeCustomerId }
    : { customer_email: user.email };

  const stripeSession = await stripe.checkout.sessions.create({
    success_url: billingUrl,
    cancel_url: billingUrl,
    mode: "subscription",
    billing_address_collection: "auto",
    ...customerDetails,
    line_items: [
      {
        price: proPlan.stripePriceId,
        quantity: 1,
      },
    ],
    metadata: {
      org_id: userInOrg.orgId,
    },
    subscription_data: {
      metadata: {
        org_id: userInOrg.orgId,
      },
    },
  });

  track(EventNames.ORG_CHECKOUT_STARTED, user.uid, {
    "org id": userInOrg.orgId,
    "price id": proPlan.stripePriceId,
  });

  return NextResponse.json({ url: stripeSession.url });
});

export default handler;
