import { Worker, Job } from 'bullmq';
import { config } from './config';
import { generateScript } from "./ollama";
import { putJson, putObject, getObjectBuffer } from "./storage";
import { logForJob } from "./logging";
import { generateAudioForJob } from "./tts";
import { renderComfyFrame } from "./comfyui";
import fs from 'fs/promises';
import { execFileSync } from 'child_process';
import path from 'path';

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

const tmpDir = '/tmp/storysphere';
async function ensureTmp() {
  try { await fs.mkdir(tmpDir, { recursive: true }); } catch {}
}

const worker = new Worker<GenerationJobData>(
  'generation-queue',
  async (job: Job) => {
    console.log(`[Job ${job.id}] Processing started: ${job.data.title}`);
    await job.updateProgress(0);

    await ensureTmp();

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
      await job.updateProgress(15);

      // Step 2: TTS
      await logForJob(job.id!, "Step 2: Generating Audio...");
      await job.updateProgress(30);
      const audioKey = await generateAudioForJob(job.id!.toString(), script);
      await logForJob(job.id!, `Audio generated at ${audioKey}`);
      await job.updateProgress(50);

      // Download audio from MinIO to tmp
      const audioBuf = await getObjectBuffer(audioKey);
      const audioPath = path.join(tmpDir, `audio-${job.id}.mp3`);
      await fs.writeFile(audioPath, audioBuf);

      // Step 3: Visual Generation (ComfyUI)
      await logForJob(job.id!, "Step 3: Generating visuals with ComfyUI...");
      await job.updateProgress(65);

      const duration = Math.max(1, Math.round(job.data.duration_target || 7));
      const videoPath = path.join(tmpDir, `video-${job.id}.mp4`);
      const imagePath = path.join(tmpDir, `frame-${job.id}.png`);

      try {
        // Choose a prompt for visuals — use the top scene description or fallback to job prompt
        const scenePrompt = (script.scenes && script.scenes[0] && script.scenes[0].description)
          ? `${script.title}\n\n${script.scenes[0].description}`
          : job.data.prompt;

        const frameBuf = await renderComfyFrame(scenePrompt);
        await fs.writeFile(imagePath, frameBuf);

        // Create a single-frame video that lasts `duration` seconds
        execFileSync('ffmpeg', [
          '-y',
          '-loop', '1',
          '-i', imagePath,
          '-c:v', 'libx264',
          '-t', String(duration),
          '-pix_fmt', 'yuv420p',
          '-vf', 'scale=1280:720', // ensure correct size
          videoPath
        ], { stdio: 'ignore' });

        await logForJob(job.id!, `Generated video from ComfyUI frame at ${videoPath}`);
      } catch (err: any) {
        await logForJob(job.id!, `ComfyUI visual generation failed: ${err?.message || err}`);
        throw err;
      }

      // Step 4: Normalize audio to target duration
      await logForJob(job.id!, "Step 4: Normalizing audio to duration...");
      await job.updateProgress(85);
      const normalizedAudioPath = path.join(tmpDir, `audio-${job.id}-norm.mp3`);
      try {
        execFileSync('ffmpeg', [
          '-y',
          '-i', audioPath,
          '-af', `apad,atrim=0:${duration}`,
          '-ac', '2',
          '-ar', '44100',
          normalizedAudioPath
        ], { stdio: 'ignore' });

        // Mux video + normalized audio
        const previewPath = path.join(tmpDir, `preview-${job.id}.mp4`);
        execFileSync('ffmpeg', [
          '-y',
          '-i', videoPath,
          '-i', normalizedAudioPath,
          '-c:v', 'copy',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-shortest',
          previewPath
        ], { stdio: 'ignore' });

        // upload preview & log
        const previewKey = `${job.id}/preview.mp4`;
        const previewBuf = await fs.readFile(previewPath);
        await putObject(previewKey, previewBuf);
        await logForJob(job.id!, `Preview uploaded to ${config.minio.bucket}/${previewKey}`);
        await job.updateProgress(100);
      } catch (err: any) {
        await logForJob(job.id!, `FFmpeg assemble failed: ${err?.message || err}`);
        throw err;
      }

      console.log(`[Job ${job.id}] Completed successfully.`);
      return {
        preview_url: `http://${config.minio.endPoint}:${config.minio.port}/${config.minio.bucket}/${job.id}/preview.mp4`,
        audio_url: `/api/v1/jobs/${job.id}/audio`,
        status: 'completed'
      };

    } catch (error: any) {
      console.error(`[Job ${job.id}] Failed:`, error);
      throw error;
    }
  },
  {
    connection: config.redis,
    concurrency: 2
  }
);

worker.on('completed', (job) => {
  console.log(`[Job ${job.id}] Finished!`);
});

worker.on('failed', (job, err) => {
  console.log(`[Job ${job?.id}] Failed with ${err?.message}`);
});

console.log('Worker is ready to accept jobs.');

