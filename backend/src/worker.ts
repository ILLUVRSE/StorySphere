import { Worker, Job } from 'bullmq';
import { config } from './config';
import { generateScript } from "./ollama";
import { putJson } from "./storage";
import { logForJob } from "./logging";

// Define the Job Data Interface
interface GenerationJobData {
  prompt: string;
  title: string;
  style: string;
  voice: string;
  language: string;
  duration_target: number;
  produce_preview: boolean;
}

console.log('Starting StorySphere Worker...');

const worker = new Worker<GenerationJobData>(
  'generation-queue',
  async (job: Job) => {
    console.log(`[Job ${job.id}] Processing started: ${job.data.title}`);
    await job.updateProgress(0);

    try {
      // Step 1: Script Generation (Ollama)
      await logForJob(job.id!, "Step 1: Generating script with Ollama...");
      await job.updateProgress(5);
      const script = await generateScript(job.data.prompt);

      // Upload the script to MinIO for later retrieval
      const scriptKey = `scripts/${job.id}.json`;
      try {
        await putJson(scriptKey, script);
        await logForJob(job.id!, `Script uploaded to ${config.minio.bucket}/${scriptKey}`);
      } catch (e: any) {
        await logForJob(job.id!, `Warning: failed to upload script to MinIO: ${e?.message || e}`);
      }
      // Advance progress
      await job.updateProgress(15);

      // Step 2: TTS (Mock/Placeholder)
      console.log(`[Job ${job.id}] Step 2: Generating Audio (Placeholder)...`);
      await job.updateProgress(30);
      // TODO: Call ElevenLabs/Local TTS
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 3: Visual Generation (Mock/Placeholder)
      console.log(`[Job ${job.id}] Step 3: Generating Visuals (Placeholder)...`);
      await job.updateProgress(60);
      // TODO: Call ComfyUI
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 4: Assembly (Mock/Placeholder)
      console.log(`[Job ${job.id}] Step 4: Assembling Media (Placeholder)...`);
      await job.updateProgress(90);
      // TODO: FFmpeg assembly
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log(`[Job ${job.id}] Completed successfully.`);
      await job.updateProgress(100);

      return {
        preview_url: `http://localhost:9000/storysphere-media/${job.id}/preview.mp4`, // Mock URL
        status: 'completed'
      };

    } catch (error) {
      console.error(`[Job ${job.id}] Failed:`, error);
      throw error;
    }
  },
  {
    connection: config.redis,
    concurrency: 2 // Allow processing 2 jobs at once
  }
);

worker.on('completed', (job) => {
  console.log(`[Job ${job.id}] Finished!`);
});

worker.on('failed', (job, err) => {
  console.log(`[Job ${job?.id}] Failed with ${err.message}`);
});

console.log('Worker is ready to accept jobs.');
