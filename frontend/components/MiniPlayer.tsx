"use client";

import { useEffect, useRef, useState } from "react";
import Player from "./Player";
import { usePlayerContext } from "./PlayerContext";

export default function MiniPlayer({
  onSkipNext,
}: {
  onSkipNext?: () => void;
}) {
  const { activeSource, setActiveSource } = usePlayerContext();
  const [visible, setVisible] = useState(false);
  const [wasSticky, setWasSticky] = useState(false);
  const anchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const isVisible = entry.isIntersecting;
        setVisible(!isVisible && Boolean(activeSource));
        setWasSticky(!isVisible);
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [activeSource]);

  if (!activeSource) {
    return <div ref={anchorRef} aria-hidden />;
  }

  return (
    <>
      <div ref={anchorRef} aria-hidden />
      {visible && (
        <div className="fixed bottom-4 right-4 left-4 md:left-auto md:w-80 z-40 drop-shadow-2xl">
          <div className="rounded-2xl border border-white/15 bg-black/80 backdrop-blur">
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 text-sm text-white">
              <span className="line-clamp-1">{activeSource.title || "Now Playing"}</span>
              <div className="flex gap-2">
                <button
                  onClick={onSkipNext}
                  className="px-2 py-1 rounded border border-white/20 hover:bg-white/10"
                  aria-label="Skip next"
                >
                  »|
                </button>
                <button
                  onClick={() => setActiveSource(null)}
                  className="px-2 py-1 rounded border border-white/20 hover:bg-white/10"
                  aria-label="Close mini player"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-2">
              <Player
                title={activeSource.title}
                source={{ ...activeSource.source, startPosition: undefined }}
                muted
                autoPlay={wasSticky}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
