// Drawing only: world state in, pixels out. The camera centres on the player and the
// 1280x720 view is scaled to fit the window. The city is painted in layers (grass and
// water, roads and sidewalks, buildings with named roofs, palms), then cars, walkers,
// the player, effects, and finally the HUD: cash, health, wanted stars, the mission
// panel, and a minimap that shows roads, the bay, police blips and the objective.
import { FONT, PALETTE, VIEW, WANTED, WORLD } from './config.js';
import { CITY_NAME, LANDMARKS, isWater } from './city.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';

const MINIMAP = { size: 176, pad: 14 };

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const cam = { x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.scale = Math.min(canvas.width / VIEW.width, canvas.height / VIEW.height);
    view.x = (canvas.width - VIEW.width * view.scale) / 2;
    view.y = (canvas.height - VIEW.height * view.scale) / 2;
  }
  resize();
  window.addEventListener('resize', resize);

  const fonts = new Map();
  function text(value, x, y, size, colour, align = 'left', weight = '') {
    const key = `${weight}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight} ${size}px ${FONT}`);
    ctx.font = fonts.get(key);
    ctx.fillStyle = colour;
    ctx.textAlign = align;
    ctx.fillText(value, x, y);
  }

  function rect(x, y, w, h, colour) {
    ctx.fillStyle = colour;
    ctx.fillRect(x, y, w, h);
  }

  // ---- the city ---------------------------------------------------------------

  function drawGround(city) {
    rect(cam.x - 40, cam.y - 40, VIEW.width + 80, VIEW.height + 80, PALETTE.grass);
    // Park and plaza blocks get a lighter lawn / paved square.
    const { block, road, walk } = WORLD;
    const park = city.parkBlock;
    rect(park.bx * block + road, park.by * block + road, block - road, block - road, PALETTE.grassDark);
    const plaza = city.plazaBlock;
    rect(plaza.bx * block + road, plaza.by * block + road, block - road, block - road, PALETTE.sidewalk);
    // The bay: sand rim, then water.
    const bayX = WORLD.width - 420;
    const bayY = WORLD.height - 420;
    rect(bayX - 26, bayY - 26, 446, 446, PALETTE.sand);
    rect(bayX, bayY, 420, 420, PALETTE.water);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i += 1) {
      const wy = bayY + 40 + i * 78 + Math.sin(performance.now() / 900 + i) * 4;
      ctx.beginPath();
      ctx.moveTo(bayX + 26, wy);
      ctx.lineTo(bayX + 150, wy);
      ctx.stroke();
    }
    // Sidewalks frame every block; roads fill the grid bands.
    for (let bx = 0; bx <= WORLD.width / block; bx += 1) {
      rect(bx * block - walk, 0, road + walk * 2, WORLD.height, PALETTE.sidewalk);
      rect(bx * block, 0, road, WORLD.height, PALETTE.road);
    }
    for (let by = 0; by <= WORLD.height / block; by += 1) {
      rect(0, by * block - walk, WORLD.width, road + walk * 2, PALETTE.sidewalk);
      rect(0, by * block, WORLD.width, road, PALETTE.road);
    }
    // Lane dashes and crosswalks.
    ctx.fillStyle = PALETTE.lane;
    for (let bx = 0; bx <= WORLD.width / block; bx += 1) {
      for (let y = 8; y < WORLD.height; y += 44) ctx.fillRect(bx * block + road / 2 - 2, y, 4, 24);
    }
    for (let by = 0; by <= WORLD.height / block; by += 1) {
      for (let x = 8; x < WORLD.width; x += 44) ctx.fillRect(x, by * block + road / 2 - 2, 24, 4);
    }
    ctx.fillStyle = PALETTE.crosswalk;
    for (let bx = 0; bx < WORLD.width / block; bx += 1) {
      for (let by = 0; by < WORLD.height / block; by += 1) {
        for (let s = 0; s < 4; s += 1) ctx.fillRect(bx * block + 10 + s * 19, by * block + 4, 10, 10);
      }
    }
    void walk;
  }

  function drawBuildings(city) {
    for (const b of city.buildings) {
      if (b.x + b.w < cam.x - 30 || b.y + b.h < cam.y - 30 || b.x > cam.x + VIEW.width + 30 || b.y > cam.y + VIEW.height + 30) continue;
      rect(b.x + 7, b.y + 9, b.w, b.h, PALETTE.roofShadow);
      rect(b.x, b.y, b.w, b.h, b.colour);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 3, b.y + 3, b.w - 6, b.h - 6);
      // Roof furniture: a vent block and a water tank dot, sized by the floors count.
      rect(b.x + b.w * 0.18, b.y + b.h * 0.2, 20, 14, 'rgba(0,0,0,0.18)');
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.beginPath();
      ctx.arc(b.x + b.w * 0.72, b.y + b.h * 0.66, 6 + (b.floors % 4), 0, Math.PI * 2);
      ctx.fill();
      if (b.w > 92 && b.h > 40) {
        ctx.save();
        ctx.globalAlpha = 0.75;
        text(b.name, b.x + b.w / 2, b.y + b.h / 2 + 5, 13, '#20242a', 'center', '600');
        ctx.restore();
      }
    }
    for (const t of city.trees) {
      ctx.fillStyle = '#2c5226';
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#477a3a';
      ctx.beginPath();
      ctx.arc(t.x - 2, t.y - 2, t.r * 0.62, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const spot of LANDMARKS) {
      ctx.fillStyle = spot.colour;
      ctx.beginPath();
      ctx.arc(spot.x, spot.y, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#10131a';
      ctx.lineWidth = 3;
      ctx.stroke();
      text(spot.name, spot.x, spot.y - 24, 13, '#10131a', 'center', '700');
    }
  }

  // ---- actors -------------------------------------------------------------------

  function drawCar(car, isPlayerCar) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    rect(3, 4, 46, 22, PALETTE.roofShadow);
    // Tyres, body, cabin, lights.
    rect(-20, -13, 11, 5, '#14161a');
    rect(9, -13, 11, 5, '#14161a');
    rect(-20, 8, 11, 5, '#14161a');
    rect(9, 8, 11, 5, '#14161a');
    ctx.fillStyle = car.model.colour;
    ctx.beginPath();
    ctx.roundRect(-23, -11, 46, 22, 6);
    ctx.fill();
    rect(-6, -8, 15, 16, '#22262e');
    rect(11, -7, 5, 14, '#3a4a5a');
    rect(20, -8, 3, 5, '#ffe9a3');
    rect(20, 3, 3, 5, '#ffe9a3');
    rect(-23, -8, 3, 5, '#c23b31');
    rect(-23, 3, 3, 5, '#c23b31');
    if (car.kind === 'police' || car.kind === 'police-parked') {
      rect(-4, -9, 9, 18, '#20242c');
      const flash = Math.floor(performance.now() / 280) % 2 === 0;
      ctx.fillStyle = flash ? '#e5534b' : '#3f7dd9';
      ctx.beginPath();
      ctx.arc(0, -4, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = flash ? '#3f7dd9' : '#e5534b';
      ctx.beginPath();
      ctx.arc(0, 4, 3.4, 0, Math.PI * 2);
      ctx.fill();
      text('PD', 0, 4, 9, '#e8ecf0', 'center', '700');
    }
    if (isPlayerCar) {
      ctx.strokeStyle = PALETTE.beacon;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-26, -14, 52, 28, 8);
      ctx.stroke();
    }
    ctx.restore();
    if (car.health < 55 && car.kind !== 'parked') {
      // A damage bar over anything that has taken a beating.
      rect(car.x - 20, car.y - 26, 40, 5, 'rgba(0,0,0,0.5)');
      rect(car.x - 19, car.y - 25, 38 * Math.max(0, car.health) / 100, 3, car.health > 25 ? '#7dd87d' : '#e5534b');
    }
  }

  function drawWalker(w) {
    ctx.save();
    ctx.translate(w.x, w.y);
    if (w.mode === 'down') {
      ctx.rotate(Math.PI / 2);
      ctx.globalAlpha = 0.85;
    } else {
      ctx.rotate(w.angle);
    }
    ctx.fillStyle = w.colour;
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath();
    ctx.arc(2, 0, 4.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPlayer(state) {
    const p = state.player;
    if (p.car) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    // Legs swing with the walk cycle; the torso is a bright jacket so the player reads.
    const swing = Math.sin(p.walkCycle) * 5;
    rect(-4, -8 + swing * 0.4, 7, 5, '#2c3242');
    rect(-4, 3 - swing * 0.4, 7, 5, '#2c3242');
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath();
    ctx.arc(3, 0, 5.4, 0, Math.PI * 2);
    ctx.fill();
    if (p.swingTimer > 0) {
      ctx.strokeStyle = '#f2f4f6';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(8, 0, 17, -0.7, 0.7);
      ctx.stroke();
    }
    if (p.hasPistol) {
      rect(8, 5, 10, 3.4, '#20242c');
    }
    ctx.restore();
    if (p.bust > 0.02) {
      rect(p.x - 22, p.y - 30, 44, 6, 'rgba(0,0,0,0.55)');
      rect(p.x - 21, p.y - 29, 42 * p.bust, 4, PALETTE.danger);
      text('BUSTING…', p.x, p.y - 36, 11, PALETTE.danger, 'center', '700');
    }
  }

  // ---- HUD ----------------------------------------------------------------------

  function drawStars(state) {
    for (let i = 0; i < WANTED.maxStars; i += 1) {
      const x = VIEW.width - 30 - i * 30;
      ctx.fillStyle = i < state.stars ? PALETTE.beacon : 'rgba(255,255,255,0.22)';
      ctx.save();
      ctx.translate(x, 30);
      ctx.beginPath();
      for (let s = 0; s < 5; s += 1) {
        const a = -Math.PI / 2 + (s * Math.PI * 2) / 5;
        const a2 = a + Math.PI / 5;
        ctx.lineTo(Math.cos(a) * 11, Math.sin(a) * 11);
        ctx.lineTo(Math.cos(a2) * 4.6, Math.sin(a2) * 4.6);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawMinimap(state, objective) {
    const { size, pad } = MINIMAP;
    const x0 = VIEW.width - size - pad;
    const y0 = VIEW.height - size - pad;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x0, y0, size, size, 10);
    ctx.clip();
    rect(x0, y0, size, size, PALETTE.minimapBg);
    const sx = size / WORLD.width;
    const sy = size / WORLD.height;
    ctx.fillStyle = PALETTE.minimapRoad;
    for (let bx = 0; bx <= WORLD.width / WORLD.block; bx += 1) ctx.fillRect(x0 + bx * WORLD.block * sx, y0, WORLD.road * sx, size);
    for (let by = 0; by <= WORLD.height / WORLD.block; by += 1) ctx.fillRect(x0, y0 + by * WORLD.block * sy, size, WORLD.road * sy);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(x0 + (WORLD.width - 420) * sx, y0 + (WORLD.height - 420) * sy, 420 * sx, 420 * sy);
    if (objective) {
      const pulse = 3.4 + Math.sin(performance.now() / 240) * 1.3;
      ctx.fillStyle = PALETTE.beacon;
      ctx.beginPath();
      ctx.arc(x0 + objective.x * sx, y0 + objective.y * sy, pulse, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const car of state.cars) {
      if (car.kind !== 'police' || car.dead) continue;
      ctx.fillStyle = Math.floor(performance.now() / 300) % 2 ? '#e5534b' : '#5b8fe0';
      ctx.fillRect(x0 + car.x * sx - 2, y0 + car.y * sy - 2, 4, 4);
    }
    const p = state.player;
    ctx.fillStyle = '#ffffff';
    ctx.save();
    ctx.translate(x0 + p.x * sx, y0 + p.y * sy);
    ctx.rotate(p.angle);
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, -3.6);
    ctx.lineTo(-4, 3.6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x0, y0, size, size, 10);
    ctx.stroke();
    text(CITY_NAME.toUpperCase(), x0 + 8, y0 + 16, 10, PALETTE.muted, 'left', '700');
  }

  function drawHud(state, objective, muted) {
    // Cash and health, top-left.
    ctx.textBaseline = 'alphabetic';
    text(`$${state.cash}`, 22, 40, 30, PALETTE.cash, 'left', '700');
    rect(22, 52, 170, 12, 'rgba(0,0,0,0.55)');
    rect(24, 54, 166 * Math.max(0, state.player.health) / 100, 8, state.player.health > 30 ? '#7dd87d' : PALETTE.danger);
    text('HEALTH', 22, 80, 10, PALETTE.muted, 'left', '700');
    if (state.player.hasPistol) text(`PISTOL · ${state.player.ammo}`, 108, 80, 10, PALETTE.muted, 'left', '700');
    drawStars(state);
    if (state.stars > 0) text('PALMSHADE PD', VIEW.width - 22, 58, 11, PALETTE.danger, 'right', '700');

    // Mission panel, bottom-left.
    if (state.mission) {
      const def = state.mission.def;
      const stage = def.stages[state.mission.stage];
      const lines = [def.title, stage.label];
      if (objective) {
        const d = Math.round(Math.hypot(objective.x - state.player.x, objective.y - state.player.y) / 10);
        lines.push(`Objective: ${objective.name} · ${d}m`);
      } else if (stage.kind === 'steal') {
        lines.push('Any parked or moving car counts.');
      }
      if (state.mission.timer > 0) lines.push(`Time left: ${Math.ceil(state.mission.timer)}s`);
      const w = 400;
      const h = 30 + lines.length * 21;
      rect(16, VIEW.height - h - 16, w, h, PALETTE.panel);
      ctx.strokeStyle = PALETTE.panelEdge;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(16, VIEW.height - h - 16, w, h);
      lines.forEach((line, i) => {
        text(line, 30, VIEW.height - h + 8 + (i + 1) * 21, i === 0 ? 16 : 14, i === 0 ? PALETTE.beacon : PALETTE.text, 'left', i === 0 ? '700' : '');
      });
    }

    // The objective's pillar of light is drawn by draw() in world space; the HUD only
    // carries the minimap blip and the distance readout in the mission panel above.

    if (state.player.car) {
      const speed = Math.round(Math.abs(state.player.car.speed) * 0.36);
      text(`${speed}`, VIEW.width - 210, VIEW.height - 196, 30, PALETTE.text, 'right', '700');
      text('km/h', VIEW.width - 204, VIEW.height - 196, 12, PALETTE.muted, 'left');
      text(state.player.car.model.name, VIEW.width - 210, VIEW.height - 172, 12, PALETTE.muted, 'right');
    }
    text(muted ? 'MUTED (M)' : 'WASD move · E car · J/click fight · Shift run · K save · P pause', VIEW.width / 2, VIEW.height - 8, 12, 'rgba(240,244,248,0.55)', 'center');

    if (state.bannerTimer > 0 && state.banner) {
      ctx.globalAlpha = Math.min(1, state.bannerTimer);
      rect(VIEW.width / 2 - 330, 92, 660, 46, PALETTE.panel);
      text(state.banner, VIEW.width / 2, 123, 21, PALETTE.beacon, 'center', '700');
      ctx.globalAlpha = 1;
    }
    if (state.messageTimer > 0 && state.message) {
      ctx.globalAlpha = Math.min(1, state.messageTimer);
      text(state.message, VIEW.width / 2, 168, 16, PALETTE.text, 'center');
      ctx.globalAlpha = 1;
    }
    drawMinimap(state, objective);
  }

  // ---- screens --------------------------------------------------------------------

  function drawPanel(title, lines, prompt, titleColour = PALETTE.beacon) {
    const w = 680;
    const h = 150 + lines.length * 27 + 56;
    const x = (VIEW.width - w) / 2;
    const y = (VIEW.height - h) / 2;
    rect(x, y, w, h, PALETTE.panel);
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    text(title, VIEW.width / 2, y + 72, 46, titleColour, 'center', '800');
    lines.forEach((line, i) => text(line, VIEW.width / 2, y + 122 + i * 27, 17, i === 0 ? PALETTE.text : PALETTE.muted, 'center'));
    text(prompt, VIEW.width / 2, y + h - 26, 18, PALETTE.beacon, 'center', '700');
  }

  function drawTitle(state, best) {
    drawPanel('PALMSHADE', [
      'A tiny open-world crime caper in a city that is not Vice City.',
      `Cash $${state.cash} · Missions done ${state.missionsDone} · Best cash $${best}`,
      'Walk the avenues, boost a car, run jobs for Tito, Marisol and Rosa —',
      'and whatever you do, do not let the Palmshade PD sit on you.',
      'WASD / arrows move · Shift run · E enter or leave a car',
      'J or click punch & shoot · W/S drive, A/D steer · K save · P pause · M mute',
    ], 'Press Enter or click to hit the streets');
  }

  /** Paint one frame of the world plus the HUD or the screen drawn over it. */
  function draw(state, city, screen, objective, best, muted) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    rect(0, 0, canvas.width, canvas.height, PALETTE.backdrop);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    cam.x = Math.max(0, Math.min(WORLD.width - VIEW.width, state.player.x - VIEW.width / 2));
    cam.y = Math.max(0, Math.min(WORLD.height - VIEW.height, state.player.y - VIEW.height / 2));
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    drawGround(city);
    drawBuildings(city);
    for (const car of state.cars) if (!car.dead && car !== state.player.car) drawCar(car, false);
    if (state.player.car) drawCar(state.player.car, true);
    for (const w of state.walkers) drawWalker(w);
    drawPlayer(state);
    for (const b of state.bullets) {
      ctx.fillStyle = '#ffe9a3';
      ctx.fillRect(b.x - 3, b.y - 1.4, 6, 2.8);
    }
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, pt.life * 2));
      ctx.fillStyle = pt.colour;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // The HUD lives in view space: undo the camera, keep the view transform.
    ctx.save();
    ctx.translate(cam.x, cam.y);
    // (objective beacon is drawn in view space below using world->view conversion)
    ctx.restore();
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
      // Beacon needs world coordinates: redraw it under the camera transform.
      ctx.save();
      ctx.translate(-cam.x, -cam.y);
      if (objective) {
        const pulse = 0.5 + Math.sin(performance.now() / 300) * 0.2;
        const grad = ctx.createLinearGradient(0, objective.y - 240, 0, objective.y);
        grad.addColorStop(0, 'rgba(255,217,77,0)');
        grad.addColorStop(1, `rgba(255,217,77,${pulse})`);
        ctx.fillStyle = grad;
        ctx.fillRect(objective.x - 12, objective.y - 240, 24, 240);
      }
      ctx.restore();
      drawHud(state, objective, muted);
    }
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    if (screen === SCREEN_PAUSED) drawPanel('PAUSED', ['The city holds its breath.', 'Your progress is in this browser: cash, missions and the pistol.'], 'Press P or Enter to resume', PALETTE.text);
    if (state.over) {
      ctx.fillStyle = state.over === 'busted' ? 'rgba(30,40,80,0.45)' : 'rgba(90,16,16,0.45)';
      rect(0, 0, VIEW.width, VIEW.height, ctx.fillStyle);
      text(state.over === 'busted' ? 'BUSTED' : 'WASTED', VIEW.width / 2, VIEW.height / 2, 64, '#ffffff', 'center', '800');
      text(state.over === 'busted' ? 'The Palmshade PD finally sits on you.' : 'Brisa Hospital patches you up and bills the city.', VIEW.width / 2, VIEW.height / 2 + 44, 17, PALETTE.text, 'center');
    }
    return { camX: cam.x, camY: cam.y };
  }

  /** Convert a mouse event's client pixels to the 1280x720 view's coordinates. */
  function toView(clientX, clientY) {
    const ratio = window.devicePixelRatio || 1;
    return {
      x: (clientX * ratio - view.x) / view.scale,
      y: (clientY * ratio - view.y) / view.scale,
    };
  }

  return { draw, toView };
}
