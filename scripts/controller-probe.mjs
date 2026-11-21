/**
 * Browser-Probe für die Controller-Bedienung (#533):
 * Startet eine gebaute Web-App mit gemocktem `navigator.getGamepads()` und prüft
 * Startseite, Optionen (#/ton) und Schach-Partie ohne Maus.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { installVirtualPad, pressPad as pressVirtualPad } from './lib/virtual-pad.mjs';

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
  await installVirtualPad(page);
  const pressPad = (btnIndex) => pressVirtualPad(page, btnIndex);
  // Der einmalige Hinweis „Controller erkannt“ (#624) bleibt hier aus; er hat unten einen eigenen Abschnitt.
  await page.addInitScript(() => localStorage.setItem('brett-und-blatt:konsole-gefragt', 'ja'));

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

  // Schieberegler der Stick-Totzone mit Links/Rechts verstellen (#613)
  const deadzone = page.locator('input[type="range"][min="15"][max="45"]');
  await deadzone.focus();
  const dzBefore = Number(await deadzone.inputValue());
  await pressPad(15); // D-Pad Right
  const dzAfter = Number(await deadzone.inputValue());
  if (!(dzAfter > dzBefore)) {
    throw new Error(`Totzone sollte mit Rechts steigen: vorher ${dzBefore}, nachher ${dzAfter}`);
  }
  await pressPad(14); // D-Pad Left
  const dzBack = Number(await deadzone.inputValue());
  if (dzBack !== dzBefore) {
    throw new Error(`Totzone sollte mit Links zurückgehen: vorher ${dzBefore}, jetzt ${dzBack}`);
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

  // 4. Tic-Tac-Toe im Bedienmodus Standard (#618): Fokus im Brett, A zieht, B und das Menü verlassen die Partie nicht.
  await page.evaluate(() => {
    localStorage.setItem('brett-und-blatt:eingabe', JSON.stringify({ mode: 'standard', deadzone: 0.25, scanIntervalMs: 1200, haptics: false, prompts: true, hotSeatMode: 'pass' }));
    localStorage.removeItem('brett-und-blatt:einstellungen:tic-tac-toe');
  });
  await page.goto(`${baseUrl}/#/neu/tic-tac-toe?autostart=1`, { waitUntil: 'networkidle' });
  await page.evaluate(() => window.dispatchEvent(new Event('gamepadconnected')));
  await page.locator('main.bub-table').waitFor({ timeout: 8000 });
  await page.locator('.bub-turn-frame').first().waitFor({ timeout: 8000 });
  await pressPad(13); // runter
  const inBoard = await page.evaluate(() => Boolean(document.activeElement?.closest('[data-focus-zone="play-board"]')));
  if (!inBoard) {
    throw new Error(`Nach dem ersten Druck sollte der Fokus im Brett liegen, liegt aber auf ${await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 120))}`);
  }
  await pressPad(0); // A
  await page.waitForFunction(() => document.querySelector('main.bub-table')?.getAttribute('data-human-moves') === '1', null, { timeout: 4000 });
  await pressPad(1); // B
  if (!(await page.evaluate(() => location.hash.startsWith('#/partie')))) {
    throw new Error('B darf die Partie nicht verlassen');
  }
  await pressPad(9); // Start: Menü
  await page.waitForTimeout(150);
  const menuFocus = await page.evaluate(() => Boolean(document.activeElement?.closest('[data-focus-zone="play-menu"]')));
  if (!menuFocus) {
    throw new Error('Start sollte das Menü öffnen und den Fokus hineinlegen');
  }
  await pressPad(1); // B schließt das Menü
  if (!(await page.evaluate(() => location.hash.startsWith('#/partie')))) {
    throw new Error('B im Menü darf die Partie nicht verlassen');
  }

  // 5. Hinweis „Controller erkannt“ (#624): erscheint einmal, A schaltet die Konsole ein.
  const offerPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  offerPage.on('pageerror', (err) => errors.push(err.message));
  await installVirtualPad(offerPage);
  await offerPage.goto(`${baseUrl}/#/`, { waitUntil: 'networkidle' });
  await offerPage.evaluate(() => window.dispatchEvent(new Event('gamepadconnected')));
  await pressVirtualPad(offerPage, 13);
  await offerPage.locator('[data-console-offer="yes"]').waitFor({ timeout: 4000 });
  const offerFocus = await offerPage.evaluate(() => document.activeElement?.getAttribute('data-console-offer'));
  if (offerFocus !== 'yes') {
    throw new Error(`Der Hinweis sollte den Fokus auf „Einschalten“ legen, liegt aber auf ${offerFocus}`);
  }
  await pressVirtualPad(offerPage, 0);
  const offerResult = await offerPage.evaluate(() => ({
    shell: document.documentElement.dataset.shell ?? null,
    asked: localStorage.getItem('brett-und-blatt:konsole-gefragt'),
  }));
  if (offerResult.shell !== 'console' || offerResult.asked !== 'ja') {
    throw new Error(`Nach „Einschalten“ sollte die Konsole gelten: ${JSON.stringify(offerResult)}`);
  }
  await offerPage.evaluate(() => localStorage.removeItem('brett-und-blatt:oberflaeche'));
  await offerPage.close();

  if (errors.length > 0) {
    throw new Error(`Browser-Fehler: ${errors.join('; ')}`);
  }
  console.log('✓ Controller-Browser-Probe erfolgreich (Optionen, Schieberegler, Startseite-Zonen, Schach-Karussell, Tic-Tac-Toe mit Steuerkreuz, Hinweis Konsole).');
} finally {
  await browser.close();
  server.close();
}
