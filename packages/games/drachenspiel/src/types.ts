import type { Options, RngState, SeatId } from '@brett-und-blatt/engine';

export type DeckThemeId = 'forest' | 'sea' | 'farm' | 'wild' | 'bugs';

/** Fähigkeiten, die eine Figur auf dem Feld trägt. */
export type MinionKeyword =
  | 'taunt'
  | 'rush'
  | 'bubble'
  | 'poisonous'
  | 'stealth'
  | 'sprinter'
  | 'doubleStrike'
  | 'lifesteal'
  | 'frostbite'
  | 'reborn'
  | 'immune'
  | 'elusive';

/** `tradeable` wirkt nur auf der Hand. */
export type KeywordId = MinionKeyword | 'tradeable';

/** Wen ein Effekt trifft. `chosen` ist das beim Ausspielen gewählte Ziel. */
export type Selector =
  | { pick: 'chosen' }
  | { pick: 'hero'; side: 'own' | 'enemy' }
  | { pick: 'allMinions'; side: 'own' | 'enemy'; exceptSelf?: boolean };

/** Wortschatz der Karten: Neue Karten kommen ohne eigenen Regelcode aus. */
export type Effect =
  | { kind: 'damage'; amount: number; to: Selector }
  | { kind: 'heal'; amount: number | 'full'; to: Selector }
  | { kind: 'buff'; attack?: number; health?: number; to: Selector }
  | { kind: 'grantKeyword'; keyword: MinionKeyword; to: Selector }
  | { kind: 'ready'; to: Selector }
  | { kind: 'draw'; count: number }
  | { kind: 'summon'; cardId: string; count?: number }
  | { kind: 'returnToHand'; to: Selector }
  | { kind: 'mana'; amount: number }
  | { kind: 'armor'; amount: number }
  /** Angriff des eigenen Helden, nur für diesen Zug. */
  | { kind: 'heroAttack'; amount: number }
  | { kind: 'equip'; gear: Gear }
  /** Ruft eines der Tiere, ausgelost über den Zufallsstrom der Partie. */
  | { kind: 'summonRandom'; cardIds: string[] }
  /** Das Ziel setzt seinen nächsten Angriff aus. */
  | { kind: 'freeze'; to: Selector }
  /** Nimmt Verstärkungen und Fähigkeiten, Schaden bleibt. */
  | { kind: 'silence'; to: Selector }
  /** Karte auf die Hand; flüchtig heißt: verschwindet am Ende des Zugs. */
  | { kind: 'addToHand'; cardId: string; fleeting?: boolean }
  /** Zweite Chance: nur vom Regelkern eingereiht, in keiner Kartenliste. */
  | { kind: 'rebirth'; cardId: string };

/** Rüstzeug: zeitlich begrenzter Angriff des Helden, nutzt sich mit jedem Angriff ab. */
export interface Gear {
  name: string;
  emoji: string;
  attack: number;
  durability: number;
}

/** Hauskraft: einmal je Zug, die Wirkung ist wie bei Karten reine Daten. */
export interface HousePower {
  id: DeckThemeId;
  name: string;
  emoji: string;
  cost: number;
  effects: Effect[];
  /** Regeltext; wird aus `effects` erzeugt. */
  text: string;
}

export interface Trigger {
  on: 'played' | 'death';
  do: Effect[];
}

/** Wen ein Zauber treffen darf. */
export type SpellTargeting = 'none' | 'enemyAny' | 'enemyMinion' | 'ownMinion';

export type SpellTarget = { kind: 'minion'; id: string } | { kind: 'hero' };

export interface CardDefinition {
  id: string;
  name: string;
  cost: number;
  attack: number;
  health: number;
  emoji: string;
  quote: string;
  sound?: string;
  isSpell?: boolean;
  /** Höchstens eine Kopie im gemischten Deck (Fuchs, Drache). */
  singleCopy?: boolean;
  /** Spielstein: gehört in kein Deck und kehrt nie auf die Hand zurück. */
  token?: boolean;
  /** Name im Akkusativ mit Artikel für erzeugte Regeltexte. */
  textName?: string;
  keywords?: KeywordId[];
  /** Naturkraft: So viel mehr Schaden machen eigene Zauber, solange das Tier liegt. */
  spellPower?: number;
  triggers?: Trigger[];
  /** Wirkung eines Zaubers. */
  effects?: Effect[];
  targeting?: SpellTargeting;
  /** Regeltext des Zaubers; wird aus `effects` erzeugt. */
  text?: string;
}

/** Eine Veränderung an einer Figur; die Werte werden daraus berechnet. */
export interface Enchantment {
  id: string;
  source: string;
  attack?: number;
  health?: number;
}

/** Ein Effekt in der Warteschlange des Spielstands (reines JSON, später auch über eine Wahl hinweg). */
export interface QueuedEffect {
  effect: Effect;
  seat: SeatId;
  sourceCard: string;
  sourceId: string | null;
  target: SpellTarget | null;
}

export interface CardInstance {
  uid: string;
  defId: string;
  /** Flüchtig: verschwindet am Ende des eigenen Zugs von der Hand. */
  fleeting?: boolean;
}

export interface Minion {
  id: string;
  cardId: string;
  owner: SeatId;
  /** Laufende Nummer: entscheidet die Reihenfolge gleichzeitiger Ereignisse. */
  playOrder: number;
  name: string;
  emoji: string;
  cost: number;
  baseAttack: number;
  attack: number;
  baseHealth: number;
  maxHealth: number;
  health: number;
  damage: number;
  enchantments: Enchantment[];
  quote: string | null;
  sound: string | null;
  taunt: boolean;
  rush: boolean;
  bubble: boolean;
  poisonous: boolean;
  stealth: boolean;
  canAttack: boolean;
  hasAttacked: boolean;
  // Ab `ruleVersion` 6, nur gesetzt, wenn sie zutreffen. So laufen ältere Spielstände unverändert weiter.
  sprinter?: boolean;
  doubleStrike?: boolean;
  lifesteal?: boolean;
  frostbite?: boolean;
  reborn?: boolean;
  immune?: boolean;
  elusive?: boolean;
  spellPower?: number;
  frozen?: boolean;
  silenced?: boolean;
  /** In diesem Zug aufs Feld gekommen. */
  justPlayed?: boolean;
  attacksMade?: number;
}

export interface PlayerState {
  seat: SeatId;
  health: number;
  maxHealth: number;
  armor: number;
  gear: Gear | null;
  /** Zusätzlicher Angriff des Helden in diesem Zug. */
  heroAttackBonus: number;
  heroAttacked: boolean;
  /** Hauskraft dieses Platzes; beim gemischten Deck aus dem Seed gewählt. */
  power: DeckThemeId | null;
  powerUsed: boolean;
  mana: number;
  maxMana: number;
  deck: CardInstance[];
  hand: CardInstance[];
  board: Minion[];
  fatigue: number;
  /** `mixed`: gemischtes Zufallsdeck ohne Thema. */
  deckTheme: DeckThemeId | 'mixed' | null;
  mulliganDone: boolean;
}

export type Phase = 'deckSelection' | 'mulligan' | 'play' | 'ended';

export interface DrachenspielState {
  phase: Phase;
  activeSeat: SeatId;
  turn: number;
  players: [PlayerState, PlayerState];
  startingSeat: SeatId;
  nextEntityId: number;
  /** Zufallsstrom der Partie, aus dem Seed abgeleitet; gehört nie in eine Sicht. */
  rng: RngState;
  queue: QueuedEffect[];
  options: Options;
}

export interface HiddenPlayerView {
  seat: SeatId;
  health: number;
  maxHealth: number;
  armor: number;
  gear: Gear | null;
  heroAttackBonus: number;
  heroAttacked: boolean;
  power: DeckThemeId | null;
  powerUsed: boolean;
  mana: number;
  maxMana: number;
  deckCount: number;
  handCount: number;
  hand: CardInstance[] | null;
  board: Minion[];
  fatigue: number;
  deckTheme: DeckThemeId | 'mixed' | null;
  mulliganDone: boolean;
}

export interface DrachenspielView {
  phase: Phase;
  activeSeat: SeatId;
  turn: number;
  players: [HiddenPlayerView, HiddenPlayerView];
  startingSeat: SeatId;
  viewerSeat: SeatId | 'spectator';
  options: Options;
}

export type DrachenspielMove =
  | { type: 'chooseDeck'; deck: DeckThemeId }
  | { type: 'mulligan'; discardIndices: number[] }
  | { type: 'playCard'; handIndex: number; target?: SpellTarget }
  | { type: 'attack'; attackerId: string; target: { kind: 'minion'; id: string } | { kind: 'hero' } }
  | { type: 'tradeCard'; handIndex: number }
  | { type: 'heroPower' }
  | { type: 'heroAttack'; target: { kind: 'minion'; id: string } | { kind: 'hero' } }
  | { type: 'endTurn' };
