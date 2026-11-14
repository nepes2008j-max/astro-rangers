// Run: npm run fetch-data
// Saves real DONKI flares + OSDR studies into src/data/nasaSnapshot.json,
// so the deployed game (no dev proxy, API limits) still shows real NASA data.
import { readFileSync, writeFileSync } from 'node:fs'
import { OSDR_TERMS, toStudy, slimFlare, slimCme, slimStorm } from '../src/lib/nasa.js'

const file = new URL('../src/data/nasaSnapshot.json', import.meta.url)
const snap = JSON.parse(readFileSync(file, 'utf8'))
const key = process.env.VITE_NASA_API_KEY || 'DEMO_KEY'
const get = async (url) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) })
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.json()
}

const end = new Date().toISOString().slice(0, 10)
const start = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)
const donki = async (type, slim, keep, name) => {
  try {
    const list = (await get(`https://api.nasa.gov/DONKI/${type}?startDate=${start}&endDate=${end}&api_key=${key}`)).map(slim).filter(keep)
    if (list.length) snap[name] = list.slice(-20)
    console.log(`DONKI ${type}: ${list.length}`)
  } catch (e) {
    console.warn(`DONKI ${type} failed, keeping old data (${e.message})`)
  }
}
await donki('FLR', slimFlare, (f) => f.classType && f.peakTime, 'flares')
await donki('CME', slimCme, Boolean, 'cmes')
await donki('GST', slimStorm, (g) => g.kp > 0, 'storms')

for (const term of [...new Set([...Object.values(OSDR_TERMS), 'spaceflight'])]) {
  try {
    const d = await get(`https://osdr.nasa.gov/osdr/data/search?term=${encodeURIComponent(term)}&type=cgene&size=10`)
    snap.osdr[term] = d.hits.hits.map((h) => toStudy(h._source)).filter((s) => s.id && s.title)
    console.log(`OSDR "${term}": ${snap.osdr[term].length} studies`)
  } catch (e) {
    console.warn(`OSDR "${term}" failed (${e.message})`)
  }
}

snap.fetchedAt = new Date().toISOString()
writeFileSync(file, JSON.stringify(snap, null, 2) + '\n')
console.log('saved', file.pathname)
