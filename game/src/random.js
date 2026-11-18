// A small seeded random number generator (mulberry32). One seed always builds the same
// city and stages the same screenshot scene, which is what makes ?seed=N repeatable.

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random float in [min, max) drawn from a createRandom stream. */
export function range(random, min, max) {
  return min + random() * (max - min);
}

/** Random integer in [min, max] inclusive, drawn from a createRandom stream. */
export function rangeInt(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

/** One element of a non-empty array, drawn from a createRandom stream. */
export function pick(random, items) {
  return items[Math.floor(random() * items.length)];
}
