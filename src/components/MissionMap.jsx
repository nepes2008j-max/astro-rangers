import { useGameStore } from '../store/useGameStore.js'

const fmt = (iso) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

const Row = ({ live, children }) => (
  <li className="flex items-center gap-2">
    <span className={`h-2 w-2 shrink-0 rounded-full ${live ? 'animate-pulse bg-emerald-400' : 'bg-amber-400'}`} aria-hidden />
    <span>{children}</span>
    <span className="ml-auto text-[10px] text-slate-500">{live ? 'LIVE' : 'saved'}</span>
  </li>
)

function SpaceWeather() {
  const sw = useGameStore((s) => s.spaceWeather)
  if (!sw) return <p className="text-xs text-slate-500">📡 Contacting NASA DONKI…</p>
  const flare = sw.flares.at(-1)
  const cme = sw.cmes.reduce((a, b) => (b.speed > (a?.speed ?? 0) ? b : a), null)
  const storm = sw.storms.reduce((a, b) => (b.kp > (a?.kp ?? 0) ? b : a), null)
  return (
    <section className="w-full rounded-xl border border-amber-400/30 bg-slate-950/70 p-3 text-left text-xs text-slate-300">
      <h3 className="mb-2 font-bold text-amber-300">☀️ Real space weather (NASA DONKI)</h3>
      <ul className="space-y-1.5">
        {flare && <Row live={sw.live.flares}>Solar flare class <b>{flare.classType}</b> · {fmt(flare.peakTime)}</Row>}
        {cme && <Row live={sw.live.cmes}>Fastest solar eruption <b>{cme.speed.toLocaleString()} km/s</b> · {fmt(cme.startTime)}</Row>}
        {storm && <Row live={sw.live.storms}>Strongest geomagnetic storm <b>Kp {storm.kp}</b> · {fmt(storm.startTime)}</Row>}
      </ul>
      <p className="mt-2 text-[11px] text-slate-500">These real events will hit your base during the mission!</p>
    </section>
  )
}

function Node({ icon, label, sub, onClick, locked, glow }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button onClick={onClick} disabled={locked}
        className={`flex h-28 w-28 flex-col items-center justify-center rounded-full border-4 transition ${locked
          ? 'border-slate-700 bg-slate-900 text-slate-500'
          : `${glow} animate-bounce bg-slate-800 [animation-duration:2.2s] hover:scale-105`}`}>
        <span className="text-4xl">{locked ? '🔒' : icon}</span>
        <span className="text-sm font-bold">{label}</span>
      </button>
      <p className="text-xs text-slate-400">{sub}</p>
    </div>
  )
}

export default function MissionMap() {
  const { startMission, marsUnlocked, bestScience, go } = useGameStore()
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 text-center">
      <h2 className="text-2xl font-bold text-cyan-300">Choose your mission</h2>
      {bestScience > 0 && <p className="text-sm text-slate-400">Best science score: 🔬 {bestScience}</p>}

      <div className="mr-24 mt-8"><Node icon="🔴" label="Mars" sub={marsUnlocked ? 'Survive 10 Sols on Mars' : 'Beat the Moon to unlock'} locked={!marsUnlocked}
        onClick={() => startMission('mars')} glow="border-orange-400 text-orange-200 shadow-[0_0_30px_#fb923c]" /></div>
      <svg width="140" height="50" viewBox="0 0 140 50" aria-hidden className="-my-2"><path d="M30 4 C 30 30, 110 20, 110 46" fill="none" stroke="#334155" strokeWidth="4" strokeDasharray="8 8" /></svg>
      <div className="ml-24"><Node icon="🌕" label="Moon" sub="Survive 10 Sols" onClick={() => startMission('moon')}
        glow="border-cyan-300 text-cyan-200 shadow-[0_0_30px_#22d3ee]" /></div>

      <SpaceWeather />
      <button onClick={() => go('welcome')} className="text-sm text-slate-500 underline">Back</button>
    </div>
  )
}
