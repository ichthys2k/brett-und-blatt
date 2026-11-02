import type { GameInfo, OptionSpec, Options } from '@brett-und-blatt/engine';
import { cleanAvatar, cleanName } from './names';

/**
 * Turniere (W-053) ohne Anbieterbindung: Einschreibung, Auslosung, Tabellen, Baum und
 * Stichtage. Der Cloudflare-Adapter hält ein `Tournament` in einem Durable Object, legt
 * für jede Partie einen normalen Spielraum an und meldet das Ergebnis zurück.
 *
 * Gespielt wird nach und nach: Jede Partie am Stück, sobald beide Gegner Zeit haben.
 * Die Kennungen (`token`) sind geheim und stehen nie in einer Sicht.
 */

export const TOURNAMENT_MIN_PLAYERS = { world: 6, swiss: 4, knockout: 4, double: 4 } as const;
export const TOURNAMENT_MAX_PLAYERS = 32;
/** „Bereit“ gilt nur so lange, damit niemand Tage später in eine Partie gezogen wird. */
export const READY_WINDOW_MS = 10 * 60 * 1000;
/** Eine Partie, die spät spielbar wird, hat mindestens so lange Zeit. */
export const MATCH_MIN_TIME_MS = 24 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;
/** Nach dem Ende bleibt das Turnier so lange sichtbar, dann wird es gelöscht. */
export const TOURNAMENT_KEEP_MS = 30 * DAY_MS;
export const TOURNAMENT_NAME_LENGTH = 40;

export type TournamentFormat = 'world' | 'swiss' | 'knockout' | 'double';
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
  /** Spieloptionen aller Partien; was fehlt, steht auf dem Standard. */
  options?: Options;
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
}

export interface TournamentStage {
  /**
   * group, swiss, ko oder double; im K.-o. zählt `round` rückwärts: 1 = Finale, 2 = Halbfinale …
   * Beim Doppel-K.-o. teilen sich Gewinner- und Verliererrunden die Stichtage, `round` zählt nur durch.
   */
  kind: 'group' | 'swiss' | 'ko' | 'double';
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

export interface TournamentSnapshot {
  version: 1;
  code: string;
  seed: string;
  settings: TournamentSettings;
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
  stages: TournamentStage[];
  /** Index der laufenden Phase. */
  currentStage: number;
  matches: Omit<TournamentMatch, 'everReady'>[];
  /** Plätze am Ende: Sieger, Zweiter, ggf. Dritter. */
  podium: string[];
  you: string | null;
  isLeader: boolean;
  /** Das Spiel hat seit dem Turnierstart neue Regeln bekommen. */
  rulesChanged: boolean;
  serverNow: number;
}

export type TournamentClientMessage =
  | { type: 'hello'; token: string; name: string; avatar: string }
  | { type: 'join' }
  | { type: 'leave' }
  | { type: 'claim'; code: string }
  | { type: 'start' }
  | { type: 'ready'; match: string; ready: boolean }
  | { type: 'setResult'; match: string; winner: MatchSide | 'draw' | 'none' }
  | { type: 'extend'; days: number }
  | { type: 'withdraw'; player: string }
  | { type: 'reissue'; player: string };

export type TournamentServerMessage =
  | { type: 'tournament'; view: TournamentView }
  /** Fremde sehen nach dem Start nur, dass es das Turnier gibt. */
  | { type: 'closed'; name: string }
  | { type: 'claimCode'; player: string; code: string }
  | { type: 'error'; message: string };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isShort = (v: unknown, max = 40): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;

export function parseTournamentMessage(raw: string): TournamentClientMessage | null {
  if (raw.length > 1000) return null;
  let m: unknown;
  try {
    m = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(m)) return null;
  switch (m.type) {
    case 'hello':
      return isShort(m.token, 100) && m.token.length >= 16 && isShort(m.name, 200) && isShort(m.avatar, 20) ? { type: 'hello', token: m.token, name: m.name, avatar: m.avatar } : null;
    case 'join':
    case 'leave':
    case 'start':
      return { type: m.type };
    case 'claim':
      return isShort(m.code, 20) ? { type: 'claim', code: m.code } : null;
    case 'ready':
      return isShort(m.match) && typeof m.ready === 'boolean' ? { type: 'ready', match: m.match, ready: m.ready } : null;
    case 'setResult':
      return isShort(m.match) && (m.winner === 0 || m.winner === 1 || m.winner === 'draw' || m.winner === 'none') ? { type: 'setResult', match: m.match, winner: m.winner } : null;
    case 'extend':
      return m.days === 1 || m.days === 3 || m.days === 7 ? { type: 'extend', days: m.days } : null;
    case 'withdraw':
    case 'reissue':
      return isShort(m.player) ? { type: m.type, player: m.player } : null;
    default:
      return null;
  }
}

/** Turniere gibt es zuerst nur für Spiele, die zu zweit gehen und in denen zwei Menschen reichen. */
export function isTournamentGame(info: GameInfo): boolean {
  return info.players.min <= 2 && info.players.max >= 2 && !info.joinMidGame && !info.draft && (info.minHumans ?? 1) <= 2;
}

/** Turniercode: 8 Zeichen, zum Erraten zu viele. */
export const TOURNAMENT_CODE_PATTERN = /^[2-9A-HJ-NP-Z]{8}$/;

/** Prüft die Angaben beim Anlegen. `isTournamentGame` kennt der Server. */
export function parseTournamentSettings(body: unknown, findGame: (id: string) => { info: GameInfo; options: OptionSpec[] } | undefined): TournamentSettings | null {
  if (!isRecord(body)) return null;
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, TOURNAMENT_NAME_LENGTH) : '';
  if (!name || !cleanName(name.slice(0, 16))) return null;
  const game = typeof body.gameId === 'string' ? findGame(body.gameId) : undefined;
  if (typeof body.gameId !== 'string' || !game || !isTournamentGame(game.info)) return null;
  if (body.format !== 'world' && body.format !== 'swiss' && body.format !== 'knockout' && body.format !== 'double') return null;
  if (body.time !== 'relaxed' && body.time !== 'normal' && body.time !== 'fast') return null;
  if (body.days !== 1 && body.days !== 3 && body.days !== 7 && body.days !== 14) return null;
  const options: Options = {};
  if (isRecord(body.options)) {
    for (const [id, value] of Object.entries(body.options)) {
      const spec = game.options.find((o) => o.id === id && !o.hidden);
      if (!spec?.choices.some((c) => c.value === value)) return null;
      options[id] = value as string;
    }
  }
  return { name, gameId: body.gameId, format: body.format, time: body.time, days: body.days, thirdPlace: body.thirdPlace === true, ...(Object.keys(options).length > 0 ? { options } : {}) };
}

// ---------------------------------------------------------------------------
// Reine Bausteine

/** Kleiner Zufallsstrom aus dem Seed: dieselbe Auslosung bei jeder Wiederherstellung. */
function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const random = seededRandom(seed);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Gruppenzahl: die größte Zweierpotenz, bei der jede Gruppe mindestens drei Spieler hat. */
export function groupCountFor(players: number): number {
  let groups = 2;
  while (Math.floor(players / (groups * 2)) >= 3) groups *= 2;
  return groups;
}

/** Runden im Schweizer System wie im Plan: 8 → 5, 16 → 6, 32 → 7, nie mehr als Gegner da sind. */
export function swissRoundsFor(players: number): number {
  return Math.min(players - 1, Math.ceil(Math.log2(players)) + 2);
}

/** Jeder gegen jeden nach dem Kreisverfahren; die Heimseite wechselt. */
export function roundRobinPairs<T>(players: readonly T[]): [T, T][] {
  const list: (T | null)[] = [...players];
  if (list.length % 2 === 1) list.push(null);
  const rounds = list.length - 1;
  const pairs: [T, T][] = [];
  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < list.length / 2; i++) {
      const a = list[i]!;
      const b = list[list.length - 1 - i]!;
      if (a !== null && b !== null) pairs.push(round % 2 === 0 ? [a, b] : [b, a]);
    }
    list.splice(1, 0, list.pop()!);
  }
  return pairs;
}

/** Erste K.-o.-Runde: Gruppensieger gegen Zweite; Spieler derselben Gruppe treffen sich erst im Finale. */
export function koFirstRound(groups: number): [SlotSource, SlotSource][] {
  const top: [SlotSource, SlotSource][] = [];
  const bottom: [SlotSource, SlotSource][] = [];
  for (let g = 0; g < groups; g += 2) {
    top.push([{ kind: 'groupPlace', group: g, place: 0 }, { kind: 'groupPlace', group: g + 1, place: 1 }]);
    bottom.push([{ kind: 'groupPlace', group: g + 1, place: 0 }, { kind: 'groupPlace', group: g, place: 1 }]);
  }
  return [...top, ...bottom];
}

/**
 * Setzliste eines Baums: Platz 1 und 2 treffen sich erst im Finale. Die Positionen je
 * zwei Einträge bilden eine Partie der ersten Runde; Setzplätze über der Spielerzahl sind Freilose.
 */
export function seedOrder(size: number): number[] {
  let order = [0];
  while (order.length < size) {
    const next = order.length * 2 - 1;
    order = order.flatMap((seed) => [seed, next - seed]);
  }
  return order;
}

/** Erste Runde eines Baums; ein Freilos steht immer auf der zweiten Seite. */
export function firstRoundSlots(ids: readonly string[]): [MatchSlot, MatchSlot][] {
  let size = 2;
  while (size < ids.length) size *= 2;
  const order = seedOrder(size);
  const pairs: [MatchSlot, MatchSlot][] = [];
  for (let i = 0; i < size; i += 2) {
    const [a, b] = [order[i]!, order[i + 1]!].sort((x, y) => x - y) as [number, number];
    pairs.push([{ player: ids[a] ?? null }, { player: ids[b] ?? null }]);
  }
  return pairs;
}

/** Paart nach Tabellenstand ohne Wiederholung (mit Rücksetzen); bei ungerader Zahl das Freilos für den Letzten ohne Freilos. */
export function swissPairing(ranked: readonly string[], played: ReadonlySet<string>, hadBye: ReadonlySet<string>): { pairs: [string, string][]; bye: string | null } {
  let list = [...ranked];
  let bye: string | null = null;
  if (list.length % 2 === 1) {
    bye = [...list].reverse().find((p) => !hadBye.has(p)) ?? list[list.length - 1]!;
    list = list.filter((p) => p !== bye);
  }
  const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const search = (rest: string[]): [string, string][] | null => {
    if (rest.length === 0) return [];
    const [first, ...others] = rest;
    for (const other of others) {
      if (played.has(key(first!, other))) continue;
      const below = search(others.filter((p) => p !== other));
      if (below) return [[first!, other], ...below];
    }
    return null;
  };
  // Geht es ohne Wiederholung nicht (viele Rückzüge), wird der Reihe nach gepaart.
  const pairs = search(list) ?? list.flatMap((p, i) => (i % 2 === 0 ? [[p, list[i + 1]!] as [string, string]] : []));
  return { pairs, bye };
}

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Tabelle aus entschiedenen Partien, Sieg 3, Remis 1. Kampflose zählen, ein Freilos als Sieg. */
export function standings(players: readonly string[], matches: readonly TournamentMatch[], seed: string, tie: 'direct' | 'buchholz'): StandingRow[] {
  const rows = new Map<string, StandingRow>(players.map((player) => [player, { player, played: 0, wins: 0, draws: 0, losses: 0, points: 0, buchholz: 0 }]));
  const done = matches.filter((m) => m.outcome);
  for (const m of done) {
    const outcome = m.outcome!;
    m.slots.forEach((slot, side) => {
      const row = slot.player ? rows.get(slot.player) : undefined;
      if (!row) return;
      row.played++;
      if (outcome.winner === side) {
        row.wins++;
        row.points += 3;
      } else if (outcome.draw) {
        row.draws++;
        row.points += 1;
      } else row.losses++;
    });
  }
  for (const m of done) {
    const [a, b] = [m.slots[0].player, m.slots[1].player];
    if (!a || !b) continue;
    const [ra, rb] = [rows.get(a), rows.get(b)];
    if (ra && rb) {
      ra.buchholz += rb.points;
      rb.buchholz += ra.points;
    }
  }
  const lot = new Map(seededShuffle(players, `${seed}/los`).map((p, i) => [p, i]));
  /** Punkte nur aus den Partien unter den Punktgleichen. */
  const direct = (player: string, tied: Set<string>) => {
    let points = 0;
    for (const m of done) {
      const side = m.slots.findIndex((s) => s.player === player);
      if (side < 0 || !tied.has(m.slots[1 - side]!.player ?? '')) continue;
      if (m.outcome!.winner === side) points += 3;
      else if (m.outcome!.draw) points += 1;
    }
    return points;
  };
  return [...rows.values()].sort((x, y) => {
    if (x.points !== y.points) return y.points - x.points;
    if (tie === 'buchholz') {
      if (x.buchholz !== y.buchholz) return y.buchholz - x.buchholz;
    } else {
      const tied = new Set([...rows.values()].filter((r) => r.points === x.points).map((r) => r.player));
      const diff = direct(y.player, tied) - direct(x.player, tied);
      if (diff !== 0) return diff;
    }
    if (x.wins !== y.wins) return y.wins - x.wins;
    return lot.get(x.player)! - lot.get(y.player)!;
  });
}

const winnerOf = (match: string): MatchSlot => ({ player: null, from: { kind: 'winner', match } });
const loserOf = (match: string): MatchSlot => ({ player: null, from: { kind: 'loser', match } });

// ---------------------------------------------------------------------------
// Das Turnier

export interface TournamentDeps {
  now(): number;
  /** Zufallscode für die Neuausstellung durch die Leitung. */
  randomClaim(): string;
  /** Der veröffentlichte Regelstand eines Spiels. */
  ruleVersion?(gameId: string): number | undefined;
}

/** Was eine Spielrunde zurückmeldet. */
export type RoomReport =
  /** Gewinnerplatz der Partie oder null bei Remis. */
  | { kind: 'played'; winner: 0 | 1 | null }
  /** Nur ein Spieler kam (`winner`), oder gar keiner (null). */
  | { kind: 'noShow'; winner: 0 | 1 | null };

/** Der Auftrag an den Adapter, einen Spielraum anzulegen. */
export interface MatchRoomRequest {
  match: string;
  gameId: string;
  time: TournamentSettings['time'];
  options: Options;
  /** Kennungen in Platzreihenfolge; nach einem Remis im K.-o. getauscht. */
  tokens: [string, string];
  label: string;
}

export class Tournament {
  private constructor(
    private s: TournamentSnapshot,
    private deps: TournamentDeps,
  ) {}

  static create(code: string, seed: string, settings: TournamentSettings, leader: { token: string; name: string }, deps: TournamentDeps): Tournament {
    const now = deps.now();
    return new Tournament(
      {
        version: 1,
        code,
        seed,
        settings,
        leaderToken: leader.token,
        leaderName: cleanName(leader.name) ?? 'Leitung',
        phase: 'signup',
        players: [],
        nextPlayer: 1,
        groups: [],
        stages: [],
        matches: [],
        claims: {},
        createdAt: now,
        lastActivity: now,
        finishedAt: null,
      },
      deps,
    );
  }

  static restore(snapshot: TournamentSnapshot, deps: TournamentDeps): Tournament {
    return new Tournament(snapshot, deps);
  }

  snapshot(): TournamentSnapshot {
    return this.s;
  }

  get phase(): TournamentPhase {
    return this.s.phase;
  }

  get name(): string {
    return this.s.settings.name;
  }

  /** Darf diese Kennung die Turnierseite sehen? In der Einschreibung jeder mit dem Link. */
  maySee(token: string): boolean {
    return this.s.phase === 'signup' || token === this.s.leaderToken || this.playerByToken(token) !== undefined;
  }

  isLeader(token: string): boolean {
    return token === this.s.leaderToken;
  }

  /** Name und Bild beim Wiederkommen nachziehen. Sagt, ob sich etwas geändert hat. */
  greet(token: string, name: string, avatar: string): boolean {
    const player = this.playerByToken(token);
    const clean = cleanName(name);
    if (!player || !clean) return false;
    const nextAvatar = cleanAvatar(avatar);
    if (player.name === clean && player.avatar === nextAvatar) return false;
    player.name = clean;
    player.avatar = nextAvatar;
    return true;
  }

  // -------------------------------------------------------------------------
  // Handlungen. Ein Text bedeutet: abgelehnt, mit dieser Begründung.

  join(token: string, name: string, avatar: string): string | null {
    if (this.s.phase !== 'signup') return 'Die Einschreibung ist beendet.';
    if (this.playerByToken(token)) return null;
    if (this.s.players.length >= TOURNAMENT_MAX_PLAYERS) return 'Das Turnier ist voll.';
    const clean = cleanName(name);
    if (!clean) return 'Bitte einen anderen Spitznamen wählen.';
    this.s.players.push({ id: `p${this.s.nextPlayer++}`, token, name: clean, avatar: cleanAvatar(avatar), withdrawn: false });
    this.touch();
    return null;
  }

  leave(token: string): string | null {
    if (this.s.phase !== 'signup') return 'Das Turnier läuft schon. Die Leitung kann dich zurückziehen.';
    this.s.players = this.s.players.filter((p) => p.token !== token);
    this.touch();
    return null;
  }

  /** Neues Gerät über den Einmalcode der Leitung: Die Kennung wechselt, das alte Gerät ist draußen. */
  claim(token: string, code: string): string | null {
    const playerId = Object.keys(this.s.claims).find((id) => this.s.claims[id] === code.trim().toUpperCase());
    const player = this.s.players.find((p) => p.id === playerId);
    if (!player) return 'Dieser Code passt nicht.';
    if (this.playerByToken(token)) return 'Du bist in diesem Turnier schon eingeschrieben.';
    player.token = token;
    delete this.s.claims[player.id];
    this.touch();
    return null;
  }

  start(token: string): string | null {
    if (!this.isLeader(token)) return 'Das darf nur die Leitung.';
    if (this.s.phase !== 'signup') return 'Das Turnier läuft schon.';
    const { format, days } = this.s.settings;
    if (this.s.players.length < TOURNAMENT_MIN_PLAYERS[format]) return `Es braucht mindestens ${TOURNAMENT_MIN_PLAYERS[format]} Spieler.`;
    const now = this.deps.now();
    const deadline = (index: number) => now + (index + 1) * days * DAY_MS;
    const ids = seededShuffle(this.s.players.map((p) => p.id), `${this.s.seed}/auslosung`);
    if (format === 'world') this.setupWorld(ids, deadline);
    else if (format === 'swiss') this.setupSwiss(ids, deadline);
    else if (format === 'knockout') this.addKnockoutTree(firstRoundSlots(ids), 0, deadline);
    else this.setupDouble(ids, deadline);
    const ruleVersion = this.deps.ruleVersion?.(this.s.settings.gameId);
    if (ruleVersion !== undefined) this.s.ruleVersion = ruleVersion;
    this.s.phase = 'running';
    this.settle();
    this.touch();
    return null;
  }

  ready(token: string, matchId: string, ready: boolean): string | null {
    const match = this.match(matchId);
    const side = match?.slots.findIndex((slot) => slot.player === this.playerByToken(token)?.id) ?? -1;
    if (!match || side < 0) return 'Das ist nicht deine Partie.';
    if (match.status !== 'open') return 'Diese Partie ist gerade nicht spielbar.';
    const playerId = match.slots[side]!.player;
    // Niemand spielt zwei Partien zugleich: „Bereit“ gilt immer nur für eine.
    const own = this.s.matches.filter((m) => m !== match && m.slots.some((slot) => slot.player === playerId));
    if (ready && own.some((m) => m.status === 'running')) return 'Du spielst gerade eine andere Partie.';
    if (ready) for (const m of own) if (m.status === 'open') m.readyAt = m.slots.map((slot, s) => (slot.player === playerId ? null : m.readyAt[s]!)) as [number | null, number | null];
    match.readyAt[side] = ready ? this.deps.now() : null;
    if (ready) match.everReady[side as MatchSide] = true;
    if (this.bothReady(match)) match.status = 'running';
    this.touch();
    return null;
  }

  /** Aufträge für Spielräume: Partien, die laufen sollen und noch keinen Raum haben. */
  pendingRooms(): MatchRoomRequest[] {
    return this.s.matches.flatMap((m) => {
      if (m.status !== 'running' || m.roomCode) return [];
      const tokens = m.slots.map((slot) => this.s.players.find((p) => p.id === slot.player)?.token) as [string | undefined, string | undefined];
      if (!tokens[0] || !tokens[1]) return [];
      const seats: [string, string] = m.replays % 2 === 1 ? [tokens[1], tokens[0]] : [tokens[0], tokens[1]];
      return [{ match: m.id, gameId: this.s.settings.gameId, time: m.replays > 0 ? 'fast' : this.s.settings.time, options: this.s.settings.options ?? {}, tokens: seats, label: this.s.settings.name }];
    });
  }

  roomCreated(matchId: string, code: string): void {
    const match = this.match(matchId);
    if (match?.status === 'running' && !match.roomCode) {
      match.roomCode = code;
      this.touch();
    }
  }

  /** Ergebnis aus einem Spielraum. Veraltete Meldungen (anderer Raum) zählen nicht. */
  report(matchId: string, roomCode: string, report: RoomReport): boolean {
    const match = this.match(matchId);
    if (!match || match.status !== 'running' || match.roomCode !== roomCode) return false;
    // Der Raum zählt nach Plätzen; nach einem getauschten Entscheidungsspiel sind das andere Seiten.
    const side = (seat: 0 | 1 | null): MatchSide | null => (seat === null ? null : ((match.replays % 2 === 1 ? 1 - seat : seat) as MatchSide));
    const winner = side(report.winner);
    if (report.kind === 'noShow') {
      if (winner === null) this.reopen(match);
      else this.decide(match, { winner, draw: false, walkover: true });
    } else if (winner !== null) {
      this.decide(match, { winner, draw: false, walkover: false });
    } else if (this.needsWinner(match)) {
      // K.-o. braucht einen Sieger: neu ansetzen, Farben getauscht, schnelle Zeit.
      match.replays++;
      this.reopen(match);
    } else {
      this.decide(match, { winner: null, draw: true, walkover: false });
    }
    this.settle();
    this.touch();
    return true;
  }

  setResult(token: string, matchId: string, winner: MatchSide | 'draw' | 'none'): string | null {
    if (!this.isLeader(token)) return 'Das darf nur die Leitung.';
    const match = this.match(matchId);
    if (!match || match.status === 'waiting') return 'Diese Partie steht noch nicht fest.';
    if (!this.mayChange(match)) return 'Daran hängen schon weitere Partien.';
    if (winner === 'draw' && this.needsWinner(match)) return 'Im K.-o.-Spiel braucht es einen Sieger.';
    match.status = 'open';
    match.roomCode = null;
    this.decide(match, winner === 'draw' ? { winner: null, draw: true, walkover: false, byLeader: true } : winner === 'none' ? { winner: null, draw: false, walkover: true, byLeader: true } : { winner, draw: false, walkover: true, byLeader: true });
    this.settle();
    this.touch();
    return null;
  }

  extend(token: string, days: number): string | null {
    if (!this.isLeader(token)) return 'Das darf nur die Leitung.';
    if (this.s.phase !== 'running') return 'Das Turnier läuft nicht.';
    const current = this.currentStage();
    this.s.stages.forEach((stage, index) => {
      if (index >= current) stage.deadline += days * DAY_MS;
    });
    this.touch();
    return null;
  }

  /** Rückzug: Offene Partien gehen kampflos an den Gegner, gespielte bleiben stehen. */
  withdraw(token: string, playerId: string): string | null {
    if (!this.isLeader(token)) return 'Das darf nur die Leitung.';
    const player = this.s.players.find((p) => p.id === playerId);
    if (!player || this.s.phase !== 'running') return 'Das geht gerade nicht.';
    player.withdrawn = true;
    this.settle();
    this.touch();
    return null;
  }

  /** Einmalcode für ein neues Gerät eines Spielers. */
  reissue(token: string, playerId: string): { code: string } | { error: string } {
    if (!this.isLeader(token)) return { error: 'Das darf nur die Leitung.' };
    if (!this.s.players.some((p) => p.id === playerId)) return { error: 'Diesen Spieler gibt es nicht.' };
    const code = this.deps.randomClaim();
    this.s.claims[playerId] = code;
    this.touch();
    return { code };
  }

  // -------------------------------------------------------------------------
  // Zeit

  /** Erledigt fällige Stichtage und räumt ab. Sagt, ob sich etwas geändert hat. */
  tick(): boolean {
    if (this.s.phase !== 'running') return false;
    const before = JSON.stringify(this.s.matches);
    this.settle();
    const changed = before !== JSON.stringify(this.s.matches);
    if (changed) this.touch();
    return changed;
  }

  /** Wann `tick` wieder etwas tun kann, oder wann das Turnier gelöscht wird. */
  nextWakeup(): number {
    const times = [this.expiresAt()];
    for (const match of this.s.matches) if (match.status === 'open') times.push(this.dueAt(match));
    return Math.min(...times);
  }

  /** Ab dann darf das Turnier samt allen Daten verschwinden. */
  expiresAt(): number {
    return (this.s.finishedAt ?? this.s.lastActivity) + TOURNAMENT_KEEP_MS;
  }

  // -------------------------------------------------------------------------
  // Sicht

  view(token: string | null): TournamentView {
    const s = this.s;
    const you = token ? (this.playerByToken(token)?.id ?? null) : null;
    return {
      code: s.code,
      settings: s.settings,
      leaderName: s.leaderName,
      phase: s.phase,
      players: s.players.map(({ id, name, avatar, withdrawn }) => ({ id, name, avatar, withdrawn })),
      groups: s.groups.map((players, group) => ({ players, table: this.groupTable(group), settled: this.groupSettled(group) })),
      swissTable: s.settings.format === 'swiss' && s.phase !== 'signup' ? this.swissTable() : [],
      stages: s.stages,
      currentStage: this.currentStage(),
      matches: s.matches.map(({ everReady: _hidden, ...match }) => match),
      podium: this.podium(),
      you,
      isLeader: token !== null && this.isLeader(token),
      rulesChanged: s.ruleVersion !== undefined && s.phase === 'running' && this.deps.ruleVersion?.(s.settings.gameId) !== s.ruleVersion,
      serverNow: this.deps.now(),
    };
  }

  // -------------------------------------------------------------------------
  // Aufbau

  private setupWorld(ids: string[], deadline: (index: number) => number): void {
    const groupCount = groupCountFor(ids.length);
    const groups: string[][] = Array.from({ length: groupCount }, () => []);
    ids.forEach((id, i) => groups[i % groupCount]!.push(id));
    this.s.groups = groups;
    this.s.stages = [{ kind: 'group', round: 0, deadline: deadline(0) }];
    groups.forEach((players, group) => {
      roundRobinPairs(players).forEach(([a, b], i) => {
        this.s.matches.push(this.newMatch(`g${group}-${i}`, 0, group, [{ player: a }, { player: b }], 'open'));
      });
    });
    // Der Baum steht von Anfang an, mit der Herkunft jedes Platzes.
    this.addKnockoutTree(koFirstRound(groupCount).map(([a, b]) => [{ player: null, from: a }, { player: null, from: b }]), 1, deadline);
  }

  /** Legt einen K.-o.-Baum an. Hat die erste Runde schon Spieler, ist sie sofort spielbar. */
  private addKnockoutTree(first: [MatchSlot, MatchSlot][], firstStage: number, deadline: (index: number) => number): void {
    let slots = first;
    let stage = firstStage;
    let round = Math.log2(first.length * 2);
    while (slots.length > 0) {
      this.s.stages.push({ kind: 'ko', round, deadline: deadline(stage) });
      const ids_: string[] = [];
      slots.forEach((pair, i) => {
        const id = `k${round}-${i}`;
        ids_.push(id);
        const ready = !pair[0].from && !pair[1].from;
        this.s.matches.push(this.newMatch(id, stage, null, pair, ready ? 'open' : 'waiting'));
      });
      if (round === 1 && this.s.settings.thirdPlace) {
        const semis = this.s.matches.filter((m) => m.stage === stage - 1);
        if (semis.length === 2) {
          const third = this.newMatch('k-3', stage, null, [{ player: null, from: { kind: 'loser', match: semis[0]!.id } }, { player: null, from: { kind: 'loser', match: semis[1]!.id } }], 'waiting');
          third.thirdPlace = true;
          this.s.matches.push(third);
        }
      }
      const next: [MatchSlot, MatchSlot][] = [];
      for (let i = 0; i + 1 < ids_.length; i += 2) next.push([winnerOf(ids_[i]!), winnerOf(ids_[i + 1]!)]);
      slots = next;
      stage++;
      round--;
    }
  }

  /**
   * Doppel-K.-o.: Wer in der Gewinnerrunde verliert, fällt in die Verliererrunde. Dort wechseln
   * sich Runden unter Verlierern und Runden mit neu Herabgefallenen ab. Gewinner- und
   * Verliererrunde laufen teils zur selben Zeit, darum teilen sie sich Stichtage.
   */
  private setupDouble(ids: string[], deadline: (index: number) => number): void {
    const first = firstRoundSlots(ids);
    const rounds = Math.log2(first.length * 2);
    const upperStage = (round: number) => (round === 1 ? 0 : 2 * round - 3);
    const lastLower = 2 * rounds - 2;
    for (let stage = 0; stage <= lastLower + 1; stage++) this.s.stages.push({ kind: 'double', round: stage, deadline: deadline(stage) });

    // Gewinnerrunde
    let upper = first;
    for (let round = 1; round <= rounds; round++) {
      const pairs = upper;
      pairs.forEach((pair, i) => this.s.matches.push(this.newMatch(`w${round}-${i}`, upperStage(round), null, pair, round === 1 ? 'open' : 'waiting')));
      upper = [];
      for (let i = 0; i + 1 < pairs.length; i += 2) upper.push([winnerOf(`w${round}-${i}`), winnerOf(`w${round}-${i + 1}`)]);
    }

    // Verliererrunde
    let survivors = first.map((_, i) => loserOf(`w1-${i}`));
    for (let round = 1; round <= lastLower; round++) {
      const pairs: [MatchSlot, MatchSlot][] = [];
      if (round % 2 === 1) {
        for (let i = 0; i + 1 < survivors.length; i += 2) pairs.push([survivors[i]!, survivors[i + 1]!]);
      } else {
        // Herabgefallene umgekehrt einsortieren, damit sich Paarungen nicht gleich wiederholen.
        const upperRound = round / 2 + 1;
        const count = survivors.length;
        survivors.forEach((slot, i) => pairs.push([loserOf(`w${upperRound}-${count - 1 - i}`), slot]));
      }
      pairs.forEach((pair, i) => this.s.matches.push(this.newMatch(`l${round}-${i}`, round, null, pair, 'waiting')));
      survivors = pairs.map((_, i) => winnerOf(`l${round}-${i}`));
    }

    this.s.matches.push(this.newMatch('gf', lastLower + 1, null, [winnerOf(`w${rounds}-0`), winnerOf(`l${lastLower}-0`)], 'waiting'));
  }

  /** Gewinnt im Großen Finale der Herausforderer, haben beide je eine Niederlage: eine Partie mehr. */
  private addDecider(): boolean {
    const final = this.match('gf');
    if (!final?.outcome || final.outcome.winner !== 1 || final.outcome.walkover || this.match('gf2')) return false;
    const stage = this.s.stages.length;
    const last = this.s.stages[stage - 1]!;
    this.s.stages.push({ kind: 'double', round: stage, deadline: Math.max(last.deadline, this.deps.now()) + this.s.settings.days * DAY_MS });
    this.s.matches.push(this.newMatch('gf2', stage, null, [{ player: final.slots[0].player }, { player: final.slots[1].player }], 'open'));
    return true;
  }

  private setupSwiss(ids: string[], deadline: (index: number) => number): void {
    const rounds = swissRoundsFor(ids.length);
    this.s.stages = Array.from({ length: rounds }, (_, i) => ({ kind: 'swiss' as const, round: i + 1, deadline: deadline(i) }));
    this.pairSwissRound(0, ids);
  }

  private pairSwissRound(stage: number, ranked: string[]): void {
    const played = new Set<string>();
    const hadBye = new Set<string>();
    for (const m of this.s.matches) {
      const [a, b] = [m.slots[0].player, m.slots[1].player];
      if (a && b) played.add(pairKey(a, b));
      else if (a && m.outcome?.bye) hadBye.add(a);
    }
    const { pairs, bye } = swissPairing(ranked, played, hadBye);
    const now = this.deps.now();
    pairs.forEach(([a, b], i) => this.s.matches.push(this.newMatch(`s${stage}-${i}`, stage, null, [{ player: a }, { player: b }], 'open')));
    if (bye) {
      const match = this.newMatch(`s${stage}-frei`, stage, null, [{ player: bye }, { player: null }], 'done');
      match.outcome = { winner: 0, draw: false, walkover: true, bye: true };
      match.finishedAt = now;
      this.s.matches.push(match);
    }
  }

  private newMatch(id: string, stage: number, group: number | null, slots: [MatchSlot, MatchSlot], status: MatchStatus): TournamentMatch {
    return { id, stage, group, slots, status, openedAt: status === 'open' ? this.deps.now() : null, readyAt: [null, null], everReady: [false, false], roomCode: null, replays: 0, outcome: null };
  }

  // -------------------------------------------------------------------------
  // Fortschritt

  /**
   * Bringt alles auf den Stand: Rückzüge, Stichtage, Gruppen in den Baum, Sieger weiter,
   * nächste Schweizer Runde, Turnierende. Läuft, bis sich nichts mehr bewegt, weil eine
   * kampflose Partie die nächste auslösen kann.
   */
  private settle(): void {
    const now = this.deps.now();
    for (let pass = 0; pass < 200; pass++) {
      let moved = false;
      for (const match of this.s.matches) {
        if (match.status !== 'open') continue;
        const gone = match.slots.map((slot) => slot.player === null || this.s.players.find((p) => p.id === slot.player)?.withdrawn === true);
        if (gone[0] || gone[1]) {
          // Ein leerer Platz ist ein Freilos, ein Rückzug kampflos.
          const bye = match.slots.some((slot) => slot.player === null);
          this.decide(match, { winner: gone[0] && gone[1] ? null : gone[0] ? 1 : 0, draw: false, walkover: true, ...(bye ? { bye } : {}) });
          moved = true;
        } else if (now >= this.dueAt(match)) {
          const [a, b] = match.everReady;
          this.decide(match, a === b ? { winner: null, draw: false, walkover: true } : { winner: a ? 0 : 1, draw: false, walkover: true });
          moved = true;
        }
      }
      if (this.fillBracket()) moved = true;
      if (this.nextSwissRound()) moved = true;
      if (this.addDecider()) moved = true;
      if (!moved) break;
    }
    this.checkFinished();
  }

  private fillBracket(): boolean {
    let moved = false;
    for (const match of this.s.matches) {
      if (match.status !== 'waiting') continue;
      let known = true;
      for (const slot of match.slots) {
        const source = slot.from;
        if (!source) continue;
        const resolved = this.resolveSource(source);
        if (resolved === undefined) known = false;
        else slot.player = resolved;
      }
      if (known) {
        match.status = 'open';
        match.openedAt = this.deps.now();
        moved = true;
      }
    }
    return moved;
  }

  /** Der Spieler einer Herkunft; null: niemand kam weiter; undefined: noch nicht entschieden. */
  private resolveSource(source: SlotSource): string | null | undefined {
    if (source.kind === 'groupPlace') {
      if (!this.groupSettled(source.group)) return undefined;
      return this.groupTable(source.group).filter((row) => !this.isWithdrawn(row.player))[source.place]?.player ?? null;
    }
    const match = this.match(source.match);
    if (!match?.outcome) return undefined;
    const { winner } = match.outcome;
    if (winner === null) return null;
    return match.slots[source.kind === 'winner' ? winner : 1 - winner]!.player;
  }

  private nextSwissRound(): boolean {
    if (this.s.settings.format !== 'swiss' || this.s.phase !== 'running') return false;
    const stage = Math.max(...this.s.matches.map((m) => m.stage));
    if (stage + 1 >= this.s.stages.length) return false;
    if (this.s.matches.some((m) => m.stage === stage && !m.outcome)) return false;
    const ranked = this.swissTable().map((row) => row.player).filter((id) => !this.isWithdrawn(id));
    if (ranked.length < 2) return false;
    this.pairSwissRound(stage + 1, ranked);
    return true;
  }

  private checkFinished(): void {
    if (this.s.phase !== 'running') return;
    const allDone = this.s.matches.every((m) => m.outcome);
    const swissMore = this.s.settings.format === 'swiss' && Math.max(...this.s.matches.map((m) => m.stage)) + 1 < this.s.stages.length && this.s.players.filter((p) => !p.withdrawn).length >= 2;
    if (allDone && !swissMore) {
      this.s.phase = 'finished';
      this.s.finishedAt = this.deps.now();
    }
  }

  private decide(match: TournamentMatch, outcome: MatchOutcome): void {
    match.outcome = outcome;
    match.status = 'done';
    match.finishedAt = this.deps.now();
    match.readyAt = [null, null];
  }

  private reopen(match: TournamentMatch): void {
    match.status = 'open';
    match.roomCode = null;
    match.readyAt = [null, null];
    match.openedAt = this.deps.now();
  }

  private bothReady(match: TournamentMatch): boolean {
    const now = this.deps.now();
    return match.readyAt.every((at) => at !== null && now - at < READY_WINDOW_MS);
  }

  /** Ein festgelegtes Ergebnis darf nichts umstoßen, woran schon andere Partien hängen. */
  private mayChange(match: TournamentMatch): boolean {
    if (match.status !== 'done') return true;
    if (match.group !== null) return !this.groupSettled(match.group) || !this.s.matches.some((m) => m.slots.some((slot) => slot.from?.kind === 'groupPlace' && slot.from.group === match.group && slot.player !== null));
    if (this.s.settings.format === 'swiss') return match.stage === Math.max(...this.s.matches.map((m) => m.stage));
    if (match.id === 'gf' && this.match('gf2')) return false;
    return !this.s.matches.some((m) => m.status !== 'waiting' && m.slots.some((slot) => slot.from && 'match' in slot.from && slot.from.match === match.id));
  }

  /** In allem außer Gruppe und Schweizer System braucht eine Partie einen Sieger. */
  private needsWinner(match: TournamentMatch): boolean {
    return match.group === null && this.s.settings.format !== 'swiss';
  }

  private dueAt(match: TournamentMatch): number {
    return Math.max(this.s.stages[match.stage]?.deadline ?? 0, (match.openedAt ?? 0) + MATCH_MIN_TIME_MS);
  }

  private currentStage(): number {
    const open = this.s.matches.find((m) => !m.outcome);
    return open ? open.stage : Math.max(0, this.s.stages.length - 1);
  }

  private groupMatches(group: number): TournamentMatch[] {
    return this.s.matches.filter((m) => m.group === group);
  }

  private groupSettled(group: number): boolean {
    const matches = this.groupMatches(group);
    return matches.length > 0 && matches.every((m) => m.outcome);
  }

  private groupTable(group: number): StandingRow[] {
    return standings(this.s.groups[group] ?? [], this.groupMatches(group), this.s.seed, 'direct');
  }

  private swissTable(): StandingRow[] {
    return standings(this.s.players.map((p) => p.id), this.s.matches, this.s.seed, 'buchholz');
  }

  private podium(): string[] {
    if (this.s.phase !== 'finished') return [];
    if (this.s.settings.format === 'swiss') return this.swissTable().slice(0, 3).map((r) => r.player);
    const place = (m: TournamentMatch | undefined, winner: boolean): string[] => {
      if (m?.outcome?.winner == null) return [];
      const player = m.slots[winner ? m.outcome.winner : 1 - m.outcome.winner]!.player;
      return player ? [player] : [];
    };
    if (this.s.settings.format === 'double') {
      const final = this.match('gf2') ?? this.match('gf');
      const lower = Math.max(...this.s.matches.filter((m) => m.id.startsWith('l')).map((m) => m.stage));
      return [...place(final, true), ...place(final, false), ...place(this.match(`l${lower}-0`), false)];
    }
    const final = this.match('k1-0');
    return [...place(final, true), ...place(final, false), ...place(this.match('k-3'), true)];
  }

  private match(id: string): TournamentMatch | undefined {
    return this.s.matches.find((m) => m.id === id);
  }

  private playerByToken(token: string): TournamentPlayer | undefined {
    return this.s.players.find((p) => p.token === token);
  }

  private isWithdrawn(id: string): boolean {
    return this.s.players.find((p) => p.id === id)?.withdrawn === true;
  }

  private touch(): void {
    this.s.lastActivity = this.deps.now();
  }
}
