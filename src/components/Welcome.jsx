import { useGameStore } from '../store/useGameStore.js'

export default function Welcome() {
  const go = useGameStore((s) => s.go)
  return (
    <div className="mx-auto flex min-h-[80dvh] max-w-md flex-col items-center justify-center gap-6 text-center">
      <div className="text-7xl" aria-hidden>🧑‍🚀</div>
      <h1 className="text-4xl font-black tracking-tight text-cyan-300 drop-shadow-[0_0_12px_#22d3ee]">ASTRO RANGERS</h1>
      <p className="text-lg text-slate-300">Outpost Survival</p>
      <p className="text-slate-400">
        10 missions from easy to super hard, on the Moon and then Mars. Walk your astronaut around the base to do every job. Every choice costs something.
        Keep your ⚡ power, 💨 oxygen and 🛡️ shields above zero!
      </p>
      <button onClick={() => go('map')}
        className="rounded-2xl bg-cyan-400 px-10 py-4 text-xl font-bold text-slate-950 shadow-[0_0_24px_#22d3ee] transition hover:scale-105 active:scale-95">
        Start Mission 🚀
      </button>
    </div>
  )
}
