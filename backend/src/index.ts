import express from 'express';
import cors from 'cors';
import { createClient } from "redis";
import { Queue } from 'bullmq';
import { config } from './config';

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
      duration_target: duration_target || 60,
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

// Job Logs SSE Endpoint
app.get("/api/v1/jobs/:id/logs", async (req, res) => {
  const jobId = String(req.params.id);
  // Standard SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  // create a dedicated Redis subscriber for this connection
  const subscriber = createClient({
    socket: { host: config.redis.host, port: config.redis.port },
  });

  subscriber.on("error", (err) => {
    console.error("Redis sub error:", err);
  });

  await subscriber.connect();

  // send a small initial message to let client know we're connected
  res.write(`data: ${JSON.stringify({ ts: new Date().toISOString(), message: "connected" })}\n\n`);

  // subscribe and forward messages to SSE
  const channel = `job:logs:${jobId}`;

  // subscribe with a callback (works with node-redis v4)
  await subscriber.subscribe(channel, (msg) => {
    // msg is the published string (JSON)
    res.write(`data: ${msg}\n\n`);
  });

  // cleanup on client disconnect
  req.on("close", async () => {
    try {
      await subscriber.unsubscribe(channel);
    } catch (e) {
      // ignore
    }
    try {
      await subscriber.quit();
    } catch (e) {}
  });
});

app.listen(config.port, () => {
  console.log(`StorySphere API running on port ${config.port}`);
});
