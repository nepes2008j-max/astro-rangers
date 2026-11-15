// Catalog of every real NASA fact a player can discover, grouped for Teacher mode.
import { nasaEvents } from '../data/nasaEvents.js'
import { marsEvents } from '../data/marsEvents.js'
import { europaEvents } from '../data/europaEvents.js'
import { SAMPLE_TYPES } from '../data/samples.js'

export const TOPICS = [
  { id: 'weather', title: '☀️ Space weather', blurb: 'Solar flares, solar eruptions and radiation, using real data from NASA DONKI.',
    questions: ['Why do astronauts on the Moon or Mars need more radiation protection than people on Earth?', 'A flare goes from class M to class X. How much stronger is it, and how would you protect a base?'] },
  { id: 'health', title: '🧬 Life & health in space', blurb: "How space changes the human body (and plants), from NASA's Open Science Data Repository (OSDR).",
    questions: ['Why do bones and muscles get weaker in low gravity? How do astronauts fight it?', 'Why is sleep difficult in space, and what can a crew do about it?'] },
  { id: 'planets', title: '🪐 Planet science', blurb: 'What it is really like on the Moon, Mars and Europa, from NASA missions.',
    questions: ['Compare the Moon, Mars and Europa: which has air, water or ice, and how would that change your base?', 'Why do solar panels make less power at Jupiter than at the Moon?'] },
  { id: 'samples', title: '🪨 Rock & ice samples', blurb: 'Real samples collected by Apollo astronauts and NASA rovers, plus what Europa may hide.',
    questions: ['What can one rock sample tell scientists about a planet’s past?', 'Why do scientists want to bring Mars samples back to Earth instead of testing them only on Mars?'] },
]

const PLANET = { moon: '🌕 Moon', mars: '🔴 Mars', europa: '🧊 Europa' }
// Space weather = radiation from the Sun or Jupiter (a Mars dust storm is planet weather, not space weather).
const isWeather = (e) => /flare|cme|gst|sep_|radiation|solar_storm/.test(e.id) || e.nasa_source.includes('DONKI')
const topicFor = (e) => (e.nasa_source.includes('OSDR') ? 'health' : isWeather(e) ? 'weather' : 'planets')

/** Every discoverable fact: { key, topic, planet, title, fact, source }. */
export const FACTS = [
  // Live DONKI cards (generated from real data, so the fact text here is the general version).
  { key: 'donki_flare', topic: 'weather', planet: 'All worlds', title: 'Solar flare classes', source: 'NASA DONKI', fact: 'Flares are ranked A, B, C, M and X. Each letter is 10 times stronger than the one before, so an X flare is 10 times stronger than an M flare.' },
  { key: 'donki_cme', topic: 'weather', planet: 'All worlds', title: 'Coronal mass ejections', source: 'NASA DONKI', fact: 'A coronal mass ejection (CME) can throw billions of tons of material from the Sun. Fast ones can reach Earth in about a day.' },
  { key: 'donki_gst', topic: 'weather', planet: 'All worlds', title: 'Geomagnetic storms', source: 'NASA DONKI', fact: 'The Kp index goes from 0 to 9. Kp 5 or more is a storm: it makes auroras but can disturb radio, GPS and satellites.' },
  ...[...nasaEvents, ...marsEvents, ...europaEvents].map((e) => ({
    key: e.id, topic: topicFor(e), planet: PLANET[e.planet], title: e.title, fact: e.nasa_fact, source: e.nasa_source,
  })),
  ...Object.entries(SAMPLE_TYPES).flatMap(([planet, list]) => list.map((sm) => ({
    key: `sample:${sm.name}`, topic: 'samples', planet: PLANET[planet], title: `${sm.icon} ${sm.name}`, fact: sm.fact, source: 'Sample collected in the game',
  }))),
]

export const factKeyForSample = (sample) => `sample:${sample.name}`
