# Executive summary — the goal

Build a **local-first** personal studio that turns prompts into MP4s, hosts them in a personal library, streams them on a continuous “LiveLoop” channel, and lets you play/experiment with light games and simple virtual worlds — all optimized for a single user (Ryan), low cost, small-scale infra, and fast iteration. Key integrations: **Ollama (LLM)**, **ComfyUI (image/video)**, **ElevenLabs (TTS)**, **Whisper (ASR)**, **FFmpeg**.

---

# Real 7s pipeline (no mocks)

The worker now requires real integrations end-to-end and will fail fast if any dependency is missing.

1. Start/point to running services: `OLLAMA_HOST` (with `OLLAMA_MODEL`, e.g. `llama3.2`), `COMFYUI_HOST` (with `COMFYUI_CHECKPOINT` present in ComfyUI models), and ElevenLabs (`ELEVEN_API_KEY`, `ELEVEN_VOICE_ID`, optional `ELEVEN_MODEL_ID`). Defaults are wired in `docker-compose.yml`.
2. Build + start: `docker-compose up --build`. The backend container now includes ffmpeg.
3. POST `/api/v1/generate` with your prompt; `duration_target` defaults to 7 seconds. The worker:
   - Calls Ollama for a scene script (no mock fallback).
   - Calls ElevenLabs for audio (fails if no key).
   - Calls ComfyUI to render a 1280x720 frame using the provided checkpoint/sampler.
   - Normalizes audio to 7s and muxes with the rendered frame via ffmpeg to produce a real MP4 preview in MinIO.

If any service is unreachable or misconfigured, the job fails instead of producing placeholder media.

# Constraints & design principles

* **Personal-use only**: minimal multi-tenant complexity, no monetization plumbing.
* **Privacy & local-first**: default to local models and local storage; optional cloud fallback.
* **Cost-sensitive**: reuse assets, low-res previews, GPU batching, spot instances only if needed.
* **Practical & incremental**: expose early previews, robust job state visibility, restartable workers.
* **Single operator UX**: simple admin UI, explicit publish controls, basic moderation tools.

---

# Scope (what this blueprint covers)

* StorySphere: prompt → MP4 generator with localization and captions.
* LiveLoop: schedule/playlist-driven 24/7 personal stream (HLS) from your generated media.
* Player: PIP, watch-party (local), wiki facts overlay, language/dub selector, captions.
* Arcade: embed WebGL games playable in PIP.
* Verse: simple scene/world editor with shareable saves.
* Full system architecture, data model, job orchestration, prioritized backlog, and hardware/deploy notes.

---

# High-level architecture (text + ASCII flow)

Components:

* **Frontend**: Next.js React UI (dark/cream themes); Player component using HLS.js.
* **API**: Lightweight API server (FastAPI or Node/Express) — job creation, status, user, content, playlists.
* **DB**: PostgreSQL for metadata; SQLite acceptable for minimal local setup.
* **Object store**: Local disk or S3-compatible (MinIO) for MP4s, segments, thumbnails.
* **Queue/Cache**: Redis for job queue + pub/sub.
* **Worker pool**: Dockerized worker processes for Ollama, ElevenLabs calls, ComfyUI invocations, FFmpeg assembly.
* **Streaming**: FFmpeg + Nginx-RTMP or simple HLS packaging to serve files; optional local CDN.
* **Realtime**: WebSocket server (Socket.io) for watch-party synchronization and job logs.
* **Models**: Ollama local LLM, ComfyUI GPU nodes, local Whisper or cloud Whisper, ElevenLabs API (or local TTS fallback).

ASCII flow (simplified):

```
[User UI] --> POST /api/generate  --> [API] --> enqueue Job -> [Workers]
   Workers:
      -> Ollama (script & scene breakdown)
      -> ElevenLabs/Local-TTS (per-scene audio)
      -> ComfyUI (frames/keyframes)
      -> FFmpeg (stitch audio+frames -> MP4 + HLS)
      -> Whisper (captions)
   -> store artifacts -> update DB -> notify UI (WebSocket)
[LiveLoop] reads playlist -> serves HLS segments -> Player(HLS.js)
[Arcade/Verse] served by static web + WebGL; PIP integrated in Player
```

---

# Detailed generation pipeline (prompt → MP4)

1. **Create job**

   * Payload: { prompt, duration_target, style, voice, language, output_preset }
   * API returns job id and initial metadata. Job enters `queued`.

2. **Script & scene breakdown (Ollama)**

   * Use a strict prompt template to produce: title, scenes[], each scene { description, shot_type, duration, lines }.

3. **TTS generation (ElevenLabs or local)**

   * For each scene line -> generate WAV. Cache identical voice+text combos.

4. **Visual generation (ComfyUI)**

   * Map scene description to ComfyUI node graph templates (background, characters, camera moves).
   * Output: sequence of frames at desired frame rate or keyframes + motion interpolation.

5. **Preview build**

   * Generate low-res frames and low-bitrate audio, assemble a short preview MP4 and thumbnail. Update job to `preview`.

6. **Final assemble (FFmpeg)**

   * Stitch frames, audio tracks, transitions, scores, and overlay subtitles. Export MP4 and HLS chunks/playlist. Produce thumbnail, poster, and chapter metadata.

7. **ASR/captions (Whisper)**

   * Run ASR for final .vtt. Also generate translated captions via Ollama + TTS pass if requested.

8. **Localization pass (optional)**

   * Ollama → translate script → ElevenLabs → re-run visual/dubbing step (or mux new audio track).

9. **Publish**

   * Store artifacts, update DB to `completed`. Provide download URL and “Add to LiveLoop” toggle.

**Optimization & UX**

* Always produce a fast preview first.
* Reuse cached assets (backgrounds, characters, voice tokens).
* Parallelize per-scene tasks across GPUs.

---

# Job states & schema

Job states: `queued → generating_script → rendering_preview → rendering_final → composing → completed | failed`

Job table (essential columns):

* id, user_id, prompt_text, style, voice, language, duration_target, status, progress, created_at, updated_at, preview_url, final_url, thumbnail_url, vtt_url, error_log

Content table:

* id, owner_id, title, description, mp4_url, hls_url, thumbnail, duration, languages[], published (bool), created_at

Playlist/Stream:

* id, title, items[], loop_mode, active (bool), hls_endpoint, scheduled_slots

---

# API contract (examples)

`POST /api/v1/generate`

```json
{
  "prompt": "A short sci-fi animation about a lighthouse that controls storms. 90s cinematic, emerald palette, 2 scenes.",
  "title": "Lighthouse Storm",
  "style": "cinematic",
  "voice": "eleven_v2_ryan",
  "language": "en",
  "duration_target": 120,
  "produce_preview": true
}
```

`GET /api/v1/jobs/:id` → returns job state, progress, preview_url, logs.

`POST /api/v1/content/:id/publish` → add content to LiveLoop playlist.

`GET /api/v1/wiki?entities=...` → returns wiki facts (server uses Ollama NER + Wikipedia fetch).

---

# Player & UX specifics (concrete)

Essential features:

* HLS playback with multi-audio track selection.
* Captions (.vtt) with adjustable size and contrast.
* PIP: floating panel that can show the video or an embedded arcade iframe; audio ducking and “flip” control.
* Watch Party (local): host sync, chat with WebSocket, manual host handoff.
* Wiki Facts: entity extraction on content metadata; tap to view compact Wikipedia summary + source link.
* Language Selector: list audio tracks (original/dubs) — if dub exists, switch to it; otherwise offer auto-translate subtitle.
* Player controls: standard playback, speed, chapters, poster thumbnail, progress KPIs.

UI behavior:

* “Create” flow left-to-right: Prompt editor → Preview player (center) → Job log & assets (right).
* LiveLoop UI: large running player + playlist editor with drag-drop, ability to insert ads or interstitial clips (manual).
* Dark teal theme default; optional cream theme toggled in settings.

---

# Branding & UI rules (from your boards)

* Palette: dark teal (primary), teal accent, gold accent, cream light background. Use gold strictly for CTAs or LiveLoop ON AIR badge.
* Typography: serif for headings (elegant feel), sans for UI text. Keep rounded corners and soft shadows.
* Iconography: lighthouse/compass motif for brand icons; simple line icons for controls.
* Component system: produce a small design token file with colors, spacing, and button states. Keep sizes accessible.

---

# Data/model considerations & entity extraction

* Use Ollama for NER & summarization. For each generated item, extract NER tokens at completion and store to allow wiki lookups and tagging.
* Maintain thumbnails and low-res proxies to avoid loading full MP4s.
* Keep transcripts and translation artifacts associated with content as separate asset entries.

---

# Implementation backlog — prioritized (start here)

These are strictly prioritized tasks you should build in order. No time estimates attached — go one-by-one and move forward.

**Priority 1 — Minimal working pipeline & player (core MVP)**

1. Setup local dev environment with Docker Compose: PostgreSQL, Redis, MinIO, API server, Web UI.
2. Build API endpoints: generate job, job status, content list, publish-to-liveloop, basic user auth (local password).
3. Implement job queue + worker skeleton (process job events; simple logging).
4. Integrate Ollama to generate scene script from prompt.
5. Integrate ElevenLabs for TTS and generate audio files.
6. Integrate ComfyUI to produce static frames for a simple scene; assemble via FFmpeg into MP4.
7. Implement preview flow (low-res) to return a quick MP4.
8. Implement the player page and HLS playback for MP4 (HLS optional at first — serve direct MP4).
9. Add job UI showing logs and status (WebSocket updates).

**Priority 2 — Production polish & LiveLoop**

1. Add full composition: transitions, subtitles (.vtt), thumbnail generation.
2. Add HLS packaging & local streaming with Nginx-RTMP or FFmpeg HLS.
3. Implement LiveLoop playlist editor and “Add to LiveLoop” publish action.
4. Implement basic watch-party (local sync + chat).
5. Add PIP support and integrate Arcade iframe with PIP toggle.

**Priority 3 — Localization, ASR, caching**

1. Add Whisper for captions and transcript generation.
2. Add translation flow (Ollama → generate translated TTS → new audio track mux).
3. Implement caching layer for voices and repeated assets.
4. Add low-res preview optimization and batch generation.

**Priority 4 — Arcades & Verse**

1. Implement simple Arcade portal (embed HTML5 games). Add API to upload game bundles.
2. Implement Verse minimal editor (scene templates, save/load worlds).
3. PIP integration and state persistence for Verse.

**Priority 5 — Ops & defensive**

1. Add monitoring (Prometheus/Grafana or logging to file + UI).
2. Add job retry logic and cleanup.
3. Implement content moderation tools (local flagging).
4. Backup strategy for MinIO/Postgres.

---

# Local-first hardware & deployment recommendations

**Local hardware (preferred for personal use)**

* **GPU**: One solid GPU — NVIDIA 3080/3080 Ti or 4090 is excellent. For multi-model workflows or faster rendering, two GPUs.
* **CPU**: 8+ cores.
* **RAM**: 64GB recommended for ComfyUI + Ollama + multitasking.
* **Storage**: NVMe 1TB+ for fast datastores. Keep media archive on a large HDD or NAS.
* **Network**: Gigabit LAN for local device streaming.

**Local software stack**

* Docker / Docker Compose for orchestration.
* MinIO for S3-compatible storage.
* PostgreSQL (or SQLite for experiments) + Redis.
* Nginx + FFmpeg packages.

**Cloud fallback**

* GPU instances: AWS g4dn / g5 or GCP A2. Use only for bursts. Use S3 and CloudFront for CDN if you need external streaming. Prefer local-first to save costs.

---

# Security, privacy & content moderation

* Default to **local-only** web UI accessible from LAN unless explicitly exposed.
* If you enable remote access, use HTTPS + basic auth + JWT. Do not expose model endpoints to public.
* Limit generation resource usage via job quotas (useful even for personal use to avoid runaway GPU costs).
* Add a manual moderation step before public share: mark content as private/public.
* Store sensitive tokens (ElevenLabs) encrypted in local environment variables or a secrets manager.

---

# Testing & observability

* Job-level logs streamed to UI via WebSockets.
* Keep “preview” artifact always available to test early.
* Add unit tests for API endpoints and worker tasks.
* Add smoke checks for Ollama/ComfyUI availability.
* Simple dashboard showing GPU usage, queue lengths, job RTT, disk usage.

---

# Practical prompts & template examples

**Ollama prompt — script generator**

```
You are a concise cinematic screenwriter. Input: {prompt_text}. Output JSON:

{
  "title": "...",
  "scenes": [
    {"id": 1, "description":"...", "duration":8, "camera":"close", "actions":["..."], "dialog":["..."]},
    {"id": 2, "..."}
  ]
}
```

**ComfyUI mapping**

* Scene mapping example: background: storm-coastline, focal: lighthouse, camera_move: slow_pan, color_palette: emerald+gold. Pass these as structured metadata into ComfyUI templates.

**FFmpeg assemble snippet (conceptual)**

```bash
ffmpeg -r 24 -i frames/frame_%04d.png -i scene_audio.wav \
  -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest output.mp4
```

**Player sync message (Watch Party)**

```json
{ "type":"sync", "position": 24.3, "action":"seek" }
```

---

# Deliverables I can produce for you next (pick any)

I’ll produce immediately without delay — choose one and I’ll deliver it right here:

* A **detailed architecture diagram** (SVG/ASCII + component responsibilities).
* A **Docker Compose + sample worker code scaffold** you can run locally (API server + worker + MinIO + Redis).
* **Figma-ready UI spec**: dark & cream variants using your brand boards (component tokens + sample screens).
* **Concrete ComfyUI + Ollama prompt library** for three styles (short film, broadcast, ambient loop).

(You don’t need to confirm anything else — pick one and I’ll give it now.)

---

# Final notes — practical tips & gotchas

* **Start with previews.** The whole product is faster and safer if you can see a preview first.
* **Cache everything.** Voices and backgrounds are time & money savers.
* **Treat ComfyUI outputs as “artifacts” not final —** plan a compositing step for stabilization and frame interpolation.
* **Keep smallest working end-to-end loop first:** prompt → preview player → job log. Then grow features.
* **LiveLoop is just a playlist + HLS server.** Keep it simple: let it read a playlist and play segments in loop with scheduled inserts.
