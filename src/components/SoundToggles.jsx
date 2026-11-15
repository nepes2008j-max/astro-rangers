import { useState } from 'react'
import { getAudioSettings, setAudio } from '../lib/audio.js'

/** Music and sound-effect switches (saved in the browser). */
export default function SoundToggles({ className = '' }) {
  const [s, setS] = useState(getAudioSettings)
  const flip = (kind) => { setAudio(kind, !s[kind]); setS({ ...s, [kind]: !s[kind] }) }
  const btn = 'rounded-full border px-3 py-0.5 text-sm font-bold'
  return (
    <div className={`flex gap-1 ${className}`}>
      <button onClick={() => flip('music')} aria-pressed={s.music} title={s.music ? 'Music on' : 'Music off'}
        className={`${btn} ${s.music ? 'border-cyan-400/60 bg-slate-950/80 text-cyan-200' : 'border-slate-600 bg-slate-950/80 text-slate-400 line-through'}`}>
        🎵<span className="sr-only">Music</span>
      </button>
      <button onClick={() => flip('sfx')} aria-pressed={s.sfx} title={s.sfx ? 'Sound effects on' : 'Sound effects off'}
        className={`${btn} ${s.sfx ? 'border-cyan-400/60 bg-slate-950/80 text-cyan-200' : 'border-slate-600 bg-slate-950/80 text-slate-400'}`}>
        {s.sfx ? '🔊' : '🔇'}<span className="sr-only">Sound effects</span>
      </button>
    </div>
  )
}
