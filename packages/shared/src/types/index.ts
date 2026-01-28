import { Environment } from "../environment";

export type UndefinedObject<T> = {
  [K in keyof T]: T[K] | undefined;
};

export interface Env {
  SMTP_FROM: string;
  STRIPE_API_KEY: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_PRO_MONTHLY_PLAN_ID: string;
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: string;
  NEXT_PUBLIC_FIREBASE_API_KEY: string;
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: string;
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: string;
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: string;
  NEXT_PUBLIC_FIREBASE_APP_ID: string;
  FIREBASE_PRIVATE_KEY: string;
  FIREBASE_CLIENT_EMAIL: string;
  AUTH_COOKIE_SIGNATURE_1: string;
  AUTH_COOKIE_SIGNATURE_2: string;
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  NEXT_PUBLIC_ENVIRONMENT: Environment;
}

export interface DBEnv {
  DB: D1Database;
}

export type UserDetail = {
  userId: string;
  email: string;
  displayName?: string;
  photoUrl?: string;
};
