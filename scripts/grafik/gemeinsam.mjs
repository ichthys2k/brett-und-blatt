// Gemeinsame Hilfen für die Bilderzeugung (scripts/grafik).
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

export const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const ROH = resolve(WURZEL, 'grafik-roh');

export function ladeManifest(pfad) {
  const datei = resolve(pfad);
  const manifest = JSON.parse(readFileSync(datei, 'utf8'));
  manifest.name = basename(datei, '.json');
  manifest.motive ??= [];
  return manifest;
}

export function ordner(...teile) {
  const pfad = resolve(ROH, ...teile);
  if (!existsSync(pfad)) mkdirSync(pfad, { recursive: true });
  return pfad;
}

export function argumente(argv) {
  const positionen = [];
  const optionen = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [schluessel, wert] = a.slice(2).split('=');
      optionen[schluessel] = wert ?? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true);
    } else positionen.push(a);
  }
  return { positionen, optionen };
}

/*
 * Originale-Archiv (G0, #307): Die Originale in voller Auflösung liegen im privaten Repo
 * `ichthys2k/brett-und-blatt-grafik` unter `originale/<Zielordner im öffentlichen Repo>/<name>.png`,
 * nie im öffentlichen Repo. Ort überschreibbar mit GRAFIK_ORIGINALE_DIR.
 */
export const ORIGINALE = resolve(process.env.GRAFIK_ORIGINALE_DIR ?? resolve(WURZEL, '../brett-und-blatt-grafik/originale'));
/** Dateiendungen, die als Original zählen (die alten Drachenspiel-Master sind JPG). */
export const ORIGINAL_ENDUNGEN = ['png', 'jpg', 'jpeg', 'webp'];

/** Bricht mit klarer Meldung ab, wenn das private Repo mit den Originalen fehlt. */
export function originaleOrdnerOderAbbruch() {
  if (!existsSync(ORIGINALE)) {
    console.error(`Abbruch: Ordner für die Originale fehlt: ${ORIGINALE}
Die Originale gehören ins private Repo ichthys2k/brett-und-blatt-grafik (siehe docs/grafik/STILBIBEL.md, Abschnitt Archiv).
  gh repo clone ichthys2k/brett-und-blatt-grafik ${resolve(WURZEL, '../brett-und-blatt-grafik')}
oder einen anderen Ort angeben: GRAFIK_ORIGINALE_DIR=/pfad/zu/originale node …`);
    process.exit(1);
  }
  return ORIGINALE;
}

/** Pfad des Originals zu einer WebP-Datei (relativ zur Repo-Wurzel), falls im Archiv vorhanden. */
export function originalZu(webpRelativ) {
  const ohneEndung = webpRelativ.replace(/\.webp$/, '');
  for (const endung of ORIGINAL_ENDUNGEN) {
    const pfad = resolve(ORIGINALE, `${ohneEndung}.${endung}`);
    if (existsSync(pfad)) return pfad;
  }
  return null;
}

/** ImageMagick 7 heißt `magick`, Version 6 nur `convert`; beide werden unterstützt. */
let magickBefehl;
export function magick() {
  if (magickBefehl) return magickBefehl;
  for (const befehl of ['magick', 'convert']) {
    try {
      execFileSync(befehl, ['-version'], { stdio: 'ignore' });
      return (magickBefehl = befehl);
    } catch {
      /* nächsten versuchen */
    }
  }
  console.error('Abbruch: ImageMagick fehlt (weder `magick` noch `convert` gefunden).');
  process.exit(1);
}

/** Bildordner im öffentlichen Repo: Ordner unter apps/, packages/ und content/, die WebP-Dateien enthalten. */
export function bildordner() {
  const ausgelassen = new Set(['node_modules', 'dist', '.wrangler']);
  const treffer = new Map();
  const gehe = (relativ) => {
    for (const eintrag of readdirSync(resolve(WURZEL, relativ), { withFileTypes: true })) {
      if (eintrag.isDirectory()) {
        if (!ausgelassen.has(eintrag.name) && !eintrag.name.startsWith('.')) gehe(`${relativ}/${eintrag.name}`);
      } else if (eintrag.name.endsWith('.webp')) {
        if (!treffer.has(relativ)) treffer.set(relativ, []);
        treffer.get(relativ).push(eintrag.name);
      }
    }
  };
  for (const wurzel of ['apps', 'packages', 'content']) if (existsSync(resolve(WURZEL, wurzel))) gehe(wurzel);
  for (const liste of treffer.values()) liste.sort();
  return new Map([...treffer].sort(([a], [b]) => a.localeCompare(b)));
}

/** Ausnahmeliste der Bilder, deren Original bekannt verloren ist. */
export const AUSNAHMEN_DATEI = resolve(WURZEL, 'scripts/grafik/originale-fehlen.json');
export function ladeAusnahmen() {
  if (!existsSync(AUSNAHMEN_DATEI)) return new Set();
  return new Set(JSON.parse(readFileSync(AUSNAHMEN_DATEI, 'utf8')).dateien);
}

/** Alle Manifeste unter scripts/grafik/manifeste. */
export function alleManifeste() {
  const dir = resolve(WURZEL, 'scripts/grafik/manifeste');
  return readdirSync(dir).filter((d) => d.endsWith('.json')).sort().map((d) => ladeManifest(resolve(dir, d)));
}
