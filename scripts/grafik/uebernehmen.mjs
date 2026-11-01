#!/usr/bin/env node
// Übernimmt gewählte Varianten als WebP ins Projekt (Zielordner und Größe stehen im Manifest).
//   node scripts/grafik/uebernehmen.mjs <Manifest> k-h=2 d-s=1 …
// Benötigt ImageMagick (`magick`).
import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { argumente, ladeManifest, ordner, WURZEL } from './gemeinsam.mjs';

const { positionen } = argumente(process.argv.slice(2));
const manifest = ladeManifest(positionen[0]);
if (!manifest.ziel) throw new Error('Im Manifest fehlt "ziel" (Ordner im Repo).');
const zielDir = resolve(WURZEL, manifest.ziel);
mkdirSync(zielDir, { recursive: true });
const [breite, hoehe] = (manifest.groesse ?? [320, 400]);

for (const wahl of positionen.slice(1)) {
  const [id, v] = wahl.split('=');
  const quelle = resolve(ordner(manifest.name, id), `v${v}.png`);
  const ziel = resolve(zielDir, `${manifest.praefix ?? ''}${id}.webp`);
  execFileSync('magick', [quelle, '-resize', `${breite}x${hoehe}^`, '-gravity', 'center', '-extent', `${breite}x${hoehe}`, '-quality', String(manifest.qualitaet ?? 80), ziel]);
  console.log(`${id} v${v} → ${ziel.replace(WURZEL + '/', '')} (${Math.round(statSync(ziel).size / 1024)} KB)`);
}
