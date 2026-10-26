import type { Options, SeatId } from '@brett-und-blatt/engine';

export type DeckThemeId = 'forest' | 'sea' | 'farm' | 'wild' | 'bugs';

export type Ability =
  | { type: 'taunt' }
  | { type: 'rush' }
  | { type: 'bubble' }
  | { type: 'poisonous' }
  | { type: 'stealth' }
  | { type: 'battlecry'; effect: BattlecryEffect }
  | { type: 'deathrattle'; effect: DeathrattleEffect };

export type BattlecryEffect =
  | 'summon_ant'
  | 'buff_allies_attack_1'
  | 'heal_hero_3'
  | 'dragon_breath';

export type DeathrattleEffect =
  | 'butterfly'
  | 'explode_1'
  | 'heal_hero_2';

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
  abilities?: Ability[];
}

export interface CardInstance {
  uid: string;
  defId: string;
}

export interface Minion {
  id: string;
  cardId: string;
  name: string;
  emoji: string;
  cost: number;
  baseAttack: number;
  attack: number;
  baseHealth: number;
  maxHealth: number;
  health: number;
  quote: string | null;
  sound: string | null;
  taunt: boolean;
  rush: boolean;
  bubble: boolean;
  poisonous: boolean;
  stealth: boolean;
  canAttack: boolean;
  hasAttacked: boolean;
  deathrattle: DeathrattleEffect | null;
}

export interface PlayerState {
  seat: SeatId;
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  deck: CardInstance[];
  hand: CardInstance[];
  board: Minion[];
  fatigue: number;
  deckTheme: DeckThemeId | null;
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
  options: Options;
}

export interface HiddenPlayerView {
  seat: SeatId;
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  deckCount: number;
  handCount: number;
  hand: CardInstance[] | null;
  board: Minion[];
  fatigue: number;
  deckTheme: DeckThemeId | null;
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
  | { type: 'playCard'; handIndex: number }
  | { type: 'attack'; attackerId: string; target: { kind: 'minion'; id: string } | { kind: 'hero' } }
  | { type: 'endTurn' };
