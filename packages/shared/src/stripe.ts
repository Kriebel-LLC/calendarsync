import Stripe from "stripe";

let internalStripe: Stripe | undefined;

export function stripe(env: { STRIPE_SECRET_KEY: string }): Stripe {
  if (!internalStripe) {
    internalStripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: "2022-11-15",
      typescript: true,
      httpClient: Stripe.createFetchHttpClient(), // ensure we use a Fetch client, and not Node's `http` for edge environments
    });
  }
  return internalStripe;
}
