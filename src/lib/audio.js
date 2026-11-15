// All sound is synthesized with the Web Audio API: no audio files, nothing to download or license.
// connectAudio(store) listens to game state and plays the right sounds, so game logic stays sound-free.
// Everything is a no-op outside the browser (e.g. in `npm run check`).

const KEY = 'astro-audio'
const settings = (() => {
  try { return { music: true, sfx: true, ...JSON.parse(localStorage.getItem(KEY)) } } catch { return { music: true, sfx: true } }
})()
const saveSettings = () => { try { localStorage.setItem(KEY, JSON.stringify(settings)) } catch { /* private mode */ } }

let ctx = null, master, musicBus, sfxBus, echo
const now = () => ctx.currentTime

/** Create the audio graph on the first user gesture (browsers block sound before that). */
function ensure() {
  if (ctx || typeof window === 'undefined' || !window.AudioContext) return !!ctx
  ctx = new AudioContext()
  master = ctx.createGain(); master.gain.value = 0.8
  const comp = ctx.createDynamicsCompressor()
  master.connect(comp).connect(ctx.destination)
  musicBus = ctx.createGain(); musicBus.gain.value = settings.music ? 0.55 : 0
  sfxBus = ctx.createGain(); sfxBus.gain.value = settings.sfx ? 0.9 : 0
  musicBus.connect(master); sfxBus.connect(master)
  // Spacey echo for music sparkles.
  echo = ctx.createDelay(1.5); echo.delayTime.value = 0.42
  const fb = ctx.createGain(); fb.gain.value = 0.38
  echo.connect(fb).connect(echo); echo.connect(musicBus)
  return true
}

// ---------- building blocks ----------
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12)

function tone({ freq, type = 'sine', at = 0, dur = 0.2, vol = 0.3, slide, bus = sfxBus, attack = 0.005 }) {
  const t = now() + at
  const o = ctx.createOscillator(), g = ctx.createGain()
  o.type = type; o.frequency.setValueAtTime(freq, t)
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(bus)
  o.start(t); o.stop(t + dur + 0.05)
}

let noiseBuf = null
function noise({ at = 0, dur = 0.15, vol = 0.2, filter = 'lowpass', freq = 800, q = 0.7 }) {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  const t = now() + at
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain()
  src.buffer = noiseBuf; f.type = filter; f.frequency.value = freq; f.Q.value = q
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f).connect(g).connect(sfxBus)
  src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05)
}

// ---------- sound effects ----------
const SFX = {
  click: () => tone({ freq: 880, type: 'triangle', dur: 0.06, vol: 0.12 }),
  choose: () => { tone({ freq: hz(72), dur: 0.18, vol: 0.22 }); tone({ freq: hz(79), at: 0.09, dur: 0.3, vol: 0.22 }) },
  sample: () => [76, 79, 83, 88].forEach((m, i) => tone({ freq: hz(m), type: 'triangle', at: i * 0.07, dur: 0.35, vol: 0.18 })),
  sol: () => noise({ dur: 0.9, vol: 0.12, filter: 'bandpass', freq: 500, q: 0.6 }),
  step: (planet) => noise({ dur: 0.09, vol: planet === 'mars' ? 0.12 : 0.07, freq: planet === 'europa' ? 2400 : 380 }), // muffled: no air on the Moon, you only hear it through your suit
  refill: () => tone({ freq: 500, slide: 900, type: 'sine', dur: 0.25, vol: 0.1 }),
  alarm: () => { tone({ freq: 880, type: 'square', dur: 0.12, vol: 0.08 }); tone({ freq: 660, type: 'square', at: 0.15, dur: 0.12, vol: 0.08 }) },
  rescue: () => [0, 0.35, 0.7].forEach((at) => tone({ freq: 900, slide: 400, type: 'sawtooth', at, dur: 0.32, vol: 0.09 })),
  geiger: () => { for (let i = 0; i < 18; i++) noise({ at: Math.random() * 1.6, dur: 0.012, vol: 0.25, filter: 'highpass', freq: 3000 }) },
  buy: () => [84, 88, 91].forEach((m, i) => tone({ freq: hz(m), at: i * 0.06, dur: 0.2, vol: 0.15 })),
  win: () => [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => tone({ freq: hz(m), type: 'triangle', at: i * 0.11, dur: i === 6 ? 1.2 : 0.3, vol: 0.2 })),
  lose: () => [64, 60, 57, 52].forEach((m, i) => tone({ freq: hz(m), type: 'sawtooth', at: i * 0.28, dur: 0.45, vol: 0.09 })),
}

export function sfx(name, arg) {
  if (!settings.sfx || !ensure() || ctx.state !== 'running') return
  SFX[name]?.(arg)
}

// ---------- generative ambient music ----------
// Each mood: root note, chord progression (semitones), sparkle scale, filter brightness.
const MOODS = {
  menu: { root: 48, chords: [[0, 7, 16], [5, 12, 21], [9, 16, 24], [7, 14, 23]], scale: [0, 2, 4, 7, 9], bright: 900 },
  moon: { root: 45, chords: [[0, 7, 15], [-4, 3, 12], [-2, 5, 14], [-5, 2, 10]], scale: [0, 3, 5, 7, 10], bright: 700 }, // calm, airless
  mars: { root: 38, chords: [[0, 7, 14], [3, 10, 17], [-2, 5, 12], [0, 5, 15]], scale: [0, 2, 3, 7, 9], bright: 480 }, // low and dusty
  europa: { root: 52, chords: [[0, 7, 18], [2, 9, 16], [4, 11, 18], [-1, 6, 14]], scale: [0, 2, 4, 6, 11], bright: 1300 }, // icy shimmer
}
let music = null // { mood, nodes, timers, bus }

function stopMusic() {
  if (!music) return
  const m = music
  music = null
  m.timers.forEach(clearInterval)
  m.bus.gain.setTargetAtTime(0.0001, now(), 0.8)
  setTimeout(() => m.nodes.forEach((n) => { try { n.stop() } catch { /* already stopped */ } }), 3000)
}

export function playMusic(moodName) {
  if (!ensure()) return
  if (music?.mood === moodName) return
  stopMusic()
  const mood = MOODS[moodName] ?? MOODS.menu
  const bus = ctx.createGain(); bus.gain.value = 0.0001
  bus.connect(musicBus)
  bus.gain.setTargetAtTime(1, now(), 2) // slow fade in
  const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = mood.bright; filter.Q.value = 0.8
  filter.connect(bus)
  const lfo = ctx.createOscillator(), lfoAmt = ctx.createGain()
  lfo.frequency.value = 0.06; lfoAmt.gain.value = mood.bright * 0.4
  lfo.connect(lfoAmt).connect(filter.frequency); lfo.start()

  // Pad voices: two detuned saws per chord note.
  const voices = [0, 1, 2].map(() => [-6, 6].map((cents) => {
    const o = ctx.createOscillator(), g = ctx.createGain()
    o.type = 'sawtooth'; o.detune.value = cents; g.gain.value = 0.035
    o.connect(g).connect(filter); o.start()
    return o
  }))
  let chord = 0
  const setChord = () => {
    mood.chords[chord % mood.chords.length].forEach((st, i) => voices[i].forEach((o) => o.frequency.setTargetAtTime(hz(mood.root + st), now(), 1.2)))
    chord++
  }
  setChord()
  const sparkle = () => {
    if (Math.random() < 0.35) return
    const st = mood.scale[Math.floor(Math.random() * mood.scale.length)] + 24 + (Math.random() < 0.3 ? 12 : 0)
    const t = now(), o = ctx.createOscillator(), g = ctx.createGain()
    o.type = 'sine'; o.frequency.value = hz(mood.root + st)
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.5)
    o.connect(g); g.connect(bus); g.connect(echo)
    o.start(t); o.stop(t + 2.6)
  }
  music = { mood: moodName, bus, nodes: [lfo, ...voices.flat()], timers: [setInterval(setChord, 8000), setInterval(sparkle, 1400)] }
}

function duck(on) { if (music) music.bus.gain.setTargetAtTime(on ? 0.25 : 1, now(), 0.4) }

// ---------- settings ----------
export const getAudioSettings = () => ({ ...settings })
export function setAudio(kind, on) {
  settings[kind] = on
  saveSettings()
  if (!ensure()) return
  const bus = kind === 'music' ? musicBus : sfxBus
  bus.gain.setTargetAtTime(on ? (kind === 'music' ? 0.55 : 0.9) : 0, now(), 0.1)
}

// ---------- wiring to game state ----------
const isRadiation = (e) => /flare|cme|gst|sep_|storm|radiation/.test(e?.id ?? '')

export function connectAudio(store) {
  if (typeof window === 'undefined') return () => {}
  const moodNow = () => { const s = store.getState(); return s.screen === 'game' ? s.planet : 'menu' }
  const unlock = () => {
    if (!ensure()) return
    if (ctx.state !== 'running') ctx.resume().then(() => playMusic(moodNow()))
    else playMusic(moodNow())
  }
  const onClick = (e) => { unlock(); if (e.target.closest?.('button')) sfx('click') }
  const onVis = () => { // silence the game when its tab is hidden
    if (!ctx) return
    if (document.hidden) ctx.suspend()
    else ctx.resume()
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
  window.addEventListener('click', onClick)
  document.addEventListener('visibilitychange', onVis)

  let lastAlarm = 0, lastRefill = 0
  const unsub = store.subscribe((s, p) => {
    // Music follows the screen and world.
    if (ctx && ctx.state === 'running') playMusic(moodNow())
    if (s.paused !== p.paused || s.briefing !== p.briefing) duck(s.paused || s.briefing)

    if (s.fact && !p.fact) sfx('choose')
    if (s.sol > p.sol && s.screen === 'game') sfx('sol')
    if (s.event !== p.event && s.screen === 'game' && isRadiation(s.event)) sfx('geiger')
    const got = (x) => x.samples.filter((m) => m.collected).length
    if (got(s) > got(p)) sfx('sample')
    if (s.respawn > p.respawn) sfx('rescue')
    if (s.ownedSuits.length > p.ownedSuits.length) sfx('buy')
    if (s.screen === 'end' && p.screen !== 'end') sfx(s.result === 'victory' ? 'win' : 'lose')

    const t = performance.now()
    if (s.screen === 'game' && s.suitO2 < 30 && s.suitO2 !== p.suitO2 && t - lastAlarm > 2000) { lastAlarm = t; sfx('alarm') }
    if (s.suitO2 > p.suitO2 && s.suitO2 < 100 && t - lastRefill > 350) { lastRefill = t; sfx('refill') }
  })
  return () => {
    unsub()
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
    window.removeEventListener('click', onClick)
    document.removeEventListener('visibilitychange', onVis)
    stopMusic()
  }
}
