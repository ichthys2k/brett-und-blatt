// Gemeinsame Hilfen für die Bilderzeugung (scripts/grafik).
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

export const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const ROH = resolve(WURZEL, 'grafik-roh');

export function ladeManifest(pfad) {
  const datei = resolve(pfad);
  const manifest = JSON.parse(readFileSync(datei, 'utf8'));
  manifest.name = basename(datei, '.json');
  manifest.motive ??= [];
  return manifest;
}

export function ordner(...teile) {
  const pfad = resolve(ROH, ...teile);
  if (!existsSync(pfad)) mkdirSync(pfad, { recursive: true });
  return pfad;
}

export function argumente(argv) {
  const positionen = [];
  const optionen = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [schluessel, wert] = a.slice(2).split('=');
      optionen[schluessel] = wert ?? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true);
    } else positionen.push(a);
  }
  return { positionen, optionen };
}
