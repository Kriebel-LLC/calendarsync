import { DBEnv, Env } from "shared/src/types";
import type { QueueMessage } from "./queue";

export interface WorkerEnv extends Env, DBEnv {
  QUEUE: Queue<QueueMessage>;
}
