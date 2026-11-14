import { useState } from 'react'
import { useGameStore } from '../store/useGameStore.js'
import { SUITS } from '../data/suits.js'

// A tiny astronaut drawn in the suit colour.
export function SuitPreview({ color, size = 72 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <rect x="19" y="27" width="26" height="24" rx="9" fill={color} stroke="#0f172a" strokeOpacity="0.25" />
      <rect x="13" y="29" width="8" height="18" rx="4" fill={color} stroke="#0f172a" strokeOpacity="0.25" />
      <rect x="43" y="29" width="8" height="18" rx="4" fill={color} stroke="#0f172a" strokeOpacity="0.25" />
      <rect x="22" y="48" width="8" height="12" rx="3" fill={color} stroke="#0f172a" strokeOpacity="0.25" />
      <rect x="34" y="48" width="8" height="12" rx="3" fill={color} stroke="#0f172a" strokeOpacity="0.25" />
      <circle cx="32" cy="17" r="13" fill={color} stroke="#0f172a" strokeOpacity="0.25" />
      <ellipse cx="32" cy="18" rx="9" ry="7" fill="#d4a017" />
      <ellipse cx="29" cy="16" rx="3" ry="2" fill="#fff7d6" opacity="0.7" />
      <rect x="27" y="33" width="10" height="6" rx="1.5" fill="#cbd5e1" />
    </svg>
  )
}

export default function BaseShop() {
  const { credits, ownedSuits, suit, buySuit, go } = useGameStore()
  const [msg, setMsg] = useState('')

  const pick = (s) => {
    const owned = ownedSuits.includes(s.id)
    if (buySuit(s.id)) setMsg(owned ? `Now wearing ${s.name}!` : `You bought ${s.name}! 🎉`)
    else setMsg(`You need ${s.price - credits} more credits for ${s.name}. Play missions to earn more!`)
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 pb-8 text-center">
      <h2 className="text-2xl font-bold text-cyan-300">🛒 Suit Shop</h2>
      <p className="rounded-full border border-amber-400/50 bg-amber-400/10 px-4 py-1.5 text-lg font-bold text-amber-200">💰 {credits} credits</p>
      <p className="text-sm text-slate-400">Earn credits from every mission: more ⭐ = more credits, plus a bonus for each new mission you beat.</p>
      <p role="status" aria-live="polite" className="min-h-5 text-sm text-cyan-200">{msg}</p>

      <ul className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
        {SUITS.map((s) => {
          const owned = ownedSuits.includes(s.id)
          const wearing = suit === s.id
          const afford = credits >= s.price
          return (
            <li key={s.id} className={`flex flex-col items-center gap-1 rounded-2xl border bg-slate-900/80 p-3 ${wearing ? 'border-cyan-300 shadow-[0_0_18px_#22d3ee55]' : 'border-slate-700'}`}>
              <SuitPreview color={s.color} />
              <p className="font-bold text-slate-100">{s.name}</p>
              <p className="text-sm text-amber-200">{owned ? 'Owned' : s.price === 0 ? 'Free' : `💰 ${s.price}`}</p>
              {s.fact && <p className="text-[11px] leading-snug text-slate-400">🛰️ {s.fact}</p>}
              <button onClick={() => pick(s)} disabled={wearing}
                className={`mt-auto w-full rounded-lg px-3 py-2 text-sm font-bold ${wearing ? 'bg-slate-800 text-cyan-300'
                  : owned ? 'border border-cyan-400 text-cyan-200 hover:bg-cyan-400/10'
                  : afford ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                  : 'border border-slate-600 text-slate-400'}`}>
                {wearing ? '✓ Wearing' : owned ? 'Wear' : afford ? 'Buy' : `Need ${s.price - credits} more`}
              </button>
            </li>
          )
        })}
      </ul>
      <button onClick={() => go('map')} className="rounded-xl bg-cyan-400 px-6 py-3 font-bold text-slate-950">← Back to missions</button>
    </div>
  )
}
