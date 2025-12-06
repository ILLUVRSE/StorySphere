"use client";

import { useState } from "react";
import type { Season } from "@/lib/media";
import SeriesBrowser from "./series-browser";

type Props = {
  seasons: Season[];
};

export default function SeriesView({ seasons }: Props) {
  const [activeTab, setActiveTab] = useState<"tv" | "radio">("tv");

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex space-x-4 border-b border-white/10 pb-4">
        <button
          onClick={() => setActiveTab("tv")}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            activeTab === "tv"
              ? "bg-[var(--color-primary)] text-white"
              : "text-white/60 hover:text-white hover:bg-white/10"
          }`}
        >
          TV Series
        </button>
        <button
          onClick={() => setActiveTab("radio")}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            activeTab === "radio"
              ? "bg-[var(--color-primary)] text-white"
              : "text-white/60 hover:text-white hover:bg-white/10"
          }`}
        >
          Radio & Legal
        </button>
      </div>

      {/* Content */}
      <div className="min-h-[60vh]">
        {activeTab === "tv" ? (
          <div className="space-y-6">
            <header>
              <p className="uppercase text-xs tracking-[0.3em] text-white/60 mb-2">
                Series
              </p>
              <h1 className="text-3xl font-serif font-bold">
                The Beverly Hillbillies
              </h1>
              <p className="text-white/75">
                Browse episodes sourced from{" "}
                <code className="font-mono text-white">
                  frontend/public/Series/Beverly-Hillbillies
                </code>
                .
              </p>
            </header>

            {seasons.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
                No episodes found. Drop MP4s into{" "}
                <code className="font-mono text-white">
                  frontend/public/Series/Beverly-Hillbillies
                </code>{" "}
                to populate the library.
              </div>
            ) : (
              <SeriesBrowser seasons={seasons} />
            )}
          </div>
        ) : (
          <div className="space-y-8 max-w-4xl text-white/90">
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white">
                Rehosting Guidelines for illuvrse.com
              </h2>
              <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-200">
                <strong>Short answer:</strong> Yes — but only with the sources
                that are actually public-domain or explicitly allow
                redistribution.
              </div>
            </div>

            <section className="space-y-4">
              <h3 className="text-xl font-bold text-green-400 flex items-center gap-2">
                ✅ You CAN Rehost These
              </h3>

              <div className="space-y-6 pl-2 border-l-2 border-green-500/20 ml-2">
                <div>
                  <h4 className="font-bold text-white">1. Public Domain Music Streams (100% Safe)</h4>
                  <p className="text-sm text-white/70 mb-2">You can mirror or restream these without permission:</p>
                  <ul className="list-disc list-inside space-y-2 text-sm text-white/80 ml-4">
                    <li>
                      <strong className="text-white">Ancient FM:</strong> All recordings are public domain. Safe to download → rehost → re-stream.
                    </li>
                    <li>
                      <strong className="text-white">Public Domain Classical stations:</strong> PD compositions + PD recordings. Safe to mirror.
                    </li>
                    <li>
                      <strong className="text-white">Internet Archive Public Domain Radio Content:</strong> Old-time radio (OTR) shows like <em>Suspense</em>, <em>Dragnet</em>, <em>Gunsmoke</em>, <em>Father Knows Best</em>. 100% public domain files.
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-bold text-white">2. U.S. Government-Created Audio (Public Domain by Law)</h4>
                  <ul className="list-disc list-inside space-y-2 text-sm text-white/80 ml-4 mt-2">
                    <li>
                      <strong className="text-white">VOA Public Domain Audio:</strong> Voice of America content created by federal employees is PD.
                      <br/>
                      <span className="text-yellow-400/80 text-xs ml-4">⚠ Warning: Some VOA segments include licensed music — do not rehost those parts. Stick to text-based news.</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-bold text-white">3. Content With Explicit Re-Broadcast Licensing</h4>
                  <ul className="list-disc list-inside space-y-2 text-sm text-white/80 ml-4 mt-2">
                    <li>
                      <strong className="text-white">Radio Free Europe / Liberty:</strong> You may rehost their original content with attribution.
                    </li>
                    <li>
                      <strong className="text-white">Radio Free Asia:</strong> Rehost allowed with attribution.
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-xl font-bold text-red-400 flex items-center gap-2">
                ❌ You CANNOT Rehost These Without Permission
              </h3>
              <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5">
                <p className="text-white/80 mb-2">If you try, you’ll get hit with copyright issues fast:</p>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-red-200/80">
                  <li className="flex items-center gap-2">⛔ Modern FM/AM radio stations</li>
                  <li className="flex items-center gap-2">⛔ NPR, BBC, CBC, ABC, iHeart-owned stations</li>
                  <li className="flex items-center gap-2">⛔ Any commercial music station</li>
                  <li className="flex items-center gap-2">⛔ Any copyrighted podcast</li>
                  <li className="flex items-center gap-2">⛔ Any station with ASCAP/BMI/SESAC-licensed music</li>
                </ul>
                <p className="text-xs text-red-400/60 mt-4">Even if you’re just “restreaming,” it’s still copyright infringement.</p>
              </div>
            </section>

            <section className="space-y-4 pt-4 border-t border-white/10">
              <h3 className="text-xl font-bold text-white">🚦 Summary</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-xl">
                  <h4 className="font-bold text-green-400 mb-2">Yes, Safe</h4>
                  <ul className="text-sm space-y-1 text-green-100/80">
                    <li>• Public domain music collections</li>
                    <li>• Public domain radio shows (OTR)</li>
                    <li>• U.S. government–created audio (VOA PD)</li>
                    <li>• Stations with explicit redistribution rights</li>
                  </ul>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl">
                  <h4 className="font-bold text-red-400 mb-2">No, Illegal</h4>
                  <ul className="text-sm space-y-1 text-red-100/80">
                    <li>• Any copyrighted modern station</li>
                    <li>• Any stream including copyrighted music</li>
                    <li>• Anything not PD or not licensed</li>
                  </ul>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
