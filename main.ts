// Palmshade's hand-in program (Node 22, standard library only). The game itself is this
// directory's game/ folder: plain static files a desktop browser loads fully offline
// (game/index.html and its ES modules, no library, no network request). This program
// copies game/ and screenshots/ from beside this file to /output and writes
// /output/dossier.json — the summary the make.fun judge reads — with the vendored
// make.fun library, byte for byte the way the scorer rebuilds it.
//
// Serve the game locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The caps below are the scorer's own (see the kit's RULES.txt): the dossier text is
// capped at 160 KiB, screenshots at 4 files of 256 KiB, and game/ at 993 entries and
// 48 MiB with no path over 1,000 bytes. Passing them here means buildDossier refuses
// an entry the scorer would refuse, instead of handing in a dossier that differs.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

const dossierBytes = statSync(join(out, 'dossier.json')).size;
console.log(`palmshade: game, screenshots and dossier.json (${dossierBytes} bytes) written to ${out}`);
