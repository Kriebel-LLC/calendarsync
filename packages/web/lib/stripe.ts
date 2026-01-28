import { env } from "@/web-env";
import { stripe as instantiateStripe } from "shared/src/stripe";

// for convenience, to not have to import env everywhere
export const stripe = instantiateStripe(env);
