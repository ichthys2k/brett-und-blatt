import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Plugin } from 'vite';

/*
 * Bilder bei den Inhalten (#319): `content/quartett/bilder/<set>/…` kommt unter `quartett/bilder/<set>/…`
 * neben die App, aber nicht ins JS-Bundle und nicht in den Vorab-Speicher der PWA (siehe `globIgnores`
 * in vite.config.ts). Ein Set lädt seine Bilder erst, wenn es gespielt wird.
 */
const ORDNER = [{ ziel: 'quartett/bilder', quelle: 'content/quartett/bilder' }];
const TYPEN: Record<string, string> = { svg: 'image/svg+xml', webp: 'image/webp', png: 'image/png' };

function dateien(dir: string): string[] {
  try {
    return readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      return statSync(full).isDirectory() ? dateien(full).map((sub) => `${name}/${sub}`) : TYPEN[name.split('.').pop() ?? ''] ? [name] : [];
    });
  } catch {
    return [];
  }
}

export function inhaltsbilder(): Plugin {
  let base = '/';
  let root = '';
  return {
    name: 'brett-und-blatt:inhaltsbilder',
    configResolved(config) {
      base = config.base;
      root = resolve(config.root, '../..');
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = decodeURIComponent(req.url?.split('?')[0] ?? '');
        for (const o of ORDNER) {
          for (const prefix of [`${base}${o.ziel}/`, `/${o.ziel}/`]) {
            if (!path.startsWith(prefix)) continue;
            const rest = path.slice(prefix.length);
            if (rest.includes('..')) return next();
            const typ = TYPEN[rest.split('.').pop() ?? ''];
            if (!typ) return next();
            try {
              const body = readFileSync(resolve(root, o.quelle, rest));
              res.setHeader('Content-Type', typ);
              return res.end(body);
            } catch {
              return next();
            }
          }
        }
        next();
      });
    },
    generateBundle() {
      for (const o of ORDNER) {
        for (const datei of dateien(resolve(root, o.quelle))) {
          this.emitFile({ type: 'asset', fileName: `${o.ziel}/${datei}`, source: readFileSync(resolve(root, o.quelle, datei)) });
        }
      }
    },
  };
}
