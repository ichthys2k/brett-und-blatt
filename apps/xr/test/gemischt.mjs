// Gemischte Partie (#339): XR-App (Browser mit WebGL, ohne Brille) gegen die Web-App im
// Handyformat, dazu ein Server-Bot – Mau-Mau zu dritt bis zum Ende. Zählt dabei die Nachrichten
// der XR-App (Lastmessung).
// Voraussetzungen: Spieleserver lokal (8787), XR-App mit `vite preview` (4175) und die Web-App,
// gebaut mit VITE_GAME_SERVER=http://127.0.0.1:8787, mit `vite preview` (4173).
//   node apps/xr/test/gemischt.mjs [mau-mau|tic-tac-toe]
import { chromium, devices } from 'playwright';

const game = process.argv[2] ?? 'mau-mau';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
const xr = await browser.newPage({ viewport: { width: 1280, height: 800 } });
xr.on('pageerror', (e) => errors.push(`XR: ${e}`));
await xr.goto('http://localhost:4175/?server=http://127.0.0.1:8787');
await xr.getByRole('button', { name: 'Neuen Raum anlegen' }).click();
await xr.getByText('Lobby').waitFor();
const code = decodeURIComponent(new URL(xr.url()).hash.slice(1));
await xr.getByRole('combobox').selectOption(game);
await xr.waitForTimeout(400);
if (game === 'mau-mau') {
  await xr.getByRole('button', { name: 'Ein Platz mehr' }).click();
  await xr.waitForTimeout(400);
}
await xr.getByRole('button', { name: 'Hinsetzen' }).first().click();
await xr.waitForTimeout(400);

const phone = await browser.newPage({ ...devices['Pixel 7'] });
phone.on('pageerror', (e) => errors.push(`Handy: ${e}`));
await phone.goto(`http://localhost:4173/#/raum/${encodeURIComponent(code)}`);
await phone.getByPlaceholder('z. B. Anna').fill('Handy');
await phone.getByRole('button', { name: 'Beitreten' }).click();
await phone.getByRole('button', { name: 'Hier sitzen' }).first().click();
await xr.waitForTimeout(800);
if (game === 'mau-mau') {
  await xr.getByRole('button', { name: 'Bot', exact: true }).first().click();
  await xr.waitForTimeout(800);
}
await xr.getByRole('button', { name: 'Partie beginnen' }).click();

const started = Date.now();
let xrMoves = 0;
let phoneMoves = 0;
let result = null;
while (Date.now() - started < 300_000) {
  result = await xr.getByRole('status').filter({ hasText: /gewinnt|Unentschieden|Niemand/ }).first().innerText({ timeout: 200 }).catch(() => null);
  if (result) break;
  const list = xr.getByRole('list', { name: 'Deine Züge' });
  if (await list.isVisible().catch(() => false)) {
    // Ausspielen vor Ziehen, damit die Partie vorankommt.
    const play = list.getByRole('button', { name: /spielen|auf|Spalte/ });
    await ((await play.count()) > 0 ? play.first() : list.getByRole('button').first()).click().catch(() => {});
    xrMoves++;
    await xr.waitForTimeout(500);
    continue;
  }
  const dialog = phone.getByRole('dialog', { name: 'Wunschfarbe wählen' });
  if (await dialog.isVisible().catch(() => false)) {
    await dialog.getByRole('button').first().click().catch(() => {});
    continue;
  }
  // Die Web-App nennt spielbare Karten und Felder über ihre Zugtexte (#335).
  const target = phone.locator('[aria-label*=" spielen –"], [aria-label^="Kreis auf"]');
  if ((await target.count()) > 0) {
    await target.first().click().catch(() => {});
    phoneMoves++;
    await phone.waitForTimeout(500);
    continue;
  }
  const draw = phone.getByRole('button', { name: /^(Karte ziehen|Ziehen|\d+ ziehen)/ });
  if (await draw.first().isVisible().catch(() => false)) {
    await draw.first().click().catch(() => {});
    phoneMoves++;
    await phone.waitForTimeout(500);
    continue;
  }
  await xr.waitForTimeout(300);
}
const stats = await xr.evaluate(() => window.__brettXrStats);
await xr.screenshot({ path: process.env.BILD ?? '/tmp/gemischt-xr.png' });
console.log(JSON.stringify({ game, code, result, seconds: Math.round((Date.now() - started) / 1000), xrMoves, phoneMoves, xrStats: stats, errors }));
await browser.close();
process.exit(result && errors.length === 0 ? 0 : 1);
