// The simulation: Palmshade alive in one fixed-step world with no drawing and no browser
// in it. The player walks or drives; traffic cars follow the road grid lane by lane and
// brake for each other; walkers stroll the sidewalks and flee from trouble; crimes feed a
// heat value that becomes wanted stars, and the stars bring police cars that hunt the
// player down. step() advances one step and returns what happened as bit flags, so the
// caller can play sounds and announcements without the world knowing about either.
import { CAR, PLAYER, POPULATION, STEP, WANTED, WORLD } from './config.js';
import { buildCity, carHitsBuilding, collideCircle, isRoad, landmark } from './city.js';
import { CAR_MODELS, POLICE_MODEL } from './city.js';
import { pick, range, rangeInt } from './random.js';
import { MISSIONS, REPEAT_JOB } from './missions.js';

export const EV_PUNCH = 1;
export const EV_SHOT = 2;
export const EV_DRYFIRE = 4;
export const EV_CRASH = 8;
export const EV_CASH = 16;
export const EV_DOOR = 32;
export const EV_HURT = 64;
export const EV_STING_WIN = 128;
export const EV_STING_LOSE = 256;
export const EV_PICKUP = 512;
export const EV_BUSTED = 1024;
export const EV_WASTED = 2048;
export const EV_STAR_UP = 4096;
export const EV_SIREN_ON = 8192;

const WALKER_COLOURS = ['#d95f76', '#e0a51f', '#5b7fa6', '#7dd87d', '#c2b280', '#b98a9e', '#e8ecf0', '#e08a3c'];
const TWO_PI = Math.PI * 2;

function angleLerp(a, b, t) {
  let d = (b - a) % TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  if (d < -Math.PI) d += TWO_PI;
  return a + d * t;
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export function createWorld(random, saved) {
  const city = buildCity(random);
  const state = {
    time: 0,
    cash: saved?.cash ?? 40,
    missionsDone: saved?.missionsDone ?? 0,
    jobCount: 0,
    heat: 0,
    stars: 0,
    hiddenTimer: 0,
    message: '',
    messageTimer: 0,
    banner: '',
    bannerTimer: 0,
    over: '', // '' while alive, 'busted' or 'wasted' during the respawn pause
    overTimer: 0,
    player: {
      x: 640, y: 700, angle: -Math.PI / 2, health: PLAYER.health,
      car: null, punchCd: 0, bust: 0, hasPistol: saved?.hasPistol ?? false, ammo: saved?.ammo ?? 0,
      swingTimer: 0, walkCycle: 0,
    },
    cars: [],
    walkers: [],
    bullets: [],
    particles: [],
    mission: null, // { def, stage, timer }
    stats: { stolen: 0, punches: 0, shots: 0, topSpeed: 0 },
  };

  // ---- spawning -------------------------------------------------------------

  function roadPoint(minDistFromPlayer) {
    for (let tries = 0; tries < 24; tries += 1) {
      const vertical = random() < 0.5;
      const line = rangeInt(random, 0, (vertical ? WORLD.width : WORLD.height) / WORLD.block - 1) * WORLD.block + WORLD.road / 2;
      const along = range(random, 80, (vertical ? WORLD.height : WORLD.width) - 80);
      const x = vertical ? line : along;
      const y = vertical ? along : line;
      if (dist(x, y, state.player.x, state.player.y) >= minDistFromPlayer) return { x, y, vertical };
    }
    return { x: 200, y: 200, vertical: true };
  }

  function spawnCar(model, kind, spot) {
    const car = {
      x: spot.x, y: spot.y, angle: 0, speed: 0, model, kind,
      health: model.health, driverDir: 1, axis: spot.vertical ? 'v' : 'h',
      turnAt: 0, smokeTimer: 0, dead: false, honkTimer: range(random, 2, 9),
    };
    if (kind === 'traffic') {
      car.driverDir = random() < 0.5 ? 1 : -1;
      car.angle = car.axis === 'v' ? (car.driverDir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.driverDir > 0 ? 0 : Math.PI);
      snapToLane(car);
    }
    state.cars.push(car);
    return car;
  }

  function snapToLane(car) {
    const laneOff = 23;
    if (car.axis === 'v') {
      const centre = Math.round((car.x - WORLD.road / 2) / WORLD.block) * WORLD.block + WORLD.road / 2;
      car.x = centre + (car.driverDir > 0 ? -laneOff : laneOff);
    } else {
      const centre = Math.round((car.y - WORLD.road / 2) / WORLD.block) * WORLD.block + WORLD.road / 2;
      car.y = centre + (car.driverDir > 0 ? laneOff : -laneOff);
    }
  }

  function spawnWalker(x, y) {
    state.walkers.push({
      x, y, angle: range(random, 0, TWO_PI), speed: range(random, 42, 74),
      colour: pick(random, WALKER_COLOURS), mode: 'stroll', timer: range(random, 2, 6),
      targetX: x, targetY: y, downTimer: 0,
    });
  }

  function seedPopulation() {
    for (let i = 0; i < POPULATION.traffic; i += 1) spawnCar(pick(random, CAR_MODELS), 'traffic', roadPoint(260));
    for (let i = 0; i < POPULATION.parked; i += 1) {
      // Parked cars sit on block edges, nose along the street, waiting to be borrowed.
      const spot = roadPoint(180);
      const car = spawnCar(pick(random, CAR_MODELS), 'parked', spot);
      car.axis = spot.vertical ? 'v' : 'h';
      car.driverDir = random() < 0.5 ? 1 : -1;
      car.angle = car.axis === 'v' ? (car.driverDir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.driverDir > 0 ? 0 : Math.PI);
      if (car.axis === 'v') car.x += car.driverDir > 0 ? -34 : 34;
      else car.y += car.driverDir > 0 ? 34 : -34;
    }
    for (let i = 0; i < POPULATION.walkers; i += 1) {
      const spot = roadPoint(120);
      spawnWalker(spot.x + range(random, 30, 90), spot.y + range(random, 30, 90));
    }
  }

  // ---- crime and wanted -----------------------------------------------------

  function addHeat(amount) {
    const before = state.stars;
    state.heat = Math.min(WANTED.thresholds[WANTED.maxStars], state.heat + amount);
    state.stars = starsForHeat(state.heat);
    return state.stars > before ? EV_STAR_UP : 0;
  }

  function starsForHeat(heat) {
    let stars = 0;
    for (let i = 1; i <= WANTED.maxStars; i += 1) if (heat >= WANTED.thresholds[i]) stars = i;
    return stars;
  }

  function setMessage(text, seconds = 3.4) {
    state.message = text;
    state.messageTimer = seconds;
  }

  function setBanner(text, seconds = 4.2) {
    state.banner = text;
    state.bannerTimer = seconds;
  }

  // ---- missions ---------------------------------------------------------------

  function startMission(def) {
    state.mission = { def, stage: 0, timer: def.stages[0].time ?? 0 };
    setBanner(`${def.title} — ${def.giver}`);
    setMessage(def.intro, 6);
  }

  function currentStage() {
    return state.mission ? state.mission.def.stages[state.mission.stage] : null;
  }

  function objectivePoint() {
    const stage = currentStage();
    if (!stage) return null;
    if (stage.kind === 'steal') return null; // any car will do: no fixed point
    return landmark(stage.at);
  }

  function advanceMission(events) {
    const mission = state.mission;
    const stage = currentStage();
    if (stage.heat) events |= addHeat(stage.heat);
    if (stage.givesPistol) {
      state.player.hasPistol = true;
      state.player.ammo += 24;
      events |= EV_PICKUP;
      setMessage('Picked up a pistol and 24 rounds. Click or J to fire.', 5);
    }
    mission.stage += 1;
    if (mission.stage >= mission.def.stages.length) {
      state.cash += mission.def.pay;
      state.missionsDone += 1;
      events |= EV_CASH | EV_STING_WIN;
      setBanner(`Mission complete: ${mission.def.title}  +$${mission.def.pay}`);
      state.mission = null;
      startNextJob();
    } else {
      const next = currentStage();
      mission.timer = next.time ?? 0;
      setMessage(next.label, 5);
      events |= EV_PICKUP;
    }
    return events;
  }

  function startNextJob() {
    if (state.missionsDone < MISSIONS.length) {
      startMission(MISSIONS[state.missionsDone]);
    } else {
      // The story is done; Rosa keeps finding the player odd jobs forever.
      const targets = ['marina', 'diner', 'depot', 'lookout', 'garage'];
      const def = { ...REPEAT_JOB, stages: REPEAT_JOB.stages.map((s) => ({ ...s })) };
      def.stages[0].at = targets[state.jobCount % targets.length];
      def.stages[1].at = targets[(state.jobCount + 2) % targets.length];
      state.jobCount += 1;
      startMission(def);
    }
  }

  function failMission(reason) {
    const def = state.mission.def;
    setBanner(`Failed: ${def.title}`);
    setMessage(reason, 5);
    state.mission = null;
    startMission(def); // the giver always gives you another chance
    return EV_STING_LOSE;
  }

  // ---- combat -----------------------------------------------------------------

  function swingPunch(events) {
    const p = state.player;
    p.punchCd = PLAYER.punchCooldown;
    p.swingTimer = 0.18;
    state.stats.punches += 1;
    events |= EV_PUNCH;
    const aim = p.angle;
    for (const w of state.walkers) {
      if (w.mode === 'down') continue;
      const d = dist(p.x, p.y, w.x, w.y);
      if (d > PLAYER.punchRange + 10) continue;
      const ang = Math.atan2(w.y - p.y, w.x - p.x);
      let diff = Math.abs(((ang - aim) % TWO_PI + TWO_PI) % TWO_PI);
      if (diff > Math.PI) diff = TWO_PI - diff;
      if (diff > PLAYER.punchArc) continue;
      w.mode = 'down';
      w.downTimer = 4;
      burst(w.x, w.y, '#e5534b', 6, 90);
      events |= addHeat(1);
      setMessage('You decked a pedestrian. The city noticed.', 2.6);
    }
    for (const car of state.cars) {
      if (car.kind !== 'police') continue;
      if (dist(p.x, p.y, car.x, car.y) < PLAYER.punchRange + 18) {
        car.health -= PLAYER.punchDamage;
        burst(car.x, car.y, '#cfd3d6', 5, 80);
        events |= addHeat(1);
      }
    }
    return events;
  }

  function firePistol(events, aimX, aimY) {
    const p = state.player;
    if (!p.hasPistol) return events;
    if (p.ammo <= 0) return events | EV_DRYFIRE;
    p.ammo -= 1;
    p.punchCd = 0.24;
    state.stats.shots += 1;
    const ang = Math.atan2(aimY - p.y, aimX - p.x);
    p.angle = ang;
    state.bullets.push({ x: p.x + Math.cos(ang) * 18, y: p.y + Math.sin(ang) * 18, vx: Math.cos(ang) * 780, vy: Math.sin(ang) * 780, life: 0.55 });
    scareWalkers(p.x, p.y, 240);
    events |= EV_SHOT | addHeat(0.6);
    return events;
  }

  function scareWalkers(x, y, radius) {
    for (const w of state.walkers) {
      if (w.mode !== 'down' && dist(x, y, w.x, w.y) < radius) {
        w.mode = 'flee';
        w.timer = range(random, 1.2, 2.4);
        w.angle = Math.atan2(w.y - y, w.x - x);
      }
    }
  }

  function burst(x, y, colour, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const a = range(random, 0, TWO_PI);
      const s = range(random, speed * 0.3, speed);
      state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: range(random, 0.25, 0.6), colour, size: range(random, 2, 4.5) });
    }
  }

  // ---- cars -------------------------------------------------------------------

  function driveCar(car, dt, throttle, steer) {
    const top = car.model.topSpeed;
    if (throttle > 0) car.speed += CAR.accel * dt * (1 - Math.max(0, car.speed) / (top * 1.25));
    else if (throttle < 0) car.speed -= (car.speed > 4 ? CAR.brake : CAR.reverse) * dt;
    car.speed -= car.speed * CAR.drag * dt * 0.35;
    if (throttle === 0) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 26 * dt);
    car.speed = Math.max(-95, Math.min(top, car.speed));
    if (Math.abs(car.speed) > 2) {
      car.angle += steer * CAR.steer * dt * Math.min(1, Math.abs(car.speed) / 120) * Math.sign(car.speed);
    }
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (carHitsBuilding(city, nx, ny, car.angle)) {
      if (Math.abs(car.speed) > 130) car.health -= Math.abs(car.speed) * 0.09;
      car.speed = -car.speed * 0.32;
      return Math.abs(car.speed) > 60 ? 1 : 0;
    }
    car.x = nx;
    car.y = ny;
    return 0;
  }

  function updateTraffic(car, dt) {
    let blocked = false;
    for (const other of state.cars) {
      if (other === car || other.dead) continue;
      const aheadX = car.x + Math.cos(car.angle) * 52;
      const aheadY = car.y + Math.sin(car.angle) * 52;
      if (dist(aheadX, aheadY, other.x, other.y) < 30) blocked = true;
    }
    const p = state.player;
    if (p.car === null && dist(car.x + Math.cos(car.angle) * 52, car.y + Math.sin(car.angle) * 52, p.x, p.y) < 30) blocked = true;
    const target = blocked ? 0 : CAR.trafficSpeed * (0.75 + (car.model.topSpeed - 250) / 400);
    car.speed += Math.sign(target - car.speed) * Math.min(Math.abs(target - car.speed), 200 * dt);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    // At an intersection, sometimes turn: pick a new axis and direction, then ease onto it.
    const inCrossing = (nx % WORLD.block) < WORLD.road && (ny % WORLD.block) < WORLD.road;
    if (inCrossing && car.turnAt <= 0 && random() < 0.012) {
      car.turnAt = 1.6;
      if (random() < 0.72) {
        car.axis = car.axis === 'v' ? 'h' : 'v';
        car.driverDir = random() < 0.5 ? 1 : -1;
      } else {
        car.driverDir = -car.driverDir;
      }
    }
    if (car.turnAt > 0) car.turnAt -= dt;
    const wantedAngle = car.axis === 'v' ? (car.driverDir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.driverDir > 0 ? 0 : Math.PI);
    car.angle = angleLerp(car.angle, wantedAngle, Math.min(1, dt * 2.6));
    if (!carHitsBuilding(city, nx, ny, car.angle)) {
      car.x = nx;
      car.y = ny;
    } else {
      car.speed = 0;
      car.driverDir = -car.driverDir;
    }
    if (car.x < 40 || car.y < 40 || car.x > WORLD.width - 40 || car.y > WORLD.height - 40) {
      const spot = roadPoint(500);
      car.x = spot.x;
      car.y = spot.y;
      car.axis = spot.vertical ? 'v' : 'h';
      snapToLane(car);
    }
  }

  function updatePolice(car, dt, events) {
    const p = state.player;
    const tx = p.car ? p.car.x : p.x;
    const ty = p.car ? p.car.y : p.y;
    const d = dist(car.x, car.y, tx, ty);
    const wantedAngle = Math.atan2(ty - car.y, tx - car.x);
    car.angle = angleLerp(car.angle, wantedAngle, Math.min(1, dt * (d > 130 ? 1.7 : 2.6)));
    const top = CAR.policeSpeed * (0.72 + state.stars * 0.07);
    const target = d > 60 ? top : top * 0.35;
    car.speed += Math.sign(target - car.speed) * Math.min(Math.abs(target - car.speed), 320 * dt);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (carHitsBuilding(city, nx, ny, car.angle)) {
      car.speed = -car.speed * 0.3;
      car.health -= 2;
    } else {
      car.x = nx;
      car.y = ny;
    }
    // Ramming hurts: a police car that connects at speed knocks health off the player.
    const playerBody = p.car ?? p;
    if (dist(car.x, car.y, playerBody.x, playerBody.y) < 34 && Math.abs(car.speed) > 120) {
      p.health -= 7;
      car.speed *= 0.4;
      burst(playerBody.x, playerBody.y, '#e5534b', 7, 110);
      events |= EV_HURT | EV_CRASH;
    }
    return events;
  }

  function managePolice(dt) {
    const wanted = state.stars > 0 ? Math.min(POPULATION.policeMax, state.stars + 1) : 0;
    const active = state.cars.filter((c) => c.kind === 'police' && !c.dead);
    if (active.length < wanted) {
      const spot = roadPoint(430);
      const car = spawnCar(POLICE_MODEL, 'police', spot);
      car.angle = Math.atan2(state.player.y - car.y, state.player.x - car.x);
    }
    for (const car of active) {
      if (state.stars === 0 && dist(car.x, car.y, state.player.x, state.player.y) > 620) car.dead = true;
    }
    state.cars = state.cars.filter((c) => !c.dead);
  }

  // ---- player -----------------------------------------------------------------

  function enterOrExitCar(events) {
    const p = state.player;
    if (p.car) {
      const car = p.car;
      p.car = null;
      car.kind = car.wasPolice ? 'police-parked' : 'parked';
      p.x = car.x - Math.sin(car.angle) * 30;
      p.y = car.y + Math.cos(car.angle) * 30;
      const fixed = collideCircle(city, p.x, p.y, PLAYER.radius);
      p.x = fixed.x;
      p.y = fixed.y;
      return events | EV_DOOR;
    }
    let best = null;
    let bestDist = PLAYER.enterRange;
    for (const car of state.cars) {
      if (car.dead || car.kind === 'police') continue;
      const d = dist(p.x, p.y, car.x, car.y);
      if (d < bestDist) {
        best = car;
        bestDist = d;
      }
    }
    if (!best) return events;
    p.car = best;
    if (best.kind !== 'player') {
      state.stats.stolen += 1;
      events |= addHeat(1);
      setMessage(`Boosted a ${best.model.name}. Somebody will report that.`, 3);
      const stage = currentStage();
      if (stage && stage.kind === 'steal') events = advanceMission(events);
    }
    best.kind = 'player';
    return events | EV_DOOR;
  }

  function endRun(kind) {
    state.over = kind;
    state.overTimer = 2.6;
    state.heat = 0;
    state.stars = 0;
    return kind === 'busted' ? EV_BUSTED | EV_STING_LOSE : EV_WASTED | EV_STING_LOSE;
  }

  function respawn() {
    const p = state.player;
    const wasBusted = state.over === 'busted';
    const spot = wasBusted ? landmark('police') : landmark('hospital');
    const fine = wasBusted ? Math.min(120, Math.floor(state.cash * 0.25)) : Math.min(80, Math.floor(state.cash * 0.15));
    state.cash = Math.max(0, state.cash - fine);
    p.car = null;
    p.x = spot.x + 60;
    p.y = spot.y + 60;
    p.health = PLAYER.health;
    p.bust = 0;
    p.ammo = Math.floor(p.ammo / 2);
    state.over = '';
    setBanner(wasBusted ? 'Released — Palmshade PD keeps the change' : 'Discharged from Brisa Hospital');
    setMessage(fine > 0 ? `The city takes $${fine} for its trouble. Walk it off.` : 'Back on the street. Walk it off.', 4.5);
  }

  // ---- the step -----------------------------------------------------------------

  function step(dt, input, aimWorld) {
    let events = 0;
    state.time += dt;
    const p = state.player;
    if (state.messageTimer > 0) state.messageTimer -= dt;
    if (state.bannerTimer > 0) state.bannerTimer -= dt;
    if (p.punchCd > 0) p.punchCd -= dt;
    if (p.swingTimer > 0) p.swingTimer -= dt;

    if (state.over) {
      state.overTimer -= dt;
      if (state.overTimer <= 0) respawn();
      updateParticles(dt);
      return events;
    }

    const actions = input.takeActions();
    // Movement and driving.
    if (p.car) {
      const crashed = driveCar(p.car, dt, input.throttle(), input.steer());
      if (crashed) {
        events |= EV_CRASH;
        if (Math.abs(p.car.speed) > 40) p.health -= 1.2;
      }
      state.stats.topSpeed = Math.max(state.stats.topSpeed, Math.abs(p.car.speed));
      p.x = p.car.x;
      p.y = p.car.y;
      p.angle = p.car.angle;
      // Running a walker down in a car is very visible.
      for (const w of state.walkers) {
        if (w.mode !== 'down' && Math.abs(p.car.speed) > 90 && dist(p.car.x, p.car.y, w.x, w.y) < 30) {
          w.mode = 'down';
          w.downTimer = 5;
          burst(w.x, w.y, '#e5534b', 8, 120);
          events |= addHeat(1.5) | EV_HURT;
          setMessage('You ran someone down. Palmshade PD is coming.', 3);
        }
      }
      if (p.car.health <= 0) {
        burst(p.car.x, p.car.y, '#555a60', 16, 130);
        p.car.dead = true;
        state.cars = state.cars.filter((c) => !c.dead);
        p.car = null;
        p.health -= 12;
        events |= EV_CRASH | EV_HURT;
        setMessage('The car gives up. So does your cover.', 3.4);
      }
    } else {
      const mx = input.moveX();
      const my = input.moveY();
      if (mx !== 0 || my !== 0) {
        const speed = input.running() ? PLAYER.runSpeed : PLAYER.walkSpeed;
        const len = Math.hypot(mx, my);
        const nx = p.x + (mx / len) * speed * dt;
        const ny = p.y + (my / len) * speed * dt;
        const fixed = collideCircle(city, nx, ny, PLAYER.radius);
        p.x = fixed.x;
        p.y = fixed.y;
        p.angle = Math.atan2(my, mx);
        p.walkCycle += dt * (input.running() ? 11 : 8);
      }
      if (aimWorld && (actions & 2)) {
        // handled below through the attack flag the caller passes in actions
      }
    }

    if (actions & 1) events = enterOrExitCar(events); // ACTION_INTERACT
    if ((actions & 2) && !p.car) { // ACTION_ATTACK
      if (p.hasPistol && aimWorld) events = firePistol(events, aimWorld.x, aimWorld.y);
      else events = swingPunch(events);
    }

    // Wanted: heat cools only while no police car can see the player.
    managePolice(dt);
    let seen = false;
    for (const car of state.cars) {
      if (car.kind !== 'police' || car.dead) continue;
      events = updatePolice(car, dt, events);
      if (dist(car.x, car.y, p.x, p.y) < WANTED.sightRange) seen = true;
    }
    if (!seen && state.stars > 0) {
      state.hiddenTimer += dt;
      state.heat = Math.max(0, state.heat - WANTED.decayPerSecond * dt * (state.hiddenTimer > 2 ? 3 : 1));
      state.stars = starsForHeat(state.heat);
      if (state.stars === 0) setMessage('You lost the heat. For now.', 3);
    } else {
      state.hiddenTimer = 0;
    }
    events |= state.stars > 0 ? EV_SIREN_ON : 0;

    // Busted: a police car sitting on a slow or foot-bound player fills the meter.
    let busting = false;
    if (state.stars > 0) {
      const playerSpeed = p.car ? Math.abs(p.car.speed) : Math.hypot(input.moveX(), input.moveY()) * PLAYER.walkSpeed;
      for (const car of state.cars) {
        if (car.kind === 'police' && !car.dead && dist(car.x, car.y, p.x, p.y) < WANTED.bustRange + (p.car ? 16 : 0) && playerSpeed < 55) busting = true;
      }
    }
    if (busting) {
      p.bust += dt / PLAYER.bustTime;
      if (p.bust >= 1) events |= endRun('busted');
    } else {
      p.bust = Math.max(0, p.bust - dt * 0.7);
    }
    if (p.health <= 0) events |= endRun('wasted');
    if (p.health < PLAYER.health && state.stars === 0) p.health = Math.min(PLAYER.health, p.health + dt * 2.2);

    // Traffic, walkers, bullets, particles.
    for (const car of state.cars) if (car.kind === 'traffic') updateTraffic(car, dt);
    updateWalkers(dt);
    events = updateBullets(dt, events);
    updateParticles(dt);
    updateCarSmoke(dt);

    // Car-on-car bumps between any two live cars.
    for (let i = 0; i < state.cars.length; i += 1) {
      for (let j = i + 1; j < state.cars.length; j += 1) {
        const a = state.cars[i];
        const b = state.cars[j];
        if (a.dead || b.dead) continue;
        const d = dist(a.x, a.y, b.x, b.y);
        if (d < 38 && d > 0.01) {
          const push = (38 - d) / 2;
          const ux = (b.x - a.x) / d;
          const uy = (b.y - a.y) / d;
          if (a.kind !== 'parked') { a.x -= ux * push; a.y -= uy * push; }
          if (b.kind !== 'parked') { b.x += ux * push; b.y += uy * push; }
          const impact = Math.abs(a.speed - b.speed);
          if (impact > 90) {
            a.health -= impact * 0.05;
            b.health -= impact * 0.05;
            if (a === p.car || b === p.car) events |= EV_CRASH;
          }
          a.speed *= 0.82;
          b.speed *= 0.82;
        }
      }
    }

    // Mission progress.
    const stage = currentStage();
    if (stage) {
      if (stage.time) {
        state.mission.timer -= dt;
        if (state.mission.timer <= 0) events |= failMission('Out of time. The giver shrugs and resets the job.');
      }
      const target = objectivePoint();
      if (target && stage.kind !== 'steal' && stage.kind !== 'escape') {
        const here = p.car ?? p;
        if (dist(here.x, here.y, target.x, target.y) < 58) events = advanceMission(events);
      }
      if (stage.kind === 'escape' && state.stars === 0 && state.mission) {
        const hideout = landmark('hideout');
        if (dist(p.x, p.y, hideout.x, hideout.y) < 70) events = advanceMission(events);
      }
    }

    return events;
  }

  function updateWalkers(dt) {
    const p = state.player;
    for (const w of state.walkers) {
      if (w.mode === 'down') {
        w.downTimer -= dt;
        if (w.downTimer <= 0) {
          w.mode = 'flee';
          w.timer = 1.4;
          w.angle = range(random, 0, TWO_PI);
        }
        continue;
      }
      w.timer -= dt;
      if (w.mode === 'stroll' && w.timer <= 0) {
        w.timer = range(random, 2.5, 6);
        // Stroll targets stay near sidewalks: a point a short walk away, off the road if possible.
        for (let tries = 0; tries < 6; tries += 1) {
          const tx = w.x + range(random, -190, 190);
          const ty = w.y + range(random, -190, 190);
          if (!isRoad(tx, ty)) {
            w.targetX = Math.max(24, Math.min(WORLD.width - 24, tx));
            w.targetY = Math.max(24, Math.min(WORLD.height - 24, ty));
            break;
          }
        }
      }
      if (w.mode === 'flee' && w.timer <= 0) w.mode = 'stroll';
      const danger = p.car && Math.abs(p.car.speed) > 150 && dist(w.x, w.y, p.car.x, p.car.y) < 95;
      if (danger) {
        w.mode = 'flee';
        w.timer = 0.8;
        w.angle = Math.atan2(w.y - p.car.y, w.x - p.car.x);
      }
      const speed = w.mode === 'flee' ? 205 : w.speed;
      let tx = w.targetX;
      let ty = w.targetY;
      if (w.mode === 'flee') {
        tx = w.x + Math.cos(w.angle) * 60;
        ty = w.y + Math.sin(w.angle) * 60;
      }
      const d = dist(w.x, w.y, tx, ty);
      if (d > 6) {
        const a = Math.atan2(ty - w.y, tx - w.x);
        w.angle = angleLerp(w.angle, a, Math.min(1, dt * 8));
        const fixed = collideCircle(city, w.x + Math.cos(a) * speed * dt, w.y + Math.sin(a) * speed * dt, 10);
        w.x = fixed.x;
        w.y = fixed.y;
      }
      // Keep the crowd near the action: anyone left far behind reappears across town.
      if (dist(w.x, w.y, p.x, p.y) > 980) {
        const spot = roadPoint(300);
        w.x = spot.x + range(random, 30, 90);
        w.y = spot.y + range(random, 30, 90);
        w.mode = 'stroll';
      }
    }
  }

  function updateBullets(dt, events) {
    for (const b of state.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      for (const w of state.walkers) {
        if (w.mode !== 'down' && dist(b.x, b.y, w.x, w.y) < 13) {
          w.mode = 'down';
          w.downTimer = 5;
          b.life = 0;
          burst(w.x, w.y, '#e5534b', 8, 110);
          events |= addHeat(1.5);
          setMessage('Shots fired in Palmshade. Everyone heard that.', 2.6);
        }
      }
      for (const car of state.cars) {
        if (!car.dead && dist(b.x, b.y, car.x, car.y) < 26) {
          car.health -= 22;
          b.life = 0;
          burst(b.x, b.y, '#ffd94d', 4, 90);
          if (car.kind === 'police') events |= addHeat(0.8);
          if (car.health <= 0 && car.kind === 'police') {
            car.dead = true;
            burst(car.x, car.y, '#555a60', 18, 140);
            setMessage('You disabled a police interceptor. They will send more.', 3);
          }
        }
      }
      if (carHitsBuilding(city, b.x, b.y, 0)) b.life = 0;
    }
    state.bullets = state.bullets.filter((b) => b.life > 0);
    state.cars = state.cars.filter((c) => !c.dead || c === state.player.car);
    if (state.player.car && state.player.car.dead) state.player.car = null;
    return events;
  }

  function updateParticles(dt) {
    for (const pt of state.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.9;
      pt.vy *= 0.9;
      pt.life -= dt;
    }
    state.particles = state.particles.filter((pt) => pt.life > 0);
  }

  function updateCarSmoke(dt) {
    for (const car of state.cars) {
      if (car.dead || car.health > 45) continue;
      car.smokeTimer -= dt;
      if (car.smokeTimer <= 0) {
        car.smokeTimer = 0.16;
        state.particles.push({ x: car.x + range(random, -8, 8), y: car.y + range(random, -8, 8), vx: range(random, -12, 12), vy: range(random, -30, -14), life: range(random, 0.5, 0.9), colour: '#6a7076', size: range(random, 4, 8) });
      }
    }
  }

  seedPopulation();
  if (state.missionsDone < MISSIONS.length) startMission(MISSIONS[state.missionsDone]);
  else startNextJob();

  return {
    state,
    city,
    step,
    /** A plain snapshot of progress, for the localStorage save. */
    snapshot() {
      return {
        cash: state.cash,
        missionsDone: Math.min(state.missionsDone, MISSIONS.length),
        hasPistol: state.player.hasPistol,
        ammo: state.player.ammo,
      };
    },
    /** Test-and-screenshot hook: place the player somewhere specific, on foot. */
    placePlayer(x, y, angle) {
      state.player.x = x;
      state.player.y = y;
      state.player.angle = angle;
    },
    /** Test-and-screenshot hook: give the player heat so the police come out to play. */
    setHeat(heat) {
      state.heat = heat;
      state.stars = starsForHeat(heat);
    },
  };
}
