import type { GameInfo, OptionSpec, Options } from '@brett-und-blatt/engine';
import { cleanName } from '../names';
import { DISCIPLINES_MAX, DISCIPLINES_MIN } from './disciplines';
import { isBestOf } from './best-of';
import { TABLE_ROUND_CHOICES, TABLE_SIZE_MAX, TABLE_SIZE_MIN } from './table-rounds';
import { EVENING_EXTEND_CHOICES, EVENING_MINUTE_CHOICES } from './evening';
import { DYP_ROUND_CHOICES } from './dyp';
import { LIVES_CHOICES } from './lives';
import { BEST_THIRD_GROUPS } from './pairing';
import { isTeamGame, validTeamSize } from './teams';
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
  | { type: 'extend'; days: number; minutes?: number }
  // Stufe 3: Turnierabend
  | { type: 'startRound' }
  | { type: 'wish'; disciplines: string[] }
  | { type: 'enterTable'; table: string; places?: number[]; scores?: number[] }
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
  | { type: 'setReferees'; on: boolean }
  /** Turnier endgültig löschen; nur die Hauptleitung. */
  | { type: 'delete' }
  /** Anmeldung mit Freigabe: zulassen (`ok`) oder ablehnen. */
  | { type: 'approve'; player: string; ok: boolean }
  /** Check-in: ohne `player` für sich selbst, Leitung und Helfer für andere. */
  | { type: 'present'; player?: string; on: boolean }
  /** Längere Aufbewahrung. */
  | { type: 'keepLong'; on: boolean }
  /** Übergabecode für die Hauptleitung erzeugen (nur Hauptleitung). */
  | { type: 'leaderCode' }
  /** Turnier einer Serie zuordnen (`CODE-SCHLÜSSEL`) oder lösen (#205); prüft der Server. */
  | { type: 'attachSeries'; link: string }
  | { type: 'detachSeries' }
  /** Die Hauptleitung mit einem Übergabecode übernehmen. */
  | { type: 'takeLeader'; code: string };

export type TournamentServerMessage =
  | { type: 'tournament'; view: TournamentView }
  /** Fremde sehen nach dem Start nur, dass es das Turnier gibt. */
  | { type: 'closed'; name: string }
  /** Die Leitung hat das Turnier gelöscht. */
  | { type: 'deleted' }
  /** Antwort auf `leaderCode`: der Übergabecode und wann er abläuft; nur an den Absender. */
  | { type: 'leaderCode'; code: string; expiresAt: number }
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
    case 'startRound':
      return { type: m.type };
    case 'enterTable': {
      const list = (v: unknown) => Array.isArray(v) && v.length >= 2 && v.length <= 8 && v.every((x) => Number.isInteger(x) && Math.abs(x as number) <= 99_999);
      if (!isShort(m.table) || (m.places !== undefined && !list(m.places)) || (m.scores !== undefined && !list(m.scores)) || (m.places === undefined) === (m.scores === undefined)) return null;
      return { type: 'enterTable', table: m.table, ...(m.places ? { places: m.places as number[] } : {}), ...(m.scores ? { scores: m.scores as number[] } : {}) };
    }
    case 'wish':
      return Array.isArray(m.disciplines) && m.disciplines.length <= DISCIPLINES_MAX && m.disciplines.every((d) => isShort(d, 40)) ? { type: 'wish', disciplines: m.disciplines as string[] } : null;
    case 'claim':
      return isShort(m.code, 20) ? { type: 'claim', code: m.code } : null;
    case 'ready':
      return isShort(m.match) && typeof m.ready === 'boolean' ? { type: 'ready', match: m.match, ready: m.ready } : null;
    case 'setResult':
      return isShort(m.match) && (m.winner === 0 || m.winner === 1 || m.winner === 'draw' || m.winner === 'none') ? { type: 'setResult', match: m.match, winner: m.winner } : null;
    case 'extend':
      if (EVENING_EXTEND_CHOICES.includes(m.minutes as 5)) return { type: 'extend', days: 0, minutes: m.minutes as number };
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
    case 'delete':
      return { type: 'delete' };
    case 'approve':
      return isShort(m.player) && typeof m.ok === 'boolean' ? { type: 'approve', player: m.player, ok: m.ok } : null;
    case 'present':
      if (typeof m.on !== 'boolean' || (m.player !== undefined && !isShort(m.player))) return null;
      return { type: 'present', ...(typeof m.player === 'string' ? { player: m.player } : {}), on: m.on };
    case 'leaderCode':
      return { type: 'leaderCode' };
    case 'attachSeries':
      return isShort(m.link, 40) ? { type: 'attachSeries', link: m.link } : null;
    case 'detachSeries':
      return { type: 'detachSeries' };
    case 'takeLeader':
      return isShort(m.code, 20) ? { type: 'takeLeader', code: m.code } : null;
    case 'keepLong':
      return typeof m.on === 'boolean' ? { type: 'keepLong', on: m.on } : null;
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

/** Tischrunden (Stufe 3 Teil 3): Spiele mit festen Plätzen ab drei Spielern; kein laufender Einstieg, keine Rollenspiele. */
export function isTableGame(info: GameInfo): boolean {
  return info.players.max >= 3 && !info.joinMidGame && !info.draft && (info.minHumans ?? 1) <= 3;
}

/** Turniercode: 8 Zeichen, zum Erraten zu viele. */
export const TOURNAMENT_CODE_PATTERN = /^[2-9A-HJ-NP-Z]{8}$/;

const FORMAT_IDS: readonly TournamentFormat[] = ['world', 'swiss', 'knockout', 'double', 'league', 'tables', 'lives', 'dyp'];
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
  // Zufallspartner gibt es nur vor Ort: Teams wechseln jede Runde, online sind die Plätze fest.
  if (format === 'dyp' && body.mode !== 'local') return null;
  const returnRound: Pick<TournamentSettings, 'returnRound' | 'leagueStart' | 'leagueDays'> = format === 'league' ? { ...(body.returnRound === true ? { returnRound: true } : {}), ...parseCalendar(body) } : {};
  if (body.mode === 'local') return parseLocalSettings(body, name, format, returnRound, findGame);
  // Spieleabend: mehrere Spiele, je Spieltag eines; `gameId` ist dann das erste.
  const disciplines = parseDisciplines(body, format, (id) => {
    const found = findGame(id);
    return found && isTournamentGame(found.info) ? id : null;
  });
  if (disciplines === null) return null;
  const gameId = disciplines ? disciplines[0] : body.gameId;
  const game = typeof gameId === 'string' ? findGame(gameId) : undefined;
  if (typeof gameId !== 'string' || !game) return null;
  // Teams (Stufe 3 Teil 4): Spiele mit zwei festen Teams, nicht mit Disziplinen und nicht als Tischrunde.
  const teamSize = body.teamSize === undefined ? undefined : body.teamSize;
  if (teamSize !== undefined && (format === 'tables' || disciplines || !isTeamGame(game.info) || !validTeamSize(game.info, teamSize))) return null;
  if (teamSize === undefined && (format === 'tables' ? !isTableGame(game.info) : !isTournamentGame(game.info))) return null;
  const tables = format === 'tables' ? parseTableSettings(body, Math.max(TABLE_SIZE_MIN, game.info.players.min), Math.min(TABLE_SIZE_MAX, game.info.players.max)) : {};
  if (body.time !== 'relaxed' && body.time !== 'normal' && body.time !== 'fast') return null;
  // Turnierabend: Minuten je Partie statt Tage je Phase.
  const minutes = EVENING_MINUTE_CHOICES.includes(body.minutes as 10) ? { minutes: body.minutes as number } : {};
  if (!minutes.minutes && body.days !== 1 && body.days !== 3 && body.days !== 7 && body.days !== 14) return null;
  const options: Options = {};
  // Am Spieleabend gelten die Standardoptionen jedes Spiels.
  if (isRecord(body.options) && !disciplines) {
    for (const [id, value] of Object.entries(body.options)) {
      const spec = game.options.find((o) => o.id === id && !o.hidden);
      if (!spec?.choices.some((c) => c.value === value)) return null;
      options[id] = value as string;
    }
  }
  // Teamspiele, die nur mit einer Option Teams haben (Kreuzbinokel), spielen im Turnier immer so.
  const teamWhen = teamSize !== undefined ? game.info.teams?.when : undefined;
  if (teamWhen) options[teamWhen.option] = teamWhen.value;
  // Platzierungsspiele (Stufe 4): K.-o. und WM-Form; sie schließen das Spiel um Platz 3 ein.
  const placements = body.placements === true && (format === 'knockout' || format === 'world');
  // Anmeldung mit Freigabe und Check-in (Stufe 5).
  const entry = { ...(body.approval === true ? { approval: true } : {}), ...(body.checkin === true ? { checkin: true } : {}) };
  const multi = disciplines ? { disciplines, ...(body.wishes === true ? { wishes: true } : {}) } : {};
  return { ...tables, ...parseLives(body, format), ...(teamSize === undefined ? parseBestOf(body, format) : { teamSize: teamSize as number }), name, gameId, format, time: body.time, days: minutes.minutes ? 1 : (body.days as number), ...minutes, ...multi, thirdPlace: body.thirdPlace === true || placements, ...entry, ...(placements ? { placements: true } : {}), isPublic: body.isPublic !== false, ...returnRound, ...(Object.keys(options).length > 0 ? { options } : {}) };
}

/** Vor Ort: Sportart statt Spiel, keine Zeitvorgabe, nie in „Offene Runden“. */
function parseLocalSettings(body: Record<string, unknown>, name: string, format: TournamentFormat, returnRound: Pick<TournamentSettings, 'returnRound' | 'leagueStart' | 'leagueDays'>, findGame: (id: string) => { info: GameInfo } | undefined): TournamentSettings | null {
  // Ein Brett-&-Blatt-Spiel als Sportart (Stufe 3): Name aus dem Steckbrief, gespielt wird am Gerät.
  const game = typeof body.gameId === 'string' && body.gameId ? findGame(body.gameId) : undefined;
  if (typeof body.gameId === 'string' && body.gameId && (!game || !(format === 'tables' ? isTableGame(game.info) : isTournamentGame(game.info)))) return null;
  // Tischrunden vor Ort: Ohne Spiel aus Brett & Blatt darf ein Tisch einen Platz mehr oder weniger haben.
  const size = Number.isInteger(body.tableSize) ? Math.max(TABLE_SIZE_MIN, Math.min(TABLE_SIZE_MAX, body.tableSize as number)) : 4;
  const tables = format === 'tables' ? (game ? parseTableSettings(body, Math.max(TABLE_SIZE_MIN, game.info.players.min), Math.min(TABLE_SIZE_MAX, game.info.players.max)) : parseTableSettings(body, Math.max(TABLE_SIZE_MIN, size - 1), Math.min(TABLE_SIZE_MAX, size + 1))) : {};
  const disciplines = parseDisciplines(body, format, (name) => cleanName(name, ENTRANT_NAME_LENGTH));
  if (disciplines === null) return null;
  const sport = game ? game.info.name : typeof body.sport === 'string' ? cleanName(body.sport, ENTRANT_NAME_LENGTH) : disciplines ? 'Spieleabend' : null;
  if (!sport) return null;
  const result = RESULT_KINDS.includes(body.result as ResultKind) ? (body.result as ResultKind) : 'winner';
  const fieldLabel = typeof body.fieldLabel === 'string' ? cleanName(body.fieldLabel, 12) : null;
  // Setzliste (Stufe 4): nur Formen mit Baum oder Gruppen; die Teilnehmerliste ist dann die Rangfolge.
  const placementsLocal = body.placements === true && (format === 'knockout' || format === 'world');
  const seeded = body.seeded === true && (format === 'knockout' || format === 'double' || format === 'world') ? { seeded: true } : {};
  // Beste Dritte (Stufe 4): eine Gruppenzahl, die mit den Dritten den Baum füllt (3, 6, 7 oder 12).
  const bestThirds = format === 'world' && body.bestThirds === true && BEST_THIRD_GROUPS.includes(body.groupCount as 3);
  const groupCount = format === 'world' && (bestThirds || GROUP_COUNT_CHOICES.includes(body.groupCount as 2)) ? { groupCount: body.groupCount as number } : {};
  return {
    name,
    gameId: game ? (body.gameId as string) : '',
    format,
    time: 'normal',
    days: 1,
    thirdPlace: body.thirdPlace === true || placementsLocal,
    ...(placementsLocal ? { placements: true } : {}),
    isPublic: false,
    mode: 'local',
    sport,
    result,
    draws: body.draws === true,
    fieldLabel: fieldLabel ?? 'Tisch',
    spectators: body.spectators === true,
    ...returnRound,
    ...(body.checkin === true ? { checkin: true } : {}),
    ...seeded,
    ...(bestThirds ? { bestThirds: true } : {}),
    ...groupCount,
    ...(disciplines ? { disciplines } : {}),
    ...tables,
    ...(format === 'tables' && body.lowWins === true ? { lowWins: true } : {}),
    // Vor Ort zählt „Best of N“ nur, wenn der Sieger eingetragen wird (dann der Stand in Partien).
    ...(result === 'winner' ? parseBestOf(body, format) : {}),
    ...parseLives(body, format),
    ...(format === 'dyp' ? { rounds: DYP_ROUND_CHOICES.includes(body.rounds as 3) ? (body.rounds as number) : 4 } : {}),
  };
}

/** Liga nach Kalender: Beginn (nicht länger als einen Tag her, höchstens zwei Jahre voraus) und Abstand in Tagen. */
export const LEAGUE_DAY_CHOICES = [1, 2, 3, 7, 14] as const;
function parseCalendar(body: Record<string, unknown>): Pick<TournamentSettings, 'leagueStart' | 'leagueDays'> {
  const start = body.leagueStart;
  if (typeof start !== 'number' || !Number.isFinite(start)) return {};
  const now = Date.now();
  if (start < now - 24 * 60 * 60 * 1000 || start > now + 2 * 365 * 24 * 60 * 60 * 1000) return {};
  return { leagueStart: Math.floor(start), ...(LEAGUE_DAY_CHOICES.includes(body.leagueDays as 1) ? { leagueDays: body.leagueDays as number } : {}) };
}

/** Last One Standing: Leben (1–5), nur für diese Form; fehlt = Standard. */
function parseLives(body: Record<string, unknown>, format: TournamentFormat): Pick<TournamentSettings, 'lives'> {
  return format === 'lives' && LIVES_CHOICES.includes(body.lives as 1) ? { lives: body.lives as number } : {};
}

/** Formen mit eigener K.-o.-Phase neben anderen Runden: nur die WM-Form (K.-o. ist ganz K.-o.). */
const KO_FORMATS: readonly TournamentFormat[] = ['world'];

/** „Best of N“ für alle Begegnungen und eigens für die K.-o.-Phase; 1 und Ungültiges fallen weg. */
function parseBestOf(body: Record<string, unknown>, format: TournamentFormat): Pick<TournamentSettings, 'bestOf' | 'bestOfKo'> {
  if (format === 'tables') return {};
  const all = isBestOf(body.bestOf) && body.bestOf > 1 ? { bestOf: body.bestOf } : {};
  const ko = KO_FORMATS.includes(format) && isBestOf(body.bestOfKo) && body.bestOfKo !== (all.bestOf ?? 1) ? { bestOfKo: body.bestOfKo } : {};
  return { ...all, ...ko };
}

/** Tischgröße, Grenzen und Rundenzahl der Tischrunden. */
function parseTableSettings(body: Record<string, unknown>, min: number, max: number): Pick<TournamentSettings, 'tableSize' | 'tableMin' | 'tableMax' | 'rounds'> {
  const wanted = Number.isInteger(body.tableSize) ? (body.tableSize as number) : Math.min(4, max);
  const rounds = TABLE_ROUND_CHOICES.includes(body.rounds as 4) ? (body.rounds as number) : 4;
  return { tableSize: Math.max(min, Math.min(max, wanted)), tableMin: min, tableMax: max, rounds };
}

/**
 * Disziplinen eines Spieleabends: undefined = keine (ein Spiel), null = ungültig.
 * Nur im Bundesliga-Modus, 2 bis 8, jede nur einmal; `clean` prüft und säubert jeden Eintrag.
 */
function parseDisciplines(body: Record<string, unknown>, format: TournamentFormat, clean: (value: string) => string | null): string[] | null | undefined {
  if (body.disciplines === undefined) return undefined;
  if (format !== 'league' || !Array.isArray(body.disciplines)) return null;
  const list = body.disciplines.map((value) => (typeof value === 'string' ? clean(value) : null));
  if (list.some((value) => value === null)) return null;
  const unique = [...new Set(list as string[])];
  return unique.length === list.length && unique.length >= DISCIPLINES_MIN && unique.length <= DISCIPLINES_MAX ? unique : null;
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

/** Namen, die beim Anlegen vor Ort schon auf der Teilnehmerliste stehen (Folgephase): höchstens 128, kurz, in Reihenfolge. */
export function parseEntrants(body: unknown): string[] {
  if (!Array.isArray(body) || body.length > TOURNAMENT_MAX_PLAYERS) return [];
  return body.filter((n): n is string => typeof n === 'string' && n.length > 0 && n.length <= ENTRANT_NAME_LENGTH * 2);
}

/** Startwert der Auslosung eines Turniers, das ohne Netz geleitet wurde (nur vor Ort; kein Geheimnis, es gibt nichts Verdecktes). */
export function parseSeed(value: unknown): string | undefined {
  return typeof value === 'string' && /^[\w-]{8,64}$/.test(value) ? value : undefined;
}
