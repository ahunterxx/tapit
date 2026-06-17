import IORedis from "ioredis";

// BullMQ bundles its own ioredis; we keep a separate IORedis client only for
// non-BullMQ use. BullMQ is given the URL string directly (see getRedisUrl).
let client: IORedis | null = null;

export function getRedisUrl(): string {
  return process.env.REDIS_URL ?? "redis://localhost:6379";
}

export function getRedis(): IORedis {
  if (!client) {
    client = new IORedis(getRedisUrl(), { maxRetriesPerRequest: null });
    client.on("error", (err) => console.error("[Redis] connection error:", err.message));
  }
  return client;
}
