import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  SyncConfig,
  SyncStatus,
  SyncFrequency,
  DestinationType,
} from "shared/src/db/schema";

// Mock the sync service module
const mockGetDueSyncs = vi.fn();
const mockProcessSync = vi.fn();

vi.mock("../services/sync-service", () => {
  return {
    SyncService: class MockSyncService {
      getDueSyncs = mockGetDueSyncs;
      processSync = mockProcessSync;
    },
  };
});

// Import after mocking
import { handleCron } from "../cron";
import { WorkerEnv } from "../types";

describe("handleCron", () => {
  const mockEnv = {
    GOOGLE_CLIENT_ID: "test-client-id",
    GOOGLE_CLIENT_SECRET: "test-client-secret",
    DB: {} as D1Database,
    QUEUE: {} as Queue<unknown>,
  } as WorkerEnv;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should do nothing when no syncs are due", async () => {
    mockGetDueSyncs.mockResolvedValue([]);

    await handleCron(mockEnv);

    expect(mockGetDueSyncs).toHaveBeenCalled();
    expect(mockProcessSync).not.toHaveBeenCalled();
  });

  it("should process all due syncs", async () => {
    const mockSyncs: Partial<SyncConfig>[] = [
      {
        id: "sync1",
        userId: "user1",
        name: "My Sync",
        calendarId: "primary",
        destinationType: DestinationType.GOOGLE_SHEETS,
        destinationId: "sheet1",
        syncFrequency: SyncFrequency.EVERY_15_MINUTES,
        status: SyncStatus.ACTIVE,
      },
      {
        id: "sync2",
        userId: "user2",
        name: "Another Sync",
        calendarId: "work@example.com",
        destinationType: DestinationType.NOTION,
        destinationId: "notion-db-1",
        syncFrequency: SyncFrequency.HOURLY,
        status: SyncStatus.ACTIVE,
      },
    ];

    mockGetDueSyncs.mockResolvedValue(mockSyncs);
    mockProcessSync.mockImplementation(async (config: Partial<SyncConfig>) => ({
      syncConfigId: config.id,
      success: true,
      eventsProcessed: 5,
      eventsCreated: 3,
      eventsUpdated: 2,
      eventsDeleted: 0,
    }));

    await handleCron(mockEnv);

    expect(mockGetDueSyncs).toHaveBeenCalled();
    expect(mockProcessSync).toHaveBeenCalledTimes(2);
  });

  it("should handle sync failures gracefully", async () => {
    const mockSyncs: Partial<SyncConfig>[] = [
      {
        id: "sync1",
        userId: "user1",
        name: "Failing Sync",
        calendarId: "primary",
        destinationType: DestinationType.GOOGLE_SHEETS,
        destinationId: "sheet1",
        syncFrequency: SyncFrequency.EVERY_15_MINUTES,
        status: SyncStatus.ACTIVE,
      },
    ];

    mockGetDueSyncs.mockResolvedValue(mockSyncs);
    mockProcessSync.mockResolvedValue({
      syncConfigId: "sync1",
      success: false,
      eventsProcessed: 0,
      eventsCreated: 0,
      eventsUpdated: 0,
      eventsDeleted: 0,
      error: "API rate limit exceeded",
    });

    // Should not throw even when sync fails
    await expect(handleCron(mockEnv)).resolves.not.toThrow();
  });

  it("should limit syncs per cron run to prevent timeout", async () => {
    // Create more than MAX_SYNCS_PER_CRON (50) syncs
    const mockSyncs: Partial<SyncConfig>[] = Array.from(
      { length: 60 },
      (_, i) => ({
        id: `sync${i}`,
        userId: `user${i}`,
        name: `Sync ${i}`,
        calendarId: "primary",
        destinationType: DestinationType.GOOGLE_SHEETS,
        destinationId: `sheet${i}`,
        syncFrequency: SyncFrequency.EVERY_15_MINUTES,
        status: SyncStatus.ACTIVE,
      })
    );

    mockGetDueSyncs.mockResolvedValue(mockSyncs);
    mockProcessSync.mockImplementation(async (config: Partial<SyncConfig>) => ({
      syncConfigId: config.id,
      success: true,
      eventsProcessed: 1,
      eventsCreated: 1,
      eventsUpdated: 0,
      eventsDeleted: 0,
    }));

    await handleCron(mockEnv);

    // Should only process 50 syncs
    expect(mockProcessSync).toHaveBeenCalledTimes(50);
  });
});
