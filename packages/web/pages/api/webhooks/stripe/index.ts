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

async function handleSubscriptionCreated(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;
  const orgId = subscription.metadata.org_id;

  if (!orgId) {
    console.warn("Subscription created without org_id in metadata");
    return;
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
    return;
  }

  // Update org with subscription details
  await db()
    .update(orgs)
    .set({
      plan: newPlan,
      stripeCustomerId: subscription.customer as string,
      stripeSubscriptionId: subscription.id,
      stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
    })
    .where(eq(orgs.id, orgId));

  // Update customer metadata with org_id for future reference
  await stripe.customers.update(subscription.customer as string, {
    metadata: { org_id: orgId },
  });

  track(EventNames.ORG_UPGRADED, orgId, {
    "org id": orgId,
    "stripe customer id": subscription.customer as string,
    "subscription id": subscription.id,
    "subscription status": subscription.status,
    "subscription period end": new Date(
      subscription.current_period_end * 1000
    ).toISOString(),
    "price id": subscription.items.data[0].price.id,
    plan: newPlan,
  });

  console.log(`Subscription created for org ${orgId}, plan: ${newPlan}`);
}

async function handleSubscriptionUpdated(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;
  const orgId = subscription.metadata.org_id;

  if (!orgId) {
    // Check if this is a user subscription
    const userId = subscription.metadata.userId;
    if (userId) {
      await handleUserSubscriptionUpdated(subscription, userId);
      return;
    }
    console.warn("Subscription updated without org_id or userId in metadata");
    return;
  }

  // Only process active or trialing subscriptions
  if (
    subscription.status !== "active" &&
    subscription.status !== "trialing"
  ) {
    console.log(
      `Ignoring subscription update with status: ${subscription.status}`
    );
    return;
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
    return;
  }

  // Get current org plan to determine if upgrade or downgrade
  const [orgRecord] = await db()
    .select({ plan: orgs.plan })
    .from(orgs)
    .where(eq(orgs.id, orgId));

  const previousPlan = orgRecord?.plan || Plan.FREE;

  // Update org with new subscription details
  await db()
    .update(orgs)
    .set({
      plan: newPlan,
      stripeSubscriptionId: subscription.id,
      stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
    })
    .where(eq(orgs.id, orgId));

  const isUpgrade = previousPlan === Plan.FREE && newPlan === Plan.PRO;
  const eventName = isUpgrade
    ? EventNames.ORG_UPGRADED
    : EventNames.ORG_SUBSCRIPTION_RENEWED;

  track(eventName, orgId, {
    "org id": orgId,
    "previous plan": previousPlan,
    "new plan": newPlan,
    "stripe customer id": subscription.customer as string,
    "subscription id": subscription.id,
    "subscription status": subscription.status,
    "subscription period end": new Date(
      subscription.current_period_end * 1000
    ).toISOString(),
    "price id": subscription.items.data[0].price.id,
  });

  console.log(
    `Subscription updated for org ${orgId}, plan: ${previousPlan} -> ${newPlan}`
  );
}

async function handleUserSubscriptionUpdated(
  subscription: Stripe.Subscription,
  userId: string
) {
  if (
    subscription.status !== "active" &&
    subscription.status !== "trialing"
  ) {
    return;
  }

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

  track(EventNames.USER_SUBSCRIPTION_RENEWED, userId, {
    "stripe customer id": subscription.customer as string,
    "subscription id": subscription.id,
    "subscription period end": new Date(
      subscription.current_period_end * 1000
    ).toISOString(),
    "price id": subscription.items.data[0].price.id,
  });
}

async function handleInvoicePaymentSucceeded(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;

  if (!invoice.subscription) {
    console.log("Invoice without subscription, skipping");
    return;
  }

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
      throw new Error("No matching plan found");
    }

    if (isRenewal) {
      // Update period end on renewal
      await db()
        .update(orgs)
        .set({
          stripeCurrentPeriodEnd: new Date(
            subscription.current_period_end * 1000
          ),
        })
        .where(eq(orgs.id, orgId));

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

      return;
    }

    await db()
      .update(orgs)
      .set({
        plan: newPlan,
        stripeCustomerId: subscription.customer as string,
        stripeSubscriptionId: subscription.id,
        stripeCurrentPeriodEnd: new Date(
          subscription.current_period_end * 1000
        ),
      })
      .where(eq(orgs.id, orgId));

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
    // Update the user stripe info in our database.
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

async function handleInvoicePaymentFailed(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;

  if (!invoice.subscription) {
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(
    invoice.subscription as string
  );

  const orgId = subscription.metadata.org_id;
  const userId = subscription.metadata.userId;

  if (orgId) {
    // Get org name and admin emails for notification
    const [allAdminUserRecords, orgName] = await Promise.all([
      db()
        .select({ userId: orgUsers.userId })
        .from(orgUsers)
        .where(and(eq(orgUsers.orgId, orgId), eq(orgUsers.role, Role.ADMIN))),
      getOrgNameForOrgId(orgId),
    ]);

    const adminUsers = await getUserDetails(
      env,
      allAdminUserRecords.map((member) => member.userId)
    );

    // Send payment failed email to admins
    await Promise.all(
      Object.keys(adminUsers).map((adminUserId) =>
        Email.send(env, {
          to: adminUsers[adminUserId].email,
          from: env.SMTP_FROM,
          subject: `[${siteConfig.name}] Payment failed for ${orgName}`,
          html: `<p>Hello,</p>
<p>We were unable to process payment for your ${siteConfig.name} subscription for the organization "${orgName}".</p>
<p>Please update your payment method to continue using Pro features. You can <a href='${env.NEXT_PUBLIC_APP_URL}/${orgName}/billing'>manage your billing here</a>.</p>
<p>If payment continues to fail, your organization will be downgraded to the Free plan.</p>
<p>Thanks,</p>
<p>${siteConfig.name} team</p>`,
        })
      )
    );

    track(EventNames.ORG_DOWNGRADED, orgId, {
      "org id": orgId,
      reason: "payment_failed",
      "stripe customer id": subscription.customer as string,
      "subscription id": subscription.id,
    });
  }

  if (userId) {
    track(EventNames.USER_DOWNGRADED, userId, {
      reason: "payment_failed",
      "stripe customer id": subscription.customer as string,
      "subscription id": subscription.id,
    });
  }

  console.log(
    `Payment failed for subscription ${subscription.id}, org: ${orgId}, user: ${userId}`
  );
}

async function handleCustomerSubscriptionDeleted(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;
  const orgId = subscription.metadata.org_id;

  if (!orgId) {
    if (subscription.metadata.userId) {
      // Individual user subscription
      track(EventNames.USER_DOWNGRADED, subscription.metadata.userId, {
        "stripe customer id": subscription.customer as string,
        "subscription id": subscription.id,
        "subscription period end": new Date(
          subscription.current_period_end * 1000
        ).toISOString(),
        "price id": subscription.items.data[0].price.id,
      });
      return;
    }

    console.warn("Subscription deleted without org_id or userId in metadata");
    return;
  }

  const downGradedPlan = Plan.FREE;

  // Get current plan before downgrading
  const [orgRecord] = await db()
    .select({ plan: orgs.plan })
    .from(orgs)
    .where(eq(orgs.id, orgId));

  const previousPlan = orgRecord?.plan || Plan.PRO;

  await db()
    .update(orgs)
    .set({
      plan: downGradedPlan,
      stripeSubscriptionId: null,
      stripeCurrentPeriodEnd: null,
    })
    .where(eq(orgs.id, orgId));

  track(EventNames.ORG_DOWNGRADED, orgId, {
    "org id": orgId,
    "previous plan": previousPlan,
    "new plan": downGradedPlan,
    "stripe customer id": subscription.customer as string,
    "subscription id": subscription.id,
    "subscription period end": new Date(
      subscription.current_period_end * 1000
    ).toISOString(),
    "price id": subscription.items.data[0].price.id,
  });

  // Send downgrade email to admins
  const allAdminUserRecords = await db()
    .select({ userId: orgUsers.userId })
    .from(orgUsers)
    .where(and(eq(orgUsers.orgId, orgId), eq(orgUsers.role, Role.ADMIN)));

  const [adminUsers, orgName] = await Promise.all([
    getUserDetails(
      env,
      allAdminUserRecords.map((member) => member.userId)
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
<p>The organization "${orgName}" on ${siteConfig.name} has been downgraded to the Free plan because your subscription has ended.</p>
<p>With the Free plan, you're limited to:</p>
<ul>
  <li>1 calendar connection</li>
  <li>1 destination</li>
  <li>Daily sync only</li>
</ul>
<p>If you'd like to review billing details or subscribe again, you can <a href='${env.NEXT_PUBLIC_APP_URL}/${orgName}/billing'>view billing here</a>.</p>
<p>You are receiving this email because you are an Admin member of this organization.</p>
<p>Thanks & we hope you'll consider upgrading again,</p>
<p>${siteConfig.name} team</p>`,
      })
    )
  );

  console.log(`Subscription deleted for org ${orgId}, downgraded to Free`);
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

  console.log(`Received Stripe Webhook event: ${event.type}`);

  try {
    switch (event.type) {
      case "customer.subscription.created":
        await handleSubscriptionCreated(event);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event);
        break;
      case "customer.subscription.deleted":
        await handleCustomerSubscriptionDeleted(event);
        break;
      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event);
        break;
      default:
        console.log(`Unhandled Stripe Webhook event type: ${event.type}`);
    }
  } catch (error) {
    console.error(`Error handling Stripe webhook ${event.type}:`, error);
    return new NextResponse(`Webhook handler error: ${error.message}`, {
      status: 500,
    });
  }

  return new NextResponse(null);
}
