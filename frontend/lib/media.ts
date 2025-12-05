import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

export type Episode = {
  productionId: number;
  season: number;
  episode: number;
  title: string;
  filename: string;
  url: string;
  durationSeconds?: number;
  poster?: string;
};

export type Season = {
  seasonNumber: number;
  episodes: Episode[];
};

export type Movie = {
  title: string;
  filename: string;
  url: string;
  durationSeconds?: number;
  thumbnailUrl?: string;
};

type LoadOptions = {
  includeDurations?: boolean;
};

type ManifestEpisode = {
  file: string;
  title?: string;
  season?: number;
  episode?: number;
  productionId?: number;
};

const PUBLIC_DIR = resolvePublicDir();
const SERIES_ROOT = path.join(PUBLIC_DIR, "Series");
const MOVIES_ROOT = path.join(PUBLIC_DIR, "Movies");
const MOVIES_THUMB_ROOT = path.join(MOVIES_ROOT, "thumbnails");
const BH_DIR = path.join(SERIES_ROOT, "Beverly-Hillbillies");

const VIDEO_EXTS = new Set([".mp4", ".mov", ".avi", ".mkv"]);
const THUMB_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const VIDEO_PRIORITY = [".mp4", ".mov", ".mkv", ".avi"];
const durationCache = new Map<string, number>();
const FALLBACK_DURATION_SECONDS = 1300; // ~21.6 minutes

function probeDurationSeconds(filePath: string): number | null {
  if (durationCache.has(filePath)) {
    return durationCache.get(filePath)!;
  }

  try {
    const output = execFileSync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath,
    ]);
    const duration = parseFloat(output.toString().trim());
    if (Number.isFinite(duration)) {
      durationCache.set(filePath, duration);
      return duration;
    }
  } catch (err) {
    // ffprobe not available or file unreadable; fall through
  }

  return null;
}

function buildPublicUrl(filePath: string) {
  const rel = path.relative(PUBLIC_DIR, filePath);
  const encoded = rel
    .split(path.sep)
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `/${encoded}`;
}

function findThumbnailUrl(file: string, activeDir: string): string | undefined {
  const base = path.parse(file).name;
  const candidates: string[] = [];

  // Prefer thumbnails/ directory
  for (const ext of THUMB_EXTS) {
    candidates.push(path.join(MOVIES_THUMB_ROOT, `${base}${ext}`));
  }

  // Fallback to same directory as the movie
  for (const ext of THUMB_EXTS) {
    candidates.push(path.join(activeDir, `${base}${ext}`));
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return buildPublicUrl(candidate);
    }
  }

  return undefined;
}

function normalizeTitleFromFilename(fileName: string) {
  const base = path.parse(fileName).name;
  const cleaned = base.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return "Episode";
  // Title-case words while leaving all-caps strings as-is (e.g. acronyms).
  return cleaned
    .split(" ")
    .map((word) =>
      /^[A-Z0-9]+$/.test(word)
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}

function resolvePublicDir() {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, "public"),
    path.join(cwd, "frontend", "public"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  // Fall back to cwd/public even if missing; callers can handle empty results.
  return path.join(cwd, "public");
}

function readManifest(dir: string): ManifestEpisode[] | null {
  const manifestPath = path.join(dir, "manifest.json");
  if (!fs.existsSync(manifestPath)) return null;
  try {
    const raw = fs.readFileSync(manifestPath, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.episodes)) {
      return parsed.episodes;
    }
  } catch {
    // Ignore malformed manifest
  }
  return null;
}

function filterVideoFiles(dir: string) {
  if (!fs.existsSync(dir)) return [] as string[];
  return fs
    .readdirSync(dir)
    .filter((file) => VIDEO_EXTS.has(path.extname(file).toLowerCase()));
}

export function loadBeverlyHillbilliesSeasons(
  options: LoadOptions = {},
): Season[] {
  const { includeDurations = false } = options;
  const primaryFiles = filterVideoFiles(BH_DIR);
  const fallbackFiles =
    primaryFiles.length === 0 ? filterVideoFiles(PUBLIC_DIR) : [];
  const filesOnDisk = primaryFiles.length ? primaryFiles : fallbackFiles;
  const activeDir = primaryFiles.length ? BH_DIR : PUBLIC_DIR;

  if (filesOnDisk.length === 0) return [];

  const manifest = activeDir === BH_DIR ? readManifest(BH_DIR) : null;
  const fileSet = new Set(filesOnDisk);

  const episodes: Episode[] = [];

  if (manifest?.length) {
    manifest.forEach((entry, idx) => {
      if (!fileSet.has(entry.file)) return;
      const seasonNumber = entry.season ?? 1;
      const episodeNumber = entry.episode ?? idx + 1;
      let durationSeconds: number | undefined;
      if (includeDurations) {
        durationSeconds =
          probeDurationSeconds(path.join(activeDir, entry.file)) ??
          FALLBACK_DURATION_SECONDS;
      }
      episodes.push({
        productionId: entry.productionId ?? idx + 1,
        season: seasonNumber,
        episode: episodeNumber,
        title: entry.title ?? `Episode ${episodeNumber.toString().padStart(2, "0")}`,
        filename: entry.file,
        url: buildPublicUrl(path.join(activeDir, entry.file)),
        durationSeconds,
      });
    });
  }

  if (episodes.length === 0) {
    const sortedFiles = Array.from(fileSet).sort();
    sortedFiles.forEach((file, idx) => {
      let durationSeconds: number | undefined;
      if (includeDurations) {
        durationSeconds =
          probeDurationSeconds(path.join(activeDir, file)) ??
          FALLBACK_DURATION_SECONDS;
      }
      const derivedTitle = normalizeTitleFromFilename(file);
      episodes.push({
        productionId: idx + 1,
        season: 1,
        episode: idx + 1,
        title: derivedTitle.match(/[0-9a-f]{6,}/i)
          ? `Episode ${(idx + 1).toString().padStart(2, "0")}`
          : derivedTitle,
        filename: file,
        url: buildPublicUrl(path.join(activeDir, file)),
        durationSeconds,
      });
    });
  }

  const grouped = episodes.reduce<Map<number, Episode[]>>((acc, ep) => {
    if (!acc.has(ep.season)) acc.set(ep.season, []);
    acc.get(ep.season)!.push(ep);
    return acc;
  }, new Map());

  const seasons: Season[] = Array.from(grouped.entries())
    .sort(([a], [b]) => a - b)
    .map(([seasonNumber, eps]) => ({
      seasonNumber,
      episodes: eps.sort((a, b) => a.episode - b.episode),
    }));

  return seasons;
}

export function loadBeverlyHillbilliesSeasonsWithDurations(): Season[] {
  return loadBeverlyHillbilliesSeasons({ includeDurations: true });
}

export function loadMovies(options: LoadOptions = {}): Movie[] {
  const { includeDurations = false } = options;
  const primary = filterVideoFiles(MOVIES_ROOT);
  const fallback =
    primary.length === 0 ? filterVideoFiles(PUBLIC_DIR) : [];
  const files = primary.length ? primary : fallback;
  const activeDir = primary.length ? MOVIES_ROOT : PUBLIC_DIR;

  // Prefer a single file per basename using VIDEO_PRIORITY ordering.
  const chosenByBase = new Map<string, string>();
  files.forEach((file) => {
    const { name, ext } = path.parse(file);
    const normalizedExt = ext.toLowerCase();
    const current = chosenByBase.get(name);
    if (!current) {
      chosenByBase.set(name, file);
      return;
    }
    const currentExt = path.parse(current).ext.toLowerCase();
    const currentRank = VIDEO_PRIORITY.indexOf(currentExt);
    const newRank = VIDEO_PRIORITY.indexOf(normalizedExt);
    if (newRank !== -1 && currentRank !== -1 && newRank < currentRank) {
      chosenByBase.set(name, file);
    }
  });

  return Array.from(chosenByBase.values())
    .map((file, idx) => {
      let durationSeconds: number | undefined;
      if (includeDurations) {
        durationSeconds =
          probeDurationSeconds(path.join(activeDir, file)) ??
          undefined;
      }
      const prettyTitle = normalizeTitleFromFilename(file);
      const thumbnailUrl = findThumbnailUrl(file, activeDir);
      return {
        title: prettyTitle,
        filename: file,
        url: buildPublicUrl(path.join(activeDir, file)),
        thumbnailUrl,
        durationSeconds,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}
