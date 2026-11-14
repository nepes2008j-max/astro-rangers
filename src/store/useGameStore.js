import { create } from 'zustand'
import { nasaEvents } from '../data/nasaEvents.js'
import { marsEvents } from '../data/marsEvents.js'
import { europaEvents } from '../data/europaEvents.js'
import { fetchSpaceWeather, flareToEvent, cmeToEvent, stormToEvent } from '../lib/nasa.js'
import { MISSIONS, missionById, starsFor } from '../data/missions.js'
import { SUITS, creditsFor } from '../data/suits.js'
import { SAMPLE_TYPES } from '../data/samples.js'

/** Where the suit refills its oxygen: beside the dome's airlock door. */
export const AIRLOCK = [-2.8, 6.6]
export const RESCUE_COST = 15 // base oxygen used when the crew has to rescue you

/** Sample sites spread around the base in different directions, at the mission's distance. */
export function makeSamples(mission, rand = Math.random) {
  const types = SAMPLE_TYPES[mission.planet]
  const [min, max] = mission.sampleDist
  const offset = rand() * Math.PI * 2
  return Array.from({ length: mission.samples }, (_, i) => {
    let x, z, tries = 0
    do {
      const a = offset + (i / mission.samples) * Math.PI * 2 + (rand() - 0.5) * 0.8
      const d = min + rand() * (max - min)
      x = Math.cos(a) * d; z = Math.sin(a) * d
    } while (++tries < 20 && Math.hypot(x + 20, z - 16) < 5) // keep clear of the lander
    return { id: i, x, z, ...types[i % types.length], collected: false }
  })
}

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
  const pool = { moon: nasaEvents, mars: marsEvents, europa: europaEvents }[mission.planet].filter((e) => e.planet === mission.planet)
  const live = spaceWeatherEvents(sw, mission.planet).slice(0, mission.weather)
  const generic = live.length ? pool.filter((e) => !/flare|storm|sep_/.test(e.id)) : pool // avoid doubling up with real DONKI cards
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
  credits: load().credits ?? 0,
  ownedSuits: load().ownedSuits ?? ['white'],
  suit: load().suit ?? 'white',
  gained: 0, // credits from the last mission
  samples: [], // this mission's sample sites
  suitO2: 100, // the astronaut's own tank (%), separate from the base's oxygen
  toast: null, // { title, text } pop-up after collecting a sample or a rescue
  respawn: 0, // bumps when the astronaut is rescued back to the airlock
  reason: null, // why a mission ended: 'resources' | 'objective'

  collectSample: (id) => {
    const { samples, res, log } = get()
    const sm = samples.find((x) => x.id === id)
    if (!sm || sm.collected) return
    const done = samples.filter((x) => x.collected).length + 1
    set({
      samples: samples.map((x) => (x.id === id ? { ...x, collected: true } : x)),
      res: applyEffects(res, { science: 10 }),
      toast: { title: `${sm.icon} ${sm.name} collected! (${done}/${samples.length})`, text: sm.fact },
      log: [`Collected ${sm.name}`, ...log],
    })
  },

  setSuitO2: (v) => set({ suitO2: Math.max(0, Math.min(100, Math.round(v))) }),

  /** Suit ran dry: the crew drags you back inside, which costs the base oxygen. */
  suitEmpty: () => {
    const { res, log, respawn } = get()
    const next = applyEffects(res, { oxygen: -RESCUE_COST })
    set({
      res: next, suitO2: 100, respawn: respawn + 1, log: ['Rescued: suit oxygen ran out', ...log],
      toast: { title: '🚨 Your suit ran out of oxygen!', text: `The crew rescued you, but the base used ${RESCUE_COST} oxygen. Watch your suit tank and refill at the 🫧 airlock.` },
    })
    if (isDead(next)) get().endMission('gameover', 'resources', next)
  },

  dismissToast: () => set({ toast: null }),

  endMission: (result, reason, next) => {
    const { mission, progress, credits } = get()
    if (result === 'victory') {
      const earned = starsFor(next.science)
      const gained = creditsFor({ won: true, stars: earned, firstWin: !progress[mission.id] })
      set({ res: next, fact: null, result, reason, screen: 'end', earned, gained, credits: credits + gained, progress: { ...progress, [mission.id]: Math.max(progress[mission.id] ?? 0, earned) } })
    } else {
      const gained = creditsFor({ won: false })
      set({ res: next, fact: null, result, reason, screen: 'end', gained, credits: credits + gained })
    }
    get().persist()
  },

  /** Everything that survives a page reload. */
  persist: () => { const { progress, credits, ownedSuits, suit } = get(); save({ progress, credits, ownedSuits, suit }) },

  /** Buy a suit (if affordable) or equip one already owned. Returns true on success. */
  buySuit: (id) => {
    const { ownedSuits, credits } = get()
    const item = SUITS.find((x) => x.id === id)
    if (!item) return false
    if (ownedSuits.includes(id)) { set({ suit: id }); get().persist(); return true }
    if (credits < item.price) return false
    set({ credits: credits - item.price, ownedSuits: [...ownedSuits, id], suit: id })
    get().persist()
    return true
  },

  go: (screen) => set({ screen }),

  loadSpaceWeather: async () => set({ spaceWeather: await fetchSpaceWeather() }),

  isUnlocked: (id) => id === 1 || (get().progress[id - 1] ?? 0) > 0,

  startMission: (id = get().mission.id) => {
    const mission = missionById(id)
    const deck = buildDeck(mission, get().spaceWeather)
    set({ screen: 'game', mission, planet: mission.planet, res: { ...mission.start, science: 0 }, sol: 1, deck, event: deck[0], fact: null, log: [], result: null, reason: null, samples: makeSamples(mission), suitO2: 100, toast: null })
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
    const { res, sol, deck, mission, samples } = get()
    let next = res
    if (!isDead(next)) next = applyEffects(next, { power: -mission.drain.power, oxygen: -mission.drain.oxygen })
    if (isDead(next)) return get().endMission('gameover', 'resources', next)
    if (sol >= mission.sols) {
      const objectiveDone = samples.every((x) => x.collected)
      return get().endMission(objectiveDone ? 'victory' : 'gameover', objectiveDone ? null : 'objective', next)
    }
    set({ res: next, fact: null, sol: sol + 1, event: deck[sol] })
  },
}))
