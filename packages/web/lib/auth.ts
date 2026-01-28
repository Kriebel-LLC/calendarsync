import { db } from "@/db";
import { env } from "@/web-env";
import { eq } from "drizzle-orm";
import { authConfig as initAuthConfig } from "shared/src/auth";
import { User, users } from "shared/src/db/schema";

export const loginPath = "/api/login";
export const logoutPath = "/api/logout";
export const authConfig = initAuthConfig(env);

export function getAuthorizationTokenFromHeader(headers: Headers) {
  return headers.get("Authorization")?.split(" ")[1];
}

async function getUserRecord(uid: string): Promise<User | undefined> {
  return (await db().select().from(users).where(eq(users.id, uid)).limit(1))[0];
}

export async function getOrCreateUserRecord(uid: string): Promise<User> {
  const maybeUser = await getUserRecord(uid);
  if (maybeUser) {
    return maybeUser;
  }

  // lazily insert since created records on sign-up is not guaranteed due to creation happening in Firebase
  return (await db().insert(users).values({ id: uid }).returning())[0];
}
