import express from 'express';
import cors from 'cors';
import { createClient } from 'redis';
import { Queue } from 'bullmq';
import { config } from './config';
import { getJson, getObjectBuffer } from "./storage";

const app = express();
app.use(cors());
app.use(express.json());

// Job Queue
const generationQueue = new Queue('generation-queue', {
  connection: config.redis
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Create Job Endpoint
app.post('/api/v1/generate', async (req, res) => {
  try {
    const { prompt, title, style, voice, language, duration_target, produce_preview } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const jobData = {
      prompt,
      title: title || 'Untitled',
      style: style || 'cinematic',
      voice: voice || 'default',
      language: language || 'en',
      duration_target: duration_target || 7,
      produce_preview: produce_preview ?? true,
      created_at: new Date().toISOString()
    };

    const job = await generationQueue.add('generate-episode', jobData);

    res.json({
      jobId: job.id,
      status: 'queued',
      data: jobData
    });
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({ error: 'Failed to create job' });
  }
});

// Regenerate Job Endpoint
app.post('/api/v1/jobs/:id/regenerate', async (req, res) => {
  try {
    const oldId = req.params.id;
    const oldJob = await generationQueue.getJob(oldId);

    if (!oldJob || !oldJob.data) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Re-enqueue using same data
    // We use the same name 'generate-episode' as in the create endpoint
    const newJob = await generationQueue.add('generate-episode', oldJob.data);

    console.log(`Regenerating job ${oldId} -> new job ${newJob.id}`);

    res.json({ jobId: newJob.id });
  } catch (error) {
    console.error('Error regenerating job:', error);
    res.status(500).json({ error: 'Failed to regenerate job' });
  }
});

// Get Job Status Endpoint
app.get('/api/v1/jobs/:id', async (req, res) => {
  try {
    const jobId = req.params.id;
    const job = await generationQueue.getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const state = await job.getState();
    const progress = job.progress;

    res.json({
      id: job.id,
      state,
      progress,
      data: job.data,
      result: job.returnvalue,
      failedReason: job.failedReason
    });
  } catch (error) {
    console.error('Error fetching job:', error);
    res.status(500).json({ error: 'Failed to fetch job status' });
  }
});

// List Jobs Endpoint (for LiveLoop)
app.get('/api/v1/jobs', async (req, res) => {
  try {
    const jobs = await generationQueue.getJobs(['completed'], 0, 49, false); // Newest first
    const list = jobs.map(j => ({
      id: j.id,
      data: j.data,
      result: j.returnvalue,
      finishedOn: j.finishedOn
    }));
    res.json(list);
  } catch (error) {
    console.error('Error listing jobs:', error);
    res.status(500).json({ error: 'Failed to list jobs' });
  }
});

// Get Script Endpoint
app.get("/api/v1/jobs/:id/script", async (req, res) => {
  try {
    const key = `scripts/${req.params.id}.json`;
    const script = await getJson(key);
    res.json(script);
  } catch (err: any) {
    console.error("Error fetching script:", err?.message || err);
    res.status(404).json({ error: "Script not found" });
  }
});

// Get Audio Endpoint
app.get("/api/v1/jobs/:id/audio", async (req, res) => {
  const key = `audio/${req.params.id}.mp3`;
  try {
    const buf = await getObjectBuffer(key);
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", String(buf.length));
    res.end(buf);
  } catch (err) {
    console.error("Audio fetch error:", err);
    res.status(404).json({ error: "Audio not found" });
  }
});

// Get Preview Video Endpoint
app.get("/api/v1/jobs/:id/preview", async (req, res) => {
  const key = `${req.params.id}/preview.mp4`;
  try {
    const buf = await getObjectBuffer(key);
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Length", String(buf.length));
    res.end(buf);
  } catch (err) {
    console.error("Video fetch error:", err);
    res.status(404).json({ error: "Video not found" });
  }
});

// Job Logs SSE Endpoint
app.get('/api/v1/jobs/:id/logs', async (req, res) => {
  const jobId = req.params.id;

  // Set headers for Server-Sent Events
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const subscriber = createClient({
    socket: { host: config.redis.host, port: config.redis.port },
  });

  try {
    await subscriber.connect();

    await subscriber.subscribe(`job:logs:${jobId}`, (message) => {
      res.write(`data: ${message}\n\n`);
    });

    // Cleanup when client disconnects
    req.on('close', async () => {
      try {
        await subscriber.disconnect();
      } catch (err) {
        console.error('Error disconnecting redis subscriber:', err);
      }
    });
  } catch (error) {
    console.error('Error initializing log stream:', error);
    res.write(`data: ${JSON.stringify({ error: 'Log stream error' })}\n\n`);
    res.end();
  }
});

app.listen(config.port, () => {
  console.log(`StorySphere API running on port ${config.port}`);
});
