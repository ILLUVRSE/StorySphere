// backend/src/logging.ts
import { createClient } from "redis";
import { config } from "./config";

const pubClient = createClient({
  socket: { host: config.redis.host, port: config.redis.port },
});

pubClient.on("error", (err) => {
  console.error("Redis pub client error:", err);
});

(async () => {
  try {
    await pubClient.connect();
    console.log("Redis pub client connected");
  } catch (err) {
    console.error("Failed to connect Redis pub client:", err);
  }
})();

export async function logForJob(jobId: string | number, message: string) {
  const id = String(jobId);
  const payload = JSON.stringify({ ts: new Date().toISOString(), message });
  try {
    await pubClient.publish(`job:logs:${id}`, payload);
  } catch (err) {
    console.error("Failed to publish job log:", err);
  }
}
