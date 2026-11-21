/**
 * Controller-Eignung aller Spiele messen (#608, Vorhaben #607 K0).
 *
 *   corepack pnpm build
 *   node scripts/controller-audit.mjs [--json <Datei>] [--parallel <n>] [ids …]
 *
 * Je Spiel zwei Durchgänge mit nachgebautem Controller bei 1280 × 800, jeder in einem frischen Kontext:
 * - „direkt“ (Bedienmodus Standard): höchstens 250 Tastendrücke nach festem Zufall (60 % Richtung, 40 % A,
 *   nie B/Start/X/Y); vor jedem Druck liegt der Fokus im Spielfeld (sonst bis zu viermal RB). Erfolg bei
 *   drei angenommenen Zügen eines Menschen (`data-human-moves` am Spielfeld).
 * - „Karussell“ (nur wenn „direkt“ scheitert, Bedienmodus „Erlaubte Züge“): höchstens 60 Runden aus
 *   0–3 mal Rechts und A. Erfolg wie oben.
 * Stufe: `direct`, sonst `carousel`, sonst `cursor`. Die Stufe ist eine maschinelle Vorsortierung; ob jede
 * Zugart erreichbar ist, prüft K8 von Hand.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { installVirtualPad, pressPad } from './lib/virtual-pad.mjs';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DIST = path.join(ROOT, 'apps/web/dist');
const GAMES_DIR = path.join(ROOT, 'packages/games');

const args = process.argv.slice(2);
let jsonOut = null;
let parallel = 4;
const ids = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--json') jsonOut = args[++i];
  else if (args[i] === '--parallel') parallel = Math.max(1, Number(args[++i]) || 1);
  else ids.push(args[i]);
}

const allGames = fs
  .readdirSync(GAMES_DIR)
  .filter((id) => {
    try {
      return !/\bdraft:\s*true\b/.test(fs.readFileSync(path.join(GAMES_DIR, id, 'src/meta.ts'), 'utf8'));
    } catch {
      return false;
    }
  })
  .sort();
const games = ids.length > 0 ? ids : allGames;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.webmanifest': 'application/manifest+json',
};
const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const filePath = path.join(DIST, urlPath === '/' ? 'index.html' : urlPath);
  if (!filePath.startsWith(DIST) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.RAUCHTEST_CHROMIUM || '/usr/bin/chromium', headless: true });

/** Fester Zufall je Spiel (mulberry32, Startwert = Summe der Zeichencodes der Spiel-id). */
function rngFor(id) {
  let a = [...id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const settings = (mode) =>
  JSON.stringify({ mode, deadzone: 0.25, scanIntervalMs: 1200, haptics: false, prompts: false, hotSeatMode: 'pass' });

async function openGame(id, mode) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.addInitScript(
    ({ value, seed }) => {
      localStorage.setItem('brett-und-blatt:eingabe', value);
      localStorage.setItem('brett-und-blatt:konsole-gefragt', 'ja');
      // Fester Zufall auf der Seite (Startwert der Partie, Kartenmischen), damit zwei Läufe dieselbe Partie sehen.
      let a = seed >>> 0;
      const next = () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let x = a;
        x = Math.imul(x ^ (x >>> 15), x | 1);
        x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
      };
      Math.random = next;
      crypto.getRandomValues = (array) => {
        for (let i = 0; i < array.length; i++) array[i] = Math.floor(next() * 2 ** 32) >>> 0;
        return array;
      };
    },
    { value: settings(mode), seed: [...id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) },
  );
  await installVirtualPad(page);
  await page.goto(`${baseUrl}/#/neu/${id}?autostart=1`, { waitUntil: 'domcontentloaded' });
  try {
    await page.locator('main.bub-table').waitFor({ timeout: 15000 });
  } catch {
    await context.close();
    return null;
  }
  await page.waitForTimeout(300);
  return { context, page };
}

/**
 * Wartet, bis ein Mensch an diesem Gerät dran ist (Rahmen `.bub-turn-frame`), damit jeder Lauf im selben Zustand
 * drückt: höchstens 3 s; zeigt ein Spiel den Rahmen nicht (gleichzeitige Phasen, Aufstellen), danach nur noch 300 ms,
 * bis er wieder erscheint.
 */
function turnWaiter(page) {
  let patience = 3000;
  return () =>
    page
      .locator('.bub-turn-frame')
      .first()
      .waitFor({ timeout: patience })
      .then(
        () => {
          patience = 3000;
          return page.waitForTimeout(120);
        },
        () => {
          patience = 300;
        },
      );
}

const readMoves = (page) => page.evaluate(() => Number(document.querySelector('main.bub-table')?.getAttribute('data-human-moves') ?? 0));

/** Züge über Neustarts hinweg zählen: Revanche und Rückkehr auf den Tisch beginnen am Spielfeld wieder bei 0. */
function moveCounter(page) {
  let base = 0;
  let last = 0;
  return async () => {
    const now = await readMoves(page);
    if (now < last) base += last;
    last = now;
    return base + now;
  };
}
const hasTextInput = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('main.bub-table input, main.bub-table textarea')].some((el) => {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return false;
      if (el.tagName === 'TEXTAREA') return true;
      const type = el.getAttribute('type');
      return !type || type === 'text' || type === 'number' || type === 'search';
    }),
  );

/** Liegt die Partie noch an? Wenn nicht, zurück auf den Spieltisch (die laufende Partie ist gespeichert). */
async function stayOnTable(page, stats) {
  const hash = await page.evaluate(() => location.hash);
  if (hash.startsWith('#/partie')) return;
  stats.left += 1;
  await page.goto(`${baseUrl}/#/partie`, { waitUntil: 'domcontentloaded' });
  await page.locator('main.bub-table').waitFor({ timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(200);
}

async function directRun(id, stats) {
  const opened = await openGame(id, 'standard');
  if (!opened) return { started: false };
  const { context, page } = opened;
  const rand = rngFor(id);
  const humanMoves = moveCounter(page);
  const waitForTurn = turnWaiter(page);
  let presses = 0;
  try {
    for (let i = 0; i < 250; i++) {
      await humanMoves();
      await stayOnTable(page, stats);
      await waitForTurn();
      let inBoard = false;
      for (let tries = 0; tries <= 4; tries++) {
        inBoard = await page.evaluate(() => Boolean(document.activeElement?.closest('[data-focus-zone="play-board"]')));
        if (inBoard || tries === 4) break;
        await pressPad(page, 5, 50, 40);
        presses += 1;
      }
      if (!inBoard) stats.focusLost += 1;
      const r = rand();
      const button = r < 0.6 ? 12 + Math.floor((r / 0.6) * 4) : 0;
      await pressPad(page, button, 50, 60);
      presses += 1;
      if (i % 10 === 0 && !stats.textInput && (await hasTextInput(page))) stats.textInput = true;
      if ((await humanMoves()) >= 3) return { started: true, ok: true, presses };
    }
    return { started: true, ok: false };
  } finally {
    await context.close();
  }
}

async function carouselRun(id, stats) {
  const opened = await openGame(id, 'legalMoves');
  if (!opened) return { started: false };
  const { context, page } = opened;
  const rand = rngFor(id);
  const humanMoves = moveCounter(page);
  let presses = 0;
  try {
    for (let round = 0; round < 60; round++) {
      await humanMoves();
      await stayOnTable(page, stats);
      const bar = await page.locator('.bub-carousel-bar').waitFor({ timeout: 5000 }).then(() => true, () => false);
      if (!bar) {
        await page.waitForTimeout(500);
        continue;
      }
      const steps = Math.floor(rand() * 4);
      for (let s = 0; s < steps; s++) {
        await pressPad(page, 15, 50, 40);
        presses += 1;
      }
      await pressPad(page, 0, 50, 40);
      presses += 1;
      await page.waitForTimeout(300);
      if (!stats.textInput && (await hasTextInput(page))) stats.textInput = true;
      if ((await humanMoves()) >= 3) return { started: true, ok: true, presses };
    }
    return { started: true, ok: false };
  } finally {
    await context.close();
  }
}

async function audit(id) {
  const stats = { focusLost: 0, left: 0, textInput: false };
  let grade = 'cursor';
  let presses = null;
  let note = '';
  const direct = await directRun(id, stats);
  if (!direct.started) note = 'startFailed';
  else if (direct.ok) {
    grade = 'direct';
    presses = direct.presses;
  } else {
    const carousel = await carouselRun(id, stats);
    if (carousel.ok) {
      grade = 'carousel';
      presses = carousel.presses;
    }
  }
  return { focusLost: stats.focusLost, grade, left: stats.left, note, presses, textInput: stats.textInput };
}

const results = {};
const queue = [...games];
const started = Date.now();
try {
  await Promise.all(
    Array.from({ length: Math.min(parallel, queue.length) }, async () => {
      while (queue.length > 0) {
        const id = queue.shift();
        const result = await audit(id);
        results[id] = result;
        console.log(
          `${id.padEnd(22)} ${result.grade.padEnd(8)} Drücke ${String(result.presses ?? '–').padStart(4)}  Fokus verloren ${String(result.focusLost).padStart(3)}  verlassen ${result.left}${result.textInput ? '  Texteingabe' : ''}${result.note ? `  ${result.note}` : ''}`,
        );
      }
    }),
  );
} finally {
  await browser.close();
  server.close();
}

const counts = { direct: 0, carousel: 0, cursor: 0 };
for (const r of Object.values(results)) counts[r.grade] += 1;
console.log(`\n${Object.keys(results).length} Spiele in ${Math.round((Date.now() - started) / 1000)} s: direct ${counts.direct}, carousel ${counts.carousel}, cursor ${counts.cursor}`);

if (jsonOut) {
  const sorted = {};
  for (const id of Object.keys(results).sort()) {
    const r = results[id];
    sorted[id] = { focusLost: r.focusLost, grade: r.grade, left: r.left, note: r.note, presses: r.presses, textInput: r.textInput };
  }
  fs.writeFileSync(jsonOut, `${JSON.stringify(sorted, null, 2)}\n`);
}
