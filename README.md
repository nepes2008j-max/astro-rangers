# Astro Rangers: Outpost Survival

A 3D NASA Space Apps game for kids (7–12). Walk your astronaut around a Moon (then Mars) base,
handle real space-weather alerts, and keep ⚡ power, 💨 oxygen and 🛡️ shields above zero for 10 Sols.

**Play:** https://&lt;your-github-username&gt;.github.io/astro-rangers/

## Missions
10 missions from easiest to hardest: 5 on the Moon, then 5 on Mars. Beat one to unlock the next.
Each win earns ⭐ (survive), ⭐⭐ (30+ science) or ⭐⭐⭐ (60+ science). Progress is saved in the browser.
Tune them in `src/data/missions.js`. `npm run check` plays every mission and fails if a careful player
can't win or if a mission is easier than the one before.

## Controls
- **WASD / arrows** move · **Shift** sprint · **Space** jump (low gravity!) · **drag or Q/E** turn the camera
- Walk onto a glowing pad at a station (Shield Generator, Solar Array, Greenhouse, Science Lab, Comms Tower, Habitat) and stand still to do the job. Phones get an on-screen D-pad.

## Real NASA data
| Source | What | How it reaches the game |
|---|---|---|
| [DONKI](https://ccmc.gsfc.nasa.gov/tools/DONKI/) | Solar flares, solar eruptions (CMEs), geomagnetic storms | Fetched **live in the browser** from api.nasa.gov. These become the Sol 1 / 4 / 7 events. |
| [OSDR](https://osdr.nasa.gov/bio/repo/) | Real spaceflight biology studies (bone, muscle, sleep, plants…) | OSDR blocks browser calls from other sites, so the deploy workflow downloads real studies every 6 hours into `src/data/nasaSnapshot.json`. On the dev server they load live. |

If a live call fails (offline, rate limit), the game uses the last real snapshot. It never invents data.
Every event fact in `src/data/nasaEvents.js` and `src/data/marsEvents.js` comes from a real NASA mission or study.

## Develop
```bash
npm install
npm run dev         # http://localhost:5173 (also proxies OSDR so it loads live)
npm run check       # plays every mission 2000x: rules + balance + difficulty order
npm run fetch-data  # refresh the real NASA snapshot
npm run build       # static site in dist/
```
Optional: copy `.env.example` to `.env` and put a free key from https://api.nasa.gov. `DEMO_KEY` is limited to about 30 requests an hour.
For the deployed site, add the same key as repo secret `NASA_API_KEY`.

## Where things live
| File | What |
|---|---|
| `src/data/*.js` | Events, choices, NASA facts (no coding needed) |
| `src/lib/nasa.js` | All NASA API calls + fallbacks |
| `src/lib/stations.js` | Which station each choice happens at |
| `src/store/useGameStore.js` | Game rules, deck, saving |
| `src/components/World3D.jsx` | 3D world, astronaut, stations |
| `src/components/Dashboard.jsx` | HUD, event card, NASA fact popup |

## Roadmap
1. Shop with credits and suit colors
2. Sound effects and music
3. More planets (Europa?) and more events per planet
4. Teacher mode: a summary of the facts each kid learned
