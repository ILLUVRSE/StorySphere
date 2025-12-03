import Link from "next/link";

export default function Home() {
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start text-center sm:text-left">
        <h1 className="text-4xl sm:text-6xl font-bold font-serif text-accent">
          StorySphere
        </h1>
        <p className="text-lg sm:text-xl max-w-2xl">
          A local-first personal studio that turns prompts into MP4s, hosts them in a personal library, and streams them on a continuous LiveLoop channel.
        </p>

        <div className="flex gap-4 items-center flex-col sm:flex-row">
          <Link
            href="/create"
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-gold text-gold-foreground gap-2 hover:bg-[#e6c200] text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 font-bold shadow-md"
          >
            Create New Story
          </Link>
          <Link
            href="/watch"
            className="rounded-full border border-solid border-white/20 transition-colors flex items-center justify-center hover:bg-white/10 text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:min-w-44"
          >
            View LiveLoop
          </Link>
        </div>
      </main>
      <footer className="row-start-3 flex gap-6 flex-wrap items-center justify-center opacity-70">
        <div className="flex items-center gap-2">
           Status: <span className="w-2 h-2 rounded-full bg-green-500"></span> Online
        </div>
      </footer>
    </div>
  );
}
