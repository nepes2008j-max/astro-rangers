import { useGameStore } from '../store/useGameStore.js'

export default function EndScreen() {
  const { result, res, sol, startMission, go, planet } = useGameStore()
  const won = result === 'victory'
  const lost = Object.entries({ power: '⚡ power', oxygen: '💨 oxygen', shielding: '🛡️ shields' })
    .filter(([k]) => res[k] <= 0).map(([, v]) => v).join(' and ')
  return (
    <div className="mx-auto flex min-h-[80dvh] max-w-md flex-col items-center justify-center gap-5 text-center">
      <div className="text-7xl" aria-hidden>{won ? '🏆' : '💥'}</div>
      <h2 className={`text-3xl font-black ${won ? 'text-emerald-300' : 'text-red-400'}`}>
        {won ? 'Mission Complete!' : 'Outpost Lost'}
      </h2>
      <p className="text-slate-300">
        {won ? `You survived 10 Sols! ${planet === 'moon' ? 'Mars is now unlocked!' : 'You are a true Astro Ranger!'}` : `You ran out of ${lost} on Sol ${sol}.`}
      </p>
      <p className="text-xl">Science collected: 🔬 <b>{res.science}</b></p>
      <div className="flex gap-3">
        <button onClick={startMission} className="rounded-xl bg-cyan-400 px-6 py-3 font-bold text-slate-950">Play again</button>
        <button onClick={() => go('map')} className="rounded-xl border border-slate-600 px-6 py-3">Map</button>
      </div>
    </div>
  )
}
