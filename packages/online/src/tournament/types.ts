import type { Options } from '@brett-und-blatt/engine';

/**
 * Datenmodell der Turniere (W-053, Umbau W-058 Stufe 0). Der Zustand ist reines JSON;
 * Kennungen (`token`) sind geheim und stehen nie in einer Sicht.
 */

export const TOURNAMENT_MIN_PLAYERS = { world: 6, swiss: 4, knockout: 4, double: 4, league: 3, tables: 3, lives: 3 } as const;
/** Obergrenze für alle Turniere (Entscheidung 7.11.2026). */
export const TOURNAMENT_MAX_PLAYERS = 128;
/** Namen von Teilnehmern vor Ort dürfen länger sein als Spitznamen, z. B. „Anna / Ben“. */
export const ENTRANT_NAME_LENGTH = 30;
/** Höchstens so viele Tische oder Felder. */
export const TOURNAMENT_MAX_FIELDS = 32;
/** „Bereit“ gilt nur so lange, damit niemand Tage später in eine Partie gezogen wird. */
export const READY_WINDOW_MS = 10 * 60 * 1000;
/** Eine Partie, die spät spielbar wird, hat mindestens so lange Zeit. */
export const MATCH_MIN_TIME_MS = 24 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;
/** Nach dem Ende bleibt das Turnier so lange sichtbar, dann wird es gelöscht. */
export const TOURNAMENT_KEEP_MS = 30 * DAY_MS;
/** Ligen laufen über Monate: ein Jahr nach der letzten Aktivität. */
export const LEAGUE_KEEP_MS = 365 * DAY_MS;
export const TOURNAMENT_NAME_LENGTH = 40;

/** WM-Form (vor Ort „Gruppen + K.-o.“), Schweizer System, K.-o., Doppel-K.-o., Bundesliga-Modus, Tischrunden (Stufe 3). */
export type TournamentFormat = 'world' | 'swiss' | 'knockout' | 'double' | 'league' | 'tables' | 'lives';
/** Online im Spielraum oder vor Ort mit Ergebnis von Hand. */
export type TournamentMode = 'online' | 'local';
/** Was vor Ort gezählt wird. */
export type ResultKind = 'winner' | 'goals' | 'sets' | 'points';
export type TournamentPhase = 'signup' | 'running' | 'finished';
export type MatchStatus = 'waiting' | 'open' | 'running' | 'done';
export type MatchSide = 0 | 1;

export interface TournamentSettings {
  name: string;
  gameId: string;
  format: TournamentFormat;
  /** Zeitvorgabe der Partien: relaxed, normal oder fast. */
  time: 'relaxed' | 'normal' | 'fast';
  /** Tage je Phase bis zum Stichtag. */
  days: number;
  /** Spiel um Platz 3 (WM-Form und K.-o.). */
  thirdPlace: boolean;
  /** Öffentlich ausgeschrieben (in „Offene Runden“), solange die Einschreibung läuft; fehlt = ja. */
  isPublic?: boolean;
  /** Spieloptionen aller Partien; was fehlt, steht auf dem Standard. */
  options?: Options;
  /** Fehlt = online. Vor Ort gelten `time` und `days` nicht; `gameId` ist leer oder das Brett-&-Blatt-Spiel, das als Sportart gespielt wird (Stufe 3). */
  mode?: TournamentMode;
  /** Vor Ort: Sportart oder Spiel, frei („Tischkicker“, „Volleyball“). */
  sport?: string;
  /** Vor Ort: was eingetragen wird; fehlt = nur Sieger. */
  result?: ResultKind;
  /** Vor Ort: Unentschieden erlaubt, wo die Form es zulässt (Gruppe, Liga, Schweizer System). */
  draws?: boolean;
  /** Vor Ort: Wie Tische oder Felder heißen („Tisch“, „Feld“). */
  fieldLabel?: string;
  /** Vor Ort: öffentlicher Lese-Link, auch für Menschen ohne Ausweis. */
  spectators?: boolean;
  /** Bundesliga-Modus: Rückrunde mit getauschtem Heimrecht. */
  returnRound?: boolean;
  /** WM-Form: Gruppenzahl (Zweierpotenz); fehlt = automatisch. */
  groupCount?: number;
  /**
   * Turnierabend (Stufe 3, nur online): Minuten je Partie statt Tage je Phase. Jede Runde
   * startet die Leitung, dann beginnen alle Partien der Runde zugleich.
   */
  minutes?: number;
  /**
   * Spieleabend (Stufe 3 Teil 2, nur Bundesliga-Modus): je Spieltag eine Disziplin, reihum.
   * Online Spiel-ids (`gameId` ist dann die erste), vor Ort freie Namen.
   */
  disciplines?: string[];
  /** Teilnehmer wünschen sich bei der Einschreibung Disziplinen. */
  wishes?: boolean;
  /** Tischrunden (Stufe 3 Teil 3): gewünschte Plätze je Tisch. */
  tableSize?: number;
  /** Tischrunden: kleinster und größter Tisch, den das Spiel erlaubt. */
  tableMin?: number;
  tableMax?: number;
  /** Tischrunden: Zahl der Runden. */
  rounds?: number;
  /** Tischrunden vor Ort: Punkte im Spiel zählen niedrig (z. B. Strafpunkte); sonst hoch. */
  lowWins?: boolean;
  /** Last One Standing (Stufe 4): Leben je Teilnehmer; fehlt = 2. */
  lives?: number;
  /** Liga nach Kalender (Stufe 4, nur Bundesliga-Modus): Beginn des ersten Spieltags (ms) und Abstand der Spieltage in Tagen. */
  leagueStart?: number;
  leagueDays?: number;
  /** Beste Dritte (Stufe 4, nur vor Ort, WM-Form): Neben den zwei Ersten jeder Gruppe kommen die besten Gruppendritten weiter, bis der Baum voll ist. */
  bestThirds?: boolean;
  /** Platzierungsspiele für alle Plätze (Stufe 4, K.-o. und WM-Form): Verlierer jeder Runde spielen ihre Plätze aus. */
  placements?: boolean;
  /** Setzliste (Stufe 4, nur vor Ort, K.-o., Doppel-K.-o. und WM-Form): Die Reihenfolge der Teilnehmerliste ist die Setzung, statt zu losen. */
  seeded?: boolean;
  /** Best of N (Stufe 3 Teil 5): Partien je Begegnung; fehlt = 1. */
  bestOf?: number;
  /** Teams (Stufe 3 Teil 4, nur online, Spiele mit `GameInfo.teams`): Spieler je Team; fehlt = Einzelne. */
  teamSize?: number;
  /** Best of N nur für die K.-o.-Phase (K.-o., Doppel-K.-o., WM-Endrunde); fehlt = wie `bestOf`. */
  bestOfKo?: number;
}

/** Woher ein noch offener Platz seinen Spieler bekommt. */
export type SlotSource =
  | { kind: 'groupPlace'; group: number; place: number }
  | { kind: 'winner'; match: string }
  | { kind: 'loser'; match: string }
  /** Beste Dritte (Stufe 4): der Gruppendritte mit dem `rank`-besten Ergebnis aller Gruppen (ab 0). */
  | { kind: 'bestThird'; rank: number };

export interface MatchSlot {
  /** Spieler-id; null, solange offen oder wenn niemand weiterkam. */
  player: string | null;
  from?: SlotSource;
}

/** Spielstand je Seite (Tore, Sätze, Punkte); fehlt, wenn nur der Sieger zählt. */
export type MatchScore = [number, number];

export interface MatchOutcome {
  /** Gewinnerseite; null bei Remis oder wenn beide verloren haben. */
  winner: MatchSide | null;
  /** Remis gibt es nur in der Gruppe und im Schweizer System. */
  draw: boolean;
  /** Kampflos, Rückzug oder von der Leitung festgelegt – nicht am Brett entschieden. */
  walkover: boolean;
  byLeader?: boolean;
  /** Freilos im Schweizer System. */
  bye?: boolean;
  /** Spielstand, wenn das Turnier einen zählt (vor Ort, ab Stufe 1). */
  score?: MatchScore;
}

export interface TournamentMatch {
  id: string;
  /** Phase, zu deren Stichtag die Partie gehört. */
  stage: number;
  group: number | null;
  slots: [MatchSlot, MatchSlot];
  status: MatchStatus;
  openedAt: number | null;
  /** Wann die Seite zuletzt „Bereit“ gesagt hat (gilt `READY_WINDOW_MS`). */
  readyAt: [number | null, number | null];
  /** War die Seite je bereit? Entscheidet am Stichtag. */
  everReady: [boolean, boolean];
  roomCode: string | null;
  /** Wie oft nach einem Remis im K.-o.-Spiel neu angesetzt wurde (tauscht die Farben). */
  replays: number;
  outcome: MatchOutcome | null;
  /** Das Spiel um Platz 3 gehört nicht zum Weg des Siegers. */
  thirdPlace?: boolean;
  /** Platzierungsspiele (Stufe 4): bester Platz, den diese Partie vergibt (der Sieger bekommt ihn, der Verlierer den nächsten). */
  placeFor?: number;
  finishedAt?: number;
  /** Vor Ort: Tisch oder Feld (ab 0), solange die Partie dort aufgerufen ist. */
  field?: number;
  calledAt?: number;
  /** Vor Ort: wer pfeift (Teams pfeifen gegenseitig). */
  referee?: string;
}

/** Vor Ort: Zeitplan aus Beginn, Spieldauer und Pause; daraus ergeben sich Uhrzeiten je Partie. */
export interface TournamentSchedule {
  start: number;
  matchMinutes: number;
  breakMinutes: number;
}

export interface TournamentStage {
  /**
   * group, swiss, ko oder double; im K.-o. zählt `round` rückwärts: 1 = Finale, 2 = Halbfinale …
   * Beim Doppel-K.-o. teilen sich Gewinner- und Verliererrunden die Stichtage, `round` zählt nur durch.
   */
  kind: 'group' | 'swiss' | 'ko' | 'double' | 'league' | 'tables';
  round: number;
  deadline: number;
  /** Turnierabend: Wann die Leitung die Runde gestartet hat; fehlt = noch nicht. */
  startedAt?: number;
  /** Liga nach Kalender (Stufe 4): Beginn des Spieltags; online werden die Partien erst dann spielbar. */
  startsAt?: number;
}

export interface TournamentPlayer {
  id: string;
  token: string;
  name: string;
  avatar: string;
  withdrawn: boolean;
  /** Teams (Stufe 3 Teil 4): die Mitglieder in Raumreihenfolge; `token` ist die des ersten. */
  members?: { token: string; name: string; avatar: string }[];
}

/** Gleichstandsregeln in der Reihenfolge, in der sie greifen; am Ende entscheidet immer das Los. */
export type Tiebreak =
  /** Punkte nur aus den Partien unter den Punktgleichen. */
  | 'direct'
  /** Summe der Punkte der Gegner (Schweizer System). */
  | 'buchholz'
  | 'wins'
  /** Differenz aus erzieltem und erhaltenem Spielstand (Tordifferenz). */
  | 'difference'
  /** Erzielter Spielstand (erzielte Tore). */
  | 'scored';

/** Wertung einer Tabelle. */
export interface ScoringRules {
  win: number;
  draw: number;
  loss: number;
  tiebreaks: Tiebreak[];
}

export interface TournamentSnapshot {
  version: 2;
  code: string;
  seed: string;
  settings: TournamentSettings;
  /** Wertung der Tabellen; bei Online-Turnieren aus der Form abgeleitet. */
  scoring: ScoringRules;
  leaderToken: string;
  leaderName: string;
  phase: TournamentPhase;
  players: TournamentPlayer[];
  nextPlayer: number;
  /** Gruppen als Spieler-ids (nur WM-Form). */
  groups: string[][];
  stages: TournamentStage[];
  matches: TournamentMatch[];
  /** Einmalcodes der Leitung, mit denen ein Spieler auf einem neuen Gerät wieder hineinkommt. */
  claims: Record<string, string>;
  createdAt: number;
  lastActivity: number;
  finishedAt: number | null;
  /** Regelstand des Spiels beim Turnierstart. */
  ruleVersion?: number;
  /** Vor Ort: Zahl der Tische oder Felder; 0 = ohne Aufruf, die Leitung trägt einfach ein. */
  fields?: number;
  /** Vor Ort: Helfer und Mitleitung. */
  helpers?: TournamentHelper[];
  nextHelper?: number;
  schedule?: TournamentSchedule;
  /** Vor Ort: Teams pfeifen gegenseitig; beim Aufruf bekommt jede Partie ein spielfreies Team. */
  referees?: boolean;
  /** Spieleabend: Wünsche je Spieler-id. */
  wishes?: Record<string, string[]>;
  /** Spieleabend: Reihenfolge der Disziplinen, beim Start festgelegt. */
  disciplineOrder?: string[];
  /** Tischrunden: die Tische aller Runden. */
  tables?: TableGame[];
  /** Teams: die Einzelnen vor der Auslosung der Teams (bleiben für die Anzeige erhalten). */
  roster?: TournamentPlayer[];
}

/**
 * Ein Tisch einer Tischrunde (Stufe 3 Teil 3): drei und mehr Spieler, Ergebnis ist die
 * Platzierung je Sitz (0 = erster Platz, gleiche Zahl = geteilter Platz).
 */
export interface TableGame {
  id: string;
  /** Runde (Phase). */
  stage: number;
  /** Tischnummer in der Runde, ab 0. */
  index: number;
  /** Spieler-ids je Sitz. */
  seats: string[];
  status: MatchStatus;
  openedAt: number | null;
  readyAt: (number | null)[];
  everReady: boolean[];
  roomCode: string | null;
  /** Platz je Sitz; null, solange offen. */
  places: number[] | null;
  /** Punkte im Spiel je Sitz (vor Ort eingetragen), zählen bei Gleichstand. */
  scores?: number[];
  /** Kampflos (Frist, Rückzug) oder von der Leitung festgelegt. */
  walkover?: boolean;
  byLeader?: boolean;
  finishedAt?: number;
}

/** Helfer vor Ort (Stufe 2): Wer den Link öffnet, trägt Ergebnisse ein; Mitleitung darf alles. */
export type HelperRole = 'helper' | 'coleader';

export interface TournamentHelper {
  id: string;
  name: string;
  role: HelperRole;
  /** Geheimer Code im Helferlink; gilt, bis die Leitung den Helfer entfernt. */
  code: string;
  /** Geräte-Kennungen, die den Link geöffnet haben. */
  tokens: string[];
}

/** Höchstens so viele Helfer je Turnier und so viele Geräte je Helferlink. */
export const TOURNAMENT_MAX_HELPERS = 20;
export const HELPER_MAX_DEVICES = 5;

/** Was die Leitung über ihre Helfer sieht. */
export interface HelperView {
  id: string;
  name: string;
  role: HelperRole;
  code: string;
  devices: number;
}

/** Eine Zeile der Tabelle. */
export interface StandingRow {
  player: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  /** Schweizer System: Summe der Punkte der Gegner. */
  buchholz: number;
  /** Erzielter und erhaltener Spielstand; 0, wenn kein Spielstand gezählt wird. */
  scored: number;
  conceded: number;
  /** Last One Standing: verbleibende Leben. */
  lives?: number;
}

export interface PublicPlayer {
  id: string;
  name: string;
  avatar: string;
  withdrawn: boolean;
  /** Teams: Namen der Mitglieder. */
  members?: string[];
}

/** Was ein Eingeschriebener sieht. Enthält weder Kennungen noch Partie-Geheimnisse. */
export interface TournamentView {
  code: string;
  settings: TournamentSettings;
  leaderName: string;
  phase: TournamentPhase;
  players: PublicPlayer[];
  groups: { players: string[]; table: StandingRow[]; settled: boolean }[];
  swissTable: StandingRow[];
  /** Gesamttabelle im Schweizer System und im Bundesliga-Modus. */
  table: StandingRow[];
  /** Vor Ort: Zahl der Tische oder Felder. */
  fields: number;
  stages: TournamentStage[];
  /** Index der laufenden Phase. */
  currentStage: number;
  /** Turnierabend: Runde, die die Leitung jetzt starten kann; sonst null. */
  startableStage: number | null;
  /** Spieleabend: Disziplinen mit Stimmen (nach dem Start in Spieltag-Reihenfolge); sonst leer. */
  disciplines: { id: string; wishes: number }[];
  /** Spieleabend: eigene Wünsche. */
  yourWishes: string[];
  /** Spieleabend: Tabelle je Disziplin. */
  disciplineTables: { id: string; table: StandingRow[] }[];
  /** Tischrunden: alle Tische ohne Geheimnisse; die Tabelle steht in `table`. */
  tableGames: Omit<TableGame, 'everReady'>[];
  /** `plannedAt`: Uhrzeit laut Zeitplan (vor Ort, wenn einer gesetzt ist). */
  matches: (Omit<TournamentMatch, 'everReady'> & { plannedAt?: number })[];
  schedule: TournamentSchedule | null;
  referees: boolean;
  /** Plätze am Ende: Sieger, Zweiter, ggf. Dritter. */
  podium: string[];
  /** Platzierungsspiele: alle Plätze der Reihe nach, sobald sie vergeben sind; sonst leer. */
  ranking: string[];
  you: string | null;
  isLeader: boolean;
  /** Dieses Gerät hat das Turnier angelegt und darf es löschen. */
  mayDelete: boolean;
  /** Vor Ort: Helfer (trägt Ergebnisse ein) oder Mitleitung; null sonst. */
  helperRole: HelperRole | null;
  /** Nur für die Leitung: die Helferlinks. */
  helpers: HelperView[];
  /** Das Spiel hat seit dem Turnierstart neue Regeln bekommen. */
  rulesChanged: boolean;
  serverNow: number;
}
