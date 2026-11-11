import type { DeckStyle } from '@brett-und-blatt/engine';
import type { CardBackId, CardBackProps } from './CardBack';

export interface SharedCardBackOptions {
  deckStyle?: DeckStyle;
  tableDesign?: CardBackId;
  label?: string;
}

/**
 * Liefert einheitliche Kartenrücken-Props für gemeinsame Stapel
 * (Nachziehstapel, Talon, Skat, gegnerische Handkarten).
 * Schließt individuelle Wappen und individuelle Bild-URLs explizit aus,
 * damit keine verdeckte Karte anhand ihrer Rückseite identifiziert werden kann.
 */
export function resolveSharedCardBack(options: SharedCardBackOptions = {}): CardBackProps {
  const isGermanic = options.deckStyle === 'bavarian' || options.deckStyle === 'german';
  const defaultDesign: CardBackId = isGermanic ? 'bavarian-gold' : 'classic-red';
  const design = options.tableDesign ?? defaultDesign;

  return {
    design,
    crest: undefined,
    customImageUrl: undefined,
    label: options.label ?? 'Verdeckte Karte',
  };
}
