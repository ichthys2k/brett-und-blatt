import type { DeckThemeId } from '../types';

const CHAMPION_IMAGES = import.meta.glob<string>('./champions/*.webp', { eager: true, query: '?url', import: 'default' });

export const HOUSE_NAMES: Record<DeckThemeId, string> = {
  forest: 'Haus Eichenhain',
  sea: 'Seefahrergilde',
  farm: 'Dorfgemeinschaft Hahnfeld',
  wild: 'Fernländer Karawane',
  bugs: 'Schwarm vom Moorbach',
};

export const HOUSE_CHAMPIONS: Record<DeckThemeId, { title: string; animal: string }> = {
  forest: { title: 'Wächter von Eichenhain', animal: 'Bär' },
  sea: { title: 'Gildekapitän', animal: 'Seeotter' },
  farm: { title: 'Hof-Champion', animal: 'Hahn' },
  wild: { title: 'Wüstenkrieger', animal: 'Karakal' },
  bugs: { title: 'Moor-Ritter', animal: 'Hirschkäfer' },
};

/** Liefert die Bild-URL für den Champion des Wappenhauses. */
export function championImage(house: DeckThemeId): string | undefined {
  return CHAMPION_IMAGES[`./champions/${house}.webp`];
}
