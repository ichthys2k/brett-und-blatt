#!/usr/bin/env node
// Übernimmt gewählte Varianten als WebP ins Projekt (Zielordner und Größe stehen im Manifest)
// und archiviert das Original im privaten Repo (G0, #307).
//   node scripts/grafik/uebernehmen.mjs <Manifest> k-h=2 d-s=1 …
// Optionen: --fuzz=22 (Toleranz in % beim Freistellen des grünen Grunds)
// Alle erzeugten Varianten der gewählten Motive (auch die nicht gewählten) kommen verlustfrei nach
// <privates Repo>/varianten/<Manifest>/<Motiv>/v<n>.webp. Fehlt grafik-roh/, wird eine gewählte
// Variante aus diesem Archiv geholt: so kann man sich später umentscheiden.
// Benötigt ImageMagick (`magick` oder `convert`) und den Ordner der Originale
// (Standard ../brett-und-blatt-grafik/originale, sonst GRAFIK_ORIGINALE_DIR).
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, relative, resolve } from 'node:path';
import { archiviereVarianten, argumente, ladeManifest, magick, ordner, originaleOrdnerOderAbbruch, VARIANTEN, WURZEL } from './gemeinsam.mjs';
import { pruefeOriginale } from './originale-pruefen.mjs';

const { positionen, optionen } = argumente(process.argv.slice(2));
if (positionen.length < 2) {
  console.error('Aufruf: node scripts/grafik/uebernehmen.mjs <Manifest> <motiv-id>=<Variante> …');
  process.exit(1);
}
const manifest = ladeManifest(positionen[0]);
if (!manifest.ziel) throw new Error('Im Manifest fehlt "ziel" (Ordner im Repo).');
// Erst prüfen, dann schreiben: ohne archiviertes Original keine Übernahme.
const originale = originaleOrdnerOderAbbruch();
const im = magick();

const zielDir = resolve(WURZEL, manifest.ziel);
mkdirSync(zielDir, { recursive: true });
const motivFuer = (id) => manifest.motive.find((m) => m.id === id);
// Größe aus dem Manifest; ein Motiv darf eine eigene Größe mitbringen (z. B. Urkunde neben Pokalen).
const groesseFuer = (id) => motivFuer(id)?.groesse ?? manifest.groesse ?? [320, 400];
// Optional: einen schmalen Rand (Anteil, z. B. 0.06) abschneiden, falls die KI Platten- oder Bildränder malt.
const randFuer = (id) => motivFuer(id)?.zuschnittRand ?? manifest.zuschnittRand ?? 0;
const freistellenFuer = (id) => Boolean(motivFuer(id)?.freistellen ?? manifest.freistellen);
const fuzz = Number(optionen.fuzz ?? 22);

/*
 * Freistellen (grüner Grund #00B140): Grün durchsichtig machen, die Kante des Alphakanals
 * leicht weichzeichnen und wieder straffen (glatter Rand ohne Treppen), danach grünen
 * Farbsaum dämpfen (Grün nie heller als der hellere von Rot und Blau).
 */
const freistellen = ['-alpha', 'set', '-fuzz', `${fuzz}%`, '-transparent', '#00B140', '-channel', 'A', '-blur', '0x0.8', '-level', '50%,100%', '+channel'];
const gruenSaumDaempfen = ['-channel', 'G', '-fx', 'min(g,max(r,b))', '+channel'];

const uebernommen = [];
for (const wahl of positionen.slice(1)) {
  const [id, v] = wahl.split('=');
  if (!motivFuer(id)) throw new Error(`Motiv „${id}“ steht nicht im Manifest ${manifest.name}.`);
  // Manifest-Option „rohSuffix“: übernommen wird v<n><Suffix>.png (z. B. -ganz bei zusammengesetzten Kartenrücken).
  let quelle = resolve(ordner(manifest.name, id), `v${v}${manifest.rohSuffix ?? ''}.png`);
  if (!existsSync(quelle)) {
    // Rohbild fehlt: aus dem Varianten-Archiv holen (verlustfreies WebP → PNG).
    const archiv = resolve(VARIANTEN, manifest.name, id, `v${v}.webp`);
    if (!existsSync(archiv)) throw new Error(`Variante fehlt: ${relative(WURZEL, quelle)} (auch nicht im Archiv ${archiv})`);
    quelle = resolve(mkdtempSync(resolve(tmpdir(), 'grafik-')), `v${v}.png`);
    execFileSync(im, [archiv, quelle]);
    console.log(`${id} v${v}: aus dem Varianten-Archiv geholt`);
  }
  const name = `${manifest.praefix ?? ''}${id}${manifest.suffix ?? ''}`;
  const ziel = resolve(zielDir, `${name}.webp`);
  const rand = randFuer(id);
  const [breite, hoehe] = groesseFuer(id);
  const frei = freistellenFuer(id);
  const zuschnitt = rand ? ['-gravity', 'center', '-crop', `${Math.round((1 - 2 * rand) * 100)}%x${Math.round((1 - 2 * rand) * 100)}%+0+0`, '+repage'] : [];
  // Manifest-Option „zweifach“: zusätzlich <name>@2x.webp in doppelter Größe (z. B. Kulissen für den Tisch-Bildschirm).
  const fassungen = [[ziel, 1], ...(manifest.zweifach ? [[resolve(zielDir, `${name}@2x.webp`), 2]] : [])];
  for (const [datei, faktor] of fassungen) {
    execFileSync(im, [
      quelle,
      ...zuschnitt,
      ...(frei ? freistellen : []),
      ...(frei ? ['-background', 'none'] : []),
      '-resize', `${breite * faktor}x${hoehe * faktor}^`, '-gravity', 'center', '-extent', `${breite * faktor}x${hoehe * faktor}`,
      ...(frei ? gruenSaumDaempfen : []),
      '-quality', String(manifest.qualitaet ?? 80),
      ...(frei ? ['-define', 'webp:alpha-quality=95', '-define', 'webp:exact=false'] : []),
      datei,
    ]);
    if (faktor === 2) uebernommen.push(relative(WURZEL, datei));
  }

  // Original in voller Auflösung ins private Repo (nicht ins öffentliche).
  const zielOriginal = resolve(originale, relative(WURZEL, zielDir), `${name}.png`);
  mkdirSync(dirname(zielOriginal), { recursive: true });
  copyFileSync(quelle, zielOriginal);
  uebernommen.push(relative(WURZEL, ziel));
  console.log(`${id} v${v}${frei ? ' (freigestellt)' : ''} → ${relative(WURZEL, ziel)} (${Math.round(statSync(ziel).size / 1024)} KB${manifest.zweifach ? `, @2x ${Math.round(statSync(resolve(zielDir, `${name}@2x.webp`)).size / 1024)} KB` : ''}) + Original: ${zielOriginal}`);
}

const gewaehlteIds = positionen.slice(1).map((w) => w.split('=')[0]);
const archiviert = archiviereVarianten(manifest.name, gewaehlteIds);
if (archiviert) console.log(`${archiviert} Variante(n) ins Archiv ${VARIANTEN}/${manifest.name} geschrieben.`);

const fehlend = pruefeOriginale().filter((f) => uebernommen.includes(f));
if (fehlend.length) {
  console.error('Achtung, ohne Original:', fehlend.join(', '));
  process.exit(1);
}
console.log(`Fertig. Im privaten Repo committen und pushen: cd ${resolve(originale, '..')} && git add -A && git commit -m "Originale und Varianten: ${manifest.name}" && git push`);
