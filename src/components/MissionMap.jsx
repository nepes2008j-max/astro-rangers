import { useGameStore } from '../store/useGameStore.js'
import { MISSIONS, COMING_SOON } from '../data/missions.js'
import { Stars } from './EndScreen.jsx'
import { SuitPreview } from './BaseShop.jsx'
import { suitById } from '../data/suits.js'

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

// Duolingo-style winding path: each node swings left/right.
const offset = (i) => Math.round(Math.sin(i * 0.8) * 85)
const PLANETS = {
  moon: { icon: '🌕', ring: 'border-cyan-300 bg-slate-800 text-cyan-100 shadow-[0_0_24px_#22d3ee88]' },
  mars: { icon: '🔴', ring: 'border-orange-400 bg-slate-800 text-orange-100 shadow-[0_0_24px_#fb923c88]' },
  europa: { icon: '🧊', ring: 'border-sky-200 bg-slate-800 text-sky-50 shadow-[0_0_24px_#bae6fd88]' },
}

// One themed section per world, drawn as if you're standing there.
const WORLDS = [
  { planet: 'moon', title: '🌕 THE MOON', sub: 'Learn to survive', border: 'border-slate-400/50' },
  { planet: 'mars', title: '🔴 MARS', sub: 'The Red Planet', border: 'border-orange-500/60' },
  { planet: 'europa', title: '🧊 EUROPA', sub: "Jupiter's icy moon", border: 'border-sky-300/60' },
]

// Deterministic star field so the sky looks the same every visit.
const STARS = Array.from({ length: 70 }, (_, i) => [(i * 97.3) % 400, (i * 53.7) % 520, 0.4 + ((i * 7) % 10) / 10])

function Backdrop({ planet }) {
  const stars = STARS.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="#fff" opacity={0.35 + (i % 5) / 8} />)
  return (
    <svg viewBox="0 0 400 760" preserveAspectRatio="xMidYMid slice" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
      {planet === 'moon' && (
        <>
          <defs>
            <linearGradient id="bg-moon-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#010205" /><stop offset="1" stopColor="#0b0d12" /></linearGradient>
            <radialGradient id="bg-earth" cx="0.35" cy="0.35" r="0.75"><stop offset="0" stopColor="#7dd3fc" /><stop offset="0.6" stopColor="#1d4ed8" /><stop offset="1" stopColor="#0b1d4d" /></radialGradient>
          </defs>
          <rect width="400" height="760" fill="url(#bg-moon-sky)" />
          {stars}
          <circle cx="320" cy="95" r="44" fill="#60a5fa" opacity="0.15" />
          <circle cx="320" cy="95" r="34" fill="url(#bg-earth)" />
          <path d="M300 82 q10 -10 22 -2 q6 8 -4 14 q-12 4 -18 -12z M326 104 q8 -4 12 4 q-4 8 -12 2z" fill="#4d7c3a" opacity="0.9" />
          <path d="M296 96 q20 -6 44 2" stroke="#fff" strokeWidth="3" fill="none" opacity="0.6" />
          <path d="M0 600 Q80 560 160 590 T320 575 T400 585 V760 H0z" fill="#3f3d3a" />
          <path d="M0 650 Q100 615 200 640 T400 630 V760 H0z" fill="#57534e" />
          {[[60, 690, 22], [180, 720, 14], [300, 680, 28], [360, 735, 10], [110, 745, 9]].map(([x, y, r]) => (
            <g key={x}><ellipse cx={x} cy={y} rx={r} ry={r * 0.35} fill="#292524" /><ellipse cx={x} cy={y - r * 0.08} rx={r} ry={r * 0.3} fill="none" stroke="#78716c" strokeWidth="1.5" /></g>
          ))}
        </>
      )}
      {planet === 'mars' && (
        <>
          <defs>
            <linearGradient id="bg-mars-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1f0904" /><stop offset="0.55" stopColor="#7c2d12" /><stop offset="1" stopColor="#c2410c" /></linearGradient>
          </defs>
          <rect width="400" height="760" fill="url(#bg-mars-sky)" />
          {stars.slice(0, 25)}
          <circle cx="90" cy="120" r="16" fill="#fde68a" opacity="0.25" />
          <circle cx="90" cy="120" r="7" fill="#fef3c7" opacity="0.8" />
          <ellipse cx="300" cy="80" rx="9" ry="6" fill="#a8a29e" />
          <circle cx="345" cy="150" r="3" fill="#d6d3d1" />
          <path d="M0 560 Q90 520 190 555 T400 540 V760 H0z" fill="#9a3412" />
          <path d="M0 620 Q120 585 230 615 T400 600 V760 H0z" fill="#7c2d12" />
          <path d="M0 690 Q140 660 260 690 T400 680 V760 H0z" fill="#5c1d0b" />
          {[[70, 640], [250, 705], [340, 655], [150, 730]].map(([x, y]) => <path key={x} d={`M${x} ${y} l12 -9 l14 3 l6 8z`} fill="#431407" />)}
        </>
      )}
      {planet === 'europa' && (
        <>
          <defs>
            <linearGradient id="bg-eu-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#01030a" /><stop offset="1" stopColor="#0b1a33" /></linearGradient>
            <clipPath id="bg-jupiter"><circle cx="290" cy="150" r="115" /></clipPath>
            <radialGradient id="bg-jshade" cx="0.3" cy="0.3" r="0.8"><stop offset="0.5" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.6" /></radialGradient>
          </defs>
          <rect width="400" height="760" fill="url(#bg-eu-sky)" />
          {stars}
          <g clipPath="url(#bg-jupiter)">
            {['#e8dcc4', '#c9a27a', '#f2e8d5', '#b07a55', '#ead9bd', '#a8714d', '#f0e3c8', '#c49a72', '#e3d3b6', '#b98b62'].map((c, i) => (
              <rect key={i} x="170" y={35 + i * 23} width="240" height="24" fill={c} />
            ))}
            <ellipse cx="320" cy="195" rx="24" ry="12" fill="#b5482e" />
            <circle cx="290" cy="150" r="115" fill="url(#bg-jshade)" />
          </g>
          <path d="M0 610 Q100 580 210 605 T400 595 V760 H0z" fill="#bcd0e0" />
          <path d="M0 660 Q130 635 250 655 T400 650 V760 H0z" fill="#e2ecf4" />
          {['M10 700 L80 680 L150 705 L230 690', 'M120 740 L200 720 L290 735 L390 715', 'M260 670 L320 690 L400 675'].map((d) => (
            <path key={d} d={d} stroke="#9a5b34" strokeWidth="3" fill="none" opacity="0.7" strokeLinecap="round" />
          ))}
        </>
      )}
    </svg>
  )
}

function WorldSection({ world, missions, startIndex }) {
  const { isUnlocked, progress } = useGameStore()
  const first = missions[0], last = missions.at(-1)
  const locked = !isUnlocked(first.id)
  const stars = missions.reduce((a, m) => a + (progress[m.id] ?? 0), 0)
  return (
    <section className={`relative w-full overflow-hidden rounded-3xl border-2 ${world.border}`} aria-label={`${world.title}: levels ${first.id} to ${last.id}`}>
      <Backdrop planet={world.planet} />
      {locked && <div className="pointer-events-none absolute inset-0 bg-black/45" aria-hidden />}
      <div className="relative">
        <header className="flex items-center justify-between bg-black/40 px-4 py-2 text-left backdrop-blur-sm">
          <div>
            <p className="text-sm font-black tracking-widest text-white">{world.title}</p>
            <p className="text-xs text-slate-200">Levels {first.id}–{last.id} · {world.sub}</p>
          </div>
          <p className="text-sm font-bold text-amber-200">⭐ {stars}/{missions.length * 3}</p>
        </header>
        {locked && <p className="mx-auto mt-3 w-fit rounded-full bg-black/60 px-3 py-1 text-xs font-bold text-slate-100">🔒 Beat level {first.id - 1} to unlock</p>}
        <ol className="flex flex-col items-center gap-5 px-2 pb-10 pt-5">
          {missions.map((m, i) => <MissionNode key={m.id} m={m} offset={offset(startIndex + i)} />)}
        </ol>
      </div>
    </section>
  )
}

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
      <div className="mt-1 max-w-[13rem] rounded-xl bg-black/55 px-2.5 py-1 backdrop-blur-sm">
        <p className={`text-sm font-bold ${open ? 'text-white' : 'text-slate-300'}`}><span className="text-xs font-semibold text-slate-300">Level {m.id} · </span>{m.name}</p>
        {stars > 0 ? <Stars n={stars} size="text-sm" /> : <p className="text-[11px] text-slate-200">{open ? m.goal : `${m.sols} Sols · ${m.samples} samples`}</p>}
      </div>
    </li>
  )
}

export default function MissionMap() {
  const { go, progress, credits, suit } = useGameStore()
  const total = Object.values(progress).reduce((a, b) => a + b, 0)
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
      <h2 className="text-2xl font-bold text-cyan-300">Level Map</h2>
      <p className="text-sm text-slate-400">⭐ {total} / {MISSIONS.length * 3} stars · easiest at the top, hardest at the bottom</p>
      <button onClick={() => go('shop')} className="flex items-center gap-2 rounded-full border border-amber-400/60 bg-amber-400/10 py-1 pl-1 pr-4 font-bold text-amber-200 hover:bg-amber-400/20">
        <SuitPreview color={suitById(suit).color} size={36} /> 🛒 Suit Shop · 💰 {credits}
      </button>
      <SpaceWeather />
      {WORLDS.map((w) => {
        const missions = MISSIONS.filter((m) => m.planet === w.planet)
        return <WorldSection key={w.planet} world={w} missions={missions} startIndex={MISSIONS.indexOf(missions[0])} />
      })}
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
