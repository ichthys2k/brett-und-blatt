/**
 * Konsolen-Probe (#625, Vorhaben #607 K11): spielt den ganzen Weg durch die Konsolen-Oberfläche nur mit
 * Tasten eines nachgebauten Controllers – Start, Bibliothek, Suche über die Bildschirmtastatur, Spielseite,
 * Partie, Menü, zurück zum Start. Nach `corepack pnpm build`:
 *
 *   node scripts/konsole-probe.mjs
 *
 * Browser wie im Rauchtest: RAUCHTEST_CHROMIUM oder das Chromium von Playwright; PROBE_DIST für einen anderen Bauordner.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { installVirtualPad, pressPad } from './lib/virtual-pad.mjs';

const DIST = path.resolve(process.env.PROBE_DIST || 'apps/web/dist');
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

const A = 0, B = 1, X = 2, LB = 4, RB = 5, START = 9, UP = 12, DOWN = 13, LEFT = 14, RIGHT = 15;

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !/Failed to load resource|klaenge|\.mp3/i.test(msg.text())) errors.push(msg.text());
  });
  await page.addInitScript(() => {
    localStorage.setItem('brett-und-blatt:oberflaeche-hinweis', 'gesehen');
    localStorage.setItem('brett-und-blatt:eingabe', JSON.stringify({ mode: 'standard', deadzone: 0.25, scanIntervalMs: 1200, haptics: false, prompts: true, hotSeatMode: 'pass' }));
  });
  await installVirtualPad(page);
  const press = (button) => pressPad(page, button);

  /** Wartet bis zu 8 s auf eine Bedingung im Browser; sonst Fehler mit dem Namen des Schritts. */
  async function expectState(step, fn, arg) {
    try {
      await page.waitForFunction(fn, arg, { timeout: 8000 });
    } catch {
      const where = await page.evaluate(() => `${location.hash} · Fokus: ${document.activeElement?.outerHTML.slice(0, 140)}`);
      throw new Error(`Konsolen-Probe, Schritt „${step}“ nicht erreicht (${where})`);
    }
  }

  /** Tippt `text` auf der Bildschirmtastatur nur mit Steuerkreuz und A. */
  async function typeOnVirtualKeyboard(text) {
    for (const ch of [...text, '✓']) {
      for (let i = 0; i < 40; i++) {
        const move = await page.evaluate((key) => {
          const target = [...document.querySelectorAll('.bub-vkb-key')].find((b) => b.textContent.trim() === key);
          const current = document.activeElement;
          if (!target || !current?.classList.contains('bub-vkb-key')) return 'missing';
          if (target === current) return 'here';
          const t = target.getBoundingClientRect();
          const c = current.getBoundingClientRect();
          if (Math.abs(t.top - c.top) > 4) return t.top < c.top ? 'up' : 'down';
          return t.left < c.left ? 'left' : 'right';
        }, ch);
        if (move === 'missing') throw new Error(`Bildschirmtastatur: Taste „${ch}“ nicht gefunden oder Fokus außerhalb`);
        if (move === 'here') break;
        await press({ up: UP, down: DOWN, left: LEFT, right: RIGHT }[move]);
      }
      await press(A);
    }
  }

  /** Steuert den Fokus mit dem Steuerkreuz auf das erste sichtbare Element zu `selector` (höchstens 20 Drücke). */
  async function steerTo(selector) {
    for (let i = 0; i < 20; i++) {
      const move = await page.evaluate((sel) => {
        const target = [...document.querySelectorAll(sel)].find((e) => e.getClientRects().length > 0);
        const current = document.activeElement;
        if (!target) return 'missing';
        if (current === target) return 'here';
        const t = target.getBoundingClientRect();
        const c = current?.getBoundingClientRect() ?? { top: 0, left: 0 };
        if (Math.abs(t.top - c.top) > 8) return t.top < c.top ? 'up' : 'down';
        return t.left < c.left ? 'left' : 'right';
      }, selector);
      if (move === 'here' || move === 'missing') return move;
      await press({ up: UP, down: DOWN, left: LEFT, right: RIGHT }[move]);
    }
    return 'far';
  }

  // 1. Start der Konsole
  await page.goto(`${baseUrl}/?modus=konsole#/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => window.dispatchEvent(new Event('gamepadconnected')));
  await expectState('Start', () => document.documentElement.dataset.shell === 'console' && !!document.querySelector('.kns-frame'));

  // 2. Fokus auf einer Kachel, Rahmen sichtbar
  for (let i = 0; i < 10; i++) {
    if (await page.evaluate(() => !!document.activeElement?.hasAttribute('data-kns-game'))) break;
    await press(DOWN);
  }
  await expectState('Fokus auf einer Kachel', () => {
    const el = document.activeElement;
    return !!el?.hasAttribute('data-kns-game') && getComputedStyle(el).outlineStyle !== 'none';
  });

  // 2b. Schnellzugriff mit Start ☰ und B; fünf Hauptreiter mit RB/LB (#638)
  await press(START);
  await expectState('Schnellzugriff offen', () => !!document.querySelector('.kns-quick[aria-modal="true"]') && !!document.activeElement?.closest('.kns-quick'));
  await press(B);
  await expectState('Schnellzugriff zu', () => !document.querySelector('.kns-quick'));
  const tabHashes = ['#/einzelspieler', '#/online', '#/pass', '#/ton'];
  for (const hash of tabHashes) {
    await press(RB);
    await expectState(`Reiter ${hash}`, (h) => location.hash === h && !!document.querySelector('.kns-frame'), hash);
  }
  await expectState('Unterreiter fehlen bei Optionen', () => !document.querySelector('.kns-subbar'));
  await press(LB);
  await expectState('Unterreiter beim Pass', () => location.hash === '#/pass' && document.querySelector('.kns-subtab[aria-current="page"]')?.textContent === 'Pass');
  for (const hash of ['#/online', '#/einzelspieler', '#/']) {
    await press(LB);
    await expectState(`zurück zu ${hash}`, (h) => location.hash === h, hash);
  }

  // 3. Bibliothek, Suche „TIC“ über die Bildschirmtastatur
  await press(RB);
  await expectState('Bibliothek', () => location.hash === '#/einzelspieler' && !!document.querySelector('.kns-grid'));
  await press(X);
  await expectState('Suchfeld', () => document.activeElement?.classList.contains('kns-search'));
  await press(A);
  await expectState('Bildschirmtastatur', () => document.activeElement?.classList.contains('bub-vkb-key'));
  await typeOnVirtualKeyboard('TIC');
  await expectState('Suchergebnis', () => !!document.querySelector('.kns-grid [data-kns-game="tic-tac-toe"]'));

  // 4. Zur Kachel und auf die Spielseite
  // „TIC“ findet auch „Ultimate Tic-Tac-Toe“: zur richtigen Kachel steuern.
  for (let i = 0; i < 10; i++) {
    const move = await page.evaluate(() => {
      const target = document.querySelector('.kns-grid [data-kns-game="tic-tac-toe"]');
      const current = document.activeElement;
      if (!target || current === target) return 'here';
      if (!current?.closest('.kns-grid')) return 'down';
      const t = target.getBoundingClientRect();
      const c = current.getBoundingClientRect();
      if (Math.abs(t.top - c.top) > 4) return t.top < c.top ? 'up' : 'down';
      return t.left < c.left ? 'left' : 'right';
    });
    if (move === 'here') break;
    await press({ up: UP, down: DOWN, left: LEFT, right: RIGHT }[move]);
  }
  await expectState('Kachel Tic-Tac-Toe', () => document.activeElement?.getAttribute('data-kns-game') === 'tic-tac-toe');
  await press(A);
  await expectState('Spielseite', () => location.hash === '#/neu/tic-tac-toe' && document.activeElement?.hasAttribute('data-kns-autofocus'));

  // 5. Spielen
  await press(A);
  await expectState('Partie', () => location.hash.startsWith('#/partie') && !!document.querySelector('main.bub-table'));

  // 6. Ein Zug mit dem Steuerkreuz
  await page.locator('.bub-turn-frame').first().waitFor({ timeout: 8000 });
  await press(DOWN);
  await press(A);
  await expectState('Zug', () => document.querySelector('main.bub-table')?.getAttribute('data-human-moves') === '1');

  // 7. B verlässt die Partie nicht
  await press(B);
  await page.waitForTimeout(200);
  if (!(await page.evaluate(() => location.hash.startsWith('#/partie')))) throw new Error('Konsolen-Probe: B hat die Partie verlassen');

  // 8. Menü öffnen und über „Zurück“ verlassen
  await press(START);
  await expectState('Menü', () => !!document.activeElement?.closest('[data-focus-zone="play-menu"]'));
  await steerTo('[data-focus-zone="play-menu"] button[aria-label="Zum Menü"]');
  await expectState('Zurück-Knopf', () => document.activeElement?.getAttribute('aria-label') === 'Zum Menü');
  await press(A);
  await expectState('Partie verlassen', () => !location.hash.startsWith('#/partie'));

  // 9. Start zeigt die laufende Partie mit Fokus auf „Weiterspielen“
  if (!(await page.evaluate(() => location.hash === '#/' || location.hash === ''))) {
    await page.evaluate(() => { location.hash = '#/'; });
  }
  await expectState('Weiterspielen', () => !!document.querySelector('.kns-resume') && document.activeElement?.getAttribute('data-kns-id') === 'resume');

  if (errors.length > 0) throw new Error(`Browser-Fehler: ${errors.join('; ')}`);
  console.log('✓ Konsolen-Probe erfolgreich (Start, Schnellzugriff, fünf Reiter, Bibliothek, Suche, Spielseite, Partie, Menü, Weiterspielen).');
} finally {
  await browser.close();
  server.close();
}
