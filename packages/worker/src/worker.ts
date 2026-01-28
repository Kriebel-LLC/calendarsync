import { Router } from "itty-router";
import { handleCron } from "./cron";
import { QueueMessage, handleQueueMessage } from "./queue";
import { WorkerEnv } from "./types";

const router = Router();

router.get("/api/test", (request, env) => {
  return new Response("test");
});
router.all("*", () => new Response("Not Found", { status: 404 }));

const handler: ExportedHandler<WorkerEnv, QueueMessage> = {
  // TODO: consider copying env onto process.env https://developers.cloudflare.com/workers/runtime-apis/nodejs/process/#relationship-to-per-request-env-argument-in-fetch-handlers
  fetch: router.handle,
  scheduled: async function scheduled(
    controller: ScheduledController,
    env: WorkerEnv,
    ctx: ExecutionContext
  ) {
    console.log("Starting cron");

    await handleCron(env);

    console.log("Finished cron");
  },
  queue: async function queue(
    batch: MessageBatch<QueueMessage>,
    env: WorkerEnv
  ) {
    const messagePromises = [];
    for (const message of batch.messages) {
      messagePromises.push(handleQueueMessage(env, message));
    }

    await Promise.all(messagePromises);
  },
};

export default handler;
