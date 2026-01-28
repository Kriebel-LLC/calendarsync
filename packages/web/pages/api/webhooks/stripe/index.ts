import { siteConfig } from "@/config/site";
import { db } from "@/db";
import { EventNames, track } from "@/lib/amplitude";
import { getOrgNameForOrgId } from "@/lib/org";
import { stripe } from "@/lib/stripe";
import { env } from "@/web-env";
import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { orgUsers, orgs, users } from "shared/src/db/schema";
import Email from "shared/src/email";
import { getUserDetails } from "shared/src/firebase-api";
import { Plan, stripePriceIdToPlan } from "shared/src/types/plan";
import { Role } from "shared/src/types/role";
import Stripe from "stripe";

export const config = {
  unstable_allowDynamic: [
    // Stripe imports this, but does not use it, so tell build to ignore
    // use a glob to allow anything in the function-bind 3rd party module
    "**/node_modules/function-bind/**",
  ],
};

async function handleInvoicePaymentSucceeded(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;

  // Retrieve the subscription details from Stripe.
  const subscription = await stripe.subscriptions.retrieve(
    invoice.subscription as string
  );

  const userId = subscription?.metadata?.userId as string | undefined;
  const orgId = subscription?.metadata?.org_id as string | undefined;

  if (!userId && !orgId) {
    console.error(
      "No Id for subscription given: ",
      subscription,
      invoice?.metadata
    );
    throw new Error("No ID for subscription given");
  }

  const isRenewal = invoice.billing_reason === "subscription_cycle";

  if (orgId) {
    if (!isRenewal) {
      await stripe.customers.update(subscription.customer as string, {
        metadata: { org_id: orgId },
      });
    }

    const newPlan = stripePriceIdToPlan(
      subscription.items.data[0].price.id,
      env
    );
    if (!newPlan) {
      console.error(
        "No matching plan for Stripe Price Id: ",
        subscription.items.data[0].price.id
      );
      throw new Error("No ID for subscription given");
    }

    if (isRenewal) {
      track(EventNames.ORG_SUBSCRIPTION_RENEWED, orgId, {
        "org id": orgId,
        "stripe customer id": subscription.customer as string,
        "subscription id": subscription.id,
        "subscription period end": new Date(
          subscription.current_period_end * 1000
        ).toISOString(),
        "price id": subscription.items.data[0].price.id,
        plan: newPlan,
      });

      // Nothing to do on org renews since plan value is already written to DB
      return;
    }

    await db()
      .update(orgs)
      .set({
        plan: newPlan,
        stripeCustomerId: subscription.customer as string,
      })
      .where(eq(orgs.id, orgId));

    // TODO: get actual user id
    track(EventNames.ORG_UPGRADED, orgId, {
      "org id": orgId,
      "stripe customer id": subscription.customer as string,
      "subscription id": subscription.id,
      "subscription period end": new Date(
        subscription.current_period_end * 1000
      ).toISOString(),
      "price id": subscription.items.data[0].price.id,
      plan: newPlan,
    });
  }

  if (userId) {
    // Update the user stripe into in our database.
    // Since this is the initial subscription, we need to update
    // the subscription id and customer id.
    await db()
      .update(users)
      .set({
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: subscription.customer as string,
        stripePriceId: subscription.items.data[0].price.id,
        stripeCurrentPeriodEnd: new Date(
          subscription.current_period_end * 1000
        ),
      })
      .where(eq(users.id, userId));

    const eventType = isRenewal
      ? EventNames.USER_SUBSCRIPTION_RENEWED
      : EventNames.USER_UPGRADED;

    track(eventType, userId, {
      "stripe customer id": subscription.customer as string,
      "subscription id": subscription.id,
      "subscription period end": new Date(
        subscription.current_period_end * 1000
      ).toISOString(),
      "price id": subscription.items.data[0].price.id,
    });
  }
}

async function handleCustomerSubscriptionDeleted(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;
  const orgId = subscription.metadata.org_id;
  if (!orgId) {
    if (!!subscription.metadata.user_id) {
      // If user_id is set, and orgId is not, then this must be an individual subscription
      // Individual subscriptions simply timeout (date is checked upon checking plan type)
      // so updating our DB is not necessary for individual users

      track(EventNames.USER_DOWNGRADED, subscription.metadata.user_id, {
        "stripe customer id": subscription.customer as string,
        "subscription id": subscription.id,
        "subscription period end": new Date(
          subscription.current_period_end * 1000
        ).toISOString(),
        "price id": subscription.items.data[0].price.id,
      });

      return;
    }

    throw new Error("Subscription for deleted event had no Org Id");
  }

  // TODO when needed: query for different plan type when there are more than 2
  const downGradedPlan = Plan.FREE;

  await db()
    .update(orgs)
    .set({
      plan: downGradedPlan,
    })
    .where(eq(orgs.id, orgId));

  track(EventNames.ORG_DOWNGRADED, orgId, {
    "org id": orgId,
    "previous plan": Plan.PAID, // TODO: if there are more than 2 plan types, query for this
    "new plan": downGradedPlan,
    "stripe customer id": subscription.customer as string,
    "subscription id": subscription.id,
    "subscription period end": new Date(
      subscription.current_period_end * 1000
    ).toISOString(),
    "price id": subscription.items.data[0].price.id,
  });

  // TODO: send a downgrade email
  const allAdminUserRecords = await db()
    .select({ id: orgUsers.id })
    .from(orgUsers)
    .where(and(eq(orgUsers.orgId, orgId), eq(orgUsers.role, Role.ADMIN)));
  const [adminUsers, orgName] = await Promise.all([
    getUserDetails(
      env,
      allAdminUserRecords.map((member) => member.id)
    ),
    getOrgNameForOrgId(orgId),
  ]);

  await Promise.all(
    Object.keys(adminUsers).map((adminUserId) =>
      Email.send(env, {
        to: adminUsers[adminUserId].email,
        from: env.SMTP_FROM,
        subject: `[${siteConfig.name}] ${orgName} organization has been downgraded`,
        html: `<p>Hello,</p>
<p>The organization, ${orgName}, on ${siteConfig.name}, has been downgraded to the ${downGradedPlan} plan due to it's subscription ending.</p>
<p>If you'd like to review billing details or subscribe again, you can <a href='${env.NEXT_PUBLIC_APP_URL}/${orgName}/billing'>view billing here</a>.</p>
<p>You are receiving this email because you are an Admin member of this organization.</p>
<p>Thanks & we hope you'll consider upgrading again,</p>
<p>${siteConfig.name} team</p>`,
      })
    )
  );
}

const webCrypto = Stripe.createSubtleCryptoProvider();

export default async function handler(req: NextRequest) {
  if (req.method !== "POST") {
    return new NextResponse(null, { status: 405 });
  }

  const body = await req.text();
  const signature = req.headers.get("Stripe-Signature") as string;

  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
      undefined,
      webCrypto
    );
  } catch (error) {
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
  }

  console.log(`Recevied Stripe Webhook event: ${event.type}`);

  if (event.type === "invoice.payment_succeeded") {
    await handleInvoicePaymentSucceeded(event);
  } else if (event.type === "customer.subscription.deleted") {
    await handleCustomerSubscriptionDeleted(event);
  } else {
    console.warn(
      `Received unexpected Stripe Webhook event type: ${event.type}`
    );
  }

  return new NextResponse(null);
}
