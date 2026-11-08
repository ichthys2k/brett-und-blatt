import { bestOfStage } from './best-of';
import type { Options } from '@brett-und-blatt/engine';
import { disciplineOf } from './disciplines';
import { eveningDueAt, isEvening } from './evening';
import { tokensOf } from './teams';
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
  | { kind: 'played'; winner: 0 | 1 | null; score?: [number, number] }
  /** Nur ein Spieler kam (`winner`), oder gar keiner (null). */
  | { kind: 'noShow'; winner: 0 | 1 | null }
  /** Tischrunde: Platz je Sitz (0 = erster); `walkover`, wenn zu wenige kamen. */
  | { kind: 'placed'; places: number[]; walkover?: boolean };

/** Der Auftrag an den Adapter, einen Spielraum anzulegen. */
export interface MatchRoomRequest {
  match: string;
  gameId: string;
  time: TournamentSettings['time'];
  options: Options;
  /** Kennungen in Platzreihenfolge; nach einem Remis im K.-o. getauscht. Tischrunden: einer je Sitz. */
  tokens: string[];
  label: string;
  /** Best of N: der Raum spielt bis zu so viele Partien (nur wenn größer als 1). */
  bestOf?: number;
  /** Teamspiele: Team (0 oder 1) je Kennung; sonst fehlt es. */
  teams?: number[];
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
  const sides = match.slots.map((slot) => s.players.find((p) => p.id === slot.player));
  if (!sides[0] || !sides[1]) return null;
  const swap = match.replays % 2 === 1;
  const [first, second] = swap ? [sides[1], sides[0]] : [sides[0], sides[1]];
  const teamed = first.members !== undefined;
  const seats = [...tokensOf(first), ...tokensOf(second)];
  if (seats.some((token) => !token)) return null;
  // Spieleabend: das Spiel des Spieltags, mit seinen Standardoptionen.
  const discipline = disciplineOf(s, match.stage);
  const bestOf = bestOfStage(s, match.stage);
  return { match: match.id, gameId: discipline ?? s.settings.gameId, time: match.replays > 0 ? 'fast' : s.settings.time, options: discipline ? {} : (s.settings.options ?? {}), tokens: seats, label: s.settings.name, ...(teamed ? { teams: [...tokensOf(first).map(() => 0), ...tokensOf(second).map(() => 1)] } : bestOf > 1 ? { bestOf } : {}) };
}

/** Der Raum zählt nach Plätzen; nach einem getauschten Entscheidungsspiel sind das andere Seiten. */
export function sideOfSeat(match: TournamentMatch, seat: number | null): MatchSide | null {
  return seat === null ? null : ((match.replays % 2 === 1 ? 1 - seat : seat) as MatchSide);
}

/** Ab wann eine offene Partie verfällt: Stichtag der Phase, mindestens `MATCH_MIN_TIME_MS` nach dem Öffnen. */
export function dueAt(s: TournamentSnapshot, match: TournamentMatch): number {
  if (isEvening(s)) return eveningDueAt(s, match);
  return Math.max(s.stages[match.stage]?.deadline ?? 0, (match.openedAt ?? 0) + MATCH_MIN_TIME_MS);
}

/** Am Stichtag: Wer je bereit war, gewinnt kampflos gegen jemanden, der es nie war; sonst verlieren beide. */
export function deadlineOutcome(match: TournamentMatch): MatchOutcome {
  const [a, b] = match.everReady;
  return a === b ? { winner: null, draw: false, walkover: true } : { winner: a ? 0 : 1, draw: false, walkover: true };
}
