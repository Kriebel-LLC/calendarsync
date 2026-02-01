/**
 * Notion connection service for managing OAuth connections and database access.
 */

import { db } from "@/db";
import { env } from "@/web-env";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { notionConnections, NotionConnection } from "shared/src/db/schema";
import { encryptToken, decryptToken } from "shared/src/encryption";
import { NotionTokenResponse } from "./notion-oauth";

export interface NotionConnectionInfo {
  connected: boolean;
  workspaceId?: string;
  workspaceName?: string;
  workspaceIcon?: string;
  selectedDatabaseId?: string;
  selectedDatabaseName?: string;
}

/**
 * Creates or updates a Notion connection for a user.
 */
export async function upsertNotionConnection(
  userId: string,
  tokenResponse: NotionTokenResponse
): Promise<NotionConnection> {
  const encryptedAccessToken = await encryptToken(
    tokenResponse.access_token,
    env.TOKEN_ENCRYPTION_SECRET
  );

  const existing = await db()
    .select()
    .from(notionConnections)
    .where(eq(notionConnections.userId, userId))
    .get();

  if (existing) {
    // Update existing connection
    const updated = await db()
      .update(notionConnections)
      .set({
        accessTokenEncrypted: encryptedAccessToken,
        workspaceId: tokenResponse.workspace_id,
        workspaceName: tokenResponse.workspace_name,
        workspaceIcon: tokenResponse.workspace_icon,
        botId: tokenResponse.bot_id,
      })
      .where(eq(notionConnections.userId, userId))
      .returning();

    return updated[0];
  }

  // Create new connection
  const created = await db()
    .insert(notionConnections)
    .values({
      id: nanoid(),
      userId,
      accessTokenEncrypted: encryptedAccessToken,
      workspaceId: tokenResponse.workspace_id,
      workspaceName: tokenResponse.workspace_name,
      workspaceIcon: tokenResponse.workspace_icon,
      botId: tokenResponse.bot_id,
    })
    .returning();

  return created[0];
}

/**
 * Gets the Notion connection for a user.
 */
export async function getNotionConnection(
  userId: string
): Promise<NotionConnection | undefined> {
  return db()
    .select()
    .from(notionConnections)
    .where(eq(notionConnections.userId, userId))
    .get();
}

/**
 * Gets the decrypted access token for a user's Notion connection.
 * Returns null if no connection exists.
 */
export async function getNotionAccessToken(
  userId: string
): Promise<string | null> {
  const connection = await getNotionConnection(userId);

  if (!connection) {
    return null;
  }

  try {
    return await decryptToken(
      connection.accessTokenEncrypted,
      env.TOKEN_ENCRYPTION_SECRET
    );
  } catch (error) {
    console.error("Failed to decrypt Notion access token:", error);
    return null;
  }
}

/**
 * Gets connection info for display purposes.
 */
export async function getNotionConnectionInfo(
  userId: string
): Promise<NotionConnectionInfo> {
  const connection = await getNotionConnection(userId);

  if (!connection) {
    return { connected: false };
  }

  return {
    connected: true,
    workspaceId: connection.workspaceId ?? undefined,
    workspaceName: connection.workspaceName ?? undefined,
    workspaceIcon: connection.workspaceIcon ?? undefined,
    selectedDatabaseId: connection.selectedDatabaseId ?? undefined,
    selectedDatabaseName: connection.selectedDatabaseName ?? undefined,
  };
}

/**
 * Updates the selected database for a user's Notion connection.
 */
export async function updateSelectedDatabase(
  userId: string,
  databaseId: string,
  databaseName: string
): Promise<void> {
  await db()
    .update(notionConnections)
    .set({
      selectedDatabaseId: databaseId,
      selectedDatabaseName: databaseName,
    })
    .where(eq(notionConnections.userId, userId));
}

/**
 * Deletes a user's Notion connection.
 */
export async function deleteNotionConnection(userId: string): Promise<void> {
  await db()
    .delete(notionConnections)
    .where(eq(notionConnections.userId, userId));
}
