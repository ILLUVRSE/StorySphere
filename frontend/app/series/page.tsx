import SeriesBrowser from "./series-browser";
import { loadBeverlyHillbilliesSeasonsWithDurations } from "@/lib/media";

export default function SeriesPage() {
  const seasons = loadBeverlyHillbilliesSeasonsWithDurations();

  return (
    <div className="space-y-6">
      <header>
        <p className="uppercase text-xs tracking-[0.3em] text-white/60 mb-2">
          Series
        </p>
        <h1 className="text-3xl font-serif font-bold">The Beverly Hillbillies</h1>
        <p className="text-white/75">
          Browse episodes sourced from{" "}
          <code className="font-mono text-white">frontend/public/Series/Beverly-Hillbillies</code>.
        </p>
      </header>

      {seasons.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
          No episodes found. Drop MP4s into{" "}
          <code className="font-mono text-white">frontend/public/Series/Beverly-Hillbillies</code>{" "}
          to populate the library.
        </div>
      ) : (
        <SeriesBrowser seasons={seasons} />
      )}
    </div>
  );
}
