import { create } from 'zustand'
import { nasaEvents } from '../data/nasaEvents.js'
import { marsEvents } from '../data/marsEvents.js'
import { fetchSpaceWeather, flareToEvent, cmeToEvent, stormToEvent } from '../lib/nasa.js'

export const SOLS_TO_WIN = 10
// Passive cost per Sol. Mars events are harsher, so its base drain is lower (tuned with `npm run check`).
export const DRAINS = { moon: { power: 5, oxygen: 4 }, mars: { power: 2, oxygen: 2 } }
const START = { power: 100, oxygen: 100, shielding: 100, science: 0 }
const VITAL = ['power', 'oxygen', 'shielding'] // hitting 0 on any of these = game over

const clamp = (n) => Math.max(0, Math.min(100, n))

export function applyEffects(res, effects = {}) {
  const out = { ...res }
  for (const [k, v] of Object.entries(effects)) out[k] = clamp(out[k] + v)
  return out
}

export const isDead = (res) => VITAL.some((k) => res[k] <= 0)

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

// 10 cards: real space weather at Sol 1, 4, 7; content events fill the rest.
export function buildDeck(planet, sw) {
  const content = shuffle((planet === 'mars' ? marsEvents : nasaEvents).filter((e) => e.planet === planet))
  const live = spaceWeatherEvents(sw, planet)
  const generic = live.length ? content.filter((e) => !/flare|storm|sep_/.test(e.id)) : content
  const deck = generic.slice(0, SOLS_TO_WIN - live.length)
  live.forEach((e, i) => deck.splice(Math.min(i * 3, deck.length), 0, e))
  return deck.slice(0, SOLS_TO_WIN)
}

const load = () => {
  try { return JSON.parse(localStorage.getItem('astro-rangers')) ?? {} } catch { return {} }
}
const save = (data) => {
  try { localStorage.setItem('astro-rangers', JSON.stringify(data)) } catch { /* private mode */ }
}

export const useGameStore = create((set, get) => ({
  screen: 'welcome', // welcome | map | game | end
  res: START,
  sol: 1,
  deck: [],
  event: null,
  fact: null, // { feedback, fact, source } shown after a choice
  log: [],
  result: null, // 'victory' | 'gameover'
  planet: 'moon',
  spaceWeather: null, // { flares, cmes, storms, live }
  marsUnlocked: !!load().marsUnlocked,
  bestScience: load().bestScience ?? 0,

  go: (screen) => set({ screen }),

  loadSpaceWeather: async () => set({ spaceWeather: await fetchSpaceWeather() }),

  startMission: (planet = get().planet) => {
    const deck = buildDeck(planet, get().spaceWeather)
    set({ screen: 'game', planet, res: START, sol: 1, deck, event: deck[0], fact: null, log: [], result: null })
  },

  choose: (choice) => {
    const { res, event, sol, log } = get()
    set({
      res: applyEffects(res, choice.effects),
      fact: { feedback: choice.feedback, fact: event.nasa_fact, source: event.nasa_source },
      log: [`Sol ${sol}: ${choice.text}`, ...log],
    })
  },

  nextSol: () => {
    const { res, sol, deck, bestScience, planet } = get()
    const DRAIN = DRAINS[planet]
    let next = res
    if (!isDead(next)) next = applyEffects(next, { power: -DRAIN.power, oxygen: -DRAIN.oxygen })
    if (isDead(next)) return set({ res: next, fact: null, result: 'gameover', screen: 'end' })
    if (sol >= SOLS_TO_WIN) {
      const best = Math.max(bestScience, next.science)
      save({ marsUnlocked: true, bestScience: best })
      return set({ res: next, fact: null, result: 'victory', screen: 'end', marsUnlocked: true, bestScience: best })
    }
    set({ res: next, fact: null, sol: sol + 1, event: deck[sol] })
  },
}))
