import type { Options } from '@brett-und-blatt/engine';

/**
 * Datenmodell der Turniere (W-053, Umbau W-058 Stufe 0). Der Zustand ist reines JSON;
 * Kennungen (`token`) sind geheim und stehen nie in einer Sicht.
 */

export const TOURNAMENT_MIN_PLAYERS = { world: 6, swiss: 4, knockout: 4, double: 4, league: 3 } as const;
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

/** WM-Form (vor Ort „Gruppen + K.-o.“), Schweizer System, K.-o., Doppel-K.-o., Bundesliga-Modus. */
export type TournamentFormat = 'world' | 'swiss' | 'knockout' | 'double' | 'league';
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
  /** Fehlt = online. Vor Ort ist `gameId` leer, `time` und `days` gelten nicht. */
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
}

/** Woher ein noch offener Platz seinen Spieler bekommt. */
export type SlotSource =
  | { kind: 'groupPlace'; group: number; place: number }
  | { kind: 'winner'; match: string }
  | { kind: 'loser'; match: string };

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
  finishedAt?: number;
  /** Vor Ort: Tisch oder Feld (ab 0), solange die Partie dort aufgerufen ist. */
  field?: number;
  calledAt?: number;
}

export interface TournamentStage {
  /**
   * group, swiss, ko oder double; im K.-o. zählt `round` rückwärts: 1 = Finale, 2 = Halbfinale …
   * Beim Doppel-K.-o. teilen sich Gewinner- und Verliererrunden die Stichtage, `round` zählt nur durch.
   */
  kind: 'group' | 'swiss' | 'ko' | 'double' | 'league';
  round: number;
  deadline: number;
}

export interface TournamentPlayer {
  id: string;
  token: string;
  name: string;
  avatar: string;
  withdrawn: boolean;
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
}

export interface PublicPlayer {
  id: string;
  name: string;
  avatar: string;
  withdrawn: boolean;
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
  matches: Omit<TournamentMatch, 'everReady'>[];
  /** Plätze am Ende: Sieger, Zweiter, ggf. Dritter. */
  podium: string[];
  you: string | null;
  isLeader: boolean;
  /** Vor Ort: Helfer (trägt Ergebnisse ein) oder Mitleitung; null sonst. */
  helperRole: HelperRole | null;
  /** Nur für die Leitung: die Helferlinks. */
  helpers: HelperView[];
  /** Das Spiel hat seit dem Turnierstart neue Regeln bekommen. */
  rulesChanged: boolean;
  serverNow: number;
}
