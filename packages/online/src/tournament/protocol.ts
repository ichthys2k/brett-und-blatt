import type { GameInfo, OptionSpec, Options } from '@brett-und-blatt/engine';
import { cleanName } from '../names';
import { TOURNAMENT_NAME_LENGTH, type MatchSide, type TournamentSettings, type TournamentView } from './types';

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
  return { name, gameId: body.gameId, format: body.format, time: body.time, days: body.days, thirdPlace: body.thirdPlace === true, isPublic: body.isPublic !== false, ...(Object.keys(options).length > 0 ? { options } : {}) };
}
