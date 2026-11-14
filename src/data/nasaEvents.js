// Content file: non-coders can edit this. Effects are added to resources (0-100).
// Keys: power, oxygen, shielding, science. Negative = cost.
export const nasaEvents = [
  {
    id: 'solar_flare_1',
    planet: 'moon',
    title: 'DONKI Alert: Solar Flare Detected',
    description: 'A big flash on the Sun! Radiation is racing toward your outpost.',
    nasa_source: 'NASA DONKI (Space Weather Database)',
    nasa_fact: 'Solar flares release energy in minutes. Without Earth\'s magnetic field to protect them, astronauts on the Moon need shelter from the radiation.',
    choices: [
      { text: 'Divert power to Shielding', effects: { shielding: 15, power: -15 }, feedback: 'The crew is safe, but your batteries took a hit.' },
      { text: 'Keep working outside', effects: { shielding: -25, science: 15 }, feedback: 'Great data collected, but the crew got a radiation dose.' },
    ],
  },
  {
    id: 'sep_storm',
    planet: 'moon',
    title: 'DONKI Alert: Solar Particle Storm',
    description: 'Super-fast particles from the Sun are arriving. They can pass through thin walls.',
    nasa_source: 'NASA DONKI (Solar Energetic Particles)',
    nasa_fact: 'Water is a great radiation shield. NASA plans "storm shelters" surrounded by water tanks so crews can hide during particle storms.',
    choices: [
      { text: 'Hide in the water-tank shelter', effects: { shielding: 10, oxygen: -10, science: -5 }, feedback: 'Cramped, but safe. Air filters worked hard with everyone in one room.' },
      { text: 'Pause all experiments and stay inside', effects: { shielding: -10, science: -10 }, feedback: 'Normal walls blocked some particles, not all.' },
    ],
  },
  {
    id: 'lunar_night',
    planet: 'moon',
    title: 'The Long Lunar Night Begins',
    description: 'The Sun is setting, and it will not rise again for two weeks. Your solar panels go dark.',
    nasa_source: 'NASA Moon Facts',
    nasa_fact: 'A night on the Moon lasts about 14 Earth days, and temperatures can drop below -170°C (-280°F).',
    choices: [
      { text: 'Turn off the science lab to save power', effects: { power: 10, science: -15 }, feedback: 'The lights stay on, but research is paused.' },
      { text: 'Keep everything running', effects: { power: -20, science: 5 }, feedback: 'The lab kept working, but your batteries are draining fast.' },
    ],
  },
  {
    id: 'micrometeoroid',
    planet: 'moon',
    title: 'Micrometeoroid Strike!',
    description: 'A tiny space rock punched a hole in the habitat wall. Air is hissing out!',
    nasa_source: 'NASA Orbital Debris & Micrometeoroid Office',
    nasa_fact: 'Micrometeoroids can travel faster than 10 km per second. Even a grain of sand at that speed hits like a bullet, so habitats use layered "Whipple shields".',
    choices: [
      { text: 'Patch it fast with spare shield panels', effects: { shielding: -15, oxygen: -5 }, feedback: 'Leak stopped! But you used up shield material.' },
      { text: 'Seal the room and fix it later', effects: { oxygen: -15, power: -5 }, feedback: 'You lost some air before the door closed.' },
    ],
  },
  {
    id: 'moon_dust',
    planet: 'moon',
    title: 'Moon Dust Clogs the Air Filters',
    description: 'Sharp, sticky dust got tracked inside. The air filters are choking!',
    nasa_source: 'NASA Apollo Mission Reports',
    nasa_fact: 'Moon dust is sharp like tiny glass because there is no wind or water to smooth it. Apollo 17 astronaut Harrison Schmitt sneezed from "lunar hay fever"!',
    choices: [
      { text: 'Replace filters with spares', effects: { oxygen: 10, power: -10 }, feedback: 'Fresh air again. The new filters need extra power to run.' },
      { text: 'Clean them by hand', effects: { oxygen: -5, science: -5 }, feedback: 'It took the whole day, and the air is still a bit dusty.' },
    ],
  },
  {
    id: 'bone_loss',
    planet: 'moon',
    title: 'Crew Health Check: Weak Bones',
    description: 'The medical scan shows the crew\'s bones are getting weaker in low gravity.',
    nasa_source: 'NASA OSDR (Open Science Data Repository)',
    nasa_fact: 'In weightlessness, astronauts can lose about 1-1.5% of their bone mass every month. The Moon has only 1/6 of Earth\'s gravity, so exercise is a must.',
    choices: [
      { text: 'Daily exercise on the treadmill', effects: { power: -10, oxygen: -5, science: 5 }, feedback: 'Strong bones! The treadmill used power, and the crew breathed harder.' },
      { text: 'Skip it, focus on the mission', effects: { science: 10, shielding: -10 }, feedback: 'More work done, but the crew is more fragile now.' },
    ],
  },
  {
    id: 'sleep',
    planet: 'moon',
    title: 'The Crew Can\'t Sleep',
    description: 'Without a normal day and night, the crew\'s body clocks are confused.',
    nasa_source: 'NASA OSDR (Human Research)',
    nasa_fact: 'Astronauts on the ISS see about 16 sunrises a day! NASA installed special LED lights that change color to help crews sleep on schedule.',
    choices: [
      { text: 'Switch on the sleep-cycle LED lights', effects: { power: -10, science: 5 }, feedback: 'Everyone slept great and worked better the next day.' },
      { text: 'Let them push through', effects: { science: -10, oxygen: -5 }, feedback: 'A tired crew made mistakes.' },
    ],
  },
  {
    id: 'muscle',
    planet: 'moon',
    title: 'Crew Health Check: Muscles Shrinking',
    description: 'Space muscles get lazy. The crew is losing strength.',
    nasa_source: 'NASA OSDR (Rodent Research)',
    nasa_fact: 'Astronauts on the ISS exercise about 2 hours every day. NASA studies mice in space to learn how muscles shrink and how to stop it.',
    choices: [
      { text: 'Run a mouse muscle experiment', effects: { science: 15, power: -10, oxygen: -5 }, feedback: 'Exciting results for scientists back on Earth!' },
      { text: 'Rest and save energy', effects: { power: 5, science: -5 }, feedback: 'Batteries recharged, but no new discoveries today.' },
    ],
  },
  {
    id: 'water_ice',
    planet: 'moon',
    title: 'Water Ice Found in a Dark Crater!',
    description: 'Your rover spots ice in a crater where sunlight never reaches.',
    nasa_source: 'NASA LCROSS Mission',
    nasa_fact: 'In 2009, NASA\'s LCROSS mission crashed into a dark crater near the Moon\'s south pole and found water ice. Ice can be split into oxygen to breathe!',
    choices: [
      { text: 'Mine the ice and make oxygen', effects: { oxygen: 20, power: -15 }, feedback: 'Fresh oxygen from Moon ice! The machines used lots of power.' },
      { text: 'Study it for science', effects: { science: 20, power: -5 }, feedback: 'Scientists on Earth are cheering!' },
      { text: 'Ignore it, save power', effects: { power: 5 }, feedback: 'Safe choice, but a big opportunity missed.' },
    ],
  },
  {
    id: 'moon_plants',
    planet: 'moon',
    title: 'Greenhouse Experiment',
    description: 'Can you grow plants in Moon soil? Your greenhouse is ready to try.',
    nasa_source: 'NASA OSDR / GeneLab (Apollo soil study, 2022)',
    nasa_fact: 'In 2022, scientists grew small plants in real Apollo Moon soil. They sprouted, but grew slowly and looked stressed. The soil is tough for plants!',
    choices: [
      { text: 'Plant seeds under grow lights', effects: { oxygen: 10, power: -15, science: 10 }, feedback: 'Little green sprouts! They make a bit of oxygen too.' },
      { text: 'Save the seeds for later', effects: { power: 5 }, feedback: 'You saved energy, but the greenhouse stays empty.' },
    ],
  },
]



