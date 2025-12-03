// backend/src/ollama.ts
import axios from "axios";
import { config } from "./config";

/**
 * generateScript(prompt)
 * - Calls the configured Ollama host to generate a JSON script.
 * - If parsing fails, an error is thrown (no mock fallbacks).
 */
export async function generateScript(prompt: string): Promise<any> {
  const model = config.ollama.model;
  const templatedPrompt = `You are a concise cinematic screenwriter. Input: ${prompt}

Return strict JSON with this shape:
{
  "title": "string",
  "scenes": [
    { "id": 1, "description": "string", "duration": 8, "camera": "close", "actions": [], "dialog": ["..."] }
  ]
}

Only return JSON, no prose.`;

  try {
    const resp = await axios.post(
      `${config.ollama.host.replace(/\/$/, "")}/api/generate`,
      { model, prompt: templatedPrompt, stream: false },
      { timeout: 60_000 }
    );

    const parsed = parseOllamaResponse(resp.data);
    if (!parsed) {
      throw new Error("Failed to parse structured script from Ollama response");
    }
    if (!parsed.scenes || !Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
      throw new Error("Ollama returned an empty scene list");
    }
    return parsed;
  } catch (err: any) {
    console.error("Ollama call failed:", err?.message || err);
    throw err;
  }
}

function parseOllamaResponse(data: any): any | null {
  if (!data) return null;
  if (data.output && typeof data.output === "object") return data.output;
  if (data.result && typeof data.result === "object") return data.result;
  if (data.response && typeof data.response === "string") {
    const js = tryExtractJson(data.response);
    if (js) return js;
  }
  if (typeof data === "string") {
    const js = tryExtractJson(data);
    if (js) return js;
  }
  if (typeof data === "object" && data.scenes) return data;
  return null;
}

function tryExtractJson(text: string): any | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch (e) {
    return null;
  }
}
