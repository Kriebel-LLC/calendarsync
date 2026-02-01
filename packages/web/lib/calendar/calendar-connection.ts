/**
 * Calendar connection service for managing Google Calendar OAuth tokens
 */
import { db } from "@/db";
import { env } from "@/web-env";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { calendarConnections } from "shared/src/db/schema";
import { decryptToken, encryptToken } from "shared/src/encryption";

import { refreshAccessToken } from "./google-oauth";

export interface CalendarConnectionData {
  accessToken: string;
  refreshToken: string;
  expiryDate: number;
  googleEmail?: string;
  calendarIds?: string[];
}

// In-memory lock to prevent concurrent token refreshes per user
const refreshLocks = new Map<string, Promise<void>>();

/**
 * Safely parses JSON with a fallback value
 */
function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

/**
 * Creates or updates a calendar connection for a user
 */
export async function upsertCalendarConnection(
  userId: string,
  data: CalendarConnectionData
) {
  const encryptionSecret = env.TOKEN_ENCRYPTION_SECRET;

  const [accessTokenEncrypted, refreshTokenEncrypted] = await Promise.all([
    encryptToken(data.accessToken, encryptionSecret),
    encryptToken(data.refreshToken, encryptionSecret),
  ]);

  const existing = await db()
    .select()
    .from(calendarConnections)
    .where(eq(calendarConnections.userId, userId))
    .get();

  if (existing) {
    // Update existing connection
    await db()
      .update(calendarConnections)
      .set({
        accessTokenEncrypted,
        refreshTokenEncrypted,
        tokenExpiry: new Date(data.expiryDate),
        googleEmail: data.googleEmail,
        calendarIds: JSON.stringify(data.calendarIds || []),
      })
      .where(eq(calendarConnections.userId, userId));

    return existing.id;
  } else {
    // Create new connection
    const id = nanoid();
    await db()
      .insert(calendarConnections)
      .values({
        id,
        userId,
        accessTokenEncrypted,
        refreshTokenEncrypted,
        tokenExpiry: new Date(data.expiryDate),
        googleEmail: data.googleEmail,
        calendarIds: JSON.stringify(data.calendarIds || []),
      });

    return id;
  }
}

/**
 * Gets a calendar connection for a user
 */
export async function getCalendarConnection(userId: string) {
  const connection = await db()
    .select()
    .from(calendarConnections)
    .where(eq(calendarConnections.userId, userId))
    .get();

  return connection;
}

/**
 * Gets decrypted tokens for a user's calendar connection
 * Automatically refreshes the access token if expired
 * Returns null if connection doesn't exist or tokens are corrupted
 */
export async function getCalendarTokens(userId: string): Promise<{
  accessToken: string;
  refreshToken: string;
  calendarIds: string[];
  googleEmail: string | null;
} | null> {
  const connection = await getCalendarConnection(userId);
  if (!connection) {
    return null;
  }

  const encryptionSecret = env.TOKEN_ENCRYPTION_SECRET;

  // Decrypt tokens with error handling for corrupted data
  let accessToken: string;
  let refreshToken: string;
  try {
    [accessToken, refreshToken] = await Promise.all([
      decryptToken(connection.accessTokenEncrypted, encryptionSecret),
      decryptToken(connection.refreshTokenEncrypted, encryptionSecret),
    ]);
  } catch (err) {
    // Token decryption failed - likely corrupted data or changed encryption key
    // Delete the corrupted connection so user can re-authenticate
    console.error("Token decryption failed for user", userId, err);
    await deleteCalendarConnection(userId);
    return null;
  }

  // Check if token is expired (with 5 minute buffer)
  const isExpired =
    connection.tokenExpiry.getTime() < Date.now() + 5 * 60 * 1000;

  if (isExpired) {
    // Use lock to prevent concurrent refresh attempts for the same user
    const existingLock = refreshLocks.get(userId);
    if (existingLock) {
      // Wait for existing refresh to complete, then re-fetch tokens
      await existingLock;
      return getCalendarTokens(userId);
    }

    // Create a new lock for this refresh operation
    let resolveLock: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    refreshLocks.set(userId, lockPromise);

    try {
      // Re-check expiry after acquiring lock (another request may have refreshed)
      const freshConnection = await getCalendarConnection(userId);
      if (
        freshConnection &&
        freshConnection.tokenExpiry.getTime() >= Date.now() + 5 * 60 * 1000
      ) {
        // Token was refreshed by another request, decrypt and return
        const freshAccessToken = await decryptToken(
          freshConnection.accessTokenEncrypted,
          encryptionSecret
        );
        return {
          accessToken: freshAccessToken,
          refreshToken,
          calendarIds: safeJsonParse<string[]>(freshConnection.calendarIds, []),
          googleEmail: freshConnection.googleEmail,
        };
      }

      // Refresh the token
      const newCredentials = await refreshAccessToken(refreshToken);

      if (!newCredentials.access_token || !newCredentials.expiry_date) {
        throw new Error(
          "Failed to refresh access token: incomplete credentials returned"
        );
      }

      accessToken = newCredentials.access_token;

      // Update stored tokens
      await upsertCalendarConnection(userId, {
        accessToken,
        refreshToken: newCredentials.refresh_token || refreshToken,
        expiryDate: newCredentials.expiry_date,
        googleEmail: connection.googleEmail || undefined,
        calendarIds: safeJsonParse<string[]>(connection.calendarIds, []),
      });
    } finally {
      // Release lock
      refreshLocks.delete(userId);
      resolveLock!();
    }
  }

  return {
    accessToken,
    refreshToken,
    calendarIds: safeJsonParse<string[]>(connection.calendarIds, []),
    googleEmail: connection.googleEmail,
  };
}

/**
 * Updates the selected calendar IDs for a user's connection
 */
export async function updateCalendarIds(userId: string, calendarIds: string[]) {
  await db()
    .update(calendarConnections)
    .set({
      calendarIds: JSON.stringify(calendarIds),
    })
    .where(eq(calendarConnections.userId, userId));
}

/**
 * Deletes a user's calendar connection
 */
export async function deleteCalendarConnection(userId: string) {
  await db()
    .delete(calendarConnections)
    .where(eq(calendarConnections.userId, userId));
}
