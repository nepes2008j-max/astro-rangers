import { create } from 'zustand'
import { nasaEvents } from '../data/nasaEvents.js'
import { marsEvents } from '../data/marsEvents.js'
import { fetchSpaceWeather, flareToEvent, cmeToEvent, stormToEvent } from '../lib/nasa.js'
import { MISSIONS, missionById, starsFor } from '../data/missions.js'

const VITAL = ['power', 'oxygen', 'shielding'] // hitting 0 on any of these = game over

const clamp = (n) => Math.max(0, Math.min(100, n))

export function applyEffects(res, effects = {}) {
  const out = { ...res }
  for (const [k, v] of Object.entries(effects)) out[k] = clamp(out[k] + v)
  return out
}

export const isDead = (res) => VITAL.some((k) => res[k] <= 0)

/** Harder missions make every cost hurt more: negative effects × harm, rounded to 5. */
export const scaleEffects = (effects, harm = 1) =>
  Object.fromEntries(Object.entries(effects).map(([k, v]) => [k, v < 0 ? -Math.max(5, Math.round((-v * harm) / 5) * 5) : v]))

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5) // ponytail: biased shuffle, fine for 10 cards

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

// Real DONKI records -> up to 3 space-weather cards (latest flare, a CME, a storm).
export function spaceWeatherEvents(sw, planet) {
  if (!sw) return []
  const out = []
  if (sw.flares.length) out.push(flareToEvent(sw.flares.at(-1), sw.live.flares, planet))
  if (sw.cmes.length) out.push(cmeToEvent(pick(sw.cmes), sw.live.cmes, planet))
  if (sw.storms.length) out.push(stormToEvent(pick(sw.storms), sw.live.storms, planet))
  return out
}

// One card per Sol: real space weather at Sol 1, 4, 7 (as many as the mission asks for),
// content events fill the rest. Long missions reshuffle the content pool.
export function buildDeck(mission, sw) {
  const pool = (mission.planet === 'mars' ? marsEvents : nasaEvents).filter((e) => e.planet === mission.planet)
  const live = spaceWeatherEvents(sw, mission.planet).slice(0, mission.weather)
  const generic = live.length ? pool.filter((e) => !/flare|storm|sep_/.test(e.id)) : pool
  const deck = []
  while (deck.length < mission.sols - live.length) {
    const round = shuffle(generic)
    if (round[0] === deck.at(-1)) round.push(round.shift()) // no same card twice in a row
    deck.push(...round)
  }
  deck.length = mission.sols - live.length
  live.forEach((e, i) => deck.splice(Math.min(i * 3, deck.length), 0, e))
  return deck
}

const load = () => {
  try { return JSON.parse(localStorage.getItem('astro-rangers')) ?? {} } catch { return {} }
}
const save = (data) => {
  try { localStorage.setItem('astro-rangers', JSON.stringify(data)) } catch { /* private mode */ }
}

export const useGameStore = create((set, get) => ({
  screen: 'welcome', // welcome | map | game | end
  mission: MISSIONS[0],
  planet: 'moon',
  res: { ...MISSIONS[0].start, science: 0 },
  sol: 1,
  deck: [],
  event: null,
  fact: null, // { feedback, fact, source } shown after a choice
  log: [],
  result: null, // 'victory' | 'gameover'
  earned: 0, // stars from the last win
  spaceWeather: null, // { flares, cmes, storms, live }
  progress: load().progress ?? {}, // { [missionId]: best stars }

  go: (screen) => set({ screen }),

  loadSpaceWeather: async () => set({ spaceWeather: await fetchSpaceWeather() }),

  isUnlocked: (id) => id === 1 || (get().progress[id - 1] ?? 0) > 0,

  startMission: (id = get().mission.id) => {
    const mission = missionById(id)
    const deck = buildDeck(mission, get().spaceWeather)
    set({ screen: 'game', mission, planet: mission.planet, res: { ...mission.start, science: 0 }, sol: 1, deck, event: deck[0], fact: null, log: [], result: null })
  },

  choose: (choice) => {
    const { res, event, sol, log, mission } = get()
    set({
      res: applyEffects(res, scaleEffects(choice.effects, mission.harm)),
      fact: { feedback: choice.feedback, fact: event.nasa_fact, source: event.nasa_source },
      log: [`Sol ${sol}: ${choice.text}`, ...log],
    })
  },

  nextSol: () => {
    const { res, sol, deck, mission, progress } = get()
    let next = res
    if (!isDead(next)) next = applyEffects(next, { power: -mission.drain.power, oxygen: -mission.drain.oxygen })
    if (isDead(next)) return set({ res: next, fact: null, result: 'gameover', screen: 'end' })
    if (sol >= mission.sols) {
      const earned = starsFor(next.science)
      const best = { ...progress, [mission.id]: Math.max(progress[mission.id] ?? 0, earned) }
      save({ progress: best })
      return set({ res: next, fact: null, result: 'victory', screen: 'end', progress: best, earned })
    }
    set({ res: next, fact: null, sol: sol + 1, event: deck[sol] })
  },
}))
