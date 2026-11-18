# gta6-tribute

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/EKXr/gta6-tribute/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/EKXr/gta6-tribute/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Palmshade** is an original top-down open-world crime game that pays tribute to the
genre: one invented coastal city to explore on foot and by car, with traffic,
pedestrians, car theft, a five-star wanted system with police pursuits, a three-job
story plus endless odd jobs, fist and pistol combat, a HUD with a live minimap, and a
local save. Every name, place, vehicle, line of art and note of music is original and
made for this game — no commercial game's names, characters, maps or assets.

## Run it

```sh
node serve.ts          # then open http://localhost:8080 in desktop Chrome
```

Or serve `game/` with any static file server and open `game/index.html`. The game
runs fully offline from its own files: no build step, no network requests, no
external assets — all art is drawn in code on a canvas and all sound is synthesized
with WebAudio.

To hand the entry in the way the grader does:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## How to play

- **WASD / arrow keys** — walk (or drive, in a car) · **Shift** — run
- **E** — enter or leave a car (parked cars can simply be taken; the city notices)
- **J or mouse click** — punch; once you carry the pistol, click fires toward the cursor
- **K** — save progress (cash, missions, pistol) to this browser · **P** — pause · **M** — mute

Follow the gold beacon and the mission panel: work for Tito at the garage, Marisol at
Cafe Azahar and Rosa, who knows everything. Crimes raise your wanted stars; police
interceptors hunt you while any star is lit, and if one sits on you while you are slow
or on foot, you are busted. Break their line of sight to cool the heat. Busted sends
you to Palmshade PD with a fine; wasted sends you to Brisa Hospital.

## Layout

- `game/index.html` — the page; `game/src/` — the game, one job per file:
  `city.js` (the generated city), `world.js` (the simulation: traffic, police,
  wanted, combat, missions), `missions.js` (the story, as data), `render.js`
  (canvas, HUD, minimap), `audio.js` (WebAudio music and effects), `input.js`,
  `shots.js` (deterministic `?shot=` scenes for the screenshots), `main.js` (the loop)
- `screenshots/` — four real renders of the game (cover: a four-star pursuit)
- `main.ts` — copies `game/` and `screenshots/` to the output directory and writes
  `dossier.json` with `vendor/makefun-game.ts`
- `serve.ts` — a tiny local static server for `game/`

---
<sub>Entered on [make.fun](https://make.fun/?ref=zs90sebx&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
