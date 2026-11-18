// Keyboard and mouse input. Held keys give continuous movement and driving axes; one-shot
// presses (interact, punch, pause, confirm, mute) are queued as bit flags and taken once by
// the loop, so a press between two frames is never lost and never counted twice. The mouse
// position is tracked in view pixels so the player can aim a punch or a shot at the cursor.

export const ACTION_INTERACT = 1;
export const ACTION_ATTACK = 2;
export const ACTION_PAUSE = 4;
export const ACTION_CONFIRM = 8;
export const ACTION_MUTE = 16;
export const ACTION_SAVE = 32;

const INTERACT = new Set(['KeyE', 'KeyF']);
const ATTACK_KEYS = new Set(['KeyJ']);
const PAUSE = new Set(['KeyP', 'Escape']);
const CONFIRM = new Set(['Space', 'Enter']);
const MUTE = new Set(['KeyM']);
const SAVE = new Set(['KeyK']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  const mouse = { x: 0, y: 0, down: false };

  window.addEventListener('keydown', (event) => {
    held.add(event.code);
    if (event.repeat) return;
    if (INTERACT.has(event.code)) actions |= ACTION_INTERACT;
    else if (ATTACK_KEYS.has(event.code)) actions |= ACTION_ATTACK;
    else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    else if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
    else if (MUTE.has(event.code)) actions |= ACTION_MUTE;
    else if (SAVE.has(event.code)) actions |= ACTION_SAVE;
    if (event.code.startsWith('Arrow') || event.code === 'Space') event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
    mouse.down = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
  });
  canvas.addEventListener('pointerdown', (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
    mouse.down = true;
    actions |= ACTION_ATTACK;
  });
  window.addEventListener('pointerup', () => {
    mouse.down = false;
  });

  function axis(negative, positive) {
    return (held.has(positive) ? 1 : 0) - (held.has(negative) ? 1 : 0);
  }

  return {
    mouse,
    /** Walking axes: x from A/D or arrows, y from W/S or arrows, each -1, 0 or 1. */
    moveX() {
      return axis('KeyA', 'KeyD') || axis('ArrowLeft', 'ArrowRight');
    },
    moveY() {
      return axis('KeyW', 'KeyS') || axis('ArrowUp', 'ArrowDown');
    },
    /** Driving: throttle -1 (reverse/brake) to 1, steer -1 (left) to 1 (right). */
    throttle() {
      return axis('KeyS', 'KeyW') || axis('ArrowDown', 'ArrowUp');
    },
    steer() {
      return axis('KeyA', 'KeyD') || axis('ArrowLeft', 'ArrowRight');
    },
    running() {
      return held.has('ShiftLeft') || held.has('ShiftRight');
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
