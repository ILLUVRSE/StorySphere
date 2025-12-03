// frontend/app/create/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BACKEND_URL } from "../../lib/config";

export default function CreatePage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [style, setStyle] = useState("cinematic");
  const [voice, setVoice] = useState("default");
  const [language, setLanguage] = useState("en");
  const [durationTarget, setDurationTarget] = useState(60);
  const [producePreview, setProducePreview] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!prompt.trim()) {
      setError("Prompt is required.");
      return;
    }
    setSubmitting(true);
    const payload = {
      prompt: prompt.trim(),
      title: title || "Untitled",
      style,
      voice,
      language,
      duration_target: Number(durationTarget) || 60,
      produce_preview: Boolean(producePreview),
    };

    try {
      const resp = await fetch(`${BACKEND_URL}/api/v1/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || resp.statusText);
      }
      const data = await resp.json();
      if (!data?.jobId) throw new Error("No jobId returned.");
      router.push(`/jobs/${data.jobId}`);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to create job");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h2 className="text-2xl font-serif mb-4">Create a New Story</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block font-medium">Prompt *</label>
          <textarea
            rows={6}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full p-2 rounded bg-white/5"
            placeholder="A short sci-fi animation about a lighthouse..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-medium">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full p-2 rounded bg-white/5" />
          </div>

          <div>
            <label className="block font-medium">Duration (sec)</label>
            <input type="number" value={durationTarget} onChange={(e) => setDurationTarget(Number(e.target.value))} className="w-full p-2 rounded bg-white/5" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block font-medium">Style</label>
            <select value={style} onChange={(e) => setStyle(e.target.value)} className="w-full p-2 rounded">
              <option value="cinematic">Cinematic</option>
              <option value="short">Short</option>
              <option value="documentary">Documentary</option>
            </select>
          </div>

          <div>
            <label className="block font-medium">Voice</label>
            <select value={voice} onChange={(e) => setVoice(e.target.value)} className="w-full p-2 rounded">
              <option value="default">default</option>
              <option value="eleven_v2_ryan">eleven_v2_ryan</option>
            </select>
          </div>

          <div>
            <label className="block font-medium">Language</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full p-2 rounded">
              <option value="en">English</option>
              <option value="es">Spanish</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input id="preview" type="checkbox" checked={producePreview} onChange={(e) => setProducePreview(e.target.checked)} />
          <label htmlFor="preview">Produce preview</label>
        </div>

        {error && <div className="text-red-400">{error}</div>}

        <div>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? "Submitting…" : "Create Story"}
          </button>
        </div>
      </form>
    </div>
  );
}
