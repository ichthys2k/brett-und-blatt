import type { Options } from '@brett-und-blatt/engine';
import { MATCH_MIN_TIME_MS, READY_WINDOW_MS, type MatchOutcome, type MatchSide, type TournamentMatch, type TournamentSettings, type TournamentSnapshot } from './types';

/**
 * Austragung online: Partien werden im Spielraum gespielt. Beide sagen „Bereit“, der Adapter
 * legt einen Raum an, der Raum meldet das Ergebnis. Stichtage entscheiden offene Partien
 * kampflos. Eine Austragung vor Ort (Ergebnis von Hand, Tische, Zeitplan) kommt in Stufe 1
 * als eigenes Modul daneben.
 */

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

export function bothReady(match: TournamentMatch, now: number): boolean {
  return match.readyAt.every((at) => at !== null && now - at < READY_WINDOW_MS);
}

/**
 * „Bereit“ setzen oder zurücknehmen. Niemand spielt zwei Partien zugleich: „Bereit“ gilt
 * immer nur für eine. Ein Text bedeutet: abgelehnt.
 */
export function setReady(s: TournamentSnapshot, match: TournamentMatch, side: MatchSide, ready: boolean, now: number): string | null {
  if (match.status !== 'open') return 'Diese Partie ist gerade nicht spielbar.';
  const playerId = match.slots[side].player;
  const own = s.matches.filter((m) => m !== match && m.slots.some((slot) => slot.player === playerId));
  if (ready && own.some((m) => m.status === 'running')) return 'Du spielst gerade eine andere Partie.';
  if (ready) for (const m of own) if (m.status === 'open') m.readyAt = m.slots.map((slot, i) => (slot.player === playerId ? null : m.readyAt[i]!)) as [number | null, number | null];
  match.readyAt[side] = ready ? now : null;
  if (ready) match.everReady[side] = true;
  if (bothReady(match, now)) match.status = 'running';
  return null;
}

/** Auftrag für einen Spielraum, wenn die Partie laufen soll und noch keinen Raum hat. */
export function roomRequest(s: TournamentSnapshot, match: TournamentMatch): MatchRoomRequest | null {
  if (match.status !== 'running' || match.roomCode) return null;
  const tokens = match.slots.map((slot) => s.players.find((p) => p.id === slot.player)?.token) as [string | undefined, string | undefined];
  if (!tokens[0] || !tokens[1]) return null;
  const seats: [string, string] = match.replays % 2 === 1 ? [tokens[1], tokens[0]] : [tokens[0], tokens[1]];
  return { match: match.id, gameId: s.settings.gameId, time: match.replays > 0 ? 'fast' : s.settings.time, options: s.settings.options ?? {}, tokens: seats, label: s.settings.name };
}

/** Der Raum zählt nach Plätzen; nach einem getauschten Entscheidungsspiel sind das andere Seiten. */
export function sideOfSeat(match: TournamentMatch, seat: 0 | 1 | null): MatchSide | null {
  return seat === null ? null : ((match.replays % 2 === 1 ? 1 - seat : seat) as MatchSide);
}

/** Ab wann eine offene Partie verfällt: Stichtag der Phase, mindestens `MATCH_MIN_TIME_MS` nach dem Öffnen. */
export function dueAt(s: TournamentSnapshot, match: TournamentMatch): number {
  return Math.max(s.stages[match.stage]?.deadline ?? 0, (match.openedAt ?? 0) + MATCH_MIN_TIME_MS);
}

/** Am Stichtag: Wer je bereit war, gewinnt kampflos gegen jemanden, der es nie war; sonst verlieren beide. */
export function deadlineOutcome(match: TournamentMatch): MatchOutcome {
  const [a, b] = match.everReady;
  return a === b ? { winner: null, draw: false, walkover: true } : { winner: a ? 0 : 1, draw: false, walkover: true };
}
