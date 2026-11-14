// Run: node check.mjs  — plays the real store 2000x to check rules + balance.
import assert from 'node:assert'
import { useGameStore as s, applyEffects, isDead, SOLS_TO_WIN, buildDeck } from './src/store/useGameStore.js'
import snap from './src/data/nasaSnapshot.json' with { type: 'json' }

const sw = { flares: snap.flares, cmes: [{ id: 'x', startTime: '2026-10-15T20:24Z', speed: 1200 }], storms: snap.storms, live: { flares: false, cmes: true, storms: false } }
for (const planet of ['moon', 'mars']) {
  const deck = buildDeck(planet, sw)
  assert.equal(deck.length, SOLS_TO_WIN, `${planet} deck has 10 cards`)
  assert.equal(new Set(deck.map((e) => e.id)).size, SOLS_TO_WIN, `${planet} deck has no duplicates`)
  assert.equal(deck[0].id.startsWith('donki_'), true, 'Sol 1 is real space weather')
  for (const e of deck) for (const c of e.choices) for (const v of Object.values(c.effects)) assert.ok(Number.isInteger(v), `${e.id} integer effects`)
}

assert.deepEqual(applyEffects({ power: 95 }, { power: 20 }), { power: 100 }, 'clamps at 100')
assert.deepEqual(applyEffects({ power: 5 }, { power: -20 }), { power: 0 }, 'clamps at 0')
assert.ok(isDead({ power: 0, oxygen: 50, shielding: 50 }))
assert.ok(!isDead({ power: 1, oxygen: 1, shielding: 1, science: 0 }), 'science 0 is not death')

function play(pick, planet = 'moon') {
  s.getState().startMission(planet)
  while (s.getState().screen === 'game') {
    const { event, res } = s.getState()
    s.getState().choose(pick(event.choices, res))
    s.getState().nextSol()
  }
  return s.getState()
}

const random = (cs) => cs[Math.floor(Math.random() * cs.length)]
const smart = (cs, res) => // keep the weakest vital resource as high as possible
  cs.reduce((best, c) => {
    const score = (r) => Math.min(r.power, r.oxygen, r.shielding) + r.science / 10
    return score(applyEffects(res, c.effects)) > score(applyEffects(res, best.effects)) ? c : best
  })

const rate = (pick, planet) => {
  let wins = 0
  for (let i = 0; i < 1000; i++) if (play(pick, planet).result === 'victory') wins++
  return wins / 1000
}

s.setState({ spaceWeather: sw })
for (const planet of ['moon', 'mars']) {
  const r = rate(random, planet), m = rate(smart, planet)
  console.log(`${planet}: win rate random clicks ${(r * 100).toFixed(0)}%, smart player ${(m * 100).toFixed(0)}%`)
  assert.ok(m > 0.9, `${planet}: a careful player should almost always win`)
  assert.ok(r < 0.8, `${planet}: random clicking should not reliably win (trade-offs must matter)`)
}
assert.equal(play(smart).sol, SOLS_TO_WIN)
assert.ok(s.getState().marsUnlocked, 'victory unlocks Mars')
console.log('all checks passed')
