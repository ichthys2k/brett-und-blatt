#!/usr/bin/env node
// Vergleicht die WebP der Bildordner im öffentlichen Repo mit den Originalen im privaten
// Repo (G0, #307) und meldet jedes Bild ohne Original, das nicht in der Ausnahmeliste
// scripts/grafik/originale-fehlen.json steht. Läuft bei jeder Übernahme und von Hand,
// nicht in der CI (dort fehlt das private Repo).
//   node scripts/grafik/originale-pruefen.mjs [--alle]   (--alle: auch Ausnahmen zeigen)
import { fileURLToPath } from 'node:url';
import { argumente, bildordner, ladeAusnahmen, originaleOrdnerOderAbbruch, originalZu, ORIGINALE } from './gemeinsam.mjs';

/** WebP-Dateien (relativ zur Repo-Wurzel) ohne Original und ohne Eintrag in der Ausnahmeliste. */
export function pruefeOriginale({ mitAusnahmen = false } = {}) {
  originaleOrdnerOderAbbruch();
  const ausnahmen = ladeAusnahmen();
  const fehlend = [];
  for (const [ordner, dateien] of bildordner()) {
    for (const datei of dateien) {
      const pfad = `${ordner}/${datei}`;
      if (originalZu(pfad)) continue;
      if (!mitAusnahmen && ausnahmen.has(pfad)) continue;
      fehlend.push(pfad);
    }
  }
  return fehlend;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { optionen } = argumente(process.argv.slice(2));
  const fehlend = pruefeOriginale({ mitAusnahmen: Boolean(optionen.alle) });
  if (fehlend.length === 0) {
    console.log(`Alle Bilder haben ein Original in ${ORIGINALE} oder stehen in der Ausnahmeliste.`);
  } else {
    console.error(`${fehlend.length} Bild(er) ohne Original in ${ORIGINALE}:`);
    for (const pfad of fehlend) console.error(`  ${pfad}`);
    console.error('Original nachtragen (originale/<Ordner>/<name>.png) oder – nur für Altfälle – in scripts/grafik/originale-fehlen.json eintragen.');
    process.exit(1);
  }
}
