#!/usr/bin/env node
// Messwerkzeug für die Bildschirmnutzung aller Spiele (#483, Vorhaben #482).
// Misst für jedes Spiel in vier Bildschirmgrößen den Anteil des Spielfelds (main)
// an der Gesamtfläche, Überlauf, Chipgröße und Porträtgröße.
//
//   corepack pnpm build
//   node scripts/platz-messen.mjs [--bilder <Ordner>] [--json <Datei>] [Spiel-ids …]
//   corepack pnpm platz-messen
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const root = new URL('..', import.meta.url);
const port = process.env.PLATZ_MESSEN_PORT ? Number(process.env.PLATZ_MESSEN_PORT) : 4319;
const base = `http://localhost:${port}/`;

// Argumente parsen
let bilderDir = null;
let jsonFile = null;
const positional = [];
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--bilder') {
    bilderDir = args[++i];
  } else if (arg.startsWith('--bilder=')) {
    bilderDir = arg.slice('--bilder='.length);
  } else if (arg === '--json') {
    jsonFile = args[++i];
  } else if (arg.startsWith('--json=')) {
    jsonFile = arg.slice('--json='.length);
  } else if (!arg.startsWith('-')) {
    positional.push(arg);
  }
}

if (bilderDir) {
  mkdirSync(resolve(bilderDir), { recursive: true });
}

// Fertige Spiele auflisten
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

const ids = positional.length > 0 ? positional : all;

// Vorschau-Server starten
const vite = new URL('apps/web/node_modules/vite/bin/vite.js', root).pathname;
const server = spawn(process.execPath, [vite, 'preview', '--port', String(port), '--strictPort'], {
  cwd: new URL('apps/web/', root),
  stdio: ['ignore', 'pipe', 'inherit'],
});
const stop = () => {
  try {
    server.kill();
  } catch {}
};
process.on('exit', stop);
process.on('SIGINT', () => {
  stop();
  process.exit(130);
});
process.on('SIGTERM', () => {
  stop();
  process.exit(143);
});

async function waitForServer() {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base)).ok) return;
    } catch {}
    await sleep(200);
  }
  throw new Error('Vorschau-Server startet nicht – vorher `corepack pnpm build` ausführen.');
}

const sizes = [
  { name: '390×844', width: 390, height: 844 },
  { name: '844×390', width: 844, height: 390 },
  { name: '1024×768', width: 1024, height: 768 },
  { name: '1440×900', width: 1440, height: 900 },
];

const maxSeatGames = [
  { id: 'ludo', count: 6 },
  { id: 'uno', count: 10 },
  { id: 'wolves-sheep', count: 19 },
  { id: 'kniffel', count: 6 },
  { id: 'skat', count: 4 },
  { id: 'doppelkopf', count: 5 },
  { id: 'poker', count: 10 },
  { id: 'maexle', count: 10 },
  { id: 'president', count: 8 },
];

async function measureGameSize(browser, id, size, customSeats = null, takeScreenshot = false) {
  for (let attempt = 0; attempt < 2; attempt++) {
    let context;
    let page;
    try {
      context = await browser.newContext({ viewport: { width: size.width, height: size.height } });
      await context.addInitScript(() => localStorage.setItem('brett-und-blatt:aussehen', 'tavern'));
      if (customSeats) {
        await context.addInitScript(
          ([game, s]) => {
            localStorage.setItem('brett-und-blatt:einstellungen:' + game, JSON.stringify({ seats: s, options: {} }));
          },
          [id, customSeats],
        );
      }
      page = await context.newPage();
      await page.goto(`${base}#/neu/${id}?autostart=1`, { timeout: 20_000 });
      await page.waitForURL(/#\/partie/, { timeout: 20_000 });

      if (id === 'drachenspiel') {
        try {
          await page.locator('.ds-deck-choice').first().click({ timeout: 10_000 });
          await page.getByRole('button', { name: 'Alle Karten behalten' }).click({ timeout: 10_000 });
          await page.locator('.ds-arena').waitFor({ timeout: 10_000 });
          await page.waitForTimeout(500);
        } catch {
          // Weiter versuchen zu messen
        }
      }

      await page.waitForTimeout(1300);

      const m = await page.evaluate(() => {
        const r = (el) => (el ? el.getBoundingClientRect() : null);
        const mainEl = document.querySelector('main');
        if (!mainEl) return null;
        const main = r(mainEl);
        const footer = document.querySelector('footer');
        const chips = [...document.querySelectorAll('.bub-chip')].map(r).filter((x) => x && x.width > 0);
        const portraits = [...document.querySelectorAll('.bub-chip img, .bub-chip .bub-crest-portrait, .bub-seat-ring img')].map(r).filter((x) => x && x.width > 0);
        let board = { width: 0, height: 0 };
        for (const el of mainEl.querySelectorAll(':scope > *:not(.bub-turn-frame)')) {
          const b = el.getBoundingClientRect();
          if (b.width * b.height > board.width * board.height) board = b;
        }
        return {
          main: [main.left, main.top, main.width, main.height].map(Math.round),
          share: Math.round(((main.width * main.height) / (innerWidth * innerHeight)) * 100),
          footerHeight: footer && r(footer) && r(footer).width > 0 ? Math.round(r(footer).height) : 0,
          chips: chips.length,
          chip: chips[0] ? [Math.round(chips[0].width), Math.round(chips[0].height)] : null,
          portrait: portraits[0] ? Math.round(portraits[0].width) : 0,
          ring: Boolean(document.querySelector('.bub-seat-ring-center')),
          menu: Boolean(document.querySelector('[data-bub-menu]')),
          board: [Math.round(board.width), Math.round(board.height)],
          overflow: mainEl.scrollHeight - mainEl.clientHeight,
        };
      });

      if (takeScreenshot && bilderDir) {
        await page.screenshot({ path: resolve(bilderDir, `${id}-${size.width}x${size.height}.png`) });
      }

      await page.close();
      await context.close();

      if (m) return m;
    } catch (e) {
      if (page) {
        try {
          await page.close();
        } catch {}
      }
      if (context) {
        try {
          await context.close();
        } catch {}
      }
      if (attempt === 0) {
        await sleep(600);
        continue;
      }
      return { error: e.message };
    }
  }
  return { error: 'Start fehlgeschlagen' };
}

function formatOverflow(m) {
  const parts = [];
  if (m[0]?.overflow > 0) parts.push(`${m[0].overflow}h`);
  if (m[1]?.overflow > 0) parts.push(`${m[1].overflow}q`);
  if (m[2]?.overflow > 0) parts.push(`${m[2].overflow}t`);
  if (m[3]?.overflow > 0) parts.push(`${m[3].overflow}d`);
  return parts.length > 0 ? `${parts.join(' / ')} px` : '-';
}

function formatZustand(mDesktop) {
  if (!mDesktop || mDesktop.error) return '-';
  if (mDesktop.ring) return 'ring';
  if (mDesktop.menu) return 'compact';
  return 'side';
}

await waitForServer();

const browser = await chromium.launch(
  process.env.RAUCHTEST_CHROMIUM
    ? { executablePath: process.env.RAUCHTEST_CHROMIUM }
    : existsSync('/usr/bin/chromium')
      ? { executablePath: '/usr/bin/chromium' }
      : {},
);

const rawResults = {
  date: new Date().toISOString().split('T')[0],
  sizes: sizes.map((s) => [s.width, s.height]),
  games: {},
  averages: {},
  maxSeats: {},
};

console.log('| Spiel | 390×844 | 844×390 | 1024×768 | 1440×900 | Überlauf | Chip (1440×900) | Porträt | Zustand |');
console.log('|---|---|---|---|---|---|---|---|---|');

const sizeSums = [0, 0, 0, 0];
const sizeCounts = [0, 0, 0, 0];

for (const id of ids) {
  const gameMeasurements = [];
  for (let sIdx = 0; sIdx < sizes.length; sIdx++) {
    const size = sizes[sIdx];
    const takeShot = Boolean(bilderDir);
    const m = await measureGameSize(browser, id, size, null, takeShot);
    gameMeasurements.push(m);
    if (!m.error && typeof m.share === 'number') {
      sizeSums[sIdx] += m.share;
      sizeCounts[sIdx]++;
    }
  }

  rawResults.games[id] = {
    '390x844': gameMeasurements[0],
    '844x390': gameMeasurements[1],
    '1024x768': gameMeasurements[2],
    '1440x900': gameMeasurements[3],
  };

  const s0 = gameMeasurements[0].error ? 'Fehler' : `${gameMeasurements[0].share} %`;
  const s1 = gameMeasurements[1].error ? 'Fehler' : `${gameMeasurements[1].share} %`;
  const s2 = gameMeasurements[2].error ? 'Fehler' : `${gameMeasurements[2].share} %`;
  const s3 = gameMeasurements[3].error ? 'Fehler' : `${gameMeasurements[3].share} %`;
  const ov = formatOverflow(gameMeasurements);
  const dM = gameMeasurements[3];
  const chipStr = dM && !dM.error && dM.chip ? `${dM.chip[0]} × ${dM.chip[1]} px` : '-';
  const portraitStr = dM && !dM.error && dM.portrait ? `${dM.portrait} px` : '-';
  const zustandStr = formatZustand(dM);

  console.log(`| ${id} | ${s0} | ${s1} | ${s2} | ${s3} | ${ov} | ${chipStr} | ${portraitStr} | ${zustandStr} |`);
}

const averages = sizeSums.map((sum, i) => (sizeCounts[i] > 0 ? Math.round(sum / sizeCounts[i]) : 0));
rawResults.averages = {
  '390x844': averages[0],
  '844x390': averages[1],
  '1024x768': averages[2],
  '1440x900': averages[3],
};

console.log(
  `| **Durchschnitt** | **${averages[0]} %** | **${averages[1]} %** | **${averages[2]} %** | **${averages[3]} %** | | | | |`,
);

// Zweiter Durchlauf mit höchster Platzzahl für feste Auswahl (nur bei vollem Lauf ohne spezifische Spieleauswahl)
if (positional.length === 0) {
  console.log('\n### Höchste Platzzahl (Auswahl)\n');
  console.log('| Spiel | Plätze | 390×844 | 844×390 | 1024×768 | 1440×900 | Überlauf | Chip (1440×900) | Zustand |');
  console.log('|---|---|---|---|---|---|---|---|---|');

  for (const item of maxSeatGames) {
    const seats = Array.from({ length: item.count }, (_, i) => {
      if (item.id === 'wolves-sheep') {
        return {
          kind: i < 4 ? 'human' : 'bot',
          name: i === 0 ? 'Du' : i < 4 ? `Mensch ${i + 1}` : `Bot ${i + 1}`,
          level: 'medium',
        };
      }
      return i === 0 ? { kind: 'human', name: 'Du' } : { kind: 'bot', name: '', level: 'medium' };
    });

    const maxMeasurements = [];
    for (const size of sizes) {
      const m = await measureGameSize(browser, item.id, size, seats, false);
      maxMeasurements.push(m);
    }

    rawResults.maxSeats[item.id] = {
      seats: item.count,
      '390x844': maxMeasurements[0],
      '844x390': maxMeasurements[1],
      '1024x768': maxMeasurements[2],
      '1440x900': maxMeasurements[3],
    };

    const s0 = maxMeasurements[0].error ? 'Fehler' : `${maxMeasurements[0].share} %`;
    const s1 = maxMeasurements[1].error ? 'Fehler' : `${maxMeasurements[1].share} %`;
    const s2 = maxMeasurements[2].error ? 'Fehler' : `${maxMeasurements[2].share} %`;
    const s3 = maxMeasurements[3].error ? 'Fehler' : `${maxMeasurements[3].share} %`;
    const ov = formatOverflow(maxMeasurements);
    const dM = maxMeasurements[3];
    const chipStr = dM && !dM.error && dM.chip ? `${dM.chip[0]} × ${dM.chip[1]} px` : '-';
    const zustandStr = formatZustand(dM);

    console.log(`| ${item.id} | ${item.count} | ${s0} | ${s1} | ${s2} | ${s3} | ${ov} | ${chipStr} | ${zustandStr} |`);
  }
}

if (jsonFile) {
  writeFileSync(resolve(jsonFile), JSON.stringify(rawResults, null, 2), 'utf8');
  console.log(`\nRohdaten in ${jsonFile} gespeichert.`);
}

await browser.close();
stop();
