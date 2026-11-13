#!/usr/bin/env node
// Erzeugt docs/grafik/BESTAND.md (G0, #307): je Bildordner Anzahl WebP, Originale,
// zugehöriges Manifest und Modell laut THIRD_PARTY.md. Nicht von Hand bearbeiten.
//   node scripts/grafik/bestand.mjs
//   node scripts/grafik/bestand.mjs --ausnahmen-schreiben   (einmalig: alle heutigen Bilder ohne
//      Original in scripts/grafik/originale-fehlen.json eintragen; nur für die Altfälle vor dem 12.11.2026)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { alleManifeste, argumente, AUSNAHMEN_DATEI, bildordner, ladeAusnahmen, ORIGINALE, originalZu, WURZEL } from './gemeinsam.mjs';

const { optionen } = argumente(process.argv.slice(2));
const ordnerListe = bildordner();
const manifeste = alleManifeste();
const archivDa = existsSync(ORIGINALE);

if (optionen['ausnahmen-schreiben']) {
  const dateien = [];
  for (const [ordner, liste] of ordnerListe) for (const datei of liste) {
    const pfad = `${ordner}/${datei}`;
    if (!(archivDa && originalZu(pfad))) dateien.push(pfad);
  }
  writeFileSync(AUSNAHMEN_DATEI, `${JSON.stringify({
    beschreibung: 'Bilder, deren Original verloren ist (grafik-roh/ existiert auf keinem Rechner mehr, Auskunft Cornelius 12.11.2026). Kein Neu-Erzeugen nur fürs Archiv; wird ein Bild neu gemacht, kommt sein Original ins private Repo und der Eintrag hier raus. Neue Einträge sind nicht erlaubt.',
    stand: '2026-11-12',
    dateien,
  }, null, 2)}\n`);
  console.log(`${dateien.length} Einträge in ${AUSNAHMEN_DATEI.replace(WURZEL + '/', '')}`);
}

// Modell und Monat je Ordner aus den Absätzen mit „KI-erzeugt“ in THIRD_PARTY.md.
const drittanbieter = readFileSync(resolve(WURZEL, 'THIRD_PARTY.md'), 'utf8');
const abschnitte = drittanbieter.split(/\n\s*\n/).filter((a) => /\*\*KI-erzeugt\*\*/.test(a));
function herkunft(ordner) {
  const treffer = new Set();
  for (const abschnitt of abschnitte) {
    const pfade = [...abschnitt.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    if (!pfade.some((p) => p.startsWith(`${ordner}/`) || p === ordner)) continue;
    const modell = /„(gemini[^“]*)“/.exec(abschnitt)?.[1] ?? (/Canva/.test(abschnitt) ? 'Canva AI' : 'Bildmodell ohne Angabe');
    const monat = /(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember) \d{4}/.exec(abschnitt)?.[0] ?? '';
    treffer.add(`${modell}${monat ? `, ${monat}` : ''}`);
  }
  return treffer.size ? [...treffer].join('; ') : '– (kein Abschnitt in THIRD_PARTY.md)';
}

const ausnahmen = ladeAusnahmen();
const zeilen = [];
let summe = { webp: 0, original: 0, verloren: 0, offen: 0 };
for (const [ordner, liste] of ordnerListe) {
  let original = 0, verloren = 0, offen = 0;
  for (const datei of liste) {
    const pfad = `${ordner}/${datei}`;
    if (archivDa && originalZu(pfad)) original++;
    else if (ausnahmen.has(pfad)) verloren++;
    else offen++;
  }
  const zu = manifeste.filter((m) => m.ziel === ordner).map((m) => `\`${m.name}\``).join(', ') || '–';
  summe = { webp: summe.webp + liste.length, original: summe.original + original, verloren: summe.verloren + verloren, offen: summe.offen + offen };
  zeilen.push(`| \`${ordner}\` | ${liste.length} | ${archivDa ? original : '?'} | ${verloren || ''} | ${offen || ''} | ${zu} | ${herkunft(ordner)} |`);
}

const geplant = manifeste
  .filter((m) => m.ziel && !ordnerListe.has(m.ziel))
  .map((m) => `| \`${m.name}\` | \`${m.ziel}\` | ${m.motive.length} |`);

const md = `# Bestand der gemalten Bilder

> Erzeugt von \`node scripts/grafik/bestand.mjs\` – nicht von Hand bearbeiten. Regeln in [STILBIBEL.md](STILBIBEL.md), Archiv der Originale im privaten Repo \`ichthys2k/brett-und-blatt-grafik\` (Ordner \`originale/<Bildordner>/\`).

${archivDa ? `Originale geprüft in \`${ORIGINALE.replace(resolve(WURZEL, '..') + '/', '../')}\`.` : '**Privates Repo nicht gefunden** – Spalte „Original im Archiv“ ungeprüft (?). Auf einem Rechner mit `../brett-und-blatt-grafik` erneut erzeugen.'}

Spalten: **WebP** im öffentlichen Repo · **Original im Archiv** (privates Repo) · **Original verloren (vor 12.11.2026)** laut \`scripts/grafik/originale-fehlen.json\` · **ohne Original** (Fehler, meldet \`originale-pruefen.mjs\`).

| Bildordner | WebP | Original im Archiv | Original verloren (vor 12.11.2026) | ohne Original | Manifest | Modell laut THIRD_PARTY.md |
|---|---:|---:|---:|---:|---|---|
${zeilen.join('\n')}
| **Summe** | **${summe.webp}** | **${archivDa ? summe.original : '?'}** | **${summe.verloren}** | **${summe.offen}** | | |

## Geplant (Manifest vorhanden, noch keine Bilder)

| Manifest | Zielordner | Motive |
|---|---|---:|
${geplant.join('\n')}
`;
mkdirSync(resolve(WURZEL, 'docs/grafik'), { recursive: true });
writeFileSync(resolve(WURZEL, 'docs/grafik/BESTAND.md'), md);
console.log(`docs/grafik/BESTAND.md geschrieben (${summe.webp} WebP in ${ordnerListe.size} Ordnern, ${geplant.length} geplante Manifeste).`);
