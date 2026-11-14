import { lazy, Suspense, useEffect, useState } from 'react'
import { useGameStore, scaleEffects } from '../store/useGameStore.js'
import { STATIONS, assignStations } from '../lib/stations.js'
import { fetchOsdrStudy, osdrTermFor } from '../lib/nasa.js'

const World3D = lazy(() => import('./World3D.jsx'))
const LETTERS = ['A', 'B', 'C']

const RES = [
  { id: 'power', icon: '⚡', label: 'Power', color: 'bg-yellow-400' },
  { id: 'oxygen', icon: '💨', label: 'Oxygen', color: 'bg-sky-400' },
  { id: 'shielding', icon: '🛡️', label: 'Shields', color: 'bg-violet-400' },
  { id: 'science', icon: '🔬', label: 'Science', color: 'bg-emerald-400' },
]
const ICON = Object.fromEntries(RES.map((r) => [r.id, r.icon]))

function Bar({ icon, label, color, value, vital }) {
  const low = vital && value < 20
  return (
    <div className={`rounded-lg border bg-slate-950/75 px-2 py-1.5 backdrop-blur ${low ? 'animate-pulse border-red-500' : 'border-slate-700'}`}>
      <div className="flex justify-between text-xs">
        <span>{icon} <span className="hidden sm:inline">{label}</span></span>
        <b className={low ? 'text-red-400' : ''}>{value}</b>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-800" role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full transition-all duration-700 ${low ? 'bg-red-500' : color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

const Effects = ({ effects }) => (
  <span className="mt-1 flex flex-wrap gap-1">
    {Object.entries(effects).filter(([, v]) => v).map(([k, v]) => (
      <span key={k} className={`rounded px-1.5 text-xs font-semibold ${v > 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
        {ICON[k]} {v > 0 ? '+' : ''}{v}
      </span>
    ))}
  </span>
)

// A real study from NASA's Open Science Data Repository, shown under health facts.
function OsdrStudy({ event }) {
  const [found, setFound] = useState(null)
  useEffect(() => {
    let alive = true
    fetchOsdrStudy(osdrTermFor(event)).then((r) => alive && setFound(r))
    return () => { alive = false }
  }, [event])
  if (!osdrTermFor(event)) return null
  if (!found) return <p className="mt-3 text-xs text-slate-500">Searching NASA OSDR for a real study…</p>
  const { study, source, updated } = found
  return (
    <a href={study.url} target="_blank" rel="noreferrer" className="mt-3 block rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 hover:border-emerald-300">
      <p className="text-xs font-bold text-emerald-300">🧬 REAL NASA STUDY {source === 'live' ? '· LIVE FROM OSDR' : `· FROM OSDR${updated ? `, fetched ${new Date(updated).toLocaleDateString()}` : ''}`}</p>
      <p className="mt-1 text-sm text-slate-200">{study.title}</p>
      <p className="mt-1 text-xs text-slate-400">{study.id}{study.mission && ` · ${study.mission}`}{study.organism && ` · ${study.organism}`}</p>
    </a>
  )
}

export default function Dashboard() {
  const { res, sol, event, fact, log, choose, nextSol, planet, mission, suitO2, samples, toast, dismissToast } = useGameStore()
  const got = samples.filter((x) => x.collected).length
  useEffect(() => { if (!toast) return; const t = setTimeout(dismissToast, 6000); return () => clearTimeout(t) }, [toast, dismissToast])
  const stations = assignStations(event.choices)
  useEffect(() => { fetchOsdrStudy(osdrTermFor(event)) }, [event]) // warm the cache before the fact popup opens
  const DRAIN = mission.drain
  return (
    <div className="fixed inset-0 overflow-hidden bg-slate-950">
      <Suspense fallback={<p className="grid h-full place-items-center text-cyan-300">Landing on the Moon…</p>}>
        <World3D />
      </Suspense>

      {/* HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 grid gap-2 p-3">
        <header className="flex items-center justify-between">
          <h1 className="text-sm font-black tracking-widest text-cyan-300 drop-shadow">{{ mars: '🔴', europa: '🧊' }[planet] ?? '🌕'} MISSION {mission.id}: {mission.name.toUpperCase()}</h1>
          <span className="rounded-full border border-cyan-400/50 bg-slate-950/70 px-3 py-0.5 font-mono text-sm text-cyan-200">Sol {sol}/{mission.sols}</span>
        </header>
        <section className="grid grid-cols-[2fr_1fr] gap-2">
          <div className={`rounded-lg border bg-slate-950/75 px-2 py-1.5 backdrop-blur ${suitO2 < 30 ? 'animate-pulse border-red-500' : 'border-cyan-700'}`}>
            <div className="flex justify-between text-xs">
              <span>🧑‍🚀 Suit O₂ {suitO2 < 30 && <b className="text-red-400">· return to the 🫧 airlock!</b>}</span>
              <b className={suitO2 < 30 ? 'text-red-400' : 'text-cyan-200'}>{suitO2}%</b>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-800" role="meter" aria-label="Suit oxygen" aria-valuenow={suitO2} aria-valuemin={0} aria-valuemax={100}>
              <div className={`h-full rounded-full transition-all duration-300 ${suitO2 < 30 ? 'bg-red-500' : 'bg-cyan-300'}`} style={{ width: `${suitO2}%` }} />
            </div>
          </div>
          <div className={`rounded-lg border bg-slate-950/75 px-2 py-1.5 text-xs backdrop-blur ${got === samples.length ? 'border-emerald-500 text-emerald-300' : 'border-amber-500/60 text-amber-200'}`}>
            <p className="font-bold">🎯 Samples {got}/{samples.length}</p>
            <p className="text-[11px] text-slate-400">{got === samples.length ? 'Objective done!' : `Collect before Sol ${mission.sols} ends`}</p>
          </div>
        </section>
        <section className="grid grid-cols-4 gap-2">
          {RES.map((r) => <Bar key={r.id} {...r} value={res[r.id]} vital={r.id !== 'science'} />)}
        </section>

        <section className="pointer-events-auto max-w-md rounded-2xl border border-cyan-400/30 bg-slate-950/80 p-3 backdrop-blur md:p-4">
          {event.live !== undefined && (
            <span className="mb-1 inline-block rounded bg-amber-400/20 px-2 py-0.5 text-xs font-bold text-amber-300">
              📡 {event.live ? 'LIVE NASA DATA' : 'REAL NASA DATA'}
            </span>
          )}
          <h2 className="font-bold text-amber-200 md:text-lg">{event.title}</h2>
          <p className="mt-1 hidden text-sm text-slate-300 sm:block">{event.description}</p>
          <p className="mt-2 hidden text-xs text-cyan-300 sm:block">🧑‍🚀 Stand on a glowing pad to choose, follow the 🟠 arrow to samples, refill at the 🫧 airlock<span className="hidden md:inline"> (WASD move · Shift sprint · Space jump · drag or Q/E to look)</span>, or tap:</p>
          <div className="mt-2 grid gap-2">
            {event.choices.map((c, i) => (
              <button key={c.text} onClick={() => choose(c)} disabled={!!fact}
                className="rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-left text-sm transition hover:border-cyan-300 disabled:opacity-50">
                <b className="text-cyan-300">{LETTERS[i]}</b> <span className="font-semibold">{c.text}</span>
                <span className="ml-1 text-xs text-slate-400">@ {STATIONS[stations[i]].icon} {STATIONS[stations[i]].name}</span>
                <Effects effects={scaleEffects(c.effects, mission.harm)} />
              </button>
            ))}
          </div>
        </section>
      </div>

      <aside className="pointer-events-none absolute bottom-4 left-4 z-20 hidden w-64 rounded-xl border border-slate-700 bg-slate-950/70 p-3 md:block">
        <h3 className="mb-1 text-xs font-bold text-slate-400">MISSION LOG</h3>
        <ul className="max-h-32 space-y-0.5 overflow-hidden font-mono text-xs text-slate-400">
          {log.length ? log.map((l, i) => <li key={i}>{l}</li>) : <li>Awaiting orders…</li>}
        </ul>
        <p className="mt-2 text-[11px] text-slate-500">Base uses ⚡{DRAIN.power} 💨{DRAIN.oxygen} per Sol</p>
      </aside>

      {toast && !fact && (
        <div role="status" className="absolute bottom-24 left-1/2 z-20 w-[min(26rem,calc(100%-2rem))] -translate-x-1/2 rounded-2xl border border-amber-400/60 bg-slate-950/90 p-4 text-left shadow-[0_0_24px_#f59e0b44] md:bottom-6">
          <p className="font-bold text-amber-200">{toast.title}</p>
          <p className="mt-1 text-sm text-slate-200">{toast.text}</p>
          <button onClick={dismissToast} className="mt-2 text-xs text-slate-400 underline">OK</button>
        </div>
      )}

      {fact && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl border border-cyan-400/50 bg-slate-900 p-6 shadow-[0_0_40px_#22d3ee55]">
            <p className="text-lg">{fact.feedback}</p>
            <div className="mt-4 rounded-xl bg-indigo-500/15 p-4">
              <p className="text-sm font-bold text-indigo-300">🛰️ NASA FACT</p>
              <p className="mt-1 text-slate-200">{fact.fact}</p>
              <p className="mt-2 text-xs text-slate-500">Source: {fact.source}</p>
            </div>
            <OsdrStudy event={event} />
            <button onClick={nextSol} autoFocus className="mt-5 w-full rounded-xl bg-cyan-400 py-3 font-bold text-slate-950">
              {sol >= mission.sols ? 'Finish mission' : 'Next Sol →'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
