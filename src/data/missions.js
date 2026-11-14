// The mission ladder, easiest first. Content file: tune numbers here, then run `npm run check`
// (it plays every mission and fails if a careful player can't win or if difficulty doesn't rise).
//   sols   – days to survive
//   start  – starting resources (0-100)
//   drain  – passive cost per Sol
//   harm   – multiplier on every negative effect (1 = normal, 1.5 = costs hurt 50% more)
//   weather – how many real NASA DONKI space-weather cards are in the deck (0-3)
//   samples – science samples to collect before the last Sol (the mission objective)
//   sampleDist – how far from the base the sample sites are [min, max] metres
//   o2Drain – suit oxygen used per second outside (% of the tank); refill at the airlock
export const MISSIONS = [
  { id: 1, name: 'First Steps', planet: 'moon', sols: 5, start: { power: 100, oxygen: 100, shielding: 100 }, drain: { power: 2, oxygen: 2 }, harm: 0.75, weather: 1, samples: 1, sampleDist: [16, 24], o2Drain: 0.5, goal: 'Learn the ropes: walk to a pad to make each choice.' },
  { id: 2, name: 'Moon Base Basics', planet: 'moon', sols: 7, start: { power: 100, oxygen: 100, shielding: 100 }, drain: { power: 3, oxygen: 3 }, harm: 1, weather: 1, samples: 2, sampleDist: [18, 30], o2Drain: 0.6, goal: 'A full week on the Moon.' },
  { id: 3, name: 'Lunar Survivor', planet: 'moon', sols: 10, start: { power: 100, oxygen: 100, shielding: 100 }, drain: { power: 5, oxygen: 4 }, harm: 1, weather: 2, samples: 2, sampleDist: [20, 40], o2Drain: 0.7, goal: 'Survive 10 Sols with real solar weather.' },
  { id: 4, name: 'Solar Storm Season', planet: 'moon', sols: 10, start: { power: 100, oxygen: 100, shielding: 75 }, drain: { power: 5, oxygen: 4 }, harm: 1.1, weather: 3, samples: 3, sampleDist: [25, 45], o2Drain: 0.8, goal: 'The Sun is angry and your shields start weak.' },
  { id: 5, name: 'The Long Lunar Night', planet: 'moon', sols: 12, start: { power: 80, oxygen: 100, shielding: 100 }, drain: { power: 5, oxygen: 4 }, harm: 1.1, weather: 2, samples: 3, sampleDist: [30, 55], o2Drain: 0.9, goal: 'Low batteries and a long, dark night.' },
  { id: 6, name: 'Mars Landing', planet: 'mars', sols: 7, start: { power: 100, oxygen: 100, shielding: 100 }, drain: { power: 2, oxygen: 2 }, harm: 1, weather: 1, samples: 1, sampleDist: [18, 28], o2Drain: 0.6, goal: 'Touchdown on the Red Planet!' },
  { id: 7, name: 'Red Planet Explorer', planet: 'mars', sols: 10, start: { power: 100, oxygen: 100, shielding: 100 }, drain: { power: 2, oxygen: 2 }, harm: 1.1, weather: 2, samples: 2, sampleDist: [22, 40], o2Drain: 0.75, goal: '10 Sols on Mars, far from help.' },
  { id: 8, name: 'Dust Storm Season', planet: 'mars', sols: 10, start: { power: 85, oxygen: 100, shielding: 100 }, drain: { power: 2, oxygen: 2 }, harm: 1.1, weather: 2, samples: 3, sampleDist: [25, 50], o2Drain: 0.85, goal: 'Dust blocks the Sun. Power is precious.' },
  { id: 9, name: 'Mars Marathon', planet: 'mars', sols: 12, start: { power: 90, oxygen: 90, shielding: 90 }, drain: { power: 2, oxygen: 2 }, harm: 1.15, weather: 3, samples: 3, sampleDist: [30, 60], o2Drain: 0.95, goal: '12 Sols on Mars with less of everything. Plan ahead!' },
  { id: 10, name: 'Mars Commander', planet: 'mars', sols: 13, start: { power: 90, oxygen: 90, shielding: 90 }, drain: { power: 2, oxygen: 2 }, harm: 1.15, weather: 3, samples: 4, sampleDist: [35, 70], o2Drain: 1.05, goal: 'The hardest Mars mission. Only true Astro Rangers survive.' },
  { id: 11, name: 'Europa Landing', planet: 'europa', sols: 7, start: { power: 100, oxygen: 100, shielding: 100 }, drain: { power: 2, oxygen: 2 }, harm: 1, weather: 1, samples: 2, sampleDist: [18, 30], o2Drain: 0.7, goal: 'Touch down on the ice moon of Jupiter!' },
  { id: 12, name: 'Ice Explorer', planet: 'europa', sols: 10, start: { power: 100, oxygen: 100, shielding: 100 }, drain: { power: 2, oxygen: 2 }, harm: 1.1, weather: 2, samples: 2, sampleDist: [22, 45], o2Drain: 0.8, goal: 'Explore the cracked ice for 10 Sols.' },
  { id: 13, name: 'Radiation Belt', planet: 'europa', sols: 10, start: { power: 100, oxygen: 100, shielding: 75 }, drain: { power: 2, oxygen: 2 }, harm: 1.15, weather: 3, samples: 3, sampleDist: [28, 55], o2Drain: 0.95, goal: "Jupiter's radiation is fierce and your shields start weak." },
  { id: 14, name: 'Ocean Hunters', planet: 'europa', sols: 12, start: { power: 90, oxygen: 90, shielding: 90 }, drain: { power: 2, oxygen: 2 }, harm: 1.15, weather: 3, samples: 4, sampleDist: [32, 65], o2Drain: 1.05, goal: 'Search for the hidden ocean under the ice.' },
  { id: 15, name: 'Jupiter Commander', planet: 'europa', sols: 14, start: { power: 80, oxygen: 80, shielding: 80 }, drain: { power: 3, oxygen: 2 }, harm: 1.3, weather: 3, samples: 5, sampleDist: [40, 85], o2Drain: 1.15, goal: 'The hardest mission in the game.' },
]

// Shown on the map as "coming soon" stops (no missions yet).
export const COMING_SOON = [
  { name: 'Mercury', icon: '🪨' },
  { name: 'Venus', icon: '🟡' },
  { name: 'Titan (Saturn)', icon: '🪐' },
  { name: 'Uranus', icon: '🔵' },
  { name: 'Neptune', icon: '🌀' },
]

export const missionById = (id) => MISSIONS.find((m) => m.id === id) ?? MISSIONS[0]

/** Stars for a won mission: 1 for surviving, 2 for science ≥ 30, 3 for science ≥ 60. */
export const starsFor = (science) => 1 + (science >= 30) + (science >= 60)
