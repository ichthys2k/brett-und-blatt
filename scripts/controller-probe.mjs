/**
 * Browser-Probe für die Controller-Bedienung (#533):
 * Startet eine gebaute Web-App mit gemocktem `navigator.getGamepads()` und prüft
 * Startseite, Optionen (#/ton) und Schach-Partie ohne Maus.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const DIST = path.resolve('apps/web/dist');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  const urlPath = (req.url || '/').split('?')[0];
  const filePath = path.join(DIST, urlPath === '/' ? 'index.html' : urlPath);
  if (!filePath.startsWith(DIST) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}`;

const browser = await chromium.launch({
  executablePath: process.env.RAUCHTEST_CHROMIUM || '/usr/bin/chromium',
  headless: true,
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));

  // Virtuelles Gamepad injizieren
  await page.addInitScript(() => {
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false, touched: false, value: 0 }));
    const pad = {
      id: 'Virtual Test Controller (STANDARD GAMEPAD)',
      index: 0,
      connected: true,
      timestamp: 0,
      mapping: 'standard',
      axes: [0, 0, 0, 0],
      buttons,
    };
    window.__virtPad = pad;
    Object.defineProperty(navigator, 'getGamepads', {
      value: () => [pad, null, null, null],
      configurable: true,
    });
    window.addEventListener('load', () => {
      window.dispatchEvent(new CustomEvent('gamepadconnected', { detail: { gamepad: pad } }));
    });
  });

  const pressPad = async (btnIndex) => {
    await page.evaluate((idx) => {
      window.__virtPad.buttons[idx] = { pressed: true, touched: true, value: 1 };
    }, btnIndex);
    await page.waitForTimeout(90);
    await page.evaluate((idx) => {
      window.__virtPad.buttons[idx] = { pressed: false, touched: false, value: 0 };
    }, btnIndex);
    await page.waitForTimeout(70);
  };

  // 1. Optionen (#/ton): Controller erkannt & Modus umschalten
  await page.goto(`${baseUrl}/#/ton`, { waitUntil: 'networkidle' });
  await page.evaluate(() => window.dispatchEvent(new Event('gamepadconnected')));
  await pressPad(13); // D-Pad Down
  const modeAttr = await page.evaluate(() => document.documentElement.dataset.inputMode);
  if (modeAttr !== 'gamepad') {
    throw new Error(`Erwartet data-input-mode="gamepad", erhalten: ${modeAttr}`);
  }
  const promptVisible = await page.locator('.bub-prompt-bar').isVisible();
  if (!promptVisible) {
    throw new Error('ButtonPrompt-Leiste sollte im Gamepad-Modus sichtbar sein');
  }

  // Tastenhinweise dauerhaft über ✕-Knopf ausblenden
  await page.locator('.bub-prompt-close').click();
  const hiddenAfterClose = !(await page.locator('.bub-prompt-bar').isVisible());
  if (!hiddenAfterClose) {
    throw new Error('ButtonPrompt-Leiste sollte nach Klick auf ✕ ausgeblendet sein');
  }
  const rawStorage = await page.evaluate(() => localStorage.getItem('brett-und-blatt:eingabe'));
  const savedPrompts = await page.evaluate(() => JSON.parse(localStorage.getItem('brett-und-blatt:eingabe') || '{}').prompts);
  if (savedPrompts !== false) {
    throw new Error(`Erwartet prompts: false in localStorage, erhalten: ${savedPrompts}, raw: ${rawStorage}`);
  }

  // 2. Startseite (#/einzelspieler): Zonenwechsel per RB (Button 5)
  await page.goto(`${baseUrl}/#/einzelspieler`, { waitUntil: 'networkidle' });
  await page.evaluate(() => window.dispatchEvent(new Event('gamepadconnected')));
  await page.waitForSelector('[data-focus-zone="home-filters"]');
  await pressPad(5); // RB -> Zone wechseln
  const diag = await page.evaluate(() => ({
    zoneAfterRb: document.activeElement?.closest('[data-focus-zone]')?.getAttribute('data-focus-zone'),
    activeTag: document.activeElement?.tagName,
    zones: [...document.querySelectorAll('[data-focus-zone]')].map((z) => z.getAttribute('data-focus-zone')),
    inputMode: document.documentElement.dataset.inputMode,
  }));
  if (!diag.zoneAfterRb) {
    throw new Error(`Nach RB auf der Startseite kein Zonen-Fokus: ${JSON.stringify(diag)}`);
  }

  // 3. Schach-Partie: Erlaubte-Züge-Karussell + Zug ausführen
  await page.evaluate(() => {
    localStorage.setItem('brett-und-blatt:eingabe', JSON.stringify({ mode: 'legalMoves', deadzone: 0.25, scanIntervalMs: 1200, haptics: false, hotSeatMode: 'pass' }));
    window.dispatchEvent(new Event('storage'));
  });
  await page.goto(`${baseUrl}/#/neu/chess?autostart=1`, { waitUntil: 'networkidle' });
  await page.evaluate(() => window.dispatchEvent(new Event('gamepadconnected')));
  await page.locator('.bub-carousel-bar').waitFor({ timeout: 8000 });
  await pressPad(15); // D-Pad Right -> nächster Zug
  await pressPad(0);  // A -> Zug ausführen

  if (errors.length > 0) {
    throw new Error(`Browser-Fehler: ${errors.join('; ')}`);
  }
  console.log('✓ Controller-Browser-Probe erfolgreich (Optionen, Startseite-Zonen, Schach-Karussell).');
} finally {
  await browser.close();
  server.close();
}
