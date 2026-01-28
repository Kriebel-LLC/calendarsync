import { eq, and, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import {
  SyncConfig,
  SyncHistoryEntry,
  syncConfigs,
  syncHistory,
  oauthCredentials,
  SyncStatus,
  SyncRunStatus,
  SyncFrequency,
  DestinationType,
} from "shared/src/db/schema";
import { WorkerEnv } from "../types";
import { GoogleCalendarClient, refreshAccessToken } from "./google-calendar";
import { GoogleSheetsAdapter, NotionAdapter, DestinationAdapter } from "./destinations";

// Generate a simple unique ID
function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
}

export interface SyncResult {
  syncConfigId: string;
  success: boolean;
  eventsProcessed: number;
  eventsCreated: number;
  eventsUpdated: number;
  eventsDeleted: number;
  error?: string;
}

export class SyncService {
  private db: ReturnType<typeof drizzle>;
  private env: WorkerEnv;

  constructor(env: WorkerEnv) {
    this.env = env;
    this.db = drizzle(env.DB);
  }

  async getDueSyncs(): Promise<SyncConfig[]> {
    const now = new Date();
    const results = await this.db
      .select()
      .from(syncConfigs)
      .where(
        and(
          eq(syncConfigs.status, SyncStatus.ACTIVE),
          lte(syncConfigs.nextSyncAt, now)
        )
      );

    return results;
  }

  async processSync(config: SyncConfig): Promise<SyncResult> {
    const historyId = generateId();

    // Create sync history entry
    await this.db.insert(syncHistory).values({
      id: historyId,
      syncConfigId: config.id,
      status: SyncRunStatus.RUNNING,
      startedAt: new Date(),
    });

    try {
      // Get user's OAuth credentials
      const credentials = await this.db
        .select()
        .from(oauthCredentials)
        .where(
          and(
            eq(oauthCredentials.userId, config.userId),
            eq(oauthCredentials.provider, "google")
          )
        )
        .limit(1);

      if (credentials.length === 0) {
        throw new Error("No Google OAuth credentials found for user");
      }

      let accessToken = credentials[0].accessToken;
      const refreshToken = credentials[0].refreshToken;
      const expiresAt = credentials[0].expiresAt;

      // Refresh token if expired or about to expire (within 5 minutes)
      const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
      if (expiresAt && expiresAt < fiveMinutesFromNow && refreshToken) {
        console.log(`Refreshing access token for user ${config.userId}`);
        const refreshed = await refreshAccessToken(refreshToken, this.env);
        accessToken = refreshed.accessToken;

        // Update stored token
        await this.db
          .update(oauthCredentials)
          .set({
            accessToken: refreshed.accessToken,
            expiresAt: new Date(Date.now() + refreshed.expiresIn * 1000),
          })
          .where(eq(oauthCredentials.id, credentials[0].id));
      }

      // Sync events from Google Calendar
      const calendarClient = new GoogleCalendarClient(accessToken, this.env);
      const syncResult = await calendarClient.syncEvents(
        config.calendarId,
        config.syncToken
      );

      console.log(
        `Fetched ${syncResult.events.length} events, ${syncResult.deletedEventIds.length} deletions for sync config ${config.id}`
      );

      // Create destination adapter
      const adapter = this.createDestinationAdapter(
        config.destinationType as DestinationType,
        accessToken,
        config.destinationId
      );

      // Push events to destination
      let eventsCreated = 0;
      let eventsUpdated = 0;
      let eventsDeleted = 0;
      const errors: string[] = [];

      if (syncResult.events.length > 0) {
        const pushResult = await adapter.pushEvents(syncResult.events);
        eventsCreated = pushResult.created;
        eventsUpdated = pushResult.updated;
        if (pushResult.errors.length > 0) {
          errors.push(...pushResult.errors);
        }
      }

      if (syncResult.deletedEventIds.length > 0) {
        eventsDeleted = await adapter.deleteEvents(syncResult.deletedEventIds);
      }

      // Update sync config with new sync token and schedule next sync
      const nextSyncAt = this.calculateNextSyncTime(
        config.syncFrequency as SyncFrequency
      );

      await this.db
        .update(syncConfigs)
        .set({
          syncToken: syncResult.nextSyncToken,
          lastSyncAt: new Date(),
          nextSyncAt,
          lastErrorMessage: errors.length > 0 ? errors.join("; ") : null,
          status:
            errors.length > 0 ? SyncStatus.ERROR : SyncStatus.ACTIVE,
        })
        .where(eq(syncConfigs.id, config.id));

      // Update sync history
      await this.db
        .update(syncHistory)
        .set({
          status:
            errors.length > 0 ? SyncRunStatus.FAILED : SyncRunStatus.SUCCESS,
          completedAt: new Date(),
          eventsProcessed: syncResult.events.length,
          eventsCreated,
          eventsUpdated,
          eventsDeleted,
          errorMessage: errors.length > 0 ? errors.join("; ") : null,
        })
        .where(eq(syncHistory.id, historyId));

      return {
        syncConfigId: config.id,
        success: errors.length === 0,
        eventsProcessed: syncResult.events.length,
        eventsCreated,
        eventsUpdated,
        eventsDeleted,
        error: errors.length > 0 ? errors.join("; ") : undefined,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      // Update sync config with error status
      await this.db
        .update(syncConfigs)
        .set({
          lastErrorMessage: errorMessage,
          status: SyncStatus.ERROR,
          // Still schedule next sync even on error (will be retried)
          nextSyncAt: this.calculateNextSyncTime(
            config.syncFrequency as SyncFrequency
          ),
        })
        .where(eq(syncConfigs.id, config.id));

      // Update sync history
      await this.db
        .update(syncHistory)
        .set({
          status: SyncRunStatus.FAILED,
          completedAt: new Date(),
          errorMessage: errorMessage,
        })
        .where(eq(syncHistory.id, historyId));

      return {
        syncConfigId: config.id,
        success: false,
        eventsProcessed: 0,
        eventsCreated: 0,
        eventsUpdated: 0,
        eventsDeleted: 0,
        error: errorMessage,
      };
    }
  }

  private createDestinationAdapter(
    type: DestinationType,
    accessToken: string,
    destinationId: string
  ): DestinationAdapter {
    switch (type) {
      case DestinationType.GOOGLE_SHEETS:
        return new GoogleSheetsAdapter(accessToken, destinationId);
      case DestinationType.NOTION:
        // Note: Notion uses its own OAuth token, not Google's
        // In a real implementation, you'd fetch the Notion token separately
        return new NotionAdapter(accessToken, destinationId);
      default:
        throw new Error(`Unsupported destination type: ${type}`);
    }
  }

  private calculateNextSyncTime(frequency: SyncFrequency): Date {
    const now = new Date();

    switch (frequency) {
      case SyncFrequency.EVERY_15_MINUTES:
        return new Date(now.getTime() + 15 * 60 * 1000);
      case SyncFrequency.HOURLY:
        return new Date(now.getTime() + 60 * 60 * 1000);
      case SyncFrequency.DAILY:
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      default:
        // Default to hourly
        return new Date(now.getTime() + 60 * 60 * 1000);
    }
  }
}
