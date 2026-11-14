import { useGameStore } from '../store/useGameStore.js'
import { MISSIONS } from '../data/missions.js'

export const Stars = ({ n, size = 'text-4xl' }) => (
  <span className={size} aria-label={`${n} of 3 stars`}>
    {[1, 2, 3].map((i) => <span key={i} className={i <= n ? '' : 'opacity-20 grayscale'}>⭐</span>)}
  </span>
)

export default function EndScreen() {
  const { result, res, sol, startMission, go, mission, earned, gained, credits, reason, samples } = useGameStore()
  const won = result === 'victory'
  const next = MISSIONS.find((m) => m.id === mission.id + 1)
  const lost = Object.entries({ power: '⚡ power', oxygen: '💨 oxygen', shielding: '🛡️ shields' })
    .filter(([k]) => res[k] <= 0).map(([, v]) => v).join(' and ')
  return (
    <div className="mx-auto flex min-h-[80dvh] max-w-md flex-col items-center justify-center gap-5 text-center">
      <div className="text-7xl" aria-hidden>{won ? (next ? '🏆' : '🎖️') : '💥'}</div>
      <p className="text-sm font-bold tracking-widest text-slate-400">MISSION {mission.id}: {mission.name.toUpperCase()}</p>
      <h2 className={`text-3xl font-black ${won ? 'text-emerald-300' : 'text-red-400'}`}>
        {won ? 'Mission Complete!' : reason === 'objective' ? 'Objective Missed' : 'Outpost Lost'}
      </h2>
      {won && <Stars n={earned} />}
      <p className="text-slate-300">
        {won
          ? `You survived ${mission.sols} Sols! ${next ? `Mission ${next.id} "${next.name}" is unlocked.` : 'You beat every mission. You are a true Astro Ranger Commander!'}`
          : reason === 'objective' ? `You survived, but the objective wasn't done: ${samples.filter((x) => x.collected).length} of ${samples.length} samples collected. Follow the orange arrow next time!` : `You ran out of ${lost} on Sol ${sol}. Try another strategy!`}
      </p>
      <p className="text-xl">Science collected: 🔬 <b>{res.science}</b></p>
      <p className="rounded-full border border-amber-400/50 bg-amber-400/10 px-4 py-1 font-bold text-amber-200">+{gained} credits · 💰 {credits} total</p>
      {won && earned < 3 && <p className="text-xs text-slate-400">Collect 🔬 {earned < 2 ? 30 : 60}+ science for the next ⭐</p>}
      <div className="flex flex-wrap justify-center gap-3">
        {won && next && <button onClick={() => startMission(next.id)} className="rounded-xl bg-cyan-400 px-6 py-3 font-bold text-slate-950">Next mission →</button>}
        <button onClick={() => startMission(mission.id)} className={won && next ? 'rounded-xl border border-cyan-400 px-6 py-3 text-cyan-200' : 'rounded-xl bg-cyan-400 px-6 py-3 font-bold text-slate-950'}>
          {won ? 'Play again' : 'Try again'}
        </button>
        <button onClick={() => go('map')} className="rounded-xl border border-slate-600 px-6 py-3">Map</button>
        <button onClick={() => go('shop')} className="rounded-xl border border-amber-400/60 px-6 py-3 text-amber-200">🛒 Shop</button>
      </div>
    </div>
  )
}
