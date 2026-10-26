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
  /**
   * Sieht jeder Platz etwas anderes (eigene Handkarten)? Dann kommt beim Hot-Seat
   * vor jedem Zug der Übergabe-Bildschirm. Fehlt die Angabe, gilt `hiddenInformation`.
   * Paare finden verbirgt zwar die Karten, aber vor allen gleich – dort ist es false.
   */
  privateViews?: boolean;
  /** Wird erhöht, wenn sich Regeln so ändern, dass alte Zuglisten anders ausgehen würden. */
  ruleVersion: number;
  /** Bietet die Oberfläche einen „Tipp“-Knopf an? Der Tipp kommt vom Standard-Bot. */
  hints?: boolean;
  /** Kurze Anleitung „So geht's“: die wichtigsten Regeln in wenigen Sätzen, je ein Punkt pro Eintrag. */
  howToPlay: string[];
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
  /** Nur zeigen, wenn andere Optionen bestimmte Werte haben, z. B. { variant: ['klondike'] }. */
  when?: Record<string, string[]>;
}

export type Options = Record<string, string>;

export type TimeControl =
  | { kind: 'none' }
  /**
   * Feste Zeit pro Zug, optional mit persönlicher Reserve (Zeitbank) für die ganze Partie.
   * `firstMoveMs`: eigene Zeit für den ersten Zug jedes Platzes, z. B. das Aufstellen der Flotte.
   */
  | { kind: 'perMove'; moveMs: number; bankMs?: number; firstMoveMs?: number }
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
  | { kind: 'draw'; reason?: string }
  /** Niemand gewinnt – etwa ein Solitaire, das aufgegeben wurde, oder ein verlorenes kooperatives Spiel. */
  | { kind: 'loss'; reason?: string };

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
  /**
   * Für Züge, die sich nicht vollständig aufzählen lassen (z. B. eine ganze Flotte aufstellen):
   * prüft einen Zug direkt. `legalMoves` liefert dann nur einige Beispiele. Fehlt die Funktion,
   * ist erlaubt, was `legalMoves` aufzählt.
   */
  isLegal?(state: S, actor: Actor, move: M): boolean;
  /** Wirft einen Fehler bei unerlaubten Zügen. */
  applyMove(state: S, actor: Actor, move: M): MoveResult<S>;
  /** Blendet Geheimes aus. Bei Spielen ohne Geheimnisse ist die Sicht der ganze Spielstand. */
  playerView(state: S, seat: SeatId | 'spectator'): V;
  result(state: S): Result | null;

  /**
   * Aufgeben als Spielzug: Nur dieser Platz scheidet aus, die anderen spielen weiter.
   * `applyMove` muss ihn jederzeit annehmen, auch wenn der Platz nicht am Zug ist; in
   * `legalMoves` gehört er nicht (sonst wählen ihn Bots). null, wenn der Platz nicht
   * (mehr) aufgeben kann. Fehlt die Funktion, beendet Aufgeben die ganze Partie.
<<<<<<< HEAD
   * Mit `reason: 'time'` gilt dasselbe bei abgelaufener Schachuhr.
   */
  resignMove?(state: S, seat: SeatId, reason?: 'resign' | 'time'): M | null;
=======
   */
  resignMove?(state: S, seat: SeatId): M | null;
>>>>>>> origin/claude/project-thread-ov6sr7
  /** Standardzug bei Zeitablauf; fehlt er, zieht der Bot. */
  timeoutMove?(state: S, seat: SeatId): M;
  /** Pflicht bei verdeckten Informationen: füllt Unbekanntes passend zur Sicht auf. */
  sampleHidden?(view: V, seat: SeatId, rng: Rng): S;
  /** Stellungsbewertung aus Sicht von `seat` für Suchbots. */
  evaluate?(state: S, seat: SeatId): number;
  /**
   * Online: Was darf ein Platz von einem Ereignis erfahren? Fehlt die Funktion, gelten alle
   * Ereignisse als öffentlich. Ereignisse mit Geheimnissen (z. B. welche Karte gezogen wurde)
   * hier entschärfen oder mit null ganz ausblenden. Züge selbst gehen online nie an andere.
   */
  eventView?(event: GameEvent, seat: SeatId | 'spectator'): GameEvent | null;

  /** Mindestens einer. Der erste ist der Standard-Bot in der Lobby. */
  bots: BotDefinition<S, M, V>[];
}

/** Ein Spielmodul mit beliebigen Typen, z. B. für Listen und die Spielleitung. */
export type AnyGameModule = GameModule<any, any, any>;
