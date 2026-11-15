import { useGameStore } from '../store/useGameStore.js'
import SoundToggles from './SoundToggles.jsx'

const HOW = [
  ['🎯', 'Complete the objective', 'Collect science samples around the base before the last Sol (day) ends.'],
  ['⚖️', 'Make tough calls', 'Every Sol brings a real crisis. Each choice costs ⚡ power, 💨 oxygen or 🛡️ shields. If any hits zero, the base is lost.'],
  ['🧑‍🚀', 'Watch your suit', 'Your suit oxygen drains while you are outside. Refill at the 🫧 airlock before it runs out.'],
]

export default function Welcome() {
  const go = useGameStore((s) => s.go)
  return (
    <div className="mx-auto flex min-h-[85dvh] max-w-xl flex-col items-center justify-center gap-5 py-6 text-center">
      <div className="text-6xl" aria-hidden>🧑‍🚀</div>
      <h1 className="text-4xl font-black tracking-tight text-cyan-300 drop-shadow-[0_0_12px_#22d3ee] sm:text-5xl">ASTRO RANGERS</h1>
      <p className="text-lg font-semibold text-slate-200">Outpost Survival · Moon, Mars & Europa</p>
      <p className="text-slate-300">
        Run a real-science outpost across 15 levels. Space weather comes from NASA's live DONKI feed and the health
        events come from real NASA spaceflight studies, so what happens to your base is based on real data.
      </p>
      <ul className="grid w-full gap-2 text-left">
        {HOW.map(([icon, title, text]) => (
          <li key={title} className="flex gap-3 rounded-xl border border-slate-700 bg-slate-900/70 p-3">
            <span className="text-2xl" aria-hidden>{icon}</span>
            <span><b className="text-slate-100">{title}</b><br /><span className="text-sm text-slate-300">{text}</span></span>
          </li>
        ))}
      </ul>
      <button onClick={() => go('map')}
        className="rounded-2xl bg-cyan-400 px-10 py-4 text-xl font-bold text-cyan-950 shadow-[0_0_24px_#22d3ee] transition hover:scale-105 active:scale-95">
        Start Mission 🚀
      </button>
      <div className="flex items-center gap-2 text-sm text-slate-300">Music & sound <SoundToggles /></div>
      <p className="text-xs text-slate-400">Ages 10–16 · Keyboard, mouse or touch · NASA Space Apps Challenge</p>
    </div>
  )
}
