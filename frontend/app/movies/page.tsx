import Image from "next/image";
import { loadMovies } from "@/lib/media";

export default function MoviesPage() {
  const movies = loadMovies({ includeDurations: true });

  return (
    <div className="space-y-4">
      <header>
        <p className="uppercase text-xs tracking-[0.3em] text-white/60 mb-2">
          Movies
        </p>
        <h1 className="text-3xl font-serif font-bold">Movies</h1>
        <p className="text-white/75">
          Auto-detected from{" "}
          <code className="font-mono text-white">frontend/public/Movies</code>.
        </p>
      </header>

      {movies.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
          No movies found. Drop MP4/MOV/AVI files into{" "}
          <code className="font-mono text-white">frontend/public/Movies</code> to populate the list.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {movies.map((movie) => (
            <article
              key={movie.filename}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-black/70 via-black/60 to-[var(--color-primary)]/10 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--color-accent)]/50 hover:shadow-[0_10px_40px_-20px_var(--color-accent)]"
            >
              <div className="relative aspect-video bg-black">
                <video
                  controls
                  className="h-full w-full object-cover"
                  poster={movie.thumbnailUrl}
                  preload="metadata"
                >
                  <source
                    src={movie.url}
                    type={
                      movie.filename.toLowerCase().endsWith(".mp4")
                        ? "video/mp4"
                        : movie.filename.toLowerCase().endsWith(".mov")
                          ? "video/quicktime"
                        : "video/mp4"
                    }
                  />
                  Your browser does not support the video tag.
                </video>
                {movie.thumbnailUrl && (
                  <Image
                    src={movie.thumbnailUrl}
                    alt={movie.title}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
                  />
                )}
              </div>
              <div className="flex flex-col gap-1 px-4 py-3 text-sm text-white/80">
                <div className="text-lg font-semibold text-white">
                  {movie.title}
                </div>
                <div className="flex items-center justify-between text-[12px] uppercase tracking-[0.2em] text-white/50">
                  <span>{movie.filename}</span>
                  {movie.durationSeconds ? (
                    <span>
                      {Math.round(movie.durationSeconds / 60)} min
                    </span>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
