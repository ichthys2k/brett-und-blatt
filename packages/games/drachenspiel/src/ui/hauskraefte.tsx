/*
 * Bilder der Hauskräfte (#467): `hauskraefte/kraft-<Haus>.webp`. Der Bauernhof nutzt das Kartenbild des Kükens.
 * Fehlt ein Bild, bleibt das Emoji.
 */
import type { HousePower } from '../types';
import { CARD_ART_MEDIA } from './cardArt';

const files = import.meta.glob<string>('./hauskraefte/kraft-*.webp', { eager: true, query: '?url', import: 'default' });

/** Haus → Bildadresse (ohne Bauernhof). */
const POWER_ART: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.replace('./hauskraefte/kraft-', '').replace('.webp', ''), url]),
);

export function powerArtUrl(power: Pick<HousePower, 'id'>): string | undefined {
  return power.id === 'farm' ? CARD_ART_MEDIA['bub-ds-token_chick.webp'] : POWER_ART[power.id];
}

/** Inhalt des Medaillons: gemaltes Bild, sonst das Emoji. */
export function PowerIcon({ power }: { power: HousePower }) {
  const url = powerArtUrl(power);
  return url ? <img className="ds-power-img" src={url} alt="" draggable={false} aria-hidden="true" /> : <span aria-hidden="true">{power.emoji}</span>;
}
