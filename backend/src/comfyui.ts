import axios from "axios";
import { config } from "./config";

type ImageRef = { filename: string; subfolder: string; type: string };

const COMFY_TIMEOUT_MS = 180000;

export async function renderComfyFrame(prompt: string): Promise<Buffer> {
  const host = config.comfyui.host.replace(/\/$/, "");
  const checkpoint = config.comfyui.checkpoint;
  const negative = config.comfyui.negativePrompt;
  const sampler = config.comfyui.sampler;

  const workflow = buildBasicWorkflow({
    prompt,
    negativePrompt: negative,
    checkpoint,
    sampler,
  });

  const submit = await axios.post(
    `${host}/prompt`,
    { prompt: workflow },
    { timeout: 10_000 }
  );

  const promptId = submit.data?.prompt_id;
  if (!promptId) {
    throw new Error("ComfyUI did not return a prompt_id");
  }

  const imageRef = await waitForComfyImage(host, promptId);
  return downloadComfyImage(host, imageRef);
}

function buildBasicWorkflow(opts: {
  prompt: string;
  negativePrompt: string;
  checkpoint: string;
  sampler: string;
}) {
  const seed = Math.floor(Math.random() * 1_000_000_000);
  return {
    "3": {
      class_type: "CheckpointLoaderSimple",
      inputs: {
        ckpt_name: opts.checkpoint,
      },
    },
    "4": {
      class_type: "KSampler",
      inputs: {
        seed,
        steps: 8,
        cfg: 6.5,
        sampler_name: opts.sampler,
        scheduler: "normal",
        denoise: 1,
        model: ["3", 0],
        positive: ["6", 0],
        negative: ["7", 0],
        latent_image: ["5", 0],
      },
    },
    "5": {
      class_type: "EmptyLatentImage",
      inputs: {
        width: 1280,
        height: 720,
        batch_size: 1,
      },
    },
    "6": {
      class_type: "CLIPTextEncode",
      inputs: {
        text: opts.prompt,
        clip: ["3", 1],
      },
    },
    "7": {
      class_type: "CLIPTextEncode",
      inputs: {
        text: opts.negativePrompt,
        clip: ["3", 1],
      },
    },
    "8": {
      class_type: "VAEDecode",
      inputs: {
        samples: ["4", 0],
        vae: ["3", 2],
      },
    },
    "9": {
      class_type: "SaveImage",
      inputs: {
        images: ["8", 0],
        filename_prefix: "storysphere_frame",
      },
    },
  };
}

async function waitForComfyImage(host: string, promptId: string): Promise<ImageRef> {
  const start = Date.now();

  while (Date.now() - start < COMFY_TIMEOUT_MS) {
    const hist = await axios
      .get(`${host}/history/${promptId}`, { timeout: 10_000 })
      .catch(() => null);

    const promptHistory = (hist?.data || {})[promptId];
    if (promptHistory?.status?.status === "error") {
      throw new Error(
        `ComfyUI error: ${promptHistory?.status?.message || "unknown"}`
      );
    }

    const outputs = promptHistory?.outputs;
    if (outputs) {
      for (const node of Object.values(outputs) as any[]) {
        if (node?.images?.length) {
          return node.images[0] as ImageRef;
        }
      }
    }

    await new Promise((r) => setTimeout(r, 1500));
  }

  throw new Error("Timed out waiting for ComfyUI to render an image");
}

async function downloadComfyImage(host: string, ref: ImageRef): Promise<Buffer> {
  const resp = await axios.get(`${host}/view`, {
    params: {
      filename: ref.filename,
      subfolder: ref.subfolder,
      type: ref.type,
    },
    responseType: "arraybuffer",
    timeout: 30_000,
  });

  return Buffer.from(resp.data);
}
