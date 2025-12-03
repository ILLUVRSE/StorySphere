// backend/src/worker.ts
import { Worker, Job } from "bullmq";
import { config } from "./config";
import { logForJob } from "./logging";

interface GenerationJobData {
  prompt: string;
  title: string;
  style: string;
  voice: string;
  language: string;
  duration_target: number;
  produce_preview: boolean;
}

console.log("Starting StorySphere Worker...");

const worker = new Worker<GenerationJobData>(
  "generation-queue",
  async (job: Job) => {
    console.log(`[Job ${job.id}] Processing started: ${job.data.title}`);
    await job.updateProgress(0);

    try {
      // Step 1: Script Generation
      await logForJob(job.id!, "Step 1: Generating script with Ollama (placeholder)...");
      await job.updateProgress(10);
      // TODO: Call Ollama
      await new Promise((r) => setTimeout(r, 1000));

      // Step 2: TTS
      await logForJob(job.id!, "Step 2: Generating audio (placeholder)...");
      await job.updateProgress(30);
      // TODO: Call ElevenLabs/Local TTS
      await new Promise((r) => setTimeout(r, 1000));

      // Step 3: Visuals
      await logForJob(job.id!, "Step 3: Generating visuals (placeholder)...");
      await job.updateProgress(60);
      // TODO: Call ComfyUI
      await new Promise((r) => setTimeout(r, 1000));

      // Step 4: Assembly
      await logForJob(job.id!, "Step 4: Assembling media (placeholder)...");
      await job.updateProgress(90);
      // TODO: FFmpeg assembly
      await new Promise((r) => setTimeout(r, 1000));

      await logForJob(job.id!, "Completed successfully.");
      await job.updateProgress(100);

      return {
        preview_url: `http://localhost:9000/storysphere-media/${job.id}/preview.mp4`,
        status: "completed",
      };
    } catch (error: any) {
      const message = (error && error.message) || String(error || "unknown error");
      console.error(`[Job ${job.id}] Failed:`, error);
      await logForJob(job.id!, `Failed: ${message}`);
      throw error;
    }
  },
  {
    connection: config.redis,
    concurrency: 2,
  }
);

worker.on("completed", (job) => {
  console.log(`[Job ${job.id}] Finished!`);
});

worker.on("failed", (job, err) => {
  console.log(`[Job ${job?.id}] Failed with ${err?.message}`);
});

console.log("Worker is ready to accept jobs.");
