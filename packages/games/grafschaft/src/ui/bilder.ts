import type { Landscape } from '../rules';

/**
 * Gemalte Bilder für die Grafschaft (G9, #318): Landschaften der Plättchen und Vignetten der Hofaufträge.
 * Fehlt ein Bild, bleibt die heutige Darstellung (Farbe und Emoji).
 */
const LAND = import.meta.glob<string>('./land/*.webp', { eager: true, query: '?url', import: 'default' });
const AUFTRAEGE = import.meta.glob<string>('./auftraege/*.webp', { eager: true, query: '?url', import: 'default' });

const LAND_DATEI: Record<Landscape, string> = {
  wald: 'forest',
  wiese: 'meadow',
  feld: 'field',
  teich: 'pond',
  dorf: 'village',
  berg: 'mountain',
};

export const landImage = (type: Landscape): string | undefined => LAND[`./land/${LAND_DATEI[type]}.webp`];

/** Vignette eines Hofauftrags (`q1` bis `q20`). */
export const questImage = (id: string): string | undefined => AUFTRAEGE[`./auftraege/bub-grafschaft-${id}.webp`];
