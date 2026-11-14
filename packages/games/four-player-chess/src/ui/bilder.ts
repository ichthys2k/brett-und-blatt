import type { PieceSetId } from '@brett-und-blatt/ui';

/** Gemalte Figuren für Vierer-Schach (#325): `<satz>-<figur>-n.webp`, cremefarben und je Platz getönt. */
const FIGUREN = import.meta.glob<string>('./figuren/*.webp', { eager: true, query: '?url', import: 'default' });

export const pieceImage = (set: PieceSetId, type: string): string | undefined =>
  set === 'classic' ? undefined : FIGUREN[`./figuren/${set}-${type.toLowerCase()}-n.webp`];

/** Farben der vier Plätze (wie in styles.css) und der geschlagenen Figuren. */
export const TINTS = { r: '#d62828', b: '#1c5fd4', y: '#e6a800', g: '#2b8a3e', dead: '#8a8a8a' } as const;
