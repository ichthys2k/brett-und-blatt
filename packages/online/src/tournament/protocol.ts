import type { GameInfo, OptionSpec, Options } from '@brett-und-blatt/engine';
import { cleanName } from '../names';
import { ENTRANT_NAME_LENGTH, TOURNAMENT_MAX_FIELDS, TOURNAMENT_MAX_PLAYERS, TOURNAMENT_NAME_LENGTH, type MatchSide, type ResultKind, type TournamentFormat, type TournamentSettings, type TournamentView } from './types';

/** Nachrichten zwischen Turnierseite und Server und die Prüfung der Angaben beim Anlegen. */

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
  | { type: 'reissue'; player: string }
  // Vor Ort (Stufe 1), nur die Leitung:
  | { type: 'addEntrants'; names: string[] }
  | { type: 'removeEntrant'; player: string }
  | { type: 'enterResult'; match: string; score?: [number, number]; winner?: MatchSide | 'draw' }
  | { type: 'setFields'; count: number }
  // Stufe 2: Helfer
  | { type: 'addHelper'; name: string; role: 'helper' | 'coleader' }
  | { type: 'removeHelper'; helper: string }
  | { type: 'helper'; code: string }
  | { type: 'setSchedule'; schedule: { start: number; matchMinutes: number; breakMinutes: number } | null }
  | { type: 'setReferees'; on: boolean };

export type TournamentServerMessage =
  | { type: 'tournament'; view: TournamentView }
  /** Fremde sehen nach dem Start nur, dass es das Turnier gibt. */
  | { type: 'closed'; name: string }
  | { type: 'claimCode'; player: string; code: string }
  | { type: 'error'; message: string };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isShort = (v: unknown, max = 40): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;

export function parseTournamentMessage(raw: string): TournamentClientMessage | null {
  // Lang genug für eine Teilnehmerliste mit 128 Namen.
  if (raw.length > 8000) return null;
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
    case 'removeEntrant':
      return isShort(m.player) ? { type: m.type, player: m.player } : null;
    case 'addEntrants':
      return Array.isArray(m.names) && m.names.length > 0 && m.names.length <= TOURNAMENT_MAX_PLAYERS && m.names.every((n) => isShort(n, 60)) ? { type: 'addEntrants', names: m.names as string[] } : null;
    case 'enterResult': {
      if (!isShort(m.match)) return null;
      if (Array.isArray(m.score) && m.score.length === 2 && m.score.every((n) => typeof n === 'number')) return { type: 'enterResult', match: m.match, score: [m.score[0], m.score[1]] };
      if (m.winner === 0 || m.winner === 1 || m.winner === 'draw') return { type: 'enterResult', match: m.match, winner: m.winner };
      return null;
    }
    case 'addHelper':
      return isShort(m.name, 60) && (m.role === 'helper' || m.role === 'coleader') ? { type: 'addHelper', name: m.name, role: m.role } : null;
    case 'removeHelper':
      return isShort(m.helper) ? { type: 'removeHelper', helper: m.helper } : null;
    case 'helper':
      return isShort(m.code, 20) ? { type: 'helper', code: m.code } : null;
    case 'setSchedule': {
      if (m.schedule === null) return { type: 'setSchedule', schedule: null };
      const sch = m.schedule;
      if (!isRecord(sch) || typeof sch.start !== 'number' || typeof sch.matchMinutes !== 'number' || typeof sch.breakMinutes !== 'number') return null;
      return { type: 'setSchedule', schedule: { start: sch.start, matchMinutes: sch.matchMinutes, breakMinutes: sch.breakMinutes } };
    }
    case 'setReferees':
      return typeof m.on === 'boolean' ? { type: 'setReferees', on: m.on } : null;
    case 'setFields':
      return Number.isInteger(m.count) && (m.count as number) >= 0 && (m.count as number) <= TOURNAMENT_MAX_FIELDS ? { type: 'setFields', count: m.count as number } : null;
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

const FORMAT_IDS: readonly TournamentFormat[] = ['world', 'swiss', 'knockout', 'double', 'league'];
const RESULT_KINDS: readonly ResultKind[] = ['winner', 'goals', 'sets', 'points'];
/** Gruppenzahlen, die die Leitung vor Ort wählen darf. */
export const GROUP_COUNT_CHOICES = [2, 4, 8, 16] as const;

/** Prüft die Angaben beim Anlegen. `isTournamentGame` kennt der Server. */
export function parseTournamentSettings(body: unknown, findGame: (id: string) => { info: GameInfo; options: OptionSpec[] } | undefined): TournamentSettings | null {
  if (!isRecord(body)) return null;
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, TOURNAMENT_NAME_LENGTH) : '';
  if (!name || !cleanName(name.slice(0, 16))) return null;
  if (!FORMAT_IDS.includes(body.format as TournamentFormat)) return null;
  const format = body.format as TournamentFormat;
  const returnRound = format === 'league' && body.returnRound === true ? { returnRound: true } : {};
  if (body.mode === 'local') return parseLocalSettings(body, name, format, returnRound);
  const game = typeof body.gameId === 'string' ? findGame(body.gameId) : undefined;
  if (typeof body.gameId !== 'string' || !game || !isTournamentGame(game.info)) return null;
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
  return { name, gameId: body.gameId, format, time: body.time, days: body.days, thirdPlace: body.thirdPlace === true, isPublic: body.isPublic !== false, ...returnRound, ...(Object.keys(options).length > 0 ? { options } : {}) };
}

/** Vor Ort: Sportart statt Spiel, keine Zeitvorgabe, nie in „Offene Runden“. */
function parseLocalSettings(body: Record<string, unknown>, name: string, format: TournamentFormat, returnRound: { returnRound?: boolean }): TournamentSettings | null {
  const sport = typeof body.sport === 'string' ? cleanName(body.sport, ENTRANT_NAME_LENGTH) : null;
  if (!sport) return null;
  const result = RESULT_KINDS.includes(body.result as ResultKind) ? (body.result as ResultKind) : 'winner';
  const fieldLabel = typeof body.fieldLabel === 'string' ? cleanName(body.fieldLabel, 12) : null;
  const groupCount = format === 'world' && GROUP_COUNT_CHOICES.includes(body.groupCount as 2) ? { groupCount: body.groupCount as number } : {};
  return {
    name,
    gameId: '',
    format,
    time: 'normal',
    days: 1,
    thirdPlace: body.thirdPlace === true,
    isPublic: false,
    mode: 'local',
    sport,
    result,
    draws: body.draws === true,
    fieldLabel: fieldLabel ?? 'Tisch',
    spectators: body.spectators === true,
    ...returnRound,
    ...groupCount,
  };
}

/** Punkte je Ergebnis, die die Leitung vor Ort selbst festlegt. */
export interface PointRules {
  win: number;
  draw: number;
  loss: number;
}

/** Höchstens so viele Punkte je Partie. */
export const MAX_POINTS = 10;

/** Punkte je Sieg, Remis und Niederlage beim Anlegen vor Ort; undefined = Voreinstellung (3/1/0). */
export function parsePointRules(body: unknown): PointRules | undefined {
  const points = isRecord(body) ? body.points : undefined;
  if (!isRecord(points)) return undefined;
  const values = [points.win, points.draw, points.loss];
  if (!values.every((v) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= MAX_POINTS)) return undefined;
  const [win, draw, loss] = values as [number, number, number];
  // Ein Sieg muss mehr zählen als ein Remis, ein Remis nicht weniger als eine Niederlage.
  if (!(win > draw && draw >= loss)) return undefined;
  return { win, draw, loss };
}

/** Zahl der Tische oder Felder beim Anlegen vor Ort (0 bis 32). */
export function parseFieldCount(body: unknown): number {
  const count = isRecord(body) ? body.fields : undefined;
  return Number.isInteger(count) && (count as number) >= 0 && (count as number) <= TOURNAMENT_MAX_FIELDS ? (count as number) : 0;
}
