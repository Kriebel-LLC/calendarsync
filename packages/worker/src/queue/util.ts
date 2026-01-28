// Cloudflare limit: https://developers.cloudflare.com/queues/platform/limits/
const MAXIMUM_BATCH_SIZE = 100;

export async function sendBatches<Body = unknown>(
  queue: Queue<Body>,
  messages: MessageSendRequest<Body>[]
): Promise<void[]> {
  const batchPromises: Promise<void>[] = [];

  // Calculate the number of batches needed
  const numBatches = Math.ceil(messages.length / MAXIMUM_BATCH_SIZE);

  for (let i = 0; i < numBatches; i++) {
    const startIdx = i * MAXIMUM_BATCH_SIZE;
    const endIdx = Math.min((i + 1) * MAXIMUM_BATCH_SIZE, messages.length); // Ensure endIdx doesn't go beyond the array length
    const batch = messages.slice(startIdx, endIdx);

    // Create a promise for each batch and push it to the array
    batchPromises.push(queue.sendBatch(batch));
  }

  return Promise.all(batchPromises);
}
