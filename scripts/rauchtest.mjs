// Browser-Rauchtest: öffnet jedes fertige Spiel der gebauten Web-App nacheinander in
// derselben Seite (wie jemand, der mehrere Spiele ausprobiert) und prüft, dass es startet.
//
//   corepack pnpm build
//   corepack pnpm exec playwright install chromium   # einmal je Rechner
//   node scripts/rauchtest.mjs                        # optional: Spiel-ids als Argumente
//
// Geprüft wird je Spiel (Handy-Hochformat 390 × 844):
// - keine unbehandelten Fehler und keine Fehler in der Konsole (fehlende Klangdateien und der
//   optionale Abruf des Bibel-Quiz-Katalogs vom Spieleserver ausgenommen),
// - die Partie startet (Seite #/partie, Spielfeld mit sichtbarem Inhalt),
// - die Seite rollt nicht und das Spielfeld verdeckt die Knöpfe darunter nicht (zu viel Inhalt rollt im Spielfeld),
// - auf Wunsch Bilder für den Vergleich der Aussehen: RAUCHTEST_LOOK=tavern, RAUCHTEST_FARBE=dark, RAUCHTEST_BILDER=<Ordner>
// - nach dem Start eines anderen Spiels bleibt das Spielfeld so groß wie beim frischen Laden
//   (fängt CSS-Kollisionen zwischen Spielen).
import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
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
// Spiele mit Vorphasen: Erst danach zeigt sich die eigentliche Spielfläche. (Das Drachenspiel
// stürzte beim Übergang in die Partie ab, ohne dass der reine Start es bemerkte.)
const firstSteps = {
  drachenspiel: async (page) => {
    await page.locator('.ds-deck-choice').first().click();
    await page.getByRole('button', { name: 'Alle Karten behalten' }).click({ timeout: 10_000 });
    await page.locator('.ds-arena').waitFor({ timeout: 10_000 });
    await page.waitForTimeout(500);
  },
  'four-in-a-row': async (page) => {
    const active = page.locator('.c4-board button:not([disabled])');
    if ((await active.count()) > 0) {
      await active.first().click();
      await page.waitForTimeout(600);
      await active.nth(3).click();
      await page.waitForTimeout(600);
    }
  },
};

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
    // Die Knöpfe unter dem Spielfeld müssen ganz sichtbar und frei antippbar sein.
    let footerBlocked = 0;
    for (const button of document.querySelectorAll('footer button')) {
      const r = button.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (r.bottom > window.innerHeight + 1 || (hit && !button.contains(hit))) footerBlocked++;
    }
    return { pageHeight: document.documentElement.scrollHeight, board, interactive, overflow, footerBlocked };
  });
}

await waitForServer();
const shots = process.env.RAUCHTEST_BILDER;
if (shots) mkdirSync(shots, { recursive: true });
const contextOptions = { viewport, colorScheme: process.env.RAUCHTEST_FARBE === 'dark' ? 'dark' : 'light' };
const newPage = async () => {
  const page = await browser.newPage(contextOptions);
  // Jede Verletzung der Content-Security-Policy (#322) mitschreiben; sie gilt als Fehler.
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  if (process.env.RAUCHTEST_LOOK) await page.addInitScript((look) => localStorage.setItem('brett-und-blatt:aussehen', look), process.env.RAUCHTEST_LOOK);
  return page;
};
// Ein vorhandenes Chromium (z. B. /usr/bin/chromium) statt des von Playwright geladenen nutzen.
const browser = await chromium.launch(process.env.RAUCHTEST_CHROMIUM ? { executablePath: process.env.RAUCHTEST_CHROMIUM } : {});
const problems = [];
try {
  if (shots) {
    const home = await newPage();
    await home.goto(base);
    await home.waitForTimeout(800);
    await home.screenshot({ path: `${shots}/_startseite.png` });
    await home.screenshot({ path: `${shots}/_startseite-ganz.png`, fullPage: true });
    await home.close();
  }

  // Erst jedes Spiel frisch laden und messen …
  const fresh = new Map();
  for (const id of ids) {
    const page = await newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      // Die Kataloge von Bibel-Quiz, Wortspielen und Klassenspielen sind optional: Die App nimmt die mitgelieferte Datei,
      // wenn der Spieleserver aus dieser Herkunft nicht erlaubt oder (noch) nicht erreichbar ist.
      // Der Browser meldet diesen fehlgeschlagenen Abruf als Konsolenfehler – das Spiel startet trotzdem.
      if (m.type() === 'error' && !/Failed to load resource|klaenge|\.mp3|bibelquiz\/fragen|wortspiele\/|klassenspiele\//i.test(m.text())) errors.push(m.text());
    });
    try {
      const m = await startGame(page, id);
      fresh.set(id, m);
      await firstSteps[id]?.(page);
      if (shots) await page.screenshot({ path: `${shots}/${id}.png` });
      if (errors.length) problems.push(`${id}: Fehler beim Start – ${errors.slice(0, 2).join(' | ')}`);
      const violations = await page.evaluate(() => window.__csp ?? []);
      if (violations.length) problems.push(`${id}: CSP-Verletzung – ${violations.slice(0, 2).join(' | ')}`);
      if (m.interactive === 0) problems.push(`${id}: Spielfeld ohne Bedienelemente`);
      if (m.pageHeight > viewport.height + 2) problems.push(`${id}: Seite ist ${m.pageHeight} px hoch und rollt (Bildschirm ${viewport.height} px)`);
      if (m.footerBlocked > 0) problems.push(`${id}: ${m.footerBlocked} Knöpfe unter dem Spielfeld verdeckt oder außerhalb des Bildschirms`);
      // Hochformat: Die Spielerleiste ist eingeklappt und klappt über ☰ über dem Spielfeld auf, ohne die Seite zu verlängern (#114).
      const players = page.locator('#bub-players');
      if (await players.isVisible()) problems.push(`${id}: Spielerleiste ist im Hochformat nicht eingeklappt`);
      await page.locator('.bub-players-toggle').click({ timeout: 2_000 });
      const opened = await page.evaluate(() => ({
        shown: document.querySelector('#bub-players')?.getBoundingClientRect().height ?? 0,
        pageHeight: document.documentElement.scrollHeight,
      }));
      if (opened.shown === 0) problems.push(`${id}: Spielerleiste klappt mit ☰ nicht auf`);
      if (opened.pageHeight > viewport.height + 2) problems.push(`${id}: aufgeklappte Spielerleiste verlängert die Seite (${opened.pageHeight} px)`);
      await page.keyboard.press('Escape');
    } catch (e) {
      problems.push(`${id}: startet nicht – ${e.message.split('\n')[0]}`);
    }
    await page.close();
  }

  // … dann alle nacheinander in derselben Seite: Die CSS früherer Spiele bleibt aktiv.
  const page = await newPage();
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

  // Spieler rund um den Tisch: bei höchster Platzzahl auf Tablet und Desktop, auf dem Handy die Leiste.
  const ringGames = { 'mau-mau': 5, skat: 4, schafkopf: 4, doppelkopf: 5, binokel: 4, elevens: 6, president: 8, 'black-peter': 6, uno: 8, quartett: 6, dominoes: 4, maexle: 8, 'market-stalls': 8 };
  for (const [id, count] of Object.entries(ringGames)) {
    if (!ids.includes(id)) continue;
    for (const [width, height] of [[1024, 768], [1280, 800], [768, 1024], [390, 844]]) {
      const context = await browser.newContext({ viewport: { width, height } });
      const ringPage = await context.newPage();
      await ringPage.goto(base);
      await ringPage.evaluate(
        ([game, seats]) => localStorage.setItem(`brett-und-blatt:einstellungen:${game}`, JSON.stringify({ seats, options: {} })),
        [id, Array.from({ length: count }, (_, i) => (i === 0 ? { kind: 'human', name: 'Du' } : { kind: 'bot', name: '', level: 'medium' }))],
      );
      const m = await startGame(ringPage, id);
      const ring = await ringPage.evaluate(() => {
        const main = document.querySelector('main').getBoundingClientRect();
        const pile = document.querySelector('.mau-pile')?.getBoundingClientRect();
        const clipped = [...document.querySelectorAll('header button, footer button')].filter((b) => {
          const r = b.getBoundingClientRect();
          return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1);
        }).length;
        const center = document.querySelector('.bub-seat-ring-center')?.getBoundingClientRect();
        const seats = [...document.querySelectorAll('.bub-seat-ring-seat')].map((el) => el.getBoundingClientRect());
        const overlap = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
        return {
          mainWidth: main.width,
          pileWidth: pile?.width ?? null,
          clipped,
          shown: Boolean(center),
          collisions: seats.filter((a, i) => seats.slice(i + 1).some((b) => overlap(a, b)) || (center && overlap(a, center))).length,
          outside: seats.filter((a) => a.left < main.left - 1 || a.right > main.right + 1 || a.top < main.top - 1 || a.bottom > main.bottom + 1).length,
        };
      });
      const where = `${id} zu ${count} bei ${width}×${height}`;
      if (ring.shown !== width >= 768) problems.push(`${where}: Tisch ${ring.shown ? 'erscheint auf dem Handy' : 'fehlt'}`);
      if (ring.shown && ring.mainWidth < width - 2) problems.push(`${where}: Seitenleiste nimmt noch Platz (${ring.mainWidth} px)`);
      if (ring.shown && width >= 1024 && ring.pileWidth !== null && ring.pileWidth < 100) problems.push(`${where}: Stapel zu klein (${ring.pileWidth} px)`);
      if (ring.clipped > 0) problems.push(`${where}: ${ring.clipped} Knöpfe ragen aus dem Bildschirm`);
      if (ring.collisions > 0) problems.push(`${where}: ${ring.collisions} Plätze überlappen`);
      if (ring.outside > 0) problems.push(`${where}: ${ring.outside} Plätze ragen aus dem Spielfeld`);
      if (m.pageHeight > height + 2) problems.push(`${where}: Seite rollt (${m.pageHeight} px)`);
      if (m.footerBlocked > 0) problems.push(`${where}: Knöpfe verdeckt`);
      await context.close();
    }
  }
  // Poker setzt bis zu zehn Spieler mit dem gemeinsamen Tisch (SeatRing): kein Überlappen, nichts außerhalb.
  if (ids.includes('poker')) {
    for (const [width, height, count] of [[1280, 800, 10], [768, 1024, 10], [1024, 768, 6], [1280, 800, 2]]) {
      const context = await browser.newContext({ viewport: { width, height } });
      const pokerPage = await context.newPage();
      await pokerPage.goto(base);
      await pokerPage.evaluate(
        ([seats]) => localStorage.setItem('brett-und-blatt:einstellungen:poker', JSON.stringify({ seats, options: {} })),
        [Array.from({ length: count }, (_, i) => (i === 0 ? { kind: 'human', name: 'Du' } : { kind: 'bot', name: '', level: 'medium' }))],
      );
      const m = await startGame(pokerPage, 'poker');
      const ring = await pokerPage.evaluate(() => {
        const stage = document.querySelector('.bub-seat-ring-stage')?.getBoundingClientRect();
        const center = document.querySelector('.bub-seat-ring-center')?.getBoundingClientRect();
        const seats = [...document.querySelectorAll('.bub-seat-ring-seat')].map((el) => el.firstElementChild.getBoundingClientRect());
        const overlap = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
        return {
          shown: Boolean(center),
          collisions: seats.filter((a, i) => seats.slice(i + 1).some((b) => overlap(a, b)) || (center && overlap(a, center))).length,
          outside: stage ? seats.filter((a) => a.left < 0 || a.right > innerWidth || a.top < 0).length : 0,
        };
      });
      const where = `poker zu ${count} bei ${width}×${height}`;
      if (!ring.shown) problems.push(`${where}: Tisch fehlt`);
      if (ring.collisions > 0) problems.push(`${where}: ${ring.collisions} Plätze überlappen`);
      if (ring.outside > 0) problems.push(`${where}: ${ring.outside} Plätze ragen aus dem Bild`);
      if (m.pageHeight > height + 2) problems.push(`${where}: Seite rollt (${m.pageHeight} px)`);
      await context.close();
    }
  }
  // CSP (#322): Selbst wenn der Bereiniger für Anki-Karten umgangen würde, läuft eingeschleustes Skript nicht.
  {
    const page = await newPage();
    await page.goto(base);
    const meta = await page.evaluate(() => document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content') ?? '');
    if (!meta.includes("script-src 'self'")) problems.push('CSP fehlt in index.html');
    const ran = await page.evaluate(async () => {
      window.__eingeschleust = false;
      const box = document.createElement('div');
      // Genau das, was ein bösartiges Kartenfeld versuchen würde: Inline-Handler und Inline-Skript.
      box.innerHTML = '<img src="data:," onerror="window.__eingeschleust = true">';
      document.body.append(box);
      const script = document.createElement('script');
      script.textContent = 'window.__eingeschleust = true';
      document.body.append(script);
      await new Promise((r) => setTimeout(r, 300));
      box.remove();
      script.remove();
      return window.__eingeschleust;
    });
    if (ran) problems.push('CSP: eingeschleustes Skript lief');
    const blocked = await page.evaluate(() => window.__csp.length);
    if (blocked === 0) problems.push('CSP: der Versuch wurde nicht als Verletzung gemeldet');
    await page.close();
  }
  // Pass-Seite (#145): im Handy-Hochformat rollt nichts waagerecht, und es gibt keine Fehler.
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${base}#/pass`);
    await page.getByRole('heading', { name: /^.{0,3}Profil/ }).waitFor({ timeout: 10_000 });
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (wide > 1) problems.push(`Pass-Seite: rollt waagerecht (${wide} px)`);
    if (errors.length > 0) problems.push(`Pass-Seite: ${errors[0]}`);
    await context.close();
  }
  // Spielhelfer (#106): Übersicht und alle 5 Werkzeuge ohne Fehler und ohne waagerechtes Rollen.
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const hash of ['#/helfer', '#/helfer/wuerfel', '#/helfer/zufall', '#/helfer/startspieler', '#/helfer/uhren', '#/helfer/punkte']) {
      await page.goto(`${base}${hash}`);
      await page.locator('.bub-tav-frame').waitFor({ timeout: 10_000 });
      const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (wide > 1) problems.push(`Spielhelfer (${hash}): rollt waagerecht (${wide} px)`);
    }
    if (errors.length > 0) problems.push(`Spielhelfer: ${errors[0]}`);
    await context.close();
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
console.log('✓ alle Spiele starten sauber, die Pass-Seite passt');
