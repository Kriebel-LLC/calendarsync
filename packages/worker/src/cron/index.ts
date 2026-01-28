import { WorkerEnv } from "../types";
import { SyncService, SyncResult } from "../services/sync-service";

const MAX_SYNCS_PER_CRON = 50; // Limit syncs per cron run to avoid timeout

export async function handleCron(env: WorkerEnv): Promise<void> {
  console.log("Starting scheduled sync cron job");

  const syncService = new SyncService(env);

  try {
    // Get all syncs that are due
    const dueSyncs = await syncService.getDueSyncs();
    console.log(`Found ${dueSyncs.length} sync configs due for processing`);

    if (dueSyncs.length === 0) {
      console.log("No syncs to process");
      return;
    }

    // Limit the number of syncs per cron run to avoid timeout
    const syncsToProcess = dueSyncs.slice(0, MAX_SYNCS_PER_CRON);
    if (dueSyncs.length > MAX_SYNCS_PER_CRON) {
      console.log(
        `Processing ${MAX_SYNCS_PER_CRON} of ${dueSyncs.length} due syncs (will continue in next cron)`
      );
    }

    // Process syncs in parallel with concurrency limit
    const results = await processWithConcurrency(
      syncsToProcess,
      async (config) => {
        console.log(`Processing sync config ${config.id} for user ${config.userId}`);
        return syncService.processSync(config);
      },
      5 // Process 5 syncs concurrently
    );

    // Log summary
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    const totalEvents = results.reduce((sum, r) => sum + r.eventsProcessed, 0);

    console.log(
      `Cron job completed: ${successful} successful, ${failed} failed, ${totalEvents} events processed`
    );

    // Log failures for debugging
    for (const result of results) {
      if (!result.success) {
        console.error(
          `Sync ${result.syncConfigId} failed: ${result.error}`
        );
      }
    }
  } catch (error) {
    console.error("Cron job failed with error:", error);
    throw error;
  }
}

async function processWithConcurrency<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];

  for (const item of items) {
    const promise = processor(item).then((result) => {
      results.push(result);
    });

    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      // Remove completed promises
      const newExecuting: Promise<void>[] = [];
      for (const p of executing) {
        // Check if promise is still pending by racing with a resolved promise
        const status = await Promise.race([
          p.then(() => "resolved" as const),
          Promise.resolve("pending" as const),
        ]);
        if (status === "pending") {
          newExecuting.push(p);
        }
      }
      executing.length = 0;
      executing.push(...newExecuting);
    }
  }

  // Wait for all remaining promises
  await Promise.all(executing);

  return results;
}
