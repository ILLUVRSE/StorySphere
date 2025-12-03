// frontend/app/watch/page.tsx
"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { BACKEND_URL } from "../../lib/config";

interface Job {
  id: string;
  data: {
    title: string;
    prompt: string;
    style: string;
  };
  result?: {
    preview_url: string;
    audio_url?: string;
  };
  finishedOn?: number;
}

export default function WatchPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    async function fetchJobs() {
      try {
        const res = await fetch(`${BACKEND_URL}/api/v1/jobs`);
        if (!res.ok) throw new Error("Failed to fetch stories");
        const data = await res.json();
        setJobs(data);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Network error");
        }
      } finally {
        setLoading(false);
      }
    }
    fetchJobs();
  }, []);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {
        // Autoplay might fail
      });
    }
  }, [currentIndex, jobs]);

  const handleEnded = () => {
    if (jobs.length > 0) {
      setCurrentIndex((prev) => (prev + 1) % jobs.length);
    }
  };

  const currentJob = jobs[currentIndex];

  if (loading) return <div className="p-10 text-center">Loading LiveLoop...</div>;
  if (error) return <div className="p-10 text-center text-red-400">{error}</div>;
  if (jobs.length === 0) return (
    <div className="p-10 text-center">
      <p className="mb-4">No stories yet.</p>
      <Link href="/create" className="btn-primary">Create one!</Link>
    </div>
  );

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden">
      {/* Sidebar Playlist */}
      <div className="w-80 border-r border-white/10 flex flex-col hidden md:flex">
        <div className="p-4 border-b border-white/10">
          <h2 className="font-serif text-xl font-bold text-accent">LiveLoop</h2>
          <Link href="/" className="text-xs text-white/50 hover:text-white">← Back to Home</Link>
        </div>
        <div className="flex-1 overflow-y-auto">
          {jobs.map((job, idx) => (
            <button
              key={job.id}
              onClick={() => setCurrentIndex(idx)}
              className={`w-full text-left p-4 border-b border-white/5 hover:bg-white/5 transition-colors ${
                idx === currentIndex ? "bg-white/10 border-l-4 border-l-gold" : ""
              }`}
            >
              <div className="font-bold truncate">{job.data.title || "Untitled"}</div>
              <div className="text-xs text-white/50 truncate">{job.data.style} • {new Date(job.finishedOn || Date.now()).toLocaleDateString()}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Player Area */}
      <div className="flex-1 flex flex-col items-center justify-center relative bg-black">
        {currentJob && (
          <>
            <video
              ref={videoRef}
              className="w-full h-full object-contain max-h-screen"
              src={`${BACKEND_URL}/api/v1/jobs/${currentJob.id}/preview`}
              onEnded={handleEnded}
              controls
              autoPlay
              playsInline
            />

            {/* Overlay Info (fades out ideally, but keeping simple) */}
            <div className="absolute bottom-10 left-10 bg-black/60 p-4 rounded-lg backdrop-blur-sm max-w-lg">
              <h1 className="text-2xl font-serif font-bold text-gold">{currentJob.data.title}</h1>
              <p className="text-sm text-white/80 mt-1 line-clamp-3">{currentJob.data.prompt}</p>
            </div>
          </>
        )}
      </div>

      {/* Mobile Nav Overlay (if sidebar hidden) */}
      <div className="absolute top-4 right-4 md:hidden">
         <Link href="/" className="bg-black/50 p-2 rounded text-sm">Exit</Link>
      </div>
    </div>
  );
}
