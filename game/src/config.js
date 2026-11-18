// Every tuning number for Palmshade in one place: the world grid, the player, the cars,
// the police, the wanted ladder and the palette. The world is a fixed 2880x2160 plain of
// city blocks; the camera shows a 1280x720 window of it, so no rule depends on screen size.

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display rate. */
export const STEP = 1 / 60;

/** The logical view the renderer fits to the window. */
export const VIEW = { width: 1280, height: 720 };

/** The whole city, in world pixels. Roads run on the grid lines every BLOCK pitch. */
export const WORLD = { width: 2880, height: 2160, block: 360, road: 92, walk: 26 };

export const PLAYER = {
  radius: 13,
  walkSpeed: 168,
  runSpeed: 252,
  health: 100,
  punchRange: 40,
  punchArc: 1.15,
  punchCooldown: 0.34,
  punchDamage: 34,
  enterRange: 52,
  bustTime: 2.2,
};

/** Car handling, shared by traffic, police and the player; per-model numbers live in city.js. */
export const CAR = {
  length: 46,
  width: 22,
  accel: 340,
  brake: 520,
  reverse: 150,
  drag: 0.9,
  grip: 7.5,
  steer: 2.35,
  trafficSpeed: 215,
  policeSpeed: 335,
};

export const WANTED = {
  /** Heat needed for each star, indexed by the star count it unlocks. */
  thresholds: [0, 1, 3, 6, 10, 15],
  maxStars: 5,
  decayPerSecond: 0.055,
  sightRange: 330,
  bustRange: 46,
};

/** How many ambient cars and walkers the city keeps alive around the player. */
export const POPULATION = { traffic: 15, policeMax: 6, walkers: 26, parked: 22 };

export const SAVE_KEY = 'palmshade.save.v1';

export const PALETTE = {
  backdrop: '#0d0f14',
  grass: '#3d6b35',
  grassDark: '#35602d',
  sidewalk: '#9aa0a3',
  sidewalkEdge: '#7e8386',
  road: '#33373d',
  roadEdge: '#26292e',
  lane: '#d8c95c',
  crosswalk: '#cfd3d6',
  sand: '#d9bd7f',
  water: '#2e6f8e',
  roofShadow: 'rgba(0,0,0,0.28)',
  beacon: '#ffd94d',
  danger: '#e5534b',
  cash: '#7dd87d',
  text: '#f2f4f6',
  muted: '#a7aeb8',
  panel: 'rgba(16,19,26,0.88)',
  panelEdge: '#ffd94d',
  minimapBg: 'rgba(13,16,22,0.82)',
  minimapRoad: '#565d66',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
