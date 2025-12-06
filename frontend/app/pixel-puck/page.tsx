import Link from 'next/link';

export default function PixelPuckHome() {
  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100 p-8 flex flex-col items-center">
      <h1 className="text-6xl font-black mb-8 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500">
        PIXEL PUCK
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
        <Link href="/pixel-puck/online" className="group">
          <div className="h-64 flex flex-col items-center justify-center p-8 bg-neutral-800 border-2 border-cyan-500/30 hover:border-cyan-400 transition-all hover:scale-105 cursor-pointer rounded-xl">
            <h2 className="text-3xl font-bold text-cyan-400 mb-4 group-hover:text-cyan-300">PLAY ONLINE</h2>
            <p className="text-neutral-400 text-center">
              Competitive 1v1. Matchmake against other players.
            </p>
            <div className="mt-6 px-6 py-2 bg-cyan-900/50 rounded-full text-cyan-200 text-sm font-mono">
              RED vs BLUE
            </div>
          </div>
        </Link>

        <Link href="/games/pixel-puck/index.html" className="group">
          <div className="h-64 flex flex-col items-center justify-center p-8 bg-neutral-800 border-2 border-purple-500/30 hover:border-purple-400 transition-all hover:scale-105 cursor-pointer rounded-xl">
            <h2 className="text-3xl font-bold text-purple-400 mb-4 group-hover:text-purple-300">PRACTICE</h2>
            <p className="text-neutral-400 text-center">
              Play locally against AI or a friend on the same keyboard.
            </p>
            <div className="mt-6 px-6 py-2 bg-purple-900/50 rounded-full text-purple-200 text-sm font-mono">
              SINGLE PLAYER
            </div>
          </div>
        </Link>
      </div>

      <div className="mt-12 text-neutral-500 text-sm max-w-lg text-center">
        <p>Goal: Use WASD/Arrows to move. Space/Enter to Dash. First to score 5 goals wins.</p>
      </div>
    </div>
  );
}
