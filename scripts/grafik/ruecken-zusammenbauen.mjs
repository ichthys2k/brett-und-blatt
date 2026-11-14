#!/usr/bin/env node
// Setzt aus dem erzeugten Viertel (links oben) den ganzen Kartenrücken zusammen (G6, #314):
//   grafik-roh/kartenruecken/<id>/v<n>.png  →  v<n>-ganz.png
// Viertel nach rechts spiegeln, die obere Hälfte nach unten kippen: Der Rücken ist damit um 180° gedreht
// gleich (punktsymmetrisch). Die Selbstprüfung vergleicht den Rücken Pixel für Pixel mit seiner Drehung.
//   node scripts/grafik/ruecken-zusammenbauen.mjs [<id> …]    ohne Angabe: alle Rücken mit Viertel
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { argumente, magick, ROH } from './gemeinsam.mjs';

const { positionen } = argumente(process.argv.slice(2));
const basis = resolve(ROH, 'kartenruecken');
const im = magick();
if (!existsSync(basis)) throw new Error(`Nichts zu tun: ${basis} fehlt.`);

const drehungGleich = (datei) => {
  const gedreht = datei.replace(/\.png$/, '-gedreht.png');
  execFileSync(im, [datei, '-rotate', '180', gedreht]);
  const [programm, vor] = im === 'magick' ? [im, ['compare']] : ['compare', []];
  const r = spawnSync(programm, [...vor, '-metric', 'AE', datei, gedreht, 'null:'], { encoding: 'utf8' });
  execFileSync('rm', [gedreht]);
  return String(r.stderr).trim().split(/\s/)[0] || '?';
};

let n = 0;
for (const id of readdirSync(basis)) {
  if (positionen.length && !positionen.includes(id)) continue;
  const dir = resolve(basis, id);
  if (!statSync(dir).isDirectory()) continue;
  for (const datei of readdirSync(dir)) {
    const t = /^v(\d+)\.png$/.exec(datei);
    if (!t) continue;
    const ziel = resolve(dir, `v${t[1]}-ganz.png`);
    execFileSync(im, [resolve(dir, datei), '(', '+clone', '-flop', ')', '+append', '(', '+clone', '-flip', ')', '-append', ziel]);
    const abweichung = drehungGleich(ziel);
    console.log(`${id} v${t[1]} → v${t[1]}-ganz.png, Abweichung bei 180°-Drehung: ${abweichung} Pixel${abweichung === '0' ? '' : '  ← NICHT symmetrisch!'}`);
    n++;
  }
}
console.log(`${n} Rücken zusammengesetzt.`);
