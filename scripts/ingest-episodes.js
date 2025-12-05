#!/usr/bin/env node

// Node ingest script to scan frontend/public for MP4 files and emit a manifest.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const PUBLIC_DIR = path.join(process.cwd(), "frontend", "public");
const OUTPUT_PATH = path.join(PUBLIC_DIR, "episodes.json");
const FILENAME_REGEX = /^(\d+)\s+-\s+S(\d{2})\s+E(\d{2})\s+-\s+(.+)\.mp4$/i;
const FALLBACK_DURATION_SECONDS = 1300;

function probeDurationSeconds(filePath) {
  try {
    const output = execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        filePath,
      ],
      { encoding: "utf8" }
    )
      .trim()
      .split("\n")[0];

    const parsed = parseFloat(output);
    if (!Number.isFinite(parsed)) {
      throw new Error("ffprobe returned non-numeric duration");
    }
    return parsed;
  } catch (error) {
    console.warn(
      `[ingest] ffprobe failed for ${filePath}: ${error.message}. Using fallback duration ${FALLBACK_DURATION_SECONDS}s.`
    );
    return FALLBACK_DURATION_SECONDS;
  }
}

function slugify(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "poster";
}

function main() {
  if (!fs.existsSync(PUBLIC_DIR)) {
    console.error(`[ingest] public directory not found at ${PUBLIC_DIR}`);
    process.exit(1);
  }

  const entries = fs.readdirSync(PUBLIC_DIR, { withFileTypes: true });
  const episodes = [];
  let skipped = 0;

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".mp4")) {
      continue;
    }

    const match = entry.name.match(FILENAME_REGEX);
    if (!match) {
      skipped += 1;
      continue;
    }

    const [, productionIdStr, seasonStr, episodeStr, titleRaw] = match;
    const filePath = path.join(PUBLIC_DIR, entry.name);
    const durationSeconds = probeDurationSeconds(filePath);
    const title = titleRaw.trim();
    const posterSlug = slugify(title);

    episodes.push({
      productionId: Number(productionIdStr),
      season: Number(seasonStr),
      episode: Number(episodeStr),
      title,
      filename: entry.name,
      url: `/${encodeURI(entry.name)}`,
      durationSeconds,
      poster: `/posters/${posterSlug}.jpg`,
      captions: [],
    });
  }

  episodes.sort((a, b) => {
    if (a.productionId !== b.productionId) return a.productionId - b.productionId;
    if (a.season !== b.season) return a.season - b.season;
    return a.episode - b.episode;
  });

  fs.writeFileSync(
    OUTPUT_PATH,
    JSON.stringify({ episodes }, null, 2) + "\n",
    "utf8"
  );

  console.log(
    `[ingest] Processed ${episodes.length} episode(s), skipped ${skipped}. Wrote manifest to ${OUTPUT_PATH}`
  );
}

main();
