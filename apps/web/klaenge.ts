import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import catalog from '../../packages/ui/src/audio/catalog.json' with { type: 'json' };
import music from '../../packages/ui/src/audio/music.json' with { type: 'json' };

/*
 * Baut Effekte und Musik unter „klaenge/“ in die App ein. Die Dateien liegen nicht in
 * diesem Repo, sondern im privaten Repo brett-und-blatt-klaenge (Lizenz von ElevenLabs:
 * keine Weitergabe der Effekte als Einzeldateien; die Musik liegt der Einfachheit halber
 * daneben). Gesucht wird in KLAENGE_DIR oder neben diesem Repo in ../brett-und-blatt-klaenge,
 * jeweils in den Ordnern effekte/, tiere/ und musik/. Fehlen sie, bleibt die App stumm.
 * Übernommen werden nur die Dateien, die die Kataloge brauchen, plus tiere/ (Drachenspiel).
 */
/** Alle Effekte werden vorab gespeichert – darum eine feste Obergrenze. */
const MAX_BYTES = 1536 * 1024;
/** Musik wird erst beim Abspielen geladen; ein Stück darf trotzdem nicht ausufern. */
const MAX_TRACK_BYTES = 8 * 1024 * 1024;
/** Tier-Sounds fürs Drachenspiel werden on-demand geladen; Obergrenze fürs gesamte Paket. */
const MAX_TIERE_BYTES = 20 * 1024 * 1024;

const effectFiles = [...new Set(Object.values(catalog).map((spec) => spec.file))];
const standardFiles = [...effectFiles.map((file) => `effekte/${file}`), ...music.tracks.map((track) => `musik/${track.file}`)];

export function klaenge(): Plugin {
  let dir = '';
  let base = '/';
  let tiereFiles: string[] = [];

  const getTiereFiles = (baseDir: string): string[] => {
    const tierePath = resolve(baseDir, 'tiere');
    if (!existsSync(tierePath)) return [];
    try {
      return (readdirSync(tierePath, { recursive: true }) as string[])
        .filter((f) => typeof f === 'string' && f.endsWith('.mp3'))
        .filter((f) => statSync(resolve(tierePath, f)).isFile())
        .map((f) => `tiere/${f}`);
    } catch {
      return [];
    }
  };

  const allFiles = () => [...standardFiles, ...tiereFiles];
  const available = () => allFiles().filter((file) => existsSync(resolve(dir, file)));

  return {
    name: 'brett-und-blatt:klaenge',
    configResolved(config) {
      base = config.base;
      // config.root ist apps/web; das Klang-Repo liegt neben dem Repo-Ordner.
      dir = process.env.KLAENGE_DIR ? resolve(process.env.KLAENGE_DIR) : resolve(config.root, '../../../brett-und-blatt-klaenge');
      tiereFiles = getTiereFiles(dir);
      const found = available();
      const bytes = (file: string) => statSync(resolve(dir, file)).size;
      const size = found.filter((file) => file.startsWith('effekte/')).reduce((sum, file) => sum + bytes(file), 0);
      const tiereSize = found.filter((file) => file.startsWith('tiere/')).reduce((sum, file) => sum + bytes(file), 0);
      const missing = standardFiles.filter((file) => !found.includes(file));
      // In der CI (KLAENGE_DIR gesetzt) ist eine fehlende Standard-Datei ein Fehler, sonst nur ein Hinweis.
      if (missing.length > 0 && process.env.KLAENGE_DIR) throw new Error(`Klänge fehlen in ${dir}: ${missing.join(', ')}`);
      if (missing.length > 0) config.logger.warn(`Klänge: ${found.length} von ${standardFiles.length} Dateien in ${dir} gefunden – fehlende bleiben stumm.`);
      if (size > MAX_BYTES) throw new Error(`Effekte zusammen ${Math.round(size / 1024)} KB – erlaubt sind ${MAX_BYTES / 1024} KB.`);
      if (tiereSize > MAX_TIERE_BYTES) throw new Error(`Tier-Effekte zusammen ${Math.round(tiereSize / 1024)} KB – erlaubt sind ${MAX_TIERE_BYTES / 1024} KB.`);
      const large = found.filter((file) => file.startsWith('musik/') && bytes(file) > MAX_TRACK_BYTES);
      if (large.length > 0) throw new Error(`Musikstücke über ${MAX_TRACK_BYTES / 1024 / 1024} MB: ${large.join(', ')}`);
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const prefix = `${base}klaenge/`;
        const file = req.url?.startsWith(prefix) ? decodeURIComponent(req.url.slice(prefix.length).split('?')[0] ?? '') : null;
        // Effekte liegen unter klaenge/<datei>, Musik unter klaenge/musik/<datei>, Tiere unter klaenge/tiere/<datei>.
        const source = file && (file.startsWith('musik/') || file.startsWith('tiere/') ? file : `effekte/${file}`);
        if (!source || !allFiles().includes(source) || !existsSync(resolve(dir, source))) return next();
        res.setHeader('Content-Type', 'audio/mpeg');
        res.end(readFileSync(resolve(dir, source)));
      });
    },
    generateBundle() {
      for (const file of available()) {
        this.emitFile({ type: 'asset', fileName: `klaenge/${file.replace(/^effekte\//, '')}`, source: readFileSync(resolve(dir, file)) });
      }
    },
  };
}
