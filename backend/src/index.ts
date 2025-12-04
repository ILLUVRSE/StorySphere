import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import { createClient } from 'redis';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { config } from './config';
import { getJson, getObjectBuffer, listObjects, getPresignedUrl } from "./storage";
import { validateTimelineSchema } from './types/timeline';
import { db } from './db';
import { MatchManager } from './matches/MatchManager';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all for MVP
    methods: ["GET", "POST"]
  }
});

const matchManager = new MatchManager(io);
matchManager.start();

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('join_match', ({ matchId, playerId }) => {
    const success = matchManager.joinMatch(socket, matchId, playerId);
    if (success) {
      socket.emit('match_joined', { matchId });
      console.log(`Socket ${socket.id} joined match ${matchId}`);
    } else {
      socket.emit('error', { message: 'Match not found' });
    }
  });

  socket.on('game_input', (data) => {
    // data: { matchId, input }
    if (data.matchId && data.input) {
      matchManager.handleInput(data.matchId, data.input);
    }
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    // Cleanup logic in MatchManager if needed
  });
});

// Expose internal match creation for testing (TEMPORARY)
app.post('/api/v1/internal/create_match', async (req, res) => {
    const id = await matchManager.createMatch();
    res.json({ matchId: id });
});

// Job Queue
const generationQueue = new Queue('generation-queue', {
  connection: config.redis
});

// Initialize DB table for Arcade Scores (MVP)
async function initDb() {
  if (db.isReady()) {
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS arcade_scores (
          id SERIAL PRIMARY KEY,
          game TEXT NOT NULL,
          user_id TEXT,
          score INTEGER NOT NULL,
          seed TEXT,
          duration_ms INTEGER,
          meta JSONB,
          created_at TIMESTAMPTZ DEFAULT now()
        );
      `);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_arcade_scores_game_seed_score ON arcade_scores (game, seed, score DESC);`);
      console.log('Arcade scores table initialized');
    } catch (err) {
      console.error('Failed to initialize arcade tables', err);
    }
  }
}
initDb();

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Arcade Score Endpoint
app.post('/api/v1/arcade/score', async (req, res) => {
  try {
    const { game, user_id, score, seed, duration_ms, meta } = req.body;

    if (!game || score === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (db.isReady()) {
      const result = await db.query(
        `INSERT INTO arcade_scores (game, user_id, score, seed, duration_ms, meta)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [game, user_id || null, score, seed, duration_ms, meta]
      );
      return res.status(201).json({ ok: true, id: result.rows[0].id });
    } else {
      // Mock success if DB unavailable
      console.warn('DB not ready, dropping score');
      return res.status(200).json({ ok: true, mocked: true });
    }
  } catch (error) {
    console.error('Error saving score:', error);
    res.status(500).json({ error: 'Failed to save score' });
  }
});

// Arcade Leaderboard Endpoint
app.get('/api/v1/arcade/leaderboard', async (req, res) => {
  try {
    const { game, seed, limit } = req.query;
    if (!db.isReady()) {
       return res.json({ items: [] });
    }

    const limitVal = Math.min(100, parseInt((limit as string) || '20', 10));

    let query = `SELECT * FROM arcade_scores WHERE game = $1`;
    const params: any[] = [game];

    if (seed) {
      query += ` AND seed = $2`;
      params.push(seed);
    }

    query += ` ORDER BY score DESC LIMIT $${params.length + 1}`;
    params.push(limitVal);

    const result = await db.query(query, params);
    res.json({ items: result.rows });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
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

// Library listing (MinIO) with presigned URLs
app.get("/api/v1/library", async (req, res) => {
  try {
    const prefix = (req.query.prefix as string) || "";
    const limit = Math.min(500, parseInt((req.query.limit as string) || "100", 10));
    const objects = await listObjects(prefix, limit);
    const enriched = await Promise.all(
      objects.map(async (obj) => {
        const url = await getPresignedUrl(obj.name, 3600);
        return {
          key: obj.name,
          size: obj.size,
          lastModified: obj.lastModified,
          url,
        };
      })
    );
    res.json({ items: enriched });
  } catch (error) {
    console.error("Error listing library objects:", error);
    res.status(500).json({ error: "Failed to list library items" });
  }
});

// Render timeline → MP4 (stub)
app.post("/api/v1/render", async (req, res) => {
  const validation = validateTimelineSchema(req.body);
  if (!validation.valid || !validation.sanitized) {
    return res.status(400).json({ error: "Invalid timeline payload", details: validation.errors });
  }

  const timeline = validation.sanitized;
  const renderId = randomUUID();
  const outputPath = `/storysphere-assets/renders/${timeline.projectId || renderId}.mp4`;

  console.log(
    `[render] accepted ${renderId} for project=${timeline.projectId} tracks=${timeline.tracks.length} fps=${timeline.render.fps}`
  );

  // Future: enqueue real FFmpeg worker; for now acknowledge receipt.
  res.json({
    renderId,
    status: "accepted",
    output: outputPath,
    summary: {
      resolution: timeline.render.resolution,
      fps: timeline.render.fps,
      tracks: timeline.tracks.length,
      audioBeds: timeline.audio?.length || 0,
    },
  });
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

server.listen(config.port, () => {
  console.log(`StorySphere API running on port ${config.port}`);
});
