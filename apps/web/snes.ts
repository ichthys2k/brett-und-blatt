import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import type { Plugin } from 'vite';

/*
 * Easter Egg „Brett & Blatt 16“ (#596): Das SNES-ROM aus apps/snes läuft im Browser mit EmulatorJS
 * (Snes9x-Kern). Der Plugin legt Emulator und ROM unter `snes/` in die App; die Seite `snes/index.html`
 * (aus public/) startet sie in einem Iframe-Dialog, der erst nach dem Easter-Egg-Auslöser geladen wird.
 *
 * EmulatorJS und sein Snes9x-Kern kommen aus der npm-Registry – nicht als pnpm-Abhängigkeit, weil
 * `@emulatorjs/emulatorjs` über `@emulatorjs/cores` alle rund 50 Kerne nachzieht. Stattdessen werden die
 * beiden Archive mit festem Prüfwert (SHA-512) geladen und einmal je Rechner entpackt
 * (~/.cache/brett-und-blatt-emulatorjs oder SNES_EMU_DIR).
 *
 * Das ROM baut `make -C apps/snes` (oder SNES_ROM zeigt darauf). In der CI (SNES_ROM_STRICT=1) ist ein
 * fehlendes ROM oder ein Fehler beim Laden ein Fehler; sonst bleibt das Easter Egg nur unsichtbar leer.
 * Snes9x ist nur für nicht-kommerzielle Nutzung freigegeben, EmulatorJS steht unter GPL-3.0 (THIRD_PARTY.md).
 */

const VERSION = '4.2.3';
const PAKETE = [
  {
    name: 'emulatorjs',
    url: `https://registry.npmjs.org/@emulatorjs/emulatorjs/-/emulatorjs-${VERSION}.tgz`,
    sha512: '7z3qaA4LwyurhuGvdMUDF9xJpEbxC3SNy9+E9tSaOsRo8FCS2QXam/0k/lc9kqHWRFIlLKWahNjPAStyL0rFnw==',
  },
  {
    name: 'core-snes9x',
    url: `https://registry.npmjs.org/@emulatorjs/core-snes9x/-/core-snes9x-${VERSION}.tgz`,
    sha512: 'JTe9Rv9eOuCkgkG4ILwuCZUqNcVI3m9ju1NHTTjridUlFgJSqL4DUqF/vLKN9olCpsqlJFfcCayAOoikJxefwA==',
  },
] as const;

/** Kerne ohne Threads (brauchen sonst COOP/COEP-Kopfzeilen, die GitHub Pages nicht setzt). */
const KERN_DATEIEN = ['snes9x-wasm.data', 'snes9x-legacy-wasm.data'];
/** Obergrenze für ein ROM, damit nichts Falsches in die App wandert. */
const ROM_MAX_BYTES = 4 * 1024 * 1024;

async function paketHolen(dir: string, paket: (typeof PAKETE)[number]): Promise<string> {
  const ziel = join(dir, paket.name);
  if (existsSync(join(ziel, 'package', 'package.json'))) return join(ziel, 'package');
  const antwort = await fetch(paket.url);
  if (!antwort.ok) throw new Error(`${paket.url}: HTTP ${antwort.status}`);
  const bytes = Buffer.from(await antwort.arrayBuffer());
  const hash = createHash('sha512').update(bytes).digest('base64');
  if (hash !== paket.sha512) throw new Error(`${paket.name}: Prüfwert stimmt nicht (${hash})`);
  const tmp = `${ziel}.tmp`;
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  const archiv = join(tmp, 'paket.tgz');
  writeFileSync(archiv, bytes);
  execFileSync('tar', ['xzf', archiv, '-C', tmp]);
  rmSync(archiv);
  rmSync(ziel, { recursive: true, force: true });
  renameSync(tmp, ziel);
  return join(ziel, 'package');
}

/** Lädt (einmal) und liefert Ordner mit `loader.js`, `src/`, `cores/` usw. – oder null, wenn es nicht ging. */
async function emulatorBereitstellen(): Promise<string | null> {
  const dir = resolve(process.env.SNES_EMU_DIR ?? join(homedir(), '.cache', 'brett-und-blatt-emulatorjs', VERSION));
  const fertig = join(dir, 'emulator');
  if (existsSync(join(fertig, 'loader.js')) && KERN_DATEIEN.every((f) => existsSync(join(fertig, 'cores', f)))) return fertig;
  mkdirSync(dir, { recursive: true });
  const [js, kern] = await Promise.all(PAKETE.map((paket) => paketHolen(dir, paket)));
  // Nur das Nötige in einen Ordner legen: data/ des Emulators plus die zwei Kerne.
  const tmp = `${fertig}.tmp`;
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(join(tmp, 'cores'), { recursive: true });
  execFileSync('cp', ['-r', `${join(js!, 'data')}/.`, tmp]);
  for (const datei of KERN_DATEIEN) execFileSync('cp', [join(kern!, datei), join(tmp, 'cores', datei)]);
  rmSync(fertig, { recursive: true, force: true });
  renameSync(tmp, fertig);
  return fertig;
}

function alleDateien(ordner: string, vor = ''): string[] {
  return readdirSync(ordner, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? alleDateien(join(ordner, e.name), `${vor}${e.name}/`) : [`${vor}${e.name}`]));
}

export function snes(): Plugin {
  let emulator: string | null = null;
  let rom: string | null = null;
  let base = '/';

  return {
    name: 'brett-und-blatt:snes',
    async configResolved(config) {
      base = config.base;
      const streng = process.env.SNES_ROM_STRICT === '1';
      rom = resolve(process.env.SNES_ROM ?? join(config.root, '../snes/brett-und-blatt-16.sfc'));
      if (!existsSync(rom)) {
        if (streng) throw new Error(`SNES-ROM fehlt: ${rom} (make -C apps/snes)`);
        config.logger.warn(`SNES-ROM nicht gefunden (${rom}) – das Easter Egg bleibt leer.`);
        rom = null;
      } else if (statSync(rom).size > ROM_MAX_BYTES) {
        throw new Error(`SNES-ROM größer als ${ROM_MAX_BYTES / 1024 / 1024} MB: ${rom}`);
      }
      try {
        emulator = await emulatorBereitstellen();
      } catch (fehler) {
        if (streng) throw fehler;
        config.logger.warn(`EmulatorJS nicht geladen (${(fehler as Error).message}) – das Easter Egg bleibt leer.`);
        emulator = null;
      }
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const prefix = `${base}snes/`;
        const pfad = req.url?.startsWith(prefix) ? decodeURIComponent(req.url.slice(prefix.length).split('?')[0] ?? '') : null;
        if (!pfad) return next();
        let datei: string | null = null;
        if (pfad === 'spiel.sfc') datei = rom;
        else if (emulator && pfad.startsWith('emulatorjs/') && !pfad.includes('..')) datei = join(emulator, pfad.slice('emulatorjs/'.length));
        if (!datei || !existsSync(datei) || !statSync(datei).isFile()) return next();
        const typ = datei.endsWith('.js') ? 'text/javascript' : datei.endsWith('.css') ? 'text/css' : datei.endsWith('.json') ? 'application/json' : 'application/octet-stream';
        res.setHeader('Content-Type', typ);
        res.end(readFileSync(datei));
      });
    },
    generateBundle() {
      if (rom) this.emitFile({ type: 'asset', fileName: 'snes/spiel.sfc', source: readFileSync(rom) });
      if (!emulator) return;
      for (const datei of alleDateien(emulator)) {
        // Brauchen wir nicht: Übersetzungen außer Deutsch/Englisch und Kerne außer Snes9x sind schon ausgesiebt; Kompressions-DLLs bleiben.
        this.emitFile({ type: 'asset', fileName: `snes/emulatorjs/${datei}`, source: readFileSync(join(emulator, datei)) });
      }
    },
  };
}
