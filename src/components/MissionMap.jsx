import { useGameStore } from '../store/useGameStore.js'
import { MISSIONS, COMING_SOON } from '../data/missions.js'
import { Stars } from './EndScreen.jsx'

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

// Duolingo-style winding path: mission 1 at the top, each node swings left/right.
const offset = (i) => Math.round(Math.sin(i * 0.8) * 85)
const PLANETS = {
  moon: { icon: '🌕', ring: 'border-cyan-300 bg-slate-800 text-cyan-100 shadow-[0_0_24px_#22d3ee88]' },
  mars: { icon: '🔴', ring: 'border-orange-400 bg-slate-800 text-orange-100 shadow-[0_0_24px_#fb923c88]' },
  europa: { icon: '🧊', ring: 'border-sky-200 bg-slate-800 text-sky-50 shadow-[0_0_24px_#bae6fd88]' },
}
const SECTIONS = { 6: ['🚀 ON TO MARS', 'border-orange-400/40 text-orange-300'], 11: ['🪐 ON TO JUPITER: EUROPA', 'border-sky-300/40 text-sky-200'] }

function MissionNode({ m, offset }) {
  const { startMission, progress, isUnlocked } = useGameStore()
  const stars = progress[m.id] ?? 0
  const open = isUnlocked(m.id)
  const isNext = open && !stars
  const p = PLANETS[m.planet]
  const ring = open ? p.ring : 'border-slate-700 bg-slate-900 text-slate-500'
  return (
    <li className="flex flex-col items-center" style={{ transform: `translateX(${offset}px)` }}>
      <button onClick={() => startMission(m.id)} disabled={!open} aria-label={`Mission ${m.id}: ${m.name}${open ? '' : ' (locked)'}`}
        className={`grid h-20 w-20 place-items-center rounded-full border-4 transition hover:scale-105 disabled:hover:scale-100 ${ring} ${isNext ? 'animate-bounce [animation-duration:2s]' : ''}`}>
        <span className="text-3xl leading-none">{open ? p.icon : '🔒'}</span>
        <span className="-mt-3 text-xs font-black">{m.id}</span>
      </button>
      <p className={`mt-1 text-sm font-bold ${open ? 'text-slate-100' : 'text-slate-500'}`}>{m.name}</p>
      {stars > 0 ? <Stars n={stars} size="text-sm" /> : <p className="max-w-[12rem] text-[11px] text-slate-400">{open ? m.goal : `${m.sols} Sols`}</p>}
    </li>
  )
}

export default function MissionMap() {
  const { go, progress } = useGameStore()
  const total = Object.values(progress).reduce((a, b) => a + b, 0)
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
      <h2 className="text-2xl font-bold text-cyan-300">Mission Map</h2>
      <p className="text-sm text-slate-400">⭐ {total} / {MISSIONS.length * 3} stars · easiest at the top, hardest at the bottom</p>
      <SpaceWeather />
      <ol className="flex flex-col items-center gap-5 py-2">
        {MISSIONS.flatMap((m, i) => [
          SECTIONS[m.id] && <li key={`s${m.id}`} className={`w-full border-t border-dashed pt-3 text-xs font-bold tracking-widest ${SECTIONS[m.id][1]}`}>{SECTIONS[m.id][0]}</li>,
          <MissionNode key={m.id} m={m} offset={offset(i)} />,
        ])}
      </ol>
      <section className="w-full border-t border-dashed border-slate-600 pt-3">
        <p className="text-xs font-bold tracking-widest text-slate-400">🔭 MORE WORLDS COMING SOON</p>
        <ul className="mt-3 flex flex-wrap justify-center gap-2">
          {COMING_SOON.map((w) => (
            <li key={w.name} className="flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-sm text-slate-400">
              <span aria-hidden>{w.icon}</span>{w.name}<span aria-hidden>🔒</span>
            </li>
          ))}
        </ul>
      </section>
      <button onClick={() => go('welcome')} className="mb-6 text-sm text-slate-500 underline">Back</button>
    </div>
  )
}
