// The story of Palmshade, in three jobs and one endless one. Every mission is data: a
// title, a giver, an intro line the HUD shows, a pay packet, and stages the world walks
// through in order. A stage names its kind and (except 'steal', which any car satisfies)
// the landmark it happens at; 'heat' is added to the wanted level when the stage completes,
// 'time' is a countdown in seconds, and 'givesPistol' arms the player. All names, people
// and places are invented for this game.
//
// Stage kinds:
//   go      — reach the landmark, on foot or by car
//   pickup  — reach the landmark (flavour: something changes hands there)
//   deliver — reach the landmark, usually against the clock
//   steal   — get into any car that is not yours (there are no cars that are yours)
//   escape  — reach Rosa's hideout, and only counts once the wanted stars are gone

export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'First Wheels',
    giver: 'Tito at the garage',
    intro: 'Tito needs a runner. Get to the garage on Marlin Ave, then bring him any car that still runs.',
    pay: 150,
    stages: [
      { kind: 'go', at: 'garage', label: "Go see Tito at Tito's Garage." },
      { kind: 'steal', label: 'Steal any car. E near a car, E again to get out.' },
      { kind: 'deliver', at: 'garage', label: "Bring the car back to Tito's Garage." },
    ],
  },
  {
    id: 'package-run',
    title: 'Package Run',
    giver: 'Marisol at Cafe Azahar',
    intro: 'Marisol slides a brown-wrapped package across the counter. "Marina Gate. Ninety seconds. Do not open it."',
    pay: 300,
    stages: [
      { kind: 'pickup', at: 'diner', label: 'Pick up the package at Cafe Azahar.' },
      { kind: 'deliver', at: 'marina', label: 'Deliver it to Marina Gate. Fast.', time: 95, heat: 2 },
    ],
  },
  {
    id: 'night-shift',
    title: 'Night Shift',
    giver: 'Rosa, who knows everything',
    intro: 'Rosa: "The Old Depot keeps a pistol in the office and a secret at the Lookout. Take both, then come home quiet."',
    pay: 450,
    stages: [
      { kind: 'pickup', at: 'depot', label: 'Search the Old Depot office.', givesPistol: true },
      { kind: 'go', at: 'lookout', label: 'Meet the contact at Palmera Lookout.', heat: 4 },
      { kind: 'escape', at: 'hideout', label: "Lose the police, then reach Rosa's Hideout." },
    ],
  },
];

/** After the story: an endless delivery job, retargeted by the world each time it starts. */
export const REPEAT_JOB = {
  id: 'odd-job',
  title: 'Odd Job',
  giver: 'Rosa, who knows everything',
  intro: 'Rosa always has one more envelope that needs to be somewhere else.',
  pay: 120,
  stages: [
    { kind: 'pickup', at: 'diner', label: 'Pick up the envelope.' },
    { kind: 'deliver', at: 'marina', label: 'Drop it off across town.', time: 110 },
  ],
};
