// Run: npm run check — rules + plays every mission 1000x with a careful and a random player.
import assert from 'node:assert'
import { useGameStore as s, applyEffects, isDead, scaleEffects, buildDeck } from './src/store/useGameStore.js'
import { MISSIONS, starsFor } from './src/data/missions.js'
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
function play(id, pick) {
  s.getState().startMission(id)
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

for (const { m, careful } of rows) assert.ok(careful >= (m.id === 10 ? 0.6 : 0.85), `${m.name}: a careful player must be able to win`)
assert.ok(rows[0].random > 0.6, 'mission 1 is friendly even for random clicking')
assert.ok(rows[9].random < 0.1, 'mission 10 is really hard for random clicking')
// Difficulty rises within each planet (small tolerance for randomness).
for (const planet of ['moon', 'mars']) {
  const r = rows.filter((x) => x.m.planet === planet).map((x) => x.random)
  r.forEach((v, i) => assert.ok(i === 0 || v <= r[i - 1] + 0.05, `${planet}: mission ${i + 1} should not be easier than the one before`))
}

// --- progress ---
s.setState({ progress: {} })
assert.ok(s.getState().isUnlocked(1) && !s.getState().isUnlocked(2), 'only mission 1 starts unlocked')
play(1, smart)
assert.ok(s.getState().progress[1] >= 1 && s.getState().isUnlocked(2), 'winning unlocks the next mission')
console.log('all checks passed')
