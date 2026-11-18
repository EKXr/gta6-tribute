// The screenshot scenes behind ?shot=start|play|chase|mission (with &seed=N). Each one
// builds a fresh world, stages a real situation with the game's own rules — walking to
// the first objective, driving a boosted car with the Palmshade PD in pursuit, running
// Marisol's package against the clock — then steps the simulation with a scripted driver
// so the frame is a moment of actual play, identical for every run of the same seed.
import { STEP } from './config.js';
import { landmark } from './city.js';
import { MISSIONS } from './missions.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

/** A stand-in for the keyboard: fixed axes, and a one-shot action queue the world drains. */
function scriptedInput(axes) {
  let queued = 0;
  return {
    queue(actions) {
      queued |= actions;
    },
    takeActions() {
      const taken = queued;
      queued = 0;
      return taken;
    },
    moveX: () => axes.x ?? 0,
    moveY: () => axes.y ?? 0,
    throttle: () => axes.throttle ?? 0,
    steer: () => axes.steer ?? 0,
    running: () => Boolean(axes.run),
  };
}

function stepSeconds(world, input, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) world.step(STEP, input, null);
}

/** Put the player into the nearest stealable car and mark it as the player's ride. */
function boostNearestCar(world) {
  const state = world.state;
  let best = null;
  let bestDist = Infinity;
  for (const car of state.cars) {
    if (car.kind === 'police') continue;
    const d = Math.hypot(car.x - state.player.x, car.y - state.player.y);
    if (d < bestDist) {
      best = car;
      bestDist = d;
    }
  }
  if (!best) return null;
  state.player.car = best;
  best.kind = 'player';
  state.player.x = best.x;
  state.player.y = best.y;
  return best;
}

function stageStart(world) {
  // The title screen floats over the city waking up: traffic rolls, walkers stroll.
  const input = scriptedInput({});
  stepSeconds(world, input, 3);
  return { screen: SCREEN_TITLE, best: 0 };
}

function stagePlay(world) {
  // On foot, mid-errand: the player jogs toward Tito's garage for the first job while
  // traffic and walkers go about their morning around them.
  const garage = landmark('garage');
  world.placePlayer(garage.x - 260, garage.y + 170, 0);
  const state = world.state;
  const input = scriptedInput({ run: true });
  const steps = Math.round(2.6 / STEP);
  for (let i = 0; i < steps; i += 1) {
    const dx = garage.x - state.player.x;
    const dy = garage.y - state.player.y;
    input.moveX = () => Math.sign(dx) * (Math.abs(dx) > 12 ? 1 : 0);
    input.moveY = () => Math.sign(dy) * (Math.abs(dy) > 12 ? 1 : 0);
    world.step(STEP, input, null);
  }
  return { screen: SCREEN_PLAY, best: 0 };
}

function stageChase(world) {
  // Four stars, one boosted coupe, and the interceptors closing in: the player floors
  // it east along the avenue while dispatch fills the street behind them.
  const state = world.state;
  // The chase runs east along the mid-city avenue (y = 789, the eastbound lane of the
  // third horizontal road), so the camera sits mid-frame instead of at the map's edge.
  world.placePlayer(1000, 789, 0);
  const car = boostNearestCar(world);
  if (car) {
    car.x = 1060;
    car.y = 789;
    car.angle = 0;
    state.player.x = car.x;
    state.player.y = car.y;
  }
  world.setHeat(10.5); // four stars
  state.cash = 390;
  const input = scriptedInput({ throttle: 1 });
  stepSeconds(world, input, 1.1);
  // Bring two interceptors into frame behind the player, lights on, as a chase looks
  // a moment after it begins; the rest of the pursuit is already on its way.
  const police = state.cars.filter((c) => c.kind === 'police');
  police.slice(0, 2).forEach((cop, i) => {
    cop.x = state.player.x - 150 - i * 90;
    cop.y = state.player.y + (i === 0 ? -18 : 18);
    cop.angle = 0;
    cop.speed = 240;
  });
  stepSeconds(world, input, 0.35);
  state.banner = 'PALMSHADE PD — VEHICLE PURSUIT';
  state.bannerTimer = 99;
  state.message = 'Four stars. Break their line of sight to cool the heat.';
  state.messageTimer = 99;
  return { screen: SCREEN_PLAY, best: 0 };
}

function stageMission(world) {
  // The Package Run, thirty seconds in: package aboard, marina beacon lit across town,
  // two stars of attention and the clock running — played from a car mid-route.
  const state = world.state;
  state.missionsDone = 1;
  state.cash = 290;
  state.mission = { def: MISSIONS[1], stage: 1, timer: 61 };
  world.placePlayer(1103, 800, Math.PI / 2);
  const car = boostNearestCar(world);
  if (car) {
    car.x = 1103;
    car.y = 800;
    car.angle = Math.PI / 2;
    state.player.x = car.x;
    state.player.y = car.y;
  }
  world.setHeat(3.2); // two stars
  const input = scriptedInput({ throttle: 1 });
  stepSeconds(world, input, 0.8);
  // The world's opening banner names the first job; this scene is the second, so say so.
  state.banner = 'Package Run — Marisol at Cafe Azahar';
  state.bannerTimer = 99;
  state.message = 'Package aboard. Marina Gate, and do not scratch the paint.';
  state.messageTimer = 99;
  return { screen: SCREEN_PLAY, best: 0 };
}

/**
 * Set `world` to the named scene (start, play, chase or mission; any other name is
 * start) and return the screen to draw over it and the best cash to show on it.
 */
export function stageShot(name, world) {
  if (name === 'play') return stagePlay(world);
  if (name === 'chase') return stageChase(world);
  if (name === 'mission') return stageMission(world);
  return stageStart(world);
}
