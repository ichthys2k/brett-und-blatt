#!/usr/bin/env node
// Einmalig (G0, #307): zieht die Drachenspiel-Kulissen-Master aus dem öffentlichen Repo ins
// private Repo um. Kopiert nur und prüft die Größe; löschen im öffentlichen Repo erst danach:
//   node scripts/grafik/master-umziehen.mjs
//   git rm packages/games/drachenspiel/assets/kulissen/*_master.*   (Befehl gibt das Skript aus)
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { originaleOrdnerOderAbbruch, WURZEL } from './gemeinsam.mjs';

const ALT = 'packages/games/drachenspiel/assets/kulissen';
const ZIEL = 'packages/games/drachenspiel/src/ui/kulissen';
const originale = originaleOrdnerOderAbbruch();
const altDir = resolve(WURZEL, ALT);
if (!existsSync(altDir)) {
  console.log('Nichts zu tun: Die Master sind schon umgezogen.');
  process.exit(0);
}
const zielDir = resolve(originale, ZIEL);
mkdirSync(zielDir, { recursive: true });
const umgezogen = [];
for (const datei of readdirSync(altDir).filter((d) => /_master\.(png|jpg)$/.test(d)).sort()) {
  // wald_master.jpg → wald.jpg (Original zu wald.webp), wald_2x_master.png → wald_2x.png (Hochskalierung)
  const name = datei.replace('_master', '');
  const ziel = resolve(zielDir, name);
  copyFileSync(resolve(altDir, datei), ziel);
  if (statSync(ziel).size !== statSync(resolve(altDir, datei)).size) throw new Error(`Kopie unvollständig: ${datei}`);
  umgezogen.push(`${ALT}/${datei}`);
  console.log(`${ALT}/${datei} → ${ziel}`);
}
console.log(`\n${umgezogen.length} Dateien kopiert. Jetzt:
  1. im privaten Repo: cd ${resolve(originale, '..')} && git add -A && git commit -m "Originale: Drachenspiel-Kulissen" && git push
  2. im öffentlichen Repo: git rm ${umgezogen.join(' ')}
  3. ALTE_ORTE in scripts/grafik/bestand.mjs und die Ausnahme in tests/grafik.test.ts löschen, node scripts/grafik/bestand.mjs, committen.`);
