"use client";

import { useEffect, useMemo, useState } from "react";
import type { Season, Episode } from "@/lib/media";

type Props = {
  seasons: Season[];
};

export default function SeriesBrowser({ seasons }: Props) {
  const [activeSeason, setActiveSeason] = useState(
    seasons[0]?.seasonNumber ?? null,
  );
  const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(
    seasons[0]?.episodes[0] ?? null,
  );

  const activeSeasonData = useMemo(
    () => seasons.find((s) => s.seasonNumber === activeSeason),
    [activeSeason, seasons],
  );

  useEffect(() => {
    if (!activeSeasonData) return;
    setCurrentEpisode((prev) =>
      prev && prev.season === activeSeasonData.seasonNumber
        ? prev
        : activeSeasonData.episodes[0] ?? null,
    );
  }, [activeSeasonData]);

  if (!activeSeason) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
        No seasons detected.
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-[320px_1fr] gap-6">
      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Seasons</h2>
          <span className="text-xs text-white/50">
            {seasons.length} total
          </span>
        </div>
        <div className="space-y-2">
          {seasons.map((season) => {
            const isActive = season.seasonNumber === activeSeason;
            return (
              <button
                key={season.seasonNumber}
                onClick={() => setActiveSeason(season.seasonNumber)}
                className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                  isActive
                    ? "border-[var(--color-accent)]/60 bg-[var(--color-accent)]/10 text-white"
                    : "border-white/10 bg-black/30 text-white/80 hover:border-white/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold">
                    Season {season.seasonNumber}
                  </div>
                  <div className="text-xs text-white/60">
                    {season.episodes.length} eps
                  </div>
                </div>
                <div className="text-xs text-white/60">
                  Episodes {season.episodes[0]?.episode.toString().padStart(2, "0")}–
                  {season.episodes[season.episodes.length - 1]?.episode
                    .toString()
                    .padStart(2, "0")}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-black via-black to-[var(--color-primary)]/30 p-4 lg:p-6">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="uppercase text-[10px] tracking-[0.3em] text-white/60">
                Season {activeSeasonData?.seasonNumber}
              </p>
              <h3 className="text-2xl font-serif font-bold text-white">
                {currentEpisode
                  ? `Episode ${currentEpisode.episode
                      .toString()
                      .padStart(2, "0")}: ${currentEpisode.title}`
                  : "Select an episode"}
              </h3>
            </div>
            {currentEpisode && (
              <span className="text-xs text-white/60">
                #{currentEpisode.productionId} · {currentEpisode.filename}
              </span>
            )}
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-black">
            {currentEpisode ? (
              <video
                key={currentEpisode.filename}
                controls
                className="w-full aspect-video bg-black"
                src={currentEpisode.url}
              />
            ) : (
              <div className="flex aspect-video items-center justify-center text-white/60">
                Choose an episode to start playback.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-lg font-semibold text-white">
              Episodes in Season {activeSeasonData?.seasonNumber}
            </h4>
            <span className="text-xs text-white/60">
              {activeSeasonData?.episodes.length ?? 0} available
            </span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 max-h-[420px] overflow-y-auto pr-1">
            {activeSeasonData?.episodes.map((episode) => {
              const isSelected =
                currentEpisode?.filename === episode.filename;
              return (
                <button
                  key={episode.filename}
                  onClick={() => setCurrentEpisode(episode)}
                  className={`flex items-start justify-between rounded-xl border p-3 text-left transition ${
                    isSelected
                      ? "border-[var(--color-accent)]/70 bg-[var(--color-accent)]/15 text-white"
                      : "border-white/10 bg-black/30 text-white/80 hover:border-white/30"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="text-xs uppercase tracking-[0.2em] text-white/50">
                      S{episode.season.toString().padStart(2, "0")}E
                      {episode.episode.toString().padStart(2, "0")}
                    </div>
                    <div className="font-semibold leading-tight text-white">
                      {episode.title}
                    </div>
                    <div className="text-[11px] text-white/50">
                      File #{episode.productionId}
                    </div>
                  </div>
                  <div className="ml-2 text-xs text-white/50">
                    Play →
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
