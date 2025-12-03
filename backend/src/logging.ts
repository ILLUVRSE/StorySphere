// backend/src/logging.ts
import { createClient } from "redis";
import { config } from "./config";

const pubClient = createClient({
  socket: { host: config.redis.host, port: config.redis.port },
});

pubClient.on("error", (err) => {
  console.error("Redis pub client error:", err);
});

let ready = false;

async function connectWithRetry(maxAttempts = 10, initialMs = 500) {
  let attempt = 0;
  let delay = initialMs;
  while (attempt < maxAttempts && !ready) {
    attempt++;
    try {
      await pubClient.connect();
      ready = true;
      console.log("Redis pub client connected");
      return;
    } catch (err) {
      console.warn(`Redis connect attempt ${attempt} failed: ${err}. retrying in ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 2, 5000);
    }
  }
  if (!ready) {
    console.error("Could not connect to Redis pub client after retries. Logging will try to reconnect on publish.");
  }
}

// Start connection attempts in background
connectWithRetry().catch((e) => console.error("Redis connect failure:", e));

export async function logForJob(jobId: string | number, message: string) {
  const id = String(jobId);
  const payload = JSON.stringify({ ts: new Date().toISOString(), message });

  // If not ready yet, try connecting one more time lazily before publish
  if (!ready) {
    try {
      await pubClient.connect();
      ready = true;
    } catch (e) {
      // fallback: log locally and return so we don't throw
      console.error("Failed to connect Redis when publishing log:", e);
      console.log(`[Job ${id}] ${message}`);
      return;
    }
  }

  try {
    await pubClient.publish(`job:logs:${id}`, payload);
  } catch (err) {
    console.error("Failed to publish job log:", err);
  }
}
