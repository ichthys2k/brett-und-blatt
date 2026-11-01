import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

/*
 * Inhalte, die ein Spiel erst zur Laufzeit lädt, statt sie ins JS-Bundle zu backen.
 * Der Fragenkatalog des Bibel-Quiz (und die Wortspiel-Kataloge) kommt im Normalfall vom Spieleserver; die Datei hier
 * ist der Rückfall, damit das Spiel auch ohne Server und ohne Internet startet (und der
 * Rauchtest ohne laufenden Server grün bleibt). Quelle bleibt `content/bibelquiz/fragen.json`
 * – eine Datei, zwei Wege. Die PWA speichert sie mit dem Rest der App vorab.
 */
const KATALOGE = [
  { datei: 'bibelquiz/fragen.json', quelle: 'content/bibelquiz/fragen.json' },
  // Wortspiele: Kategorien-Sprint, Wer bin ich?, Verboten!.
  { datei: 'wortspiele/kategorien.json', quelle: 'content/wortspiele/kategorien.json' },
  { datei: 'wortspiele/wer-bin-ich.json', quelle: 'content/wortspiele/wer-bin-ich.json' },
  { datei: 'wortspiele/begriffe.json', quelle: 'content/wortspiele/begriffe.json' },
];

export function kataloge(): Plugin {
  let base = '/';
  let root = '';

  return {
    name: 'brett-und-blatt:kataloge',
    configResolved(config) {
      base = config.base;
      root = resolve(config.root, '../..');
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0] ?? '';
        const treffer = KATALOGE.find((k) => path === `${base}${k.datei}` || path === `/${k.datei}`);
        if (!treffer) return next();
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(readFileSync(resolve(root, treffer.quelle)));
      });
    },
    generateBundle() {
      for (const k of KATALOGE) {
        this.emitFile({ type: 'asset', fileName: k.datei, source: readFileSync(resolve(root, k.quelle)) });
      }
    },
  };
}
