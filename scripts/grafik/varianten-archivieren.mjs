#!/usr/bin/env node
// Archiviert ALLE erzeugten Varianten eines Manifests (auch für Motive, die noch nicht gewählt wurden)
// verlustfrei im privaten Repo: <privates Repo>/varianten/<Manifest>/<Motiv>/v<n>.webp (G0, #307).
//   node scripts/grafik/varianten-archivieren.mjs <Manifest> [--nur=id1,id2]
// Vorhandenes wird übersprungen. Danach im privaten Repo committen und pushen.
import { resolve } from 'node:path';
import { archiviereVarianten, argumente, ladeManifest, originaleOrdnerOderAbbruch, VARIANTEN } from './gemeinsam.mjs';

const { positionen, optionen } = argumente(process.argv.slice(2));
if (!positionen[0]) {
  console.error('Aufruf: node scripts/grafik/varianten-archivieren.mjs <Manifest> [--nur=id1,id2]');
  process.exit(1);
}
const manifest = ladeManifest(positionen[0]);
originaleOrdnerOderAbbruch();
const neu = archiviereVarianten(manifest.name, optionen.nur ? String(optionen.nur).split(',') : null);
console.log(`${neu} Variante(n) neu archiviert in ${resolve(VARIANTEN, manifest.name)}.`);
console.log(`Danach: cd ${resolve(VARIANTEN, '..')} && git add -A && git commit -m "Varianten: ${manifest.name}" && git push`);
