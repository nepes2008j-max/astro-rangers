// The mission ladder, easiest first. Content file: tune numbers here, then run `npm run check`
// (it plays every mission and fails if a careful player can't win or if difficulty doesn't rise).
//   sols   – days to survive
//   start  – starting resources (0-100)
//   drain  – passive cost per Sol
//   harm   – multiplier on every negative effect (1 = normal, 1.5 = costs hurt 50% more)
//   weather – how many real NASA DONKI space-weather cards are in the deck (0-3)
export const MISSIONS = [
  { id: 1, name: 'First Steps', planet: 'moon', sols: 5, start: { power: 100, oxygen: 100, shielding: 100 }, drain: { power: 2, oxygen: 2 }, harm: 0.75, weather: 1, goal: 'Learn the ropes: walk to a pad to make each choice.' },
  { id: 2, name: 'Moon Base Basics', planet: 'moon', sols: 7, start: { power: 100, oxygen: 100, shielding: 100 }, drain: { power: 3, oxygen: 3 }, harm: 1, weather: 1, goal: 'A full week on the Moon.' },
  { id: 3, name: 'Lunar Survivor', planet: 'moon', sols: 10, start: { power: 100, oxygen: 100, shielding: 100 }, drain: { power: 5, oxygen: 4 }, harm: 1, weather: 2, goal: 'Survive 10 Sols with real solar weather.' },
  { id: 4, name: 'Solar Storm Season', planet: 'moon', sols: 10, start: { power: 100, oxygen: 100, shielding: 75 }, drain: { power: 5, oxygen: 4 }, harm: 1.1, weather: 3, goal: 'The Sun is angry and your shields start weak.' },
  { id: 5, name: 'The Long Lunar Night', planet: 'moon', sols: 12, start: { power: 80, oxygen: 100, shielding: 100 }, drain: { power: 5, oxygen: 4 }, harm: 1.1, weather: 2, goal: 'Low batteries and a long, dark night.' },
  { id: 6, name: 'Mars Landing', planet: 'mars', sols: 7, start: { power: 100, oxygen: 100, shielding: 100 }, drain: { power: 2, oxygen: 2 }, harm: 1, weather: 1, goal: 'Touchdown on the Red Planet!' },
  { id: 7, name: 'Red Planet Explorer', planet: 'mars', sols: 10, start: { power: 100, oxygen: 100, shielding: 100 }, drain: { power: 2, oxygen: 2 }, harm: 1.1, weather: 2, goal: '10 Sols on Mars, far from help.' },
  { id: 8, name: 'Dust Storm Season', planet: 'mars', sols: 10, start: { power: 85, oxygen: 100, shielding: 100 }, drain: { power: 2, oxygen: 2 }, harm: 1.1, weather: 2, goal: 'Dust blocks the Sun. Power is precious.' },
  { id: 9, name: 'Mars Marathon', planet: 'mars', sols: 12, start: { power: 90, oxygen: 90, shielding: 90 }, drain: { power: 2, oxygen: 2 }, harm: 1.15, weather: 3, goal: '12 Sols on Mars with less of everything. Plan ahead!' },
  { id: 10, name: 'Commander Challenge', planet: 'mars', sols: 13, start: { power: 90, oxygen: 90, shielding: 90 }, drain: { power: 2, oxygen: 2 }, harm: 1.15, weather: 3, goal: 'The hardest mission. Only true Astro Rangers survive.' },
]

export const missionById = (id) => MISSIONS.find((m) => m.id === id) ?? MISSIONS[0]

/** Stars for a won mission: 1 for surviving, 2 for science ≥ 30, 3 for science ≥ 60. */
export const starsFor = (science) => 1 + (science >= 30) + (science >= 60)
