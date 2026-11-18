// Palmshade itself: an original little coastal city generated from a seed. A grid of
// avenues and streets cuts the world into blocks; every block holds two to four buildings
// with flat coloured roofs and invented shop names, two blocks are a park and a beach car
// park, and six landmarks (garage, diner, police station, hospital, hideout, marina) anchor
// the missions. The same module answers the questions the rest of the game asks: is this
// point road, sidewalk or water, and does this circle hit a building?
import { WORLD } from './config.js';
import { pick, range, rangeInt } from './random.js';

export const CITY_NAME = 'Palmshade';

const SHOP_NAMES = [
  'Noodle Nook', 'Casa Verde', 'The Daily Grind', 'Palm Pharmacy', 'Tide & Thread',
  'Mango Records', 'Sunset Laundry', 'Barrio Books', 'Hotel Brisa', 'Coco Loco',
  'Fix-It Felix Auto', 'Marina Bait', 'Golden Crust', 'Vista Bank', 'El Faro Tapas',
  'Palm Gym', 'Orchid Florist', 'Byte Repair', 'Casa del Sol', 'Night Owl Liquor',
  'Tropicana Tours', 'Salon Marisol', 'Palm Pawn', 'Cafe Azahar', 'Dockside Deli',
];

const ROOF_COLOURS = ['#b0563c', '#c97b4a', '#a8a29a', '#8f9aa4', '#c2b280', '#7d8c74', '#b98a9e', '#d0c6b2', '#96705a', '#6f8296'];

/** Car models a Palmshade driver might own: name, paint, top speed and toughness. */
export const CAR_MODELS = [
  { name: 'Civica', colour: '#c0c6cc', topSpeed: 300, health: 90 },
  { name: 'Rancho', colour: '#7a4a2b', topSpeed: 265, health: 130 },
  { name: 'Veloz GT', colour: '#b03030', topSpeed: 395, health: 75 },
  { name: 'Palmera', colour: '#3f7d5c', topSpeed: 285, health: 100 },
  { name: 'Taxi Cab', colour: '#e0a51f', topSpeed: 290, health: 100 },
  { name: 'Brisa Van', colour: '#5b7fa6', topSpeed: 250, health: 140 },
  { name: 'Noche Coupe', colour: '#2c2f36', topSpeed: 360, health: 80 },
];

export const POLICE_MODEL = { name: 'Interceptor', colour: '#e8ecf0', topSpeed: 380, health: 160 };

/** Where the story happens: fixed spots on fixed blocks, found by name from missions. */
export const LANDMARKS = [
  { id: 'garage', name: "Tito's Garage", x: 540, y: 540, colour: '#e08a3c' },
  { id: 'diner', name: 'Cafe Azahar', x: 1260, y: 540, colour: '#d95f76' },
  { id: 'marina', name: 'Marina Gate', x: 2340, y: 540, colour: '#3f8fae' },
  { id: 'depot', name: 'Old Depot', x: 540, y: 1260, colour: '#8a7f5c' },
  { id: 'police', name: 'Palmshade PD', x: 1440, y: 1260, colour: '#4a6fa5' },
  { id: 'hospital', name: 'Brisa Hospital', x: 900, y: 1800, colour: '#e8e4da' },
  { id: 'hideout', name: "Rosa's Hideout", x: 2340, y: 1800, colour: '#7d5ba6' },
  { id: 'lookout', name: 'Palmera Lookout', x: 1800, y: 900, colour: '#5c9e6e' },
];

/** True when the point sits on a road band (either direction of the grid). */
export function isRoad(x, y) {
  const { block, road } = WORLD;
  return x % block < road || y % block < road;
}

/** True in the south-east corner bay: water the player and cars cannot enter. */
export function isWater(x, y) {
  return x > WORLD.width - 420 && y > WORLD.height - 420;
}

export function landmark(id) {
  return LANDMARKS.find((spot) => spot.id === id);
}

/**
 * Build the city for a seed: the building list (rect, roof colour, name, floors), the two
 * open blocks (a park and a plaza), and the palm trees that line the beach road.
 */
export function buildCity(random) {
  const buildings = [];
  const { block, road, walk } = WORLD;
  const cols = WORLD.width / block;
  const rows = WORLD.height / block;
  const parkBlock = { bx: 4, by: 1 };
  const plazaBlock = { bx: 1, by: 4 };
  for (let bx = 0; bx < cols; bx += 1) {
    for (let by = 0; by < rows; by += 1) {
      if ((bx === parkBlock.bx && by === parkBlock.by) || (bx === plazaBlock.bx && by === plazaBlock.by)) continue;
      if (bx >= 6 && by >= 4) continue; // the bay: no buildings on the water
      const inner = block - road - walk * 2;
      const x0 = bx * block + road + walk;
      const y0 = by * block + road + walk;
      const split = random() < 0.5;
      const gap = 14;
      const cells = split
        ? [
            { x: x0, y: y0, w: inner, h: (inner - gap) / 2 },
            { x: x0, y: y0 + (inner + gap) / 2, w: inner, h: (inner - gap) / 2 },
          ]
        : [
            { x: x0, y: y0, w: (inner - gap) / 2, h: inner },
            { x: x0 + (inner + gap) / 2, y: y0, w: (inner - gap) / 2, h: inner },
          ];
      for (const cell of cells) {
        if (random() < 0.18) continue; // an empty lot keeps the skyline uneven
        buildings.push({
          x: cell.x + range(random, 0, 8),
          y: cell.y + range(random, 0, 8),
          w: cell.w - range(random, 0, 16),
          h: cell.h - range(random, 0, 16),
          colour: pick(random, ROOF_COLOURS),
          name: pick(random, SHOP_NAMES),
          floors: rangeInt(random, 2, 14),
        });
      }
    }
  }
  const trees = [];
  for (let index = 0; index < 46; index += 1) {
    const x = range(random, 60, WORLD.width - 60);
    const y = range(random, 60, WORLD.height - 60);
    if (!isRoad(x, y)) trees.push({ x, y, r: range(random, 9, 15) });
  }
  return { buildings, trees, parkBlock, plazaBlock };
}

/** Push a circle at (x, y) out of every building and the water; returns the corrected point. */
export function collideCircle(city, x, y, radius) {
  for (const b of city.buildings) {
    const nearX = Math.max(b.x, Math.min(x, b.x + b.w));
    const nearY = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - nearX;
    const dy = y - nearY;
    const distSq = dx * dx + dy * dy;
    if (distSq >= radius * radius) continue;
    if (distSq > 0.0001) {
      const dist = Math.sqrt(distSq);
      x = nearX + (dx / dist) * radius;
      y = nearY + (dy / dist) * radius;
    } else {
      // Centre inside the rect: leave by the shallowest side.
      const left = x - b.x;
      const right = b.x + b.w - x;
      const top = y - b.y;
      const bottom = b.y + b.h - y;
      const min = Math.min(left, right, top, bottom);
      if (min === left) x = b.x - radius;
      else if (min === right) x = b.x + b.w + radius;
      else if (min === top) y = b.y - radius;
      else y = b.y + b.h + radius;
    }
  }
  if (isWater(x, y)) {
    const edgeX = WORLD.width - 420;
    const edgeY = WORLD.height - 420;
    if (x - edgeX < y - edgeY) x = edgeX - radius;
    else y = edgeY - radius;
  }
  return {
    x: Math.max(radius, Math.min(WORLD.width - radius, x)),
    y: Math.max(radius, Math.min(WORLD.height - radius, y)),
  };
}

/** True when a car-sized box at (x, y, angle) overlaps any building. */
export function carHitsBuilding(city, x, y, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const halfL = 24;
  const halfW = 12;
  const corners = [
    [halfL, halfW], [halfL, -halfW], [-halfL, halfW], [-halfL, -halfW], [0, 0],
  ];
  for (const [lx, ly] of corners) {
    const px = x + lx * cos - ly * sin;
    const py = y + lx * sin + ly * cos;
    if (isWater(px, py)) return true;
    for (const b of city.buildings) {
      if (px > b.x - 2 && px < b.x + b.w + 2 && py > b.y - 2 && py < b.y + b.h + 2) return true;
    }
  }
  return false;
}
