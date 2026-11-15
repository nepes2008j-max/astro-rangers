// Run: npm run check — rules + plays every mission 1000x with a careful and a random player.
import assert from 'node:assert'
import { useGameStore as s, applyEffects, isDead, scaleEffects, buildDeck, makeSamples, RESCUE_COST } from './src/store/useGameStore.js'
import { MISSIONS, starsFor } from './src/data/missions.js'
import { creditsFor, SUITS } from './src/data/suits.js'
import snap from './src/data/nasaSnapshot.json' with { type: 'json' }

// --- rules ---
assert.deepEqual(applyEffects({ power: 95 }, { power: 20 }), { power: 100 }, 'clamps at 100')
assert.deepEqual(applyEffects({ power: 5 }, { power: -20 }), { power: 0 }, 'clamps at 0')
assert.ok(isDead({ power: 0, oxygen: 50, shielding: 50 }))
assert.ok(!isDead({ power: 1, oxygen: 1, shielding: 1, science: 0 }), 'science 0 is not death')
assert.deepEqual(scaleEffects({ power: -10, science: 10 }, 1.5), { power: -15, science: 10 }, 'harm only scales costs')
assert.deepEqual(scaleEffects({ power: -5 }, 0.5), { power: -5 }, 'a cost never drops below 5')
assert.deepEqual([0, 30, 60].map(starsFor), [1, 2, 3])

// --- decks: right length, real space weather first, integer effects ---
const sw = { flares: snap.flares, cmes: [{ id: 'x', startTime: '2026-10-15T20:24Z', speed: 1200 }], storms: snap.storms, live: { flares: false, cmes: true, storms: false } }
s.setState({ spaceWeather: sw })
for (const m of MISSIONS) {
  const deck = buildDeck(m, sw)
  assert.equal(deck.length, m.sols, `${m.name}: one card per Sol`)
  assert.ok(deck[0].id.startsWith('donki_'), `${m.name}: Sol 1 is real space weather`)
  assert.equal(deck.filter((e) => e.id.startsWith('donki_')).length, Math.min(m.weather, 3), `${m.name}: weather cards`)
  deck.forEach((e, i) => assert.ok(i === 0 || e !== deck[i - 1], `${m.name}: no card twice in a row`))
  for (const e of deck) for (const c of e.choices) for (const v of Object.values(c.effects)) assert.ok(Number.isInteger(v), `${e.id} integer effects`)
}

// --- play ---
function play(id, pick, collect = true) {
  s.getState().startMission(id)
  if (collect) s.getState().samples.forEach((x) => s.getState().collectSample(x.id)) // the walking part is the player's skill
  while (s.getState().screen === 'game') {
    const { event, res, mission } = s.getState()
    s.getState().choose(pick(event.choices, res, mission))
    s.getState().nextSol()
  }
  return s.getState()
}
const random = (cs) => cs[Math.floor(Math.random() * cs.length)]
const smart = (cs, res, m) => cs.reduce((best, c) => { // keep the weakest vital resource as high as possible
  const score = (ch) => { const r = applyEffects(res, scaleEffects(ch.effects, m.harm)); return Math.min(r.power, r.oxygen, r.shielding) + r.science / 10 }
  return score(c) > score(best) ? c : best
})
const rate = (id, pick, n = 1000) => { let w = 0; for (let i = 0; i < n; i++) if (play(id, pick).result === 'victory') w++; return w / n }

const rows = MISSIONS.map((m) => ({ m, careful: rate(m.id, smart), random: rate(m.id, random) }))
for (const { m, careful, random: r } of rows) console.log(`${String(m.id).padStart(2)}. ${m.name.padEnd(22)} careful ${(careful * 100).toFixed(0).padStart(3)}%   random ${(r * 100).toFixed(0).padStart(3)}%`)

// The last mission on Mars and Europa is a hard 'boss' level; every other mission must be comfortably winnable.
const finals = new Set(['mars', 'europa'].map((p) => MISSIONS.filter((m) => m.planet === p).at(-1).id))
for (const { m, careful } of rows) assert.ok(careful >= (finals.has(m.id) ? 0.5 : 0.85), `${m.name}: a careful player must be able to win`)
assert.ok(rows[0].random > 0.6, 'mission 1 is friendly even for random clicking')
assert.ok(rows.at(-1).random < 0.05, 'the final mission is really hard for random clicking')
// Difficulty rises within each planet (small tolerance for randomness).
for (const planet of ['moon', 'mars', 'europa']) {
  const r = rows.filter((x) => x.m.planet === planet).map((x) => x.random)
  r.forEach((v, i) => assert.ok(i === 0 || v <= r[i - 1] + 0.05, `${planet}: mission ${i + 1} should not be easier than the one before`))
}

// --- progress ---
s.setState({ progress: {} })
assert.ok(s.getState().isUnlocked(1) && !s.getState().isUnlocked(2), 'only mission 1 starts unlocked')
play(1, smart)
assert.ok(s.getState().progress[1] >= 1 && s.getState().isUnlocked(2), 'winning unlocks the next mission')
// --- objectives & suit oxygen ---
for (const m of MISSIONS) {
  const sm = makeSamples(m)
  assert.equal(sm.length, m.samples, `${m.name}: sample count`)
  sm.forEach((x) => { const d = Math.hypot(x.x, x.z); assert.ok(d >= m.sampleDist[0] - 0.01 && d <= m.sampleDist[1] + 0.01, `${m.name}: sample distance`) })
}
assert.equal(play(3, smart, false).reason, 'objective', 'surviving without the samples fails the mission')
s.getState().startMission(3)
const o2 = s.getState().res.oxygen
s.getState().suitEmpty()
assert.equal(s.getState().res.oxygen, o2 - RESCUE_COST, 'a rescue costs base oxygen')
assert.equal(s.getState().suitO2, 100, 'the rescued astronaut gets a full tank')
s.getState().collectSample(0); const sci = s.getState().res.science; s.getState().collectSample(0)
assert.equal(s.getState().res.science, sci, 'a sample can only be collected once')

// --- shop ---
assert.equal(creditsFor({ won: false }), 5, 'a loss still pays a little')
assert.equal(creditsFor({ won: true, stars: 3, firstWin: true }), 60, 'first 3-star win pays most')
assert.equal(creditsFor({ won: true, stars: 1 }), 20)
s.setState({ credits: 50, ownedSuits: ['white'], suit: 'white' })
assert.ok(!s.getState().buySuit('gold'), 'cannot buy what you cannot afford')
assert.equal(s.getState().credits, 50, 'failed purchase costs nothing')
assert.ok(s.getState().buySuit('orange') && s.getState().suit === 'orange' && s.getState().credits === 10, 'buying deducts and equips')
assert.ok(s.getState().buySuit('white') && s.getState().credits === 10, 'equipping an owned suit is free')
assert.ok(SUITS[0].price === 0, 'the starting suit is free')
s.setState({ credits: 0, progress: {} })
play(1, smart)
assert.equal(s.getState().credits, s.getState().gained, 'winning a mission adds credits')
assert.ok(s.getState().gained >= 40, 'a first win includes the bonus')

// --- pause / exit ---
s.getState().startMission(2)
assert.ok(s.getState().briefing, 'every level opens with a briefing')
s.getState().beginPlay()
const before = { credits: s.getState().credits, progress: { ...s.getState().progress } }
s.getState().setPaused(true)
s.getState().exitToMap()
assert.equal(s.getState().screen, 'map', 'exit goes back to the level map')
assert.ok(!s.getState().paused, 'exit closes the pause menu')
assert.equal(s.getState().credits, before.credits, 'exiting gives no credits')
assert.deepEqual(s.getState().progress, before.progress, 'exiting keeps earlier stars')

// --- teacher mode: every fact the game can show is in the catalog, and seeing it records it ---
const { FACTS } = await import('./src/lib/facts.js')
const { nasaEvents } = await import('./src/data/nasaEvents.js')
const { marsEvents } = await import('./src/data/marsEvents.js')
const { europaEvents } = await import('./src/data/europaEvents.js')
const keys = new Set(FACTS.map((f) => f.key))
for (const e of [...nasaEvents, ...marsEvents, ...europaEvents]) assert.ok(keys.has(e.id), `${e.id} is in the teacher catalog`)
for (const k of ['donki_flare', 'donki_cme', 'donki_gst']) assert.ok(keys.has(k), `${k} is in the teacher catalog`)
s.getState().resetProgress()
assert.deepEqual(s.getState().learned, {}, 'reset clears learned facts')
assert.equal(s.getState().credits, 0, 'reset clears credits')
s.getState().startMission(1); s.getState().beginPlay()
const ev = s.getState().event
s.getState().choose(ev.choices[0])
assert.equal(s.getState().learned[ev.id]?.count, 1, 'making a choice records its fact')
const sm = s.getState().samples[0]
s.getState().collectSample(sm.id)
assert.ok(s.getState().learned[`sample:${sm.name}`], 'collecting a sample records its fact')
assert.ok([...Object.keys(s.getState().learned)].every((k) => keys.has(k)), 'every recorded fact exists in the catalog')
console.log('all checks passed')
