import { useState } from 'react'
import { useGameStore } from '../store/useGameStore.js'
import { FACTS, TOPICS } from '../lib/facts.js'
import { MISSIONS } from '../data/missions.js'

const Stat = ({ value, label }) => (
  <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-3 text-center print:border-slate-300 print:bg-white">
    <p className="text-2xl font-black text-white print:text-black">{value}</p>
    <p className="text-xs text-slate-300 print:text-slate-700">{label}</p>
  </div>
)

export default function TeacherMode() {
  const { learned, progress, go, resetProgress } = useGameStore()
  const [showAll, setShowAll] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [msg, setMsg] = useState('')

  const found = FACTS.filter((f) => learned[f.key])
  const beaten = MISSIONS.filter((m) => progress[m.id]).length
  const stars = Object.values(progress).reduce((a, b) => a + b, 0)
  const pct = Math.round((found.length / FACTS.length) * 100)

  const copySummary = async () => {
    const lines = [
      'ASTRO RANGERS – Facts learned',
      `Levels beaten: ${beaten}/${MISSIONS.length} · Stars: ${stars}/${MISSIONS.length * 3} · Facts: ${found.length}/${FACTS.length} (${pct}%)`,
      '',
      ...TOPICS.flatMap((t) => {
        const list = found.filter((f) => f.topic === t.id)
        return [`${t.title} (${list.length})`, ...list.map((f) => `- ${f.fact} [${f.source}]`), '']
      }),
    ]
    try { await navigator.clipboard.writeText(lines.join('\n')); setMsg('Summary copied! Paste it into a document or message.') }
    catch { setMsg('Copy is blocked in this browser. Use Print instead.') }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 pb-10 text-left print:max-w-none print:text-black">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-widest text-cyan-300 print:text-slate-600">👩‍🏫 TEACHER MODE</p>
          <h2 className="text-2xl font-black text-white print:text-black">Facts learned in Astro Rangers</h2>
          <p className="text-sm text-slate-300 print:text-slate-700">Every fact comes from real NASA missions and data (DONKI space weather, OSDR spaceflight studies, Apollo, Mars rovers, Galileo and Europa Clipper).</p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <button onClick={() => window.print()} className="rounded-lg bg-cyan-400 px-3 py-2 text-sm font-bold text-cyan-950">🖨️ Print</button>
          <button onClick={copySummary} className="rounded-lg border border-cyan-400/60 px-3 py-2 text-sm font-bold text-cyan-200">📋 Copy summary</button>
        </div>
      </header>
      <p role="status" aria-live="polite" className="min-h-5 text-sm text-cyan-200 print:hidden">{msg}</p>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat value={`${found.length}/${FACTS.length}`} label="facts discovered" />
        <Stat value={`${pct}%`} label="of all facts" />
        <Stat value={`${beaten}/${MISSIONS.length}`} label="levels beaten" />
        <Stat value={`⭐ ${stars}`} label={`of ${MISSIONS.length * 3} stars`} />
      </section>

      <label className="flex items-center gap-2 text-sm text-slate-200 print:hidden">
        <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="h-4 w-4 accent-cyan-400" />
        Show all facts, including ones not discovered yet (for lesson planning)
      </label>

      {TOPICS.map((t) => {
        const all = FACTS.filter((f) => f.topic === t.id)
        const list = showAll ? all : all.filter((f) => learned[f.key])
        const got = all.filter((f) => learned[f.key]).length
        return (
          <section key={t.id} className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 print:break-inside-avoid print:border-slate-300 print:bg-white">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-lg font-bold text-white print:text-black">{t.title}</h3>
              <span className="text-sm text-slate-300 print:text-slate-700">{got}/{all.length} discovered</span>
            </div>
            <p className="text-sm text-slate-300 print:text-slate-700">{t.blurb}</p>
            {list.length ? (
              <ul className="mt-3 grid gap-2">
                {list.map((f) => {
                  const seen = learned[f.key]
                  return (
                    <li key={f.key} className={`rounded-xl border p-3 ${seen ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-slate-700 bg-slate-950/40'} print:border-slate-300 print:bg-white`}>
                      <p className="text-xs font-semibold text-slate-300 print:text-slate-600">
                        {seen ? '✓ Discovered' : 'Not discovered yet'} · {f.planet} · {f.title}
                      </p>
                      <p className="mt-1 text-slate-100 print:text-black">{f.fact}</p>
                      <p className="mt-1 text-xs text-slate-400 print:text-slate-600">Source: {f.source}</p>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="mt-3 rounded-xl bg-slate-950/40 p-3 text-sm text-slate-300 print:text-slate-700">No facts discovered here yet. Play more levels to unlock them.</p>
            )}
            <div className="mt-3 rounded-xl bg-indigo-500/10 p-3 print:bg-white">
              <p className="text-xs font-bold text-indigo-200 print:text-slate-700">💬 Discuss in class</p>
              <ol className="mt-1 list-decimal pl-5 text-sm text-slate-200 print:text-black">
                {t.questions.map((q) => <li key={q}>{q}</li>)}
              </ol>
            </div>
          </section>
        )
      })}

      <section className="rounded-2xl border border-red-400/40 p-4 print:hidden">
        <h3 className="font-bold text-red-200">Shared computer?</h3>
        <p className="text-sm text-slate-300">Reset clears levels, stars, credits, suits and facts saved in this browser, so the next student starts fresh.</p>
        {confirmReset ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => { resetProgress(); setConfirmReset(false); setMsg('Progress reset. The next student starts from level 1.') }} className="rounded-lg bg-red-500 px-3 py-2 text-sm font-bold text-white">Yes, reset everything</button>
            <button onClick={() => setConfirmReset(false)} className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setConfirmReset(true)} className="mt-3 rounded-lg border border-red-400/60 px-3 py-2 text-sm font-bold text-red-200">Reset progress…</button>
        )}
      </section>

      <div className="flex gap-3 print:hidden">
        <button onClick={() => go('map')} className="rounded-xl bg-cyan-400 px-5 py-3 font-bold text-cyan-950">← Level map</button>
        <button onClick={() => go('welcome')} className="rounded-xl border border-slate-600 px-5 py-3 text-slate-200">Home</button>
      </div>
    </div>
  )
}
