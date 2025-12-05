import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import { existsSync, mkdirSync } from "fs";
import path from "path";

// Dev/admin API only; no auth is enforced here.
type Anchor =
  | { type: "fixedTime"; time: string }
  | { type: "timestamp"; timestampMs: number }
  | { type: "offset"; offsetMs: number };

export type Channel = {
  id: number;
  name: string;
  label?: string;
  description?: string;
  placeholder?: boolean;
  anchor?: Anchor;
  poster?: string;
};

const DEFAULT_CHANNELS: Channel[] = [
  {
    id: 1,
    name: "illuvrse1",
    label: "Series Marathon",
    description: "Starts 3:00 PM anchored loop of full series.",
    placeholder: false,
    anchor: { type: "fixedTime", time: "15:00" },
    poster: "/posters/series-marathon.jpg",
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

function validateChannels(input: any): Channel[] | null {
  if (!Array.isArray(input)) return null;
  const channels: Channel[] = [];

  for (const item of input) {
    if (!item || typeof item !== "object") return null;
    const { id, name, label, description, placeholder, anchor, poster } = item;
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
      poster: typeof poster === "string" ? poster : undefined,
    });
  }

  return channels;
}

async function readOrInitChannels(filePath: string): Promise<Channel[]> {
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
    if (!valid) {
      throw new Error("Invalid channel file shape");
    }
    return valid;
  } catch (err: any) {
    console.warn(
      `[channels] Failed reading channels.json (${err.message}); resetting to defaults.`,
    );
    await fs.writeFile(
      filePath,
      JSON.stringify(DEFAULT_CHANNELS, null, 2) + "\n",
      "utf8",
    );
    return DEFAULT_CHANNELS;
  }
}

export async function GET() {
  const filePath = resolveChannelsPath();
  const channels = await readOrInitChannels(filePath);
  return NextResponse.json(channels);
}

export async function POST(request: Request) {
  const filePath = resolveChannelsPath();
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const channelsCandidate = Array.isArray(body.channels) ? body.channels : body;
  const validated = validateChannels(channelsCandidate);
  if (!validated) {
    return NextResponse.json(
      { error: "Invalid channels payload" },
      { status: 400 },
    );
  }

  await fs.writeFile(
    filePath,
    JSON.stringify(validated, null, 2) + "\n",
    "utf8",
  );

  return NextResponse.json(validated);
}
