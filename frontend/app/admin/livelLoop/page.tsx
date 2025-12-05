"use client";

import { useEffect, useMemo, useState } from "react";

type AnchorType = "none" | "fixedTime";

type Channel = {
  id: number;
  name: string;
  label?: string;
  description?: string;
  placeholder?: boolean;
  anchor?: { type: "fixedTime"; time: string };
  poster?: string;
};

export default function LiveLoopAdminPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/channels", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        const list = Array.isArray(data) ? data : Array.isArray(data?.channels) ? data.channels : [];
        setChannels(list);
      } catch (err: any) {
        if (!cancelled) {
          setMessage({ type: "error", text: err.message || "Failed to load channels" });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFieldChange = (id: number, key: keyof Channel, value: any) => {
    setChannels((prev) =>
      prev.map((ch) =>
        ch.id === id
          ? { ...ch, [key]: value }
          : ch,
      ),
    );
  };

  const handleAnchorChange = (id: number, type: AnchorType, time?: string) => {
    setChannels((prev) =>
      prev.map((ch) => {
        if (ch.id !== id) return ch;
        if (type === "none") {
          const next = { ...ch };
          delete (next as any).anchor;
          return next;
        }
        return { ...ch, anchor: { type: "fixedTime", time: time || "15:00" } };
      }),
    );
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channels }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `HTTP ${res.status}`);
      }
      setMessage({ type: "success", text: "Saved channel configuration." });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to save channels." });
    } finally {
      setSaving(false);
    }
  };

  const anchorTypeFor = (ch: Channel): AnchorType =>
    ch.anchor?.type === "fixedTime" ? "fixedTime" : "none";

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="uppercase text-xs tracking-[0.3em] text-white/60">Admin</p>
          <h1 className="text-2xl font-semibold text-white">LiveLoop Channels</h1>
          <p className="text-white/70 text-sm">Edit lineup metadata and anchors. Changes persist via /api/channels.</p>
        </div>
        <button
          onClick={save}
          disabled={saving || loading}
          className="px-4 py-2 rounded-full border border-white/20 bg-[var(--color-accent)]/20 text-sm hover:bg-[var(--color-accent)]/30 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </header>

      {message && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            message.type === "success"
              ? "border-green-500/50 bg-green-500/10 text-green-100"
              : "border-red-500/50 bg-red-500/10 text-red-100"
          }`}
          role="status"
        >
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="text-white/70">Loading channels…</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-white/60">
              <tr className="border-b border-white/10">
                <th className="py-2 pr-3">ID</th>
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Label</th>
                <th className="py-2 pr-3">Description</th>
                <th className="py-2 pr-3">Placeholder</th>
                <th className="py-2 pr-3">Anchor</th>
                <th className="py-2 pr-3">Poster URL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {channels.map((ch) => {
                const anchorType = anchorTypeFor(ch);
                return (
                  <tr key={ch.id} className="align-top">
                    <td className="py-3 pr-3 text-white/80">{ch.id}</td>
                    <td className="py-3 pr-3">
                      <input
                        className="w-32 rounded border border-white/20 bg-black/40 px-2 py-1 text-white"
                        value={ch.name}
                        onChange={(e) => handleFieldChange(ch.id, "name", e.target.value)}
                      />
                    </td>
                    <td className="py-3 pr-3">
                      <input
                        className="w-40 rounded border border-white/20 bg-black/40 px-2 py-1 text-white"
                        value={ch.label || ""}
                        onChange={(e) => handleFieldChange(ch.id, "label", e.target.value)}
                        placeholder="Label"
                      />
                    </td>
                    <td className="py-3 pr-3">
                      <textarea
                        className="w-64 rounded border border-white/20 bg-black/40 px-2 py-1 text-white"
                        value={ch.description || ""}
                        onChange={(e) => handleFieldChange(ch.id, "description", e.target.value)}
                        rows={2}
                      />
                    </td>
                    <td className="py-3 pr-3">
                      <label className="flex items-center gap-2 text-white/80">
                        <input
                          type="checkbox"
                          checked={Boolean(ch.placeholder)}
                          onChange={(e) => handleFieldChange(ch.id, "placeholder", e.target.checked)}
                        />
                        Placeholder
                      </label>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex flex-col gap-2">
                        <select
                          className="rounded border border-white/20 bg-black/40 px-2 py-1 text-white"
                          value={anchorType}
                          onChange={(e) =>
                            handleAnchorChange(
                              ch.id,
                              e.target.value as AnchorType,
                              ch.anchor?.time,
                            )
                          }
                        >
                          <option value="none">None</option>
                          <option value="fixedTime">Fixed Time</option>
                        </select>
                        {anchorType === "fixedTime" && (
                          <input
                            type="time"
                            className="rounded border border-white/20 bg-black/40 px-2 py-1 text-white"
                            value={ch.anchor?.time || "15:00"}
                            onChange={(e) =>
                              handleAnchorChange(ch.id, "fixedTime", e.target.value)
                            }
                          />
                        )}
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <input
                        className="w-64 rounded border border-white/20 bg-black/40 px-2 py-1 text-white"
                        value={ch.poster || ""}
                        onChange={(e) => handleFieldChange(ch.id, "poster", e.target.value)}
                        placeholder="/posters/example.jpg"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
