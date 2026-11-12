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
// Größe aus dem Manifest; ein Motiv darf eine eigene Größe mitbringen (z. B. Urkunde neben Pokalen).
const groesseFuer = (id) => manifest.motive.find((m) => m.id === id)?.groesse ?? manifest.groesse ?? [320, 400];
// Optional: einen schmalen Rand (Anteil, z. B. 0.06) abschneiden, falls die KI Platten- oder Bildränder malt.
const randFuer = (id) => manifest.motive.find((m) => m.id === id)?.zuschnittRand ?? manifest.zuschnittRand ?? 0;

for (const wahl of positionen.slice(1)) {
  const [id, v] = wahl.split('=');
  const rand = randFuer(id);
  const [breite, hoehe] = groesseFuer(id);
  const quelle = resolve(ordner(manifest.name, id), `v${v}.png`);
  const ziel = resolve(zielDir, `${manifest.praefix ?? ''}${id}${manifest.suffix ?? ''}.webp`);
  execFileSync('magick', [quelle, ...(rand ? ['-gravity', 'center', '-crop', `${Math.round((1 - 2 * rand) * 100)}%x${Math.round((1 - 2 * rand) * 100)}%+0+0`, '+repage'] : []), '-resize', `${breite}x${hoehe}^`, '-gravity', 'center', '-extent', `${breite}x${hoehe}`, '-quality', String(manifest.qualitaet ?? 80), ziel]);
  
  // Cornelius-Regel: Das ausgewählte Original in voller Auflösung im Repo archivieren
  const originalDir = resolve(zielDir, 'original');
  mkdirSync(originalDir, { recursive: true });
  const zielOriginal = resolve(originalDir, `${manifest.praefix ?? ''}${id}${manifest.suffix ?? ''}.png`);
  execFileSync('cp', [quelle, zielOriginal]);

  console.log(`${id} v${v} → ${ziel.replace(WURZEL + '/', '')} (${Math.round(statSync(ziel).size / 1024)} KB) + Original: ${zielOriginal.replace(WURZEL + '/', '')}`);
}
