// Where each choice happens in the 3D base. Pure data + logic (no three.js) so the HUD and tests can use it.
export const STATIONS = {
  shield: { name: 'Shield Generator', icon: '🛡️', pos: [-11, 6] },
  solar: { name: 'Solar Array', icon: '⚡', pos: [14, -4], padDist: 6 },
  greenhouse: { name: 'Greenhouse', icon: '🌱', pos: [-12, -11] },
  lab: { name: 'Science Lab', icon: '🔬', pos: [11, 11] },
  comms: { name: 'Comms Tower', icon: '📡', pos: [1, -17] },
  habitat: { name: 'Habitat', icon: '🏠', pos: [0, 0] },
}
const FALLBACK = ['habitat', 'comms', 'lab', 'greenhouse', 'solar', 'shield']

const KEYWORDS = [
  ['shield', /shield|shelter|radiation|dome|hide|patch/i],
  ['solar', /solar|power|battery|batteries|panel|energy|recharge/i],
  ['greenhouse', /plant|seed|greenhouse|oxygen|filter|ice|moxie|air/i],
  ['comms', /antenna|radio|contact|signal|earth|message|call/i],
  ['lab', /lab|study|experiment|measure|science|sample|research|data|scout|helicopter/i],
  ['habitat', /rest|sleep|exercise|treadmill|wait|inside|crew|seal|skip|ignore|team|clean|wipe|habitat|lights|schedule|push/i],
]
const BY_EFFECT = { shielding: 'shield', power: 'solar', oxygen: 'greenhouse', science: 'lab' }

/** Stations that fit a choice, best first: keyword match, then by its biggest effects, then anything. */
export function stationsFor(choice) {
  const byKeyword = KEYWORDS.filter(([, re]) => re.test(choice.text)).map(([id]) => id)
  const byEffect = Object.entries(choice.effects).sort((a, b) => b[1] - a[1]).map(([k]) => BY_EFFECT[k])
  return [...new Set([...byKeyword, ...byEffect, ...FALLBACK])]
}

/** One distinct station per choice (a clash moves to that choice's next-best station). */
export function assignStations(choices) {
  const used = new Set()
  return choices.map((c) => {
    const id = stationsFor(c).find((s) => !used.has(s))
    used.add(id)
    return id
  })
}

/** Pad sits in front of the station (padDist, default 3.5), toward the habitat. Returns [x, z]. */
export function padFor(stationId) {
  const [x, z] = STATIONS[stationId].pos
  if (stationId === 'habitat') return [0, 7.5] // in front of the dome's airlock
  const d = Math.hypot(x, z)
  const k = STATIONS[stationId].padDist ?? 3.5
  return [x - (x / d) * k, z - (z / d) * k]
}
