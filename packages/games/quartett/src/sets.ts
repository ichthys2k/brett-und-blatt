import bibel from '../../../../content/quartett/bibel.json';
import dinosaurier from '../../../../content/quartett/dinosaurier.json';
import geometrie from '../../../../content/quartett/geometrie.json';
import tiere from '../../../../content/quartett/tiere.json';
import weltraum from '../../../../content/quartett/weltraum.json';

/** Eine Eigenschaft, nach der verglichen wird, z. B. Gewicht. */
export interface CardProperty {
  id: string;
  label: string;
  unit: string;
  /** true: Der höhere Wert gewinnt; false: der niedrigere (z. B. „früher gefunden“). */
  higherWins: boolean;
  /** Anzeige: Zahl mit Tausenderpunkten bzw. Mio./Mrd. (Standard), Jahreszahl ohne Punkt, Jahr v./n. Chr. */
  format?: 'plain' | 'year';
  /** Feste Texte für bestimmte Werte, z. B. Buchnummer → „1. Mose“. */
  valueLabels?: Record<string, string>;
}

export interface QuartettCard {
  /** Gruppe und Nummer, z. B. „C3“. */
  id: string;
  name: string;
  emoji: string;
  values: Record<string, number>;
  /** Quelle für alle Werte der Karte … */
  source?: string;
  /** … oder je Eigenschaft. */
  sources?: Record<string, string>;
}

export interface CardSet {
  id: string;
  name: string;
  emoji: string;
  license: string;
  /** „Entwurf“, solange die Werte nicht geprüft sind. */
  status?: string;
  description: string;
  /** Wie die Werte zu verstehen sind (Messweise, Rundung, Zählweise). */
  note: string;
  properties: CardProperty[];
  groups: { id: string; name: string }[];
  cards: QuartettCard[];
}

export const CARD_SETS: Record<string, CardSet> = {
  tiere: tiere as CardSet,
  weltraum: weltraum as CardSet,
  bibel: bibel as CardSet,
  dinosaurier: dinosaurier as CardSet,
  geometrie: geometrie as CardSet,
};

export const SET_IDS = Object.keys(CARD_SETS);

export function cardSet(id: string): CardSet {
  return CARD_SETS[id] ?? CARD_SETS.tiere!;
}

export type CardId = string;

/** Die Gruppe einer Karte: „C3“ → „C“. */
export function groupOf(card: CardId): string {
  return card.slice(0, 1);
}

const byId = new Map<string, Map<CardId, QuartettCard>>();

export function cardOf(setId: string, card: CardId): QuartettCard {
  let cards = byId.get(setId);
  if (!cards) {
    cards = new Map(cardSet(setId).cards.map((c) => [c.id, c]));
    byId.set(setId, cards);
  }
  const found = cards.get(card);
  if (!found) throw new Error(`Unbekannte Karte ${card}`);
  return found;
}

export function valueOf(setId: string, card: CardId, property: string): number {
  return cardOf(setId, card).values[property] ?? 0;
}

/** Vergleich zweier Werte: > 0, wenn `a` besser ist. */
export function compareValues(property: Pick<CardProperty, 'higherWins'>, a: number, b: number): number {
  return property.higherWins ? a - b : b - a;
}

const SCALES: [number, string][] = [
  [1e15, 'Brd.'],
  [1e12, 'Bio.'],
  [1e9, 'Mrd.'],
  [1e6, 'Mio.'],
];

/** Ein Wert für die Anzeige, z. B. „6.000“, „1,43 Mrd.“, „0,0022“ oder „1800 v. Chr.“. */
export function formatValue(property: CardProperty, value: number): string {
  const label = property.valueLabels?.[String(value)];
  if (label) return label;
  if (property.format === 'year') return value < 0 ? `${-value} v. Chr.` : `${value} n. Chr.`;
  if (property.format === 'plain') return String(value);
  const abs = Math.abs(value);
  for (const [scale, name] of SCALES) {
    if (abs >= scale) return `${(value / scale).toLocaleString('de-DE', { maximumSignificantDigits: 3 })} ${name}`;
  }
  if (abs > 0 && abs < 1) return value.toLocaleString('de-DE', { maximumSignificantDigits: 2, maximumFractionDigits: 12 });
  return value.toLocaleString('de-DE', { maximumFractionDigits: 2 });
}

/** Wert mit Einheit, z. B. „6.000 kg“. */
export function formatWithUnit(property: CardProperty, value: number): string {
  const text = formatValue(property, value);
  return property.unit ? `${text} ${property.unit}` : text;
}
