// Boot and the one loop for Palmshade: input is read every frame, the world advances in
// fixed 1/60 s steps, world events become sound, and the renderer paints what is there.
// Screens: title, play, paused — plus the world's own busted/wasted pause. Progress
// (cash, missions done, the pistol) is kept in localStorage and written on K, on every
// mission payday, and whenever a run ends.
//
// ?seed=N fixes the city and its crowds. ?shot=start|play|chase|mission (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld, EV_BUSTED, EV_CASH, EV_CRASH, EV_DOOR, EV_DRYFIRE, EV_HURT, EV_PICKUP,
  EV_PUNCH, EV_SHOT, EV_SIREN_ON, EV_STAR_UP, EV_STING_LOSE, EV_STING_WIN, EV_WASTED,
} from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_SAVE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';
import { landmark } from './city.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const renderer = createRenderer(canvas);

function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null; // storage off or corrupt: start fresh rather than crash
  }
}

function storeSave(world) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(world.snapshot()));
  } catch {
    // Private windows: progress then lasts this visit only.
  }
}

function objectiveOf(world) {
  const mission = world.state.mission;
  if (!mission) return null;
  const stage = mission.def.stages[mission.stage];
  if (!stage || stage.kind === 'steal') return null;
  return landmark(stage.at);
}

function playEvents(events) {
  if (events & EV_PUNCH) audio.punch();
  if (events & EV_SHOT) audio.shot();
  if (events & EV_DRYFIRE) audio.dryFire();
  if (events & EV_CRASH) audio.crash(160);
  if (events & EV_CASH) audio.cash();
  if (events & EV_DOOR) audio.door();
  if (events & EV_HURT) audio.hurt();
  if (events & EV_PICKUP) audio.pickup();
  if (events & EV_STING_WIN) audio.sting(true);
  if (events & EV_STING_LOSE) audio.sting(false);
  audio.setSiren(Boolean(events & EV_SIREN_ON));
}

function runShot(name) {
  const world = createWorld(createRandom(seed), null);
  const scene = stageShot(name, world);
  let painted = 0;
  let lastCam = { camX: 0, camY: 0 };
  function paint() {
    lastCam = renderer.draw(world.state, world.city, scene.screen, objectiveOf(world), scene.best, false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  void lastCam;
  requestAnimationFrame(paint);
}

function runGame() {
  const world = createWorld(createRandom(seed), loadSave());
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = world.state.cash;
  let accumulator = 0;
  let last = performance.now();
  let cam = { camX: 0, camY: 0 };
  let muted = false;

  function announce(message) {
    status.textContent = message;
  }

  function startPlay() {
    screen = SCREEN_PLAY;
    audio.unlock();
    announce(`Playing Palmshade. Cash $${world.state.cash}. ${world.state.mission ? world.state.mission.def.title : 'Free roam.'}`);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;

    // One-shot menu actions ride the same queue the world drains; take a peek by
    // reading the flags the input layer exposes through a pre-drain hook: the world
    // step below consumes movement flags, so menu keys are handled from a copy.
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_SAVE && screen === SCREEN_PLAY) {
      storeSave(world);
      announce('Saved to this browser.');
    }
    if (screen === SCREEN_TITLE && (actions & ACTION_CONFIRM)) startPlay();
    else if (screen === SCREEN_PLAY && (actions & ACTION_PAUSE)) {
      screen = SCREEN_PAUSED;
      audio.setSiren(false);
      announce('Paused.');
    } else if (screen === SCREEN_PAUSED && (actions & (ACTION_PAUSE | ACTION_CONFIRM))) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }

    if (screen === SCREEN_PLAY) {
      // Re-queue the world-facing flags (interact / attack) the menu pass just read:
      // the input queue is drained once per frame, so hand the world a shim that
      // returns exactly the flags meant for it.
      const worldActions = actions & 3;
      const shim = {
        takeActions: () => worldActions,
        moveX: () => input.moveX(),
        moveY: () => input.moveY(),
        throttle: () => input.throttle(),
        steer: () => input.steer(),
        running: () => input.running(),
      };
      const view = renderer.toView(input.mouse.x, input.mouse.y);
      const aim = { x: view.x + cam.camX, y: view.y + cam.camY };
      while (accumulator >= STEP) {
        const events = world.step(STEP, shim, aim);
        playEvents(events);
        if (events & (EV_CASH | EV_BUSTED | EV_WASTED)) storeSave(world);
        if (events & EV_STAR_UP) announce(`Wanted level ${world.state.stars}.`);
        if (events & EV_BUSTED) announce('Busted.');
        if (events & EV_WASTED) announce('Wasted.');
        accumulator -= STEP;
        shim.takeActions = () => 0; // one-shot flags fire on the first step only
      }
    } else {
      accumulator = 0;
      if (screen === SCREEN_TITLE) {
        // The city idles behind the title: one quiet step per frame, no player input.
        const idle = { takeActions: () => 0, moveX: () => 0, moveY: () => 0, throttle: () => 0, steer: () => 0, running: () => false };
        world.step(STEP, idle, null);
      }
    }

    best = Math.max(best, world.state.cash);
    cam = renderer.draw(world.state, world.city, screen, objectiveOf(world), best, muted);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      audio.setSiren(false);
      announce('Paused.');
    }
  });
  canvas.addEventListener('pointerdown', () => {
    if (screen === SCREEN_TITLE) startPlay();
    else audio.unlock();
  });

  announce('Palmshade. Press Enter or click to hit the streets.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
