import type { Rng } from './random';

/** Platz am Tisch: 0, 1, 2, … in Sitzreihenfolge. */
export type SeatId = number;

/** Wer einen Zug macht: ein Platz oder die Spielleitung selbst (Systemzug, z. B. Würfeln). */
export type Actor = SeatId | 'system';

export type Mode = 'solo' | 'hotseat' | 'online' | 'parallel';

export type Pattern = 'open' | 'hidden' | 'simultaneous' | 'parallel' | 'cooperative';

export interface GameInfo {
  id: string;
  name: string;
  description: string;
  emoji: string;
  players: { min: number; max: number };
  modes: Mode[];
  patterns: Pattern[];
  /** true, wenn `playerView` etwas verbirgt (Handkarten, Flotten, Würfel …). */
  hiddenInformation: boolean;
  /** Wird erhöht, wenn sich Regeln so ändern, dass alte Zuglisten anders ausgehen würden. */
  ruleVersion: number;
}

export interface OptionChoice {
  value: string;
  label: string;
}

/** Eine Variante oder Hausregel; erscheint in der Lobby als Auswahl. */
export interface OptionSpec {
  id: string;
  label: string;
  description?: string;
  choices: OptionChoice[];
  default: string;
}

export type Options = Record<string, string>;

export type TimeControl =
  | { kind: 'none' }
  /** Feste Zeit pro Zug, optional mit persönlicher Reserve (Zeitbank) für die ganze Partie. */
  | { kind: 'perMove'; moveMs: number; bankMs?: number }
  /** Schachuhr: Gesamtzeit pro Spieler, nach jedem Zug kommt der Zuschlag dazu. */
  | { kind: 'chessClock'; baseMs: number; incrementMs: number };

export interface TimePresets {
  relaxed: TimeControl;
  normal: TimeControl;
  fast: TimeControl;
}

export type TimePresetId = keyof TimePresets;

/** Beschreibt, was passiert ist – die Oberfläche animiert danach. */
export interface GameEvent {
  type: string;
  [key: string]: unknown;
}

export interface MoveResult<S> {
  state: S;
  events: GameEvent[];
}

export type Result =
  | { kind: 'win'; winners: SeatId[]; reason?: string }
  | { kind: 'draw'; reason?: string };

export type BotLevel = 'easy' | 'medium' | 'hard';

export const BOT_LEVELS: BotLevel[] = ['easy', 'medium', 'hard'];

export interface BotContext<S, M, V> {
  module: GameModule<S, M, V>;
  /** Der Bot sieht nur, was auch ein Mensch auf diesem Platz sähe. */
  view: V;
  seat: SeatId;
  level: BotLevel;
  rng: Rng;
  /** Wie lange der Bot höchstens rechnen soll; Bots ohne Suche ignorieren das. */
  timeBudgetMs: number;
  now: () => number;
}

export interface BotDefinition<S, M, V = S> {
  id: string;
  name: string;
  levels: BotLevel[];
  chooseMove(ctx: BotContext<S, M, V>): M;
}

/**
 * Die Schnittstelle, die jedes Spiel erfüllt. Alle Funktionen sind rein:
 * Sie verändern ihre Eingaben nicht und hängen nur von ihnen ab.
 */
export interface GameModule<S, M, V = S> {
  info: GameInfo;
  options: OptionSpec[];
  timePresets: TimePresets;

  setup(seats: number, options: Options, seed: string): S;
  /** Wer gerade handeln darf – auch mehrere Plätze gleichzeitig oder 'system'. */
  currentPlayers(state: S): Actor[];
  legalMoves(state: S, actor: Actor): M[];
  /** Wirft einen Fehler bei unerlaubten Zügen. */
  applyMove(state: S, actor: Actor, move: M): MoveResult<S>;
  /** Blendet Geheimes aus. Bei Spielen ohne Geheimnisse ist die Sicht der ganze Spielstand. */
  playerView(state: S, seat: SeatId | 'spectator'): V;
  result(state: S): Result | null;

  /** Standardzug bei Zeitablauf; fehlt er, zieht der Bot. */
  timeoutMove?(state: S, seat: SeatId): M;
  /** Pflicht bei verdeckten Informationen: füllt Unbekanntes passend zur Sicht auf. */
  sampleHidden?(view: V, seat: SeatId, rng: Rng): S;
  /** Stellungsbewertung aus Sicht von `seat` für Suchbots. */
  evaluate?(state: S, seat: SeatId): number;

  /** Mindestens einer. Der erste ist der Standard-Bot in der Lobby. */
  bots: BotDefinition<S, M, V>[];
}

/** Ein Spielmodul mit beliebigen Typen, z. B. für Listen und die Spielleitung. */
export type AnyGameModule = GameModule<any, any, any>;
