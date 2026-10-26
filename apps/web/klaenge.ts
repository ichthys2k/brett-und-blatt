import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import catalog from '../../packages/ui/src/audio/catalog.json' with { type: 'json' };

/*
 * Baut die Klänge unter „klaenge/“ in die App ein. Die Dateien liegen nicht in diesem
 * Repo, sondern im privaten Repo brett-und-blatt-klaenge (Lizenz von ElevenLabs:
 * keine Weitergabe als Einzeldateien). Gesucht wird in KLAENGE_DIR oder neben diesem
 * Repo in ../brett-und-blatt-klaenge/effekte. Fehlen sie, bleibt die App stumm.
 * Übernommen werden nur die Dateien, die der Katalog braucht.
 */
/** Alle Effekte werden vorab gespeichert – darum eine feste Obergrenze. */
const MAX_BYTES = 1536 * 1024;

const files = [...new Set(Object.values(catalog).map((spec) => spec.file))];

export function klaenge(): Plugin {
  let dir = '';
  let base = '/';
  const available = () => files.filter((file) => existsSync(resolve(dir, file)));

  return {
    name: 'brett-und-blatt:klaenge',
    configResolved(config) {
      base = config.base;
      // config.root ist apps/web; das Klang-Repo liegt neben dem Repo-Ordner.
      dir = process.env.KLAENGE_DIR ? resolve(process.env.KLAENGE_DIR) : resolve(config.root, '../../../brett-und-blatt-klaenge/effekte');
      const found = available();
      const size = found.reduce((sum, file) => sum + statSync(resolve(dir, file)).size, 0);
      const missing = files.filter((file) => !found.includes(file));
      // In der CI (KLAENGE_DIR gesetzt) ist eine fehlende Datei ein Fehler, sonst nur ein Hinweis.
      if (missing.length > 0 && process.env.KLAENGE_DIR) throw new Error(`Klänge fehlen in ${dir}: ${missing.join(', ')}`);
      if (missing.length > 0) config.logger.warn(`Klänge: ${found.length} von ${files.length} Dateien in ${dir} gefunden – fehlende bleiben stumm.`);
      if (size > MAX_BYTES) throw new Error(`Klänge zusammen ${Math.round(size / 1024)} KB – erlaubt sind ${MAX_BYTES / 1024} KB.`);
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const prefix = `${base}klaenge/`;
        const file = req.url?.startsWith(prefix) ? decodeURIComponent(req.url.slice(prefix.length).split('?')[0] ?? '') : null;
        if (!file || !files.includes(file) || !existsSync(resolve(dir, file))) return next();
        res.setHeader('Content-Type', 'audio/mpeg');
        res.end(readFileSync(resolve(dir, file)));
      });
    },
    generateBundle() {
      for (const file of available()) this.emitFile({ type: 'asset', fileName: `klaenge/${file}`, source: readFileSync(resolve(dir, file)) });
    },
  };
}
