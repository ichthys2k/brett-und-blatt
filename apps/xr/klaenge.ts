import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import catalog from '../../packages/ui/src/audio/catalog.json' with { type: 'json' };
import { XR_SOUND_NAMES } from './src/sound-names';

/*
 * Baut die wenigen Klänge der VR-App (#349) unter „klaenge/“ ein. Wie bei der Web-App liegen die
 * Dateien nur im privaten Repo brett-und-blatt-klaenge (ElevenLabs-Lizenz, nie ins öffentliche
 * Repo): gesucht in KLAENGE_DIR oder neben diesem Repo in ../brett-und-blatt-klaenge, Ordner
 * effekte/. Fehlen sie, bleibt die App stumm. Übernommen werden nur die Klänge aus
 * src/sound-names.ts; welche das sind, hat Cornelius für die Web-App ausgewählt.
 */
const files = [...new Set(XR_SOUND_NAMES.map((name) => (catalog as Record<string, { file: string }>)[name]?.file).filter((f): f is string => Boolean(f)))];

export function klaenge(): Plugin {
  let dir = '';
  return {
    name: 'brett-und-blatt:xr-klaenge',
    configResolved(config) {
      dir = process.env.KLAENGE_DIR ? resolve(process.env.KLAENGE_DIR) : resolve(config.root, '../../../brett-und-blatt-klaenge');
      const missing = files.filter((file) => !existsSync(resolve(dir, 'effekte', file)));
      if (missing.length > 0 && process.env.KLAENGE_DIR) throw new Error(`Klänge fehlen in ${dir}/effekte: ${missing.join(', ')}`);
      if (missing.length > 0) config.logger.warn(`Klänge: ${files.length - missing.length} von ${files.length} Dateien gefunden – die VR-App bleibt dafür stumm.`);
    },
    configureServer(server) {
      server.middlewares.use('/klaenge/', (req, res, next) => {
        const file = decodeURIComponent((req.url ?? '').replace(/^\//, '').split('?')[0] ?? '');
        if (!files.includes(file) || !existsSync(resolve(dir, 'effekte', file))) return next();
        res.setHeader('Content-Type', 'audio/mpeg');
        res.end(readFileSync(resolve(dir, 'effekte', file)));
      });
    },
    generateBundle() {
      for (const file of files) {
        const path = resolve(dir, 'effekte', file);
        if (existsSync(path)) this.emitFile({ type: 'asset', fileName: `klaenge/${file}`, source: readFileSync(path) });
      }
    },
  };
}
