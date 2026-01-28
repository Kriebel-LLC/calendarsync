import { WorkerEnv } from "@/src/types";
import { assertNever } from "shared/src/utils";

export enum QueueMessageType {
  Default = "DEFAULT",
}

export type QueueMessage = DefaultQueueMessage;

export type DefaultQueueMessage = {
  type: QueueMessageType.Default;
  foo: string;
};

export async function handleQueueMessage(
  env: WorkerEnv,
  message: Message<QueueMessage>
) {
  try {
    const { body } = message;

    console.log(`Got ${body.type} message with id: ${message.id}`);

    const messageType = body.type;
    switch (messageType) {
      case QueueMessageType.Default:
        return;
      default:
        assertNever(messageType);
    }
  } catch (error) {
    // retry ONLY the failed message; if uncaught, entire batch will be retried
    console.error(error);
    message.retry();
  }
}
