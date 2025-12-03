// backend/src/ollama.ts
import axios from "axios";
import { config } from "./config";

/**
 * generateScript(prompt)
 * - Calls the configured Ollama host to generate a JSON script.
 * - Attempts to parse returned text into JSON; falls back to a compact mock if Ollama is unavailable.
 */
export async function generateScript(prompt: string): Promise<any> {
  const model = process.env.OLLAMA_MODEL || "story-sphere";
  const templatedPrompt = `You are a concise cinematic screenwriter. Input: ${prompt}\n\nOutput JSON:\n{\n  "title": "...",\n  "scenes": [\n    { "id": 1, "description": "...", "duration": 8, "camera": "close", "actions": [], "dialog": ["..."] }\n  ]\n}\n\nReturn only valid JSON.`;

  try {
    const resp = await axios.post(
      `${config.ollama.host.replace(/\/$/, "")}/api/generate`,
      { model, prompt: templatedPrompt },
      { timeout: 60_000 }
    );

    // Try a few forms of parsing the response
    if (resp.data) {
      // If resp.data is an object with useful fields, prefer them
      if (typeof resp.data === "object") {
        // Common patterns: { output: {...} }, { result: {...} }, or raw JSON
        if (resp.data.output) return resp.data.output;
        if (resp.data.result) return resp.data.result;
        // If resp.data has a 'text' string, attempt to extract JSON
        if (typeof resp.data.text === "string") {
          const js = tryExtractJson(resp.data.text);
          if (js) return js;
          return { title: "Generated", scenes: [{ id: 1, description: resp.data.text, duration: 10, camera: "wide", actions: [], dialog: [] }] };
        }
        // As a last resort, return resp.data directly
        return resp.data;
      }

      // If it's a string, try to extract JSON from it
      if (typeof resp.data === "string") {
        const js = tryExtractJson(resp.data);
        if (js) return js;
        return { title: "Generated", scenes: [{ id: 1, description: resp.data, duration: 10, camera: "wide", actions: [], dialog: [] }] };
      }
    }

    // If we get here, fallback to a simple mock
    return mockScript(prompt);
  } catch (err: any) {
    console.warn("Ollama call failed, returning mock script:", err?.message || err);
    return mockScript(prompt);
  }
}

function tryExtractJson(text: string): any | null {
  // Find the first { .. } block and try to parse it
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch (e) {
    return null;
  }
}

function mockScript(prompt: string) {
  return {
    title: `Mock: ${prompt.slice(0, 40)}`,
    scenes: [
      {
        id: 1,
        description: `Mock scene derived from prompt: ${prompt.slice(0, 120)}`,
        duration: 10,
        camera: "wide",
        actions: [],
        dialog: []
      }
    ]
  };
}
