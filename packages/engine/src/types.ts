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
  /**
   * Dürfen Mitspieler auch im laufenden Betrieb an freie Plätze hinzukommen oder ihren
   * Platz verlassen, um ab der nächsten Runde mitzuspielen (z. B. Poker)?
   */
  joinMidGame?: boolean;
  /**
   * Noch in Arbeit: Das Spiel erscheint nicht auf der Startseite, nicht in der Online-Lobby und
   * nicht auf dem Spieleserver. Zum Testen bleibt es über `#/neu/<id>` erreichbar.
   */
  draft?: boolean;
  /**
   * Das Spiel bringt eigene Musik mit (z. B. Enten-Rallye): Die allgemeine Playlist läuft dann
   * nicht, und die Oberfläche spielt ihre Musik selbst (Lautstärken über `BoardProps.audio`).
   */
  ownMusic?: boolean;
  /**
   * Teamspiel: Die Lobby zeigt je Platz das Team und lässt es wechseln (`teamOption`,
   * `teamsFromOptions` in `teams.ts`). `names` sind die Anzeigenamen der Teams.
   */
  teams?: { count: number; names: string[] };
  /** Mindestens so viele Menschen braucht eine Partie; ohne Gespräch unter Menschen ist sie sinnlos. Fehlt die Angabe, reicht einer. */
  minHumans?: number;
  /** Kein „Zug zurück“: Bei geheimen Rollen an einem Gerät würde das Zurücknehmen Wissen verraten. */
  noUndo?: boolean;
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
  /**
   * Nicht in Einrichtung und Lobby zeigen: Die Oberfläche des Spiels füllt den Wert selbst
   * (`GameUi.prepareOptions`), z. B. mit Freischaltungen dieses Geräts. Online lässt sich eine
   * verborgene Option nicht setzen, dort gilt immer der Standard.
   */
  hidden?: boolean;
  /** Freier Wert statt Auswahl: erlaubt ist außer den Auswahlen jeder Text, der ganz auf dieses Muster passt (höchstens `maxLength` Zeichen). */
  pattern?: string;
  /** Höchstlänge für freie Werte (`pattern`), Standard 256 – z. B. mehr für eingefügte Partien (SGF, PGN). */
  maxLength?: number;
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
  | { kind: 'chessClock'; baseMs: number; incrementMs: number }
  /**
   * Byo-yomi (Go): Hauptzeit für die ganze Partie, danach `periods` Perioden mit je `periodMs`
   * pro Zug. Wer eine Periode überschreitet, verbraucht sie; nach der letzten ist die Zeit um.
   */
  | { kind: 'byoyomi'; mainMs: number; periods: number; periodMs: number };

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
  /**
   * Bedenkpause in Millisekunden, bevor die Spielleitung den gewählten Zug ausführt – etwa
   * damit ein Bingo-Ansager nicht alle Zahlen auf einmal zieht. Gilt nur für Bot-Züge, nicht
   * bei Zeitablauf. Bis dahin wird der Zug geparkt und erst bei Fälligkeit noch einmal geprüft.
   * Fehlt die Funktion, zieht der Bot sofort.
   */
  delayMs?(ctx: { view: V; seat: SeatId; level: BotLevel; move: M; rng: Rng }): number;
}

/**
 * Die Schnittstelle, die jedes Spiel erfüllt. Alle Funktionen sind rein:
 * Sie verändern ihre Eingaben nicht und hängen nur von ihnen ab.
 */
/** Woher ein Spiel zusätzliche Daten holen darf, bevor es zum ersten Mal gebraucht wird. */
export interface PrepareContext {
  /** Adresse des Spieleservers – null, wenn diese Auslieferung keinen kennt. */
  serverUrl: string | null;
  /** Wurzel der ausgelieferten App (Vite `base`), immer mit abschließendem Schrägstrich. */
  baseUrl: string;
}

export interface GameModule<S, M, V = S> {
  info: GameInfo;
  options: OptionSpec[];
  timePresets: TimePresets;
  /**
   * Wird einmal vor dem ersten Gebrauch der Regeln aufgerufen (im Browser, im Bot-Worker und
   * überall dort, wo die Plattform die Regeln lädt) – für Spiele, deren Inhalte nicht im
   * JS-Bundle stecken, etwa der Fragenkatalog des Bibel-Quiz. Fehlt der Haken, ist nichts zu tun.
   */
  prepare?(context: PrepareContext): Promise<void>;
  /** Zeitvorgaben, die von den Optionen abhängen (z. B. Brettgröße bei Go). Fehlt sie, gilt `timePresets`. */
  timePresetsFor?(options: Options): TimePresets;

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
   * Mit `reason: 'time'` gilt dasselbe bei abgelaufener Schachuhr.
   */
  resignMove?(state: S, seat: SeatId, reason?: 'resign' | 'time'): M | null;
  /**
   * Für Spiele mit `joinMidGame`: Systemzug, mit dem ein Platz im laufenden Betrieb für die
   * nächste Runde hinzukommt (`active = true`) oder den Tisch verlässt (`active = false`).
   * Wird mit `actor = 'system'` ausgeführt und im Zugprotokoll gespeichert.
   */
  seatChangeMove?(state: S, seat: SeatId, active: boolean): M | null;
  /**
   * Wartezeit der Spielleitung vor dem nächsten Systemzug: Ist 'system' am Zug und liefert die
   * Funktion mehr als 0, führt die Spielleitung den Systemzug erst nach so vielen Millisekunden
   * aus – für Abläufe in Echtzeit wie die Strömung in der Enten-Rallye. Die anderen Plätze
   * können währenddessen weiter ziehen. Die Regeln kennen dabei keine Zeit; der fällige
   * Systemzug landet wie jeder andere im Protokoll. Fehlt die Funktion, sofort.
   */
  systemDelayMs?(state: S): number;
  /** Standardzug bei Zeitablauf; fehlt er, zieht der Bot. */
  timeoutMove?(state: S, seat: SeatId): M;
  /** Pflicht bei verdeckten Informationen: füllt Unbekanntes passend zur Sicht auf. */
  sampleHidden?(view: V, seat: SeatId, rng: Rng): S;
  /**
   * Gesetzt, wenn `playerView(sampleHidden(Sicht))` die Sicht nur ungefähr wiederherstellt –
   * mit kurzer Begründung. Die Vertragsprüfung überspringt dann diesen Vergleich.
   */
  sampleHiddenApproximate?: string;
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
