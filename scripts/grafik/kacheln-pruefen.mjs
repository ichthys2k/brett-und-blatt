#!/usr/bin/env node
// Selbstprüfung für kachelbare Texturen (G5, #313): je Variante
//   – Naht: Unterschied zwischen gegenüberliegenden Rändern (so würde die Kachel aneinanderstoßen) im Vergleich
//     zum Unterschied zweier benachbarter Pixelspalten; Verhältnis ≈ 1 = unauffällig, deutlich mehr = sichtbare Naht
//   – Mittelfarbe gegen die Zielfarbe aus dem Prompt („close to #rrggbb“)
//   – 3 × 3 gekachelte Probe als v<n>-probe.png (zum Ansehen)
//   node scripts/grafik/kacheln-pruefen.mjs scripts/grafik/manifeste/tische.json [<id> …]
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { argumente, ladeManifest, magick, ordner } from './gemeinsam.mjs';

const { positionen } = argumente(process.argv.slice(2));
const manifest = ladeManifest(positionen[0]);
const nur = positionen.slice(1);
const im = magick();
const [vergleich, vor] = im === 'magick' ? [im, ['compare']] : ['compare', []];
const mae = (a, b) => {
  const r = spawnSync(vergleich, [...vor, '-metric', 'MAE', a, b, 'null:'], { encoding: 'utf8' });
  const m = /\(([\d.e+-]+)\)/.exec(String(r.stderr));
  return m ? Number(m[1]) : NaN;
};
const mittel = (datei) => execFileSync(im, [datei, '-scale', '1x1!', '-format', '%[hex:p{0,0}]', 'info:'], { encoding: 'utf8' }).trim();
const abstand = (h1, h2) => [0, 2, 4].map((i) => parseInt(h1.slice(i, i + 2), 16) - parseInt(h2.slice(i, i + 2), 16));

for (const m of manifest.motive) {
  if (nur.length && !nur.includes(m.id)) continue;
  const dir = ordner(manifest.name, m.id);
  if (!existsSync(dir)) continue;
  const ziel = /close to #([0-9a-f]{6})/i.exec(m.prompt)?.[1]?.toUpperCase();
  for (const datei of readdirSync(dir).filter((d) => /^v\d+\.png$/.test(d))) {
    const pfad = resolve(dir, datei);
    const [b, h] = execFileSync(im, [pfad, '-format', '%w %h', 'info:'], { encoding: 'utf8' }).split(' ').map(Number);
    const sp = (x) => { const t = resolve(dir, `.sp${x}.png`); execFileSync(im, [pfad, '-crop', `1x${h}+${x}+0`, '+repage', t]); return t; };
    const ze = (y) => { const t = resolve(dir, `.ze${y}.png`); execFileSync(im, [pfad, '-crop', `${b}x1+0+${y}`, '+repage', t]); return t; };
    const [s0, s1, sl] = [sp(0), sp(1), sp(b - 1)];
    const [z0, z1, zl] = [ze(0), ze(1), ze(h - 1)];
    const naht = (mae(s0, sl) + mae(z0, zl)) / 2;
    const nachbar = (mae(s0, s1) + mae(z0, z1)) / 2 || 1e-6;
    for (const t of [s0, s1, sl, z0, z1, zl]) execFileSync('rm', [t]);
    const probe = resolve(dir, datei.replace('.png', '-probe.png'));
    execFileSync(im, [pfad, '-resize', '512x512!', '-write', 'mpr:t', '+delete', '-size', '1536x1536', 'tile:mpr:t', probe]);
    const mf = mittel(pfad).slice(0, 6);
    const d = ziel ? abstand(mf, ziel) : null;
    console.log(`${m.id} ${datei}: Naht-Verhältnis ${(naht / nachbar).toFixed(1)}${naht / nachbar > 3 ? '  ← Naht sichtbar?' : ''}; Mittelfarbe #${mf}${ziel ? ` (Ziel #${ziel}, Abweichung R${d[0]} G${d[1]} B${d[2]})` : ''}; Probe ${probe}`);
  }
}
