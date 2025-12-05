import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import { existsSync, mkdirSync } from "fs";
import path from "path";
import { loadYuGiOhSeasonsWithDurations } from "@/lib/ygo";
import { buildSchedule } from "@/lib/scheduler";
import type { Episode, Season } from "@/lib/media";

type Anchor =
  | { type: "fixedTime"; time: string }
  | { type: "timestamp"; timestampMs: number }
  | { type: "offset"; offsetMs: number };

type ChannelConfig = {
  id: number;
  name: string;
  label?: string;
  description?: string;
  placeholder?: boolean;
  anchor?: Anchor;
};

const DEFAULT_CHANNELS: ChannelConfig[] = [
  {
    id: 1,
    name: "illuvrse1",
    label: "Series Marathon",
    description: "Starts 3:00 PM anchored loop of full series.",
    placeholder: false,
    anchor: { type: "fixedTime", time: "15:00" },
  },
  {
    id: 2,
    name: "illuvrse2",
    label: "Coming Soon",
    description: "Reserved for new lineup.",
    placeholder: true,
  },
  {
    id: 3,
    name: "illuvrse3",
    label: "Coming Soon",
    description: "Reserved for new lineup.",
    placeholder: true,
  },
  {
    id: 4,
    name: "illuvrse4",
    label: "Coming Soon",
    description: "Reserved for new lineup.",
    placeholder: true,
  },
  {
    id: 5,
    name: "illuvrse5",
    label: "Coming Soon",
    description: "Reserved for new lineup.",
    placeholder: true,
  },
  {
    id: 6,
    name: "illuvrse6",
    label: "Coming Soon",
    description: "Reserved for new lineup.",
    placeholder: true,
  },
];

type CacheEntry = {
  key: string;
  expiresAt: number;
  payload: any;
};

const CACHE_TTL_MS = 60_000;
const cacheStore: CacheEntry[] = [];

function makeCacheKey(nowBucket: number, horizonMs: number, channelsHash: string) {
  return JSON.stringify({ nowBucket, horizonMs, channelsHash });
}

function setCache(entry: CacheEntry) {
  cacheStore.push(entry);
  if (cacheStore.length > 50) {
    cacheStore.shift();
  }
}

function getFromCache(key: string) {
  const now = Date.now();
  const foundIdx = cacheStore.findIndex((c) => c.key === key && c.expiresAt > now);
  if (foundIdx === -1) return null;
  const entry = cacheStore[foundIdx];
  // simple recency bump
  cacheStore.splice(foundIdx, 1);
  cacheStore.push(entry);
  return entry.payload;
}

function resolveChannelsPath(): string {
  const preferredDir = path.join(process.cwd(), "..", "data");
  const fallbackDir = path.join(process.cwd(), "data");
  const dir = existsSync(preferredDir) ? preferredDir : fallbackDir;
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, "channels.json");
}

function isValidAnchor(anchor: any): anchor is Anchor {
  if (!anchor || typeof anchor !== "object") return false;
  if (anchor.type === "fixedTime" && typeof anchor.time === "string") {
    return true;
  }
  if (anchor.type === "timestamp" && Number.isFinite(anchor.timestampMs)) {
    return true;
  }
  if (anchor.type === "offset" && Number.isFinite(anchor.offsetMs)) {
    return true;
  }
  return false;
}

function validateChannels(input: any): ChannelConfig[] | null {
  if (!Array.isArray(input)) return null;
  const channels: ChannelConfig[] = [];

  for (const item of input) {
    if (!item || typeof item !== "object") return null;
    const { id, name, label, description, placeholder, anchor } = item;
    if (!Number.isFinite(Number(id)) || typeof name !== "string") {
      return null;
    }
    if (anchor && !isValidAnchor(anchor)) {
      return null;
    }
    channels.push({
      id: Number(id),
      name,
      label: typeof label === "string" ? label : undefined,
      description: typeof description === "string" ? description : undefined,
      placeholder: typeof placeholder === "boolean" ? placeholder : undefined,
      anchor,
    });
  }

  return channels;
}

async function readChannels(): Promise<ChannelConfig[]> {
  const filePath = resolveChannelsPath();
  if (!existsSync(filePath)) {
    await fs.writeFile(
      filePath,
      JSON.stringify(DEFAULT_CHANNELS, null, 2) + "\n",
      "utf8",
    );
    return DEFAULT_CHANNELS;
  }

  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    const valid = validateChannels(parsed);
    if (!valid) throw new Error("Invalid channel file shape");
    return valid;
  } catch (err) {
    console.warn(`[schedules] Failed to read channels.json: ${(err as any).message}`);
    return DEFAULT_CHANNELS;
  }
}

function getMostRecentTimeOfDay(time: string, referenceMs: number): number | null {
  const [hoursStr, minsStr] = time.split(":");
  const hours = Number(hoursStr);
  const minutes = Number(minsStr ?? "0");
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  const d = new Date(referenceMs);
  d.setHours(hours, minutes, 0, 0);
  if (d.getTime() > referenceMs) {
    d.setDate(d.getDate() - 1);
  }
  return d.getTime();
}

function buildChannels(
  channelConfigs: ChannelConfig[],
  seasons: Season[],
): { config: ChannelConfig; episodes: Episode[] }[] {
  const fullSeriesEpisodes = seasons
    .flatMap((s) => s.episodes)
    .sort((a, b) =>
      a.season === b.season ? a.episode - b.episode : a.season - b.season,
    );

  return channelConfigs.map((config) => {
    const episodes = config.id === 1 ? fullSeriesEpisodes : [];
    return { config, episodes };
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const nowMsParam = Number(searchParams.get("nowMs"));
  const horizonMsParam = Number(searchParams.get("horizonMs"));
  const channelIdParam = searchParams.get("channelId");

  const nowMs = Number.isFinite(nowMsParam) ? nowMsParam : Date.now();
  const horizonMs = Number.isFinite(horizonMsParam)
    ? horizonMsParam
    : 3 * 60 * 60 * 1000;
  const channelIdFilter = channelIdParam
    ? Number(channelIdParam)
    : null;

  const seasons = loadYuGiOhSeasonsWithDurations();
  const channelConfigs = await readChannels();
  const channels = buildChannels(channelConfigs, seasons).filter(({ config }) =>
    channelIdFilter ? config.id === channelIdFilter : true,
  );

  const nowBucket = Math.floor(nowMs / 30_000);
  const channelsHash = JSON.stringify(channelConfigs);
  const cacheKey = makeCacheKey(nowBucket, horizonMs, channelsHash);
  const cached = getFromCache(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  const channelSchedules = channels.map(({ config, episodes }) => {
    let anchorMs: number | undefined;
    if (config.anchor?.type === "fixedTime" && config.anchor.time) {
      const computed = getMostRecentTimeOfDay(config.anchor.time, nowMs);
      if (computed !== null) anchorMs = computed;
    }

    return {
      channelId: config.id,
      schedule: buildSchedule(episodes, nowMs, horizonMs, anchorMs),
    };
  });

  const payload = {
    nowMs,
    horizonMs,
    channelSchedules,
  };

  setCache({
    key: cacheKey,
    expiresAt: Date.now() + CACHE_TTL_MS,
    payload,
  });

  return NextResponse.json(payload);
}
