// All live NASA API calls live here. Every call has a timeout and falls back to
// src/data/nasaSnapshot.json (refresh it with `npm run fetch-data`), so the game never breaks.
import snapshot from '../data/nasaSnapshot.json' with { type: 'json' }

const KEY = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_NASA_API_KEY) || 'DEMO_KEY'
const TIMEOUT = 6000
// The /api/* proxy only exists on the dev server (vite.config.js). On GitHub Pages we use the snapshot,
// which the deploy workflow refreshes from NASA every 6 hours.
const HAS_PROXY = typeof import.meta !== 'undefined' && !!import.meta.env?.DEV
const day = (offset) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10)

async function getJson(url, timeout = TIMEOUT) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeout) })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.json()
}

// Flare class like "X1.2" from a DONKI notification text.
export const classFromText = (text) => text?.match(/\b([CMX]\d+(?:\.\d+)?)\b/)?.[1] ?? null

const tryAll = async (sources) => {
  for (const get of sources) {
    try {
      const list = await get()
      if (Array.isArray(list) && list.length) return list
    } catch { /* next source */ }
  }
  return null
}

// Keep only the fields the game uses (same shape live and in the snapshot).
export const slimFlare = (f) => ({
  classType: f.classType, peakTime: f.peakTime,
  sourceLocation: f.activeRegionNum ? `Active Region ${f.activeRegionNum}` : f.sourceLocation || '',
})
export const slimCme = (c) => {
  const a = c.cmeAnalyses?.find((x) => x.isMostAccurate) ?? c.cmeAnalyses?.[0]
  return a?.speed ? { id: c.activityID, startTime: c.startTime, speed: Math.round(a.speed) } : null
}
export const slimStorm = (g) => ({
  id: g.gstID, startTime: g.startTime,
  kp: Math.max(...(g.allKpIndex ?? []).map((k) => k.kpIndex), 0),
})

/** Live DONKI space weather: { flares, cmes, storms, live: {flares, cmes, storms} }. Falls back per type to the snapshot. */
export async function fetchSpaceWeather() {
  const range = `startDate=${day(-30)}&endDate=${day(0)}`
  const api = (type) => getJson(`https://api.nasa.gov/DONKI/${type}?${range}&api_key=${KEY}`)
  const [flares, cmes, storms] = await Promise.all([
    tryAll([
      async () => (await api('FLR')).map(slimFlare),
      async () => HAS_PROXY ? (await getJson(`/api/ccmc/DONKI/WS/get/FLR?${range}`)).map(slimFlare) : [], // dev proxy
      async () => (await getJson(`https://api.nasa.gov/DONKI/notifications?${range}&type=FLR&api_key=${KEY}`))
        .map((n) => ({ classType: classFromText(n.messageBody), peakTime: n.messageIssueTime, sourceLocation: '' })),
    ]).then((l) => l?.filter((f) => f.classType && f.peakTime)),
    tryAll([async () => (await api('CME')).map(slimCme).filter(Boolean)]),
    tryAll([async () => (await api('GST')).map(slimStorm).filter((g) => g.kp > 0)]),
  ])
  return {
    flares: flares?.length ? flares : snapshot.flares,
    cmes: cmes?.length ? cmes : snapshot.cmes ?? [],
    storms: storms?.length ? storms : snapshot.storms ?? [],
    live: { flares: !!flares?.length, cmes: !!cmes?.length, storms: !!storms?.length },
  }
}

const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' })

// Turn real DONKI records into game events. Stronger event = bigger hit.
export function flareToEvent(f, live, planet = 'moon') {
  const hit = f.classType.startsWith('X') ? 30 : f.classType.startsWith('M') ? 20 : 10
  return {
    id: 'donki_flare', planet, live,
    title: `${live ? 'LIVE' : 'Real'} DONKI Alert: Class ${f.classType} Solar Flare`,
    description: `NASA recorded a class ${f.classType} solar flare on ${fmtDate(f.peakTime)}${f.sourceLocation ? ` from ${f.sourceLocation}` : ''}. Imagine it is heading for your outpost!`,
    nasa_source: `NASA DONKI${live ? ' (live feed)' : ' (archived event)'}`,
    nasa_fact: 'Flares are ranked A, B, C, M and X. Each letter is 10 times stronger than the one before, so an X flare is 10 times stronger than an M flare!',
    choices: [
      { text: 'Power up the shield generator', effects: { shielding: 10, power: -hit / 2 }, feedback: 'Shields up! The crew is safe.' },
      { text: 'Ignore it and keep working', effects: { shielding: -hit, science: 10 }, feedback: 'You studied the flare, but radiation got through.' },
    ],
  }
}

export function cmeToEvent(c, live, planet = 'moon') {
  const fast = c.speed >= 1000
  const hit = fast ? 25 : 15
  return {
    id: 'donki_cme', planet, live,
    title: `${live ? 'LIVE' : 'Real'} DONKI Alert: Solar Eruption at ${c.speed.toLocaleString()} km/s`,
    description: `On ${fmtDate(c.startTime)} the Sun threw out a huge cloud of hot gas (a CME) at ${c.speed.toLocaleString()} km per second. ${fast ? 'That is super fast!' : 'It is on its way.'}`,
    nasa_source: `NASA DONKI – Coronal Mass Ejections${live ? ' (live feed)' : ''}`,
    nasa_fact: `A coronal mass ejection can carry billions of tons of material. At ${c.speed.toLocaleString()} km/s it would cross the 150 million km to Earth in about ${Math.round(150e6 / c.speed / 3600)} hours.`,
    choices: [
      { text: 'Reinforce the shield dome', effects: { shielding: 10, power: fast ? -20 : -10 }, feedback: 'The dome held strong, but the generators ran hot.' },
      { text: 'Measure the cloud with the science lab', effects: { shielding: -hit, science: 15 }, feedback: 'Amazing measurements, but the base got hit hard.' },
    ],
  }
}

export function stormToEvent(g, live, planet = 'moon') {
  const severe = g.kp >= 7
  return {
    id: 'donki_gst', planet, live,
    title: `${live ? 'LIVE' : 'Real'} DONKI Alert: Geomagnetic Storm Kp ${g.kp}`,
    description: `On ${fmtDate(g.startTime)} Earth was hit by a geomagnetic storm (Kp ${g.kp}). Radio contact with Mission Control is crackling!`,
    nasa_source: `NASA DONKI – Geomagnetic Storms${live ? ' (live feed)' : ''}`,
    nasa_fact: 'The Kp index goes from 0 to 9. Kp 5 or more is a storm: it makes beautiful auroras but can disturb radio, GPS and satellites.',
    choices: [
      { text: 'Boost the antenna with extra power', effects: { power: severe ? -20 : -10, science: 5 }, feedback: 'You kept contact with Earth and sent your data home.' },
      { text: 'Wait until the storm passes', effects: { science: -10, oxygen: -5 }, feedback: 'A quiet day with no help from Earth.' },
    ],
  }
}

// Which OSDR search term goes with which health event.
export const OSDR_TERMS = {
  bone_loss: 'bone loss',
  muscle: 'muscle atrophy',
  sleep: 'sleep',
  moon_plants: 'Arabidopsis',
  mars_muscle_loss: 'muscle atrophy',
  mars_sleep_shift: 'circadian',
  mars_isolation_stress: 'behavior',
  mars_radiation_walk: 'radiation',
}
export const osdrTermFor = (event) => OSDR_TERMS[event?.id] ?? (event?.nasa_source?.includes('OSDR') ? 'spaceflight' : null)

export const toStudy = (src) => ({
  id: src.Accession,
  title: src['Study Title'],
  mission: src.Mission?.Name || src['Project Title'] || '',
  organism: src.organism || '',
  url: `https://osdr.nasa.gov/bio/repo/data/studies/${src.Accession}`,
})

const cache = {}
/** A real OSDR study for a search term. Returns { study, source: 'live' | 'snapshot', updated? } or null. */
export async function fetchOsdrStudy(term) {
  if (!term) return null
  if (HAS_PROXY) try {
    cache[term] ??= getJson(`/api/osdr/osdr/data/search?term=${encodeURIComponent(term)}&type=cgene&size=10`, 12000)
      .then((d) => d.hits.hits.map((h) => toStudy(h._source)).filter((s) => s.id && s.title))
    const studies = await cache[term]
    if (studies.length) return { study: studies[Math.floor(Math.random() * studies.length)], source: 'live' }
  } catch { delete cache[term] }
  const saved = snapshot.osdr[term]
  return saved?.length ? { study: saved[Math.floor(Math.random() * saved.length)], source: 'snapshot', updated: snapshot.fetchedAt } : null
}
