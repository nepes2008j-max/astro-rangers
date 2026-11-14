// Shop items: suit colours (looks only, they never change the game balance).
// `fact` is optional: a real NASA detail shown in the shop.
export const SUITS = [
  { id: 'white', name: 'Classic White', color: '#eef0f2', price: 0, fact: 'Real spacesuits are white because white reflects sunlight and keeps astronauts from overheating.' },
  { id: 'orange', name: 'Rescue Orange', color: '#f97316', price: 40, fact: 'NASA\'s orange "pumpkin suit" was worn on Space Shuttle launches so rescuers could spot astronauts in the ocean.' },
  { id: 'blue', name: 'Ocean Blue', color: '#3b82f6', price: 60 },
  { id: 'green', name: 'Space Garden', color: '#22c55e', price: 60 },
  { id: 'red', name: 'Mars Red', color: '#dc2626', price: 80 },
  { id: 'purple', name: 'Nebula Purple', color: '#8b5cf6', price: 100 },
  { id: 'black', name: 'Stealth Black', color: '#3f3f46', price: 120 },
  { id: 'gold', name: 'Commander Gold', color: '#eab308', price: 200, fact: 'Astronaut visors have a thin layer of real gold to block the Sun\'s harsh light.' },
]

export const suitById = (id) => SUITS.find((s) => s.id === id) ?? SUITS[0]

/** Credits for finishing a mission. */
export const creditsFor = ({ won, stars = 0, firstWin = false }) => (won ? 10 + 10 * stars + (firstWin ? 20 : 0) : 5)
