import type { RngState, SeatId } from '@brett-und-blatt/engine';

/** Die vier Farben: Rot, Gelb, Blau, Grün. */
export type Color = 'r' | 'y' | 'b' | 'g';
export const COLORS: Color[] = ['r', 'y', 'b', 'g'];

/** Rang 1–13: 1–9 sind Zahlen, 10 Baby, 11 Mädchen, 12 Junge, 13 Santa (höchster Rang). */
export type Rank = number;

/** Friseur-Salon: Veredelungen einer Spielkarte. */
export type Enhancement = 'granite' | 'volume' | 'gloss' | 'ombre' | 'gold' | 'blond' | 'keratin' | 'star';
/** Druck-Technik: Folien für Karten und Mods. „clear“ (durchsichtig) gibt es nur für Mods. */
export type Foil = 'hot' | 'holo' | 'iris' | 'clear';
/** Abzeichen auf Spielkarten. */
export type Seal = 'gold' | 'red' | 'blue' | 'purple';

export interface Card {
  /** Eindeutig innerhalb eines Laufs – für Animationen und Auswahl. */
  id: number;
  rank: Rank;
  color: Color;
  enh?: Enhancement;
  foil?: Foil;
  seal?: Seal;
  /** Dauerhafte Zusatz-Chips (Mod „Wanderer“). */
  bonus?: number;
}

/** In der Sicht: eine verdeckte Karte (Boss „Schloss-Gespenst“ u. a.). */
export interface HiddenCard {
  id: number;
  hidden: true;
}

export type ViewCard = Card | HiddenCard;

export type HandType = 'high' | 'pair' | 'twoPair' | 'three' | 'straight' | 'flush' | 'fullHouse' | 'four' | 'straightFlush' | 'five' | 'flushHouse' | 'flushFive';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';

/** Aufkleber der höheren Sortierstufen auf Mods. */
export type Sticker = 'eternal' | 'perishable' | 'rental';

export interface ModInstance {
  uid: number;
  key: string;
  foil?: Foil;
  sticker?: Sticker;
  /** Zähler für Mods, die wachsen oder schrumpfen (z. B. Eiswaffel). */
  value?: number;
  /** Runden bis „vergänglich“ abläuft. */
  roundsLeft?: number;
  /** Abgelaufen (vergänglich) – wirkt nicht mehr. */
  spent?: boolean;
  /** Zusätzlicher Verkaufswert (Goldei). */
  extraSell?: number;
}

export type ConsumableKind = 'spell' | 'nail' | 'dream';

export interface Consumable {
  kind: ConsumableKind;
  key: string;
}

export type PackKind = 'mods' | 'spells' | 'nails' | 'dreams' | 'cards';
export type PackSize = 'normal' | 'big' | 'huge';

export type Offer = { type: 'mod'; key: string; foil?: Foil; sticker?: Sticker; price: number } | { type: 'consumable'; item: Consumable; price: number } | { type: 'card'; card: Card; price: number };

export interface PackOffer {
  kind: PackKind;
  size: PackSize;
  price: number;
}

export interface Shop {
  offers: (Offer | null)[];
  packs: (PackOffer | null)[];
  /** Werkzeug dieses Levels; null, wenn gekauft oder keines mehr übrig. */
  tool: string | null;
  rerollCost: number;
}

/** Eine geöffnete Lieferung. */
export interface OpenPack {
  kind: PackKind;
  items: Offer[];
  picksLeft: number;
  /** Bei Zauber-Mappe und Traum-Schachtel: Karten zum Verzaubern, wie eine Hand. */
  hand: Card[];
  /** Kam die Lieferung aus dem Laden (zurück in den Laden) oder von einem Sticker? */
  returnTo: 'shop' | 'choose';
}

/** Runde im Level: Vorhut, Wächter, Boss (bzw. Duell). */
export type RoundIndex = 0 | 1 | 2;

export type RunPhase =
  /** Vor Vorhut oder Wächter: spielen oder überspringen. */
  | 'choose'
  | 'play'
  | 'shop'
  | 'pack'
  /** Wartet am Treffpunkt auf die anderen (Duell). */
  | 'wait'
  /** Lauf zu Ende: verloren bzw. ausgeschieden. */
  | 'out'
  /** Alle Level geschafft (Solo, Überleben, Wettrennen). */
  | 'won';

export interface RoundState {
  target: number;
  score: number;
  handsLeft: number;
  discardsLeft: number;
  boss: string | null;
  duel: boolean;
  /** Kombi-Arten, die in dieser Runde schon gespielt wurden (Riesen-Schlange, Goldener Löwe). */
  playedTypes: HandType[];
  /** Erste Hand gespielt? (Schloss-Gespenst) */
  firstDone: boolean;
  /** See-Schlange: Karten wirkungslos, bis ein Mod verkauft wird. */
  silenced: boolean;
  /** Karten-ids, die verdeckt liegen. */
  faceDown: number[];
}

export interface Payout {
  reward: number;
  hands: number;
  bonus: number;
  extra: number;
}

export interface RunState {
  seat: SeatId;
  phase: RunPhase;
  level: number;
  round: RoundIndex;
  tokens: number;
  /** Alle Karten des Decks (Zusammensetzung). */
  deck: Card[];
  /** Nachziehstapel in Reihenfolge (geheim). */
  pile: Card[];
  hand: Card[];
  handSize: number;
  hands: number;
  discards: number;
  mods: ModInstance[];
  modSlots: number;
  consumables: Consumable[];
  consumableSlots: number;
  handLevels: Record<HandType, number>;
  handPlays: Record<HandType, number>;
  tools: string[];
  stickers: string[];
  shop: Shop | null;
  pack: OpenPack | null;
  current: RoundState | null;
  lastPayout: Payout | null;
  /** Zuletzt benutzte Zauber- oder Nagelstudio-Karte (für „Der Narr“). */
  lastSpell: Consumable | null;
  /** Zuletzt gespielte Kombi (blaues Abzeichen). */
  lastHandType: HandType | null;
  /** Werkzeug, das in diesem Level angeboten wird. */
  toolOffer: string | null;
  /** Nur in der Sicht: wie viele Karten wirklich noch im Stapel liegen. */
  pileCount?: number;
  /** Reihenfolge des Ausscheidens (für Gleichstände im Mehrspieler). */
  outAt?: number;
  /** In diesem Level schon gespielte Karten (Fels-Golem). */
  playedThisLevel: number[];
  lives: number;
  nextId: number;
  nextUid: number;
  rng: { deal: RngState; shop: RngState; fx: RngState };
  /** Für Mehrspieler und Abrechnung: bestes Ergebnis einer einzelnen Hand. */
  bestHand: number;
  /** Geschlagene Bosse insgesamt (Farbtropfen). */
  bossesBeaten: number;
  /** Neu gewählter Boss (Fernrohr, Satellit) für ein Level. */
  bossSwap: { level: number; key: string; count: number } | null;
  /** Gewonnene Duelle (jemand anderes hat ein Leben verloren). */
  duelsWon: number;
  /** Wie oft verworfen wurde (Herausforderung „ohne Verwerfen“). */
  discardsUsed: number;
  /** Verlorene Leben (Abwehr). */
  livesLost: number;
}

export type GameMode = 'solo' | 'duel' | 'showdown' | 'survival' | 'race';

export interface DuelState {
  level: number;
  /** Punkte je Platz; null = noch nicht fertig bzw. nicht dabei. */
  scores: (number | null)[];
}

export interface SorterState {
  mode: GameMode;
  deckKind: string;
  stake: number;
  /** Bosse je Level, für alle gleich (öffentlich wie im Original). */
  bosses: string[];
  runs: RunState[];
  duel: DuelState | null;
  /** Gewinner, sobald die Partie vorbei ist. */
  winners: SeatId[] | null;
  /** Sticker fürs Überspringen, je Level zwei (Vorhut, Wächter) – für alle gleich. */
  tags: string[];
  /** Zähler fürs Ausscheiden. */
  outCount: number;
  /** Letztes abgerechnetes Duell (für die Anzeige). */
  lastDuel: {
    level: number;
    scores: (number | null)[];
    losers: SeatId[];
  } | null;
  /** Kennung der Partie (nicht der Seed) – damit Farbtropfen nur einmal gutgeschrieben werden. */
  key: string;
  /** Nach Level 8 weiterspielen (allein und bei Überleben). */
  endless: boolean;
  /** Gesperrte Inhalte („mod:twins“, „tool:bin2“ …), siehe unlocks.ts. */
  locked: string[];
}

export type SorterMove =
  | { type: 'start' }
  | { type: 'skip' }
  | { type: 'play'; cards: number[] }
  | { type: 'discard'; cards: number[] }
  | { type: 'use'; index: number; cards: number[] }
  | { type: 'sellMod'; index: number }
  | { type: 'sellConsumable'; index: number }
  | { type: 'moveMod'; from: number; to: number }
  | { type: 'buy'; index: number }
  | { type: 'buyPack'; index: number }
  | { type: 'buyTool' }
  | { type: 'reroll' }
  | { type: 'pick'; index: number; cards: number[] }
  | { type: 'skipPack' }
  | { type: 'next' }
  | { type: 'sortHand'; by: 'rank' | 'color' }
  | { type: 'rerollBoss' };
