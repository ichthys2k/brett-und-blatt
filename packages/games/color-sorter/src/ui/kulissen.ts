import type { CSSProperties } from 'react';

/**
 * Hintergrundbilder für Jahrmarkt, Thronsaal, Hof, Lieferung und Narrenschule (KI-erzeugt, siehe THIRD_PARTY.md).
 * Sie liegen unter einem Schleier in der Flächenfarbe, damit Text und Kacheln lesbar bleiben (Klasse `cs-kulisse`).
 */
const files = import.meta.glob<string>('./kulissen/*.webp', { eager: true, query: '?url', import: 'default' });

export type Kulisse = 'jahrmarkt' | 'thronsaal' | 'hof' | 'buendel' | 'schule';

/** Style mit dem Hintergrundbild; ohne Bild bleibt die Fläche wie sie war. */
export function kulisse(name: Kulisse): { className: string; style?: CSSProperties } {
  const url = files[`./kulissen/${name}.webp`];
  return url ? { className: 'cs-kulisse', style: { '--cs-kulisse': `url(${url})` } as CSSProperties } : { className: '' };
}
