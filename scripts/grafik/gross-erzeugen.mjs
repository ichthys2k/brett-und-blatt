#!/usr/bin/env node
// Baut die Großfassungen (#419) aus den archivierten Originalen im privaten Repo.
//   node scripts/grafik/gross-erzeugen.mjs <Manifest> [motiv-id …] [--neu]
// Ohne ids: alle Motive des Manifests. Das Manifest braucht die Option `gross: [Breite, Höhe]`
// (optional `grossQualitaet`, Standard 80). Quelle ist das Original
// `<Originale>/<ziel>/<praefix><id><suffix>.<png|jpg|jpeg|webp>`, nicht grafik-roh/.
// Ergebnis: `<ziel>/gross/<praefix><id><suffix>.webp`, gleicher Dateiname wie die kleine Fassung.
// Es wird nie vergrößert: ist das Original kleiner als die Zielgröße, bekommt die Datei die
// Originalgröße (im Seitenverhältnis zugeschnitten) und es gibt eine Warnung.
// Fehlende Originale werden übersprungen und am Ende aufgelistet (Exit-Code 0).
// Vorhandene Großfassungen bleiben, außer mit --neu.
// Benötigt ImageMagick und den Ordner der Originale (../brett-und-blatt-grafik/originale oder GRAFIK_ORIGINALE_DIR).
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { argumente, ladeManifest, magick, ORIGINAL_ENDUNGEN, originaleOrdnerOderAbbruch, schreibeGross, WURZEL } from './gemeinsam.mjs';

const { positionen, optionen } = argumente(process.argv.slice(2));
if (positionen.length < 1) {
  console.error('Aufruf: node scripts/grafik/gross-erzeugen.mjs <Manifest> [motiv-id …] [--neu]');
  process.exit(1);
}
const manifest = ladeManifest(positionen[0]);
if (!manifest.ziel) throw new Error('Im Manifest fehlt "ziel" (Ordner im Repo).');
if (!manifest.gross) throw new Error(`Im Manifest ${manifest.name} fehlt die Option "gross": [Breite, Höhe].`);
const originale = originaleOrdnerOderAbbruch();
magick();

const ids = positionen.length > 1 ? positionen.slice(1) : manifest.motive.map((m) => m.id);
for (const id of ids) if (!manifest.motive.some((m) => m.id === id)) throw new Error(`Motiv „${id}“ steht nicht im Manifest ${manifest.name}.`);

const zielDir = resolve(WURZEL, manifest.ziel, 'gross');
const fehlend = [];
let geschrieben = 0, vorhanden = 0, zuKlein = 0, zuGross = 0;
for (const id of ids) {
  const motiv = manifest.motive.find((m) => m.id === id);
  const name = `${manifest.praefix ?? ''}${id}${manifest.suffix ?? ''}`;
  const ziel = resolve(zielDir, `${name}.webp`);
  if (existsSync(ziel) && !optionen.neu) {
    vorhanden++;
    continue;
  }
  const quelle = ORIGINAL_ENDUNGEN.map((e) => resolve(originale, manifest.ziel, `${name}.${e}`)).find((p) => existsSync(p));
  if (!quelle) {
    fehlend.push(id);
    continue;
  }
  mkdirSync(dirname(ziel), { recursive: true });
  const rand = motiv.zuschnittRand ?? manifest.zuschnittRand ?? 0;
  const frei = Boolean(motiv.freistellen ?? manifest.freistellen);
  const { breite, hoehe, verkleinert } = schreibeGross({ quelle, ziel, manifest, motiv, rand, frei, fuzz: Number(optionen.fuzz ?? 22) });
  const kb = Math.round(statSync(ziel).size / 1024);
  if (verkleinert) {
    zuKlein++;
    console.warn(`Warnung: ${id}: Original zu klein für ${(motiv.gross ?? manifest.gross).join('×')}, nicht vergrößert → ${breite}×${hoehe}`);
  }
  if (kb > 200) {
    zuGross++;
    console.warn(`Warnung: ${id}: ${kb} KB (Grenze 200 KB) – grossQualitaet im Manifest senken (z. B. 72).`);
  }
  geschrieben++;
  console.log(`${id} → ${relative(WURZEL, ziel)} (${breite}×${hoehe}, ${kb} KB)`);
}
console.log(`${manifest.name}: ${geschrieben} geschrieben, ${vorhanden} vorhanden (mit --neu überschreiben), ${fehlend.length} ohne Original${zuKlein ? `, ${zuKlein} nicht vergrößert` : ''}${zuGross ? `, ${zuGross} über 200 KB` : ''}.`);
if (fehlend.length) console.log(`Übersprungen (Original fehlt): ${fehlend.join(', ')}`);
