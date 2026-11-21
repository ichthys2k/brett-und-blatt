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
const browser = await chromium.launch(process.env.RAUCHTEST_CHROMIUM ? { executablePath: process.env.RAUCHTEST_CHROMIUM } : {});

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
      localStorage.setItem('brett-und-blatt:oberflaeche-hinweis', 'gesehen');
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

/** Ziele im Spielfeld, die ein Mensch ansteuern würde; Kopf, Menü und Aufgeben bleiben außen vor. */
const SKIP_LABEL = /aufgeben|remis|zeitmaschine|notiz|regeln|anleitung|zurück|zum menü|tipp|verlassen|neue partie|alle leeren|zurücknehmen|tafel/i;

/** Nummeriert die erreichbaren Ziele im Spielfeld (`data-cp`) und gibt ihre Kennzeichen zurück. */
const listTargets = (page) =>
  page.evaluate((skip) => {
    const zone = document.querySelector('[data-focus-zone="play-board"]');
    if (!zone) return [];
    const re = new RegExp(skip, 'i');
    const sel = 'button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"], [role="button"]:not([aria-disabled="true"])';
    const list = [...zone.querySelectorAll(sel)].filter((e) => e.getClientRects().length > 0 && !re.test(e.getAttribute('aria-label') ?? e.textContent ?? ''));
    return list.map((e, i) => {
      e.setAttribute('data-cp', String(i));
      const tag = e.tagName.toLowerCase();
      const text = tag === 'input' || tag === 'textarea' ? `${tag}:${e.getAttribute('type') ?? 'text'}` : (e.getAttribute('aria-label') ?? e.textContent ?? '').trim().slice(0, 40);
      return `${i}|${tag}|${text}`;
    });
  }, SKIP_LABEL.source);

/**
 * Steuert den Fokus nur mit dem Steuerkreuz auf das Ziel `data-cp=<i>`: Bestensuche über die Wege der räumlichen
 * Navigation. Von einem erreichten Element werden die vier Richtungen gedrückt; als Nächstes erweitert wird immer
 * das erreichte, aber noch nicht erweiterte Element, das dem Ziel am nächsten liegt (höchstens 40 Erweiterungen). Zurück auf ein schon erreichtes Element
 * springt die Suche per `focus()` – dorthin hatte sie das Steuerkreuz ja bereits gebracht. Gibt zurück, ob das Ziel
 * erreicht wurde.
 */
async function steerTo(page, index, count) {
  const state = () =>
    page.evaluate((idx) => {
      const target = document.querySelector(`[data-cp="${idx}"]`);
      const current = document.activeElement;
      if (!target) return { gone: true };
      if (current === target) return { here: true };
      if (!current || current === document.body) return { outside: true };
      if (!current.hasAttribute('data-sv')) current.setAttribute('data-sv', String(document.querySelectorAll('[data-sv]').length));
      const a = target.getBoundingClientRect();
      const b = current.getBoundingClientRect();
      return { id: current.getAttribute('data-sv'), dist: Math.hypot(a.left + a.width / 2 - b.left - b.width / 2, a.top + a.height / 2 - b.top - b.height / 2) };
    }, index);
  try {
    // Ohne Fokus (gleichzeitige Runden setzen keinen) holt ein Druck aufs Steuerkreuz ihn auf die Seite, dann RB ins Spielfeld.
    for (const button of [13, 5, 5]) {
      const s = await state();
      if (!s.outside) break;
      await pressPad(page, button, 50, 50);
      count.presses += 1;
    }
    let s = await state();
    if (s.here) return true;
    if (s.gone || s.outside) return false;
    // Vorrat: alle bisher erreichten, noch nicht erweiterten Elemente; erweitert wird immer das dem Ziel nächste.
    const seen = new Set([s.id]);
    const frontier = [s];
    for (let step = 0; step < 40 && frontier.length > 0; step++) {
      frontier.sort((a, b) => a.dist - b.dist);
      const current = frontier.shift();
      for (const button of [12, 13, 14, 15]) {
        await page.evaluate((id) => document.querySelector(`[data-sv="${id}"]`)?.focus(), current.id);
        await pressPad(page, button, 40, 40);
        count.presses += 1;
        const r = await state();
        if (r.here) return true;
        if (r.gone) return false;
        if (r.outside || seen.has(r.id)) continue;
        seen.add(r.id);
        frontier.push(r);
      }
    }
    // Rückfall: Breitensuche über alle Wege von Steuerkreuz und LB/RB (höchstens 150 Elemente). Ein Mensch fände den Weg auch.
    const queue = [...seen];
    const done = new Set();
    while (queue.length > 0 && done.size < 150) {
      const id = queue.shift();
      if (done.has(id)) continue;
      done.add(id);
      // Hier auch LB/RB: Aus dem Menü führt ein Mensch den Fokus mit RB zurück ins Spielfeld.
      for (const button of [12, 13, 14, 15, 4, 5]) {
        await page.evaluate((v) => document.querySelector(`[data-sv="${v}"]`)?.focus(), id);
        await pressPad(page, button, 30, 30);
        count.presses += 1;
        const r = await state();
        if (r.here) return true;
        if (r.gone) return false;
        if (!r.outside && !seen.has(r.id)) {
          seen.add(r.id);
          queue.push(r.id);
        }
      }
    }
    return false;
  } finally {
    await page.evaluate(() => document.querySelectorAll('[data-sv]').forEach((e) => e.removeAttribute('data-sv'))).catch(() => {});
  }
}

/** Tippt eine kurze Eingabe auf der Bildschirmtastatur (Steuerkreuz und A) und übernimmt sie mit ✓. */
async function typeOnKeyboard(page, text, count) {
  for (const ch of [...text, '✓']) {
    for (let i = 0; i < 30; i++) {
      const move = await page.evaluate((key) => {
        const target = [...document.querySelectorAll('.bub-vkb-key')].find((b) => b.textContent.trim() === key);
        const current = document.activeElement;
        if (!target || !current?.classList?.contains('bub-vkb-key')) return 'missing';
        if (target === current) return 'here';
        const a = target.getBoundingClientRect();
        const b = current.getBoundingClientRect();
        if (Math.abs(a.top - b.top) > 4) return a.top < b.top ? 'up' : 'down';
        return a.left < b.left ? 'left' : 'right';
      }, ch);
      if (move === 'missing') return false;
      if (move === 'here') break;
      await pressPad(page, { up: 12, down: 13, left: 14, right: 15 }[move], 50, 40);
      count.presses += 1;
    }
    await pressPad(page, 0, 50, 60);
    count.presses += 1;
  }
  return true;
}

/**
 * Gezielter Durchgang (seit K8, #619–#622): Jedes Ziel im Spielfeld wird mit dem Steuerkreuz angesteuert und mit A
 * ausgelöst. Wird kein Zug angenommen, aber die Ziele ändern sich (Auswahl begonnen), geht es eine Stufe tiefer
 * (höchstens drei). Textfelder werden über die Bildschirmtastatur gefüllt („5“). Erfolg bei drei angenommenen Zügen.
 */
async function targetedRun(id, stats) {
  const opened = await openGame(id, 'standard');
  if (!opened) return { started: false };
  const { context, page } = opened;
  const humanMoves = moveCounter(page);
  const waitForTurn = turnWaiter(page);
  const count = { presses: 0 };
  const unreachable = new Set();
  const deadline = Date.now() + 150000;
  try {
    let idleTurns = 0;
    while (Date.now() < deadline && idleTurns < 6) {
      await humanMoves();
      await stayOnTable(page, stats);
      await waitForTurn();
      if ((await humanMoves()) >= 3) return { started: true, ok: true, presses: count.presses, unreachable: unreachable.size };
      const before = await humanMoves();
      let progressed = false;
      let attempts = 0;
      const explore = async (depth) => {
        const targets = await listTargets(page);
        const signature = targets.join('\n');
        for (const entry of targets) {
          if (progressed || attempts >= 40 || Date.now() > deadline) return;
          const [index, tag, label] = entry.split('|');
          if (!(await steerTo(page, index, count))) {
            if (await page.evaluate((i) => Boolean(document.querySelector(`[data-cp="${i}"]`)), index)) {
              unreachable.add(label);
              if (process.env.AUDIT_DEBUG) {
                const where = await page.evaluate(() => `${document.activeElement?.tagName} ${(document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent ?? '').trim().slice(0, 30)} zone=${document.activeElement?.closest('[data-focus-zone]')?.getAttribute('data-focus-zone')}`);
                console.log(`  ${id}: nicht erreicht „${label}“ (Fokus: ${where})`);
              }
            }
            continue;
          }
          attempts += 1;
          await pressPad(page, 0, 50, 220);
          count.presses += 1;
          if (tag === 'input' || tag === 'textarea') {
            if (await page.locator('.bub-vkb-key').first().isVisible().catch(() => false)) {
              stats.textInput = true;
              await typeOnKeyboard(page, '5', count);
            }
          }
          if ((await humanMoves()) > before) {
            progressed = true;
            return;
          }
          const now = (await listTargets(page)).join('\n');
          if (now !== signature && depth < 3) {
            await explore(depth + 1);
            return;
          }
        }
      };
      await explore(1);
      idleTurns = progressed ? 0 : idleTurns + 1;
    }
    return { started: true, ok: (await humanMoves()) >= 3, presses: count.presses, unreachable: unreachable.size };
  } finally {
    stats.unreachable = Math.max(stats.unreachable ?? 0, unreachable.size);
    await context.close();
  }
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
  const stats = { focusLost: 0, left: 0, textInput: false, unreachable: 0 };
  let grade = 'cursor';
  let presses = null;
  let note = '';
  // Erst der schnelle Zufallslauf, bei Misserfolg der gezielte (mehrschrittige Züge, Texteingabe).
  let direct = await directRun(id, stats);
  if (direct.started && !direct.ok) {
    const targeted = await targetedRun(id, stats);
    if (targeted.ok) direct = targeted;
  }
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
  return { focusLost: stats.focusLost, grade, left: stats.left, note, presses, textInput: stats.textInput, unreachable: stats.unreachable };
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
          `${id.padEnd(22)} ${result.grade.padEnd(8)} Drücke ${String(result.presses ?? '–').padStart(4)}  Fokus verloren ${String(result.focusLost).padStart(3)}  verlassen ${result.left}  unerreichbar ${result.unreachable}${result.textInput ? '  Texteingabe' : ''}${result.note ? `  ${result.note}` : ''}`,
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
    sorted[id] = { focusLost: r.focusLost, grade: r.grade, left: r.left, note: r.note, presses: r.presses, textInput: r.textInput, unreachable: r.unreachable };
  }
  fs.writeFileSync(jsonOut, `${JSON.stringify(sorted, null, 2)}\n`);
}
