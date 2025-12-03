import axios from "axios";
import { config } from "./config";
import { putObject } from "./storage";

export async function generateAudioForJob(jobId: string, scriptObj: any): Promise<string> {
  // Build text: join title + all scene.description + scene.dialog (join arrays)
  const parts: string[] = [];
  if (scriptObj.title) parts.push(scriptObj.title);
  (scriptObj.scenes || []).forEach((s: any) => {
    if (s.description) parts.push(s.description);
    if (Array.isArray(s.dialog)) parts.push(...s.dialog);
  });
  const text = parts.join("\n\n").slice(0, 40000); // safe limit

  if (!config.eleven.apiKey) {
    throw new Error(
      "ElevenLabs API key is missing. Set ELEVEN_API_KEY to generate real audio."
    );
  }

  // Call ElevenLabs
  try {
    const url = `${config.eleven.host}/v1/text-to-speech/${config.eleven.voiceId}`;
    console.log(`[TTS] Calling ElevenLabs for job ${jobId} (${text.length} chars)`);
    const resp = await axios.post(url, {
      text,
      model_id: config.eleven.modelId,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.5
      }
    }, {
      headers: {
        "xi-api-key": config.eleven.apiKey,
        "Content-Type": "application/json"
      },
      responseType: "arraybuffer",
      timeout: 120000
    });

    const audioBuf = Buffer.from(resp.data);
    const key = `audio/${jobId}.mp3`;
    await putObject(key, audioBuf);
    console.log(`[TTS] Generated and stored audio at ${key}`);
    return key;
  } catch (err: any) {
    const detail =
      err?.response?.data?.toString?.() ||
      err?.message ||
      "ElevenLabs request failed";
    console.error(`[TTS] ElevenLabs call failed: ${detail}`);
    throw new Error(detail);
  }
}
