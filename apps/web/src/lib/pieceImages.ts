import { setPieceImageResolver } from '@brett-und-blatt/ui';

/**
 * Bild-Adressen der gemalten Figurensätze (#325) für Spiele, die ihre Steine über CSS austauschen: Aus
 * `packages/games/<spiel>/src/ui/figuren/<satz>-<figur>.webp` wird die Variable `--fig-<spiel>-<figur>`.
 */
const FILES = import.meta.glob<string>('../../../../packages/games/*/src/ui/figuren/*.webp', { eager: true, query: '?url', import: 'default' });

setPieceImageResolver((game, set) => {
  const out: Record<string, string> = {};
  for (const [path, url] of Object.entries(FILES)) {
    const m = new RegExp(`/games/${game}/src/ui/figuren/${set}-(.+)\\.webp$`).exec(path);
    if (m) out[m[1]!] = url;
  }
  return out;
});
