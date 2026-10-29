// Browser-Rauchtest: öffnet jedes fertige Spiel der gebauten Web-App nacheinander in
// derselben Seite (wie jemand, der mehrere Spiele ausprobiert) und prüft, dass es startet.
//
//   corepack pnpm build
//   corepack pnpm exec playwright install chromium   # einmal je Rechner
//   node scripts/rauchtest.mjs                        # optional: Spiel-ids als Argumente
//
// Geprüft wird je Spiel (Handy-Hochformat 390 × 844):
// - keine unbehandelten Fehler und keine Fehler in der Konsole (fehlende Klangdateien ausgenommen),
// - die Partie startet (Seite #/partie, Spielfeld mit sichtbarem Inhalt),
// - die Seite bleibt höchstens dreimal so hoch wie der Bildschirm (fängt z. B. riesige Handkarten),
// - nach dem Start eines anderen Spiels bleibt das Spielfeld so groß wie beim frischen Laden
//   (fängt CSS-Kollisionen zwischen Spielen).
import { spawn } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const root = new URL('..', import.meta.url);
const port = 4317;
const base = `http://localhost:${port}/`;
const viewport = { width: 390, height: 844 };

const gamesDir = new URL('packages/games/', root);
const all = readdirSync(gamesDir)
  .filter((id) => {
    try {
      return !/\bdraft:\s*true\b/.test(readFileSync(new URL(`${id}/src/meta.ts`, gamesDir), 'utf8'));
    } catch {
      return false;
    }
  })
  .sort();
const ids = process.argv.slice(2).length > 0 ? process.argv.slice(2) : all;

const vite = new URL('apps/web/node_modules/vite/bin/vite.js', root).pathname;
const server = spawn(process.execPath, [vite, 'preview', '--port', String(port), '--strictPort'], {
  cwd: new URL('apps/web/', root),
  stdio: ['ignore', 'pipe', 'inherit'],
});
const stop = () => server.kill();
process.on('exit', stop);

async function waitForServer() {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base)).ok) return;
    } catch {
      // Server startet noch
    }
    await sleep(200);
  }
  throw new Error('Vorschau-Server startet nicht – vorher `corepack pnpm build` ausführen.');
}

/** Startet ein Spiel mit Voreinstellungen und misst das Spielfeld. */
async function startGame(page, id) {
  await page.goto(`${base}#/neu/${id}?autostart=1`);
  await page.waitForURL(/#\/partie/, { timeout: 10_000 });
  await page.waitForTimeout(1_200);
  return page.evaluate(() => {
    const main = document.querySelector('main') ?? document.body;
    // Das größte sichtbare Element mit Inhalt unterhalb der Kopfzeile gilt als Spielfeld.
    let board = { width: 0, height: 0 };
    for (const el of main.querySelectorAll('div, section, svg')) {
      const r = el.getBoundingClientRect();
      if (r.width * r.height > board.width * board.height && r.height < window.innerHeight * 3 && el.querySelector('button, svg, img, [role]')) {
        board = { width: Math.round(r.width), height: Math.round(r.height) };
      }
    }
    const interactive = main.querySelectorAll('button:not([disabled]), [role="button"], svg').length;
    // Wie weit quillt Inhalt in einem Bereich mit eigenem Rollbalken über? (Zerfallenes Raster)
    let overflow = 0;
    for (const el of main.querySelectorAll('*')) {
      if (/auto|scroll/.test(getComputedStyle(el).overflowY)) overflow = Math.max(overflow, el.scrollHeight - el.clientHeight);
    }
    return { pageHeight: document.documentElement.scrollHeight, board, interactive, overflow };
  });
}

await waitForServer();
// Ein vorhandenes Chromium (z. B. /usr/bin/chromium) statt des von Playwright geladenen nutzen.
const browser = await chromium.launch(process.env.RAUCHTEST_CHROMIUM ? { executablePath: process.env.RAUCHTEST_CHROMIUM } : {});
const problems = [];
try {
  // Erst jedes Spiel frisch laden und messen …
  const fresh = new Map();
  for (const id of ids) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/Failed to load resource|klaenge|\.mp3/i.test(m.text())) errors.push(m.text());
    });
    try {
      const m = await startGame(page, id);
      fresh.set(id, m);
      if (errors.length) problems.push(`${id}: Fehler beim Start – ${errors.slice(0, 2).join(' | ')}`);
      if (m.interactive === 0) problems.push(`${id}: Spielfeld ohne Bedienelemente`);
      if (m.pageHeight > viewport.height * 3) problems.push(`${id}: Seite ist ${m.pageHeight} px hoch (mehr als dreimal der Bildschirm)`);
    } catch (e) {
      problems.push(`${id}: startet nicht – ${e.message.split('\n')[0]}`);
    }
    await page.close();
  }

  // … dann alle nacheinander in derselben Seite: Die CSS früherer Spiele bleibt aktiv.
  const page = await browser.newPage({ viewport });
  for (const id of ids) {
    if (!fresh.has(id)) continue;
    try {
      const m = await startGame(page, id);
      const before = fresh.get(id).board;
      const shrunk = m.board.width < before.width * 0.7 || m.board.height < before.height * 0.7;
      const grown = m.pageHeight > Math.max(fresh.get(id).pageHeight * 1.5, viewport.height * 1.5);
      const spilled = m.overflow > fresh.get(id).overflow + 300;
      if (shrunk || grown || spilled) {
        problems.push(
          `${id}: sieht nach anderen Spielen anders aus (Spielfeld ${before.width}×${before.height} → ${m.board.width}×${m.board.height}, ` +
            `Seite ${m.pageHeight} px, Überlauf ${fresh.get(id).overflow} → ${m.overflow} px) – CSS-Kollision?`,
        );
      }
    } catch (e) {
      problems.push(`${id}: startet nach anderen Spielen nicht – ${e.message.split('\n')[0]}`);
    }
  }
} finally {
  await browser.close();
  stop();
}

console.log(`Rauchtest: ${ids.length} Spiele geprüft.`);
if (problems.length) {
  console.error(problems.map((p) => `✗ ${p}`).join('\n'));
  process.exit(1);
}
console.log('✓ alle Spiele starten sauber');
