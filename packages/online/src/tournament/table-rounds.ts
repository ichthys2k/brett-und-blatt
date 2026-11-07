import type { FormatContext, TournamentFormatRules } from './formats';
import { seededShuffle } from './pairing';
import type { MatchRoomRequest } from './online-play';
import { READY_WINDOW_MS, TOURNAMENT_MIN_PLAYERS, type StandingRow, type TableGame, type TournamentSnapshot } from './types';

/**
 * Tischrunden (W-058 Stufe 3 Teil 3) für Spiele mit drei und mehr Plätzen, wie beim
 * Skatturnier: Jede Runde verteilt alle an Tische, gespielt wird eine Partie je Tisch, die
 * Platzierung gibt Punkte (so viele, wie Mitspieler hinter einem liegen). Ab Runde 2 wird
 * nach der Tabelle neu gesetzt: die Besten zusammen an Tisch 1 usw.
 */

export const TABLE_ROUND_CHOICES = [2, 3, 4, 5, 6, 8] as const;
export const TABLE_SIZE_MIN = 3;
export const TABLE_SIZE_MAX = 8;

export function isTables(s: TournamentSnapshot): boolean {
  return s.settings.format === 'tables';
}

/**
 * Tischgrößen für `n` Spieler: so viele Tische, dass keiner größer als `size` ist, dann so
 * gleichmäßig wie möglich. Größere Tische zuerst. null, wenn es mit `min`/`max` nicht aufgeht.
 */
export function tableSizes(n: number, size: number, min: number, max: number): number[] | null {
  if (n < min) return null;
  let count = Math.ceil(n / Math.min(size, max));
  while (count > 1 && Math.floor(n / count) < min) count--;
  const base = Math.floor(n / count);
  const extra = n % count;
  if (base < min || base + (extra > 0 ? 1 : 0) > max) return null;
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Punkte je Sitz: so viele, wie Mitspieler einen schlechteren Platz haben. */
export function placePoints(places: readonly number[]): number[] {
  return places.map((place) => places.filter((other) => other > place).length);
}

/** Plätze aus Punkten im Spiel; gleiche Punkte teilen sich den Platz. */
export function placesFromScores(scores: readonly number[], lowWins = false): number[] {
  return scores.map((score) => scores.filter((other) => (lowWins ? other < score : other > score)).length);
}

/** Gültige Plätze: ganze Zahlen ab 0, „Wettkampf-Platzierung“ (1, 1, 3 statt 1, 1, 2). */
export function validPlaces(places: readonly number[], seats: number): boolean {
  if (places.length !== seats || !places.every((p) => Number.isInteger(p) && p >= 0 && p < seats)) return false;
  return places.every((place) => places.filter((other) => other < place).length === place);
}

/** Tabelle über alle entschiedenen Tische: Punkte, dann erste Plätze, dann Punkte im Spiel, dann Los. */
export function tableStandings(s: TournamentSnapshot): StandingRow[] {
  const rows = new Map<string, StandingRow>(s.players.map((p) => [p.id, { player: p.id, played: 0, wins: 0, draws: 0, losses: 0, points: 0, buchholz: 0, scored: 0, conceded: 0 }]));
  for (const table of s.tables ?? []) {
    if (!table.places) continue;
    const points = placePoints(table.places);
    const last = Math.max(...table.places);
    table.seats.forEach((id, seat) => {
      const row = rows.get(id);
      if (!row) return;
      row.played++;
      row.points += points[seat]!;
      if (table.places![seat] === 0) row.wins++;
      else if (table.places![seat] === last) row.losses++;
      row.scored += table.scores?.[seat] ?? 0;
    });
  }
  const lot = new Map(seededShuffle(s.players.map((p) => p.id), `${s.seed}/tische`).map((id, i) => [id, i]));
  const low = s.settings.lowWins === true;
  return [...rows.values()].sort((a, b) => b.points - a.points || b.wins - a.wins || (low ? a.scored - b.scored : b.scored - a.scored) || lot.get(a.player)! - lot.get(b.player)!);
}

/** Setzt eine Runde: `order` der Reihe nach auf die Tische, größere Tische zuerst. */
export function seatRound(s: TournamentSnapshot, stage: number, order: string[], now: number): boolean {
  const sizes = tableSizes(order.length, s.settings.tableSize ?? 4, s.settings.tableMin ?? TABLE_SIZE_MIN, s.settings.tableMax ?? TABLE_SIZE_MAX);
  if (!sizes) return false;
  s.tables ??= [];
  let at = 0;
  sizes.forEach((size, index) => {
    const seats = order.slice(at, at + size);
    at += size;
    s.tables!.push({ id: `r${stage}-t${index}`, stage, index, seats, status: 'open', openedAt: now, readyAt: seats.map(() => null), everReady: seats.map(() => false), roomCode: null, places: null });
  });
  return true;
}

export function tablesOfStage(s: TournamentSnapshot, stage: number): TableGame[] {
  return (s.tables ?? []).filter((t) => t.stage === stage);
}

function lastStage(s: TournamentSnapshot): number {
  return Math.max(-1, ...(s.tables ?? []).map((t) => t.stage));
}

/** Entscheidet einen Tisch. Wer sich zurückgezogen hat, landet immer hinten. */
export function decideTable(s: TournamentSnapshot, table: TableGame, places: number[], now: number, extra: Partial<Pick<TableGame, 'scores' | 'walkover' | 'byLeader'>> = {}): void {
  const gone = table.seats.map((id) => s.players.find((p) => p.id === id)?.withdrawn === true);
  const ranked = gone.some(Boolean) ? rerank(places.map((p, i) => (gone[i] ? table.seats.length + p : p))) : places;
  table.places = ranked;
  table.status = 'done';
  table.finishedAt = now;
  delete table.scores;
  delete table.walkover;
  delete table.byLeader;
  Object.assign(table, extra);
}

/** Beliebige Rangzahlen in Wettkampf-Plätze (0, 0, 2 …). */
export function rerank(values: readonly number[]): number[] {
  return values.map((v) => values.filter((other) => other < v).length);
}

/** Die Form „Tischrunden“ für `FORMATS`. */
export const tablesFormat: TournamentFormatRules = {
  minPlayers: TOURNAMENT_MIN_PLAYERS.tables,
  setup(ctx: FormatContext, ids: string[], deadline: (stage: number) => number) {
    const rounds = ctx.s.settings.rounds ?? 4;
    ctx.s.stages = Array.from({ length: rounds }, (_, i) => ({ kind: 'tables' as const, round: i + 1, deadline: deadline(i) }));
    ctx.s.tables = [];
    seatRound(ctx.s, 0, ids, ctx.now());
  },
  advance(ctx) {
    const s = ctx.s;
    const stage = lastStage(s);
    if (stage < 0 || stage + 1 >= s.stages.length) return false;
    if (tablesOfStage(s, stage).some((t) => t.status !== 'done')) return false;
    const ranked = tableStandings(s).map((row) => row.player).filter((id) => !ctx.isWithdrawn(id));
    return seatRound(s, stage + 1, ranked, ctx.now());
  },
  moreRounds(ctx) {
    const s = ctx.s;
    if ((s.tables ?? []).some((t) => t.status !== 'done')) return true;
    const active = s.players.filter((p) => !p.withdrawn).length;
    return lastStage(s) + 1 < s.stages.length && tableSizes(active, s.settings.tableSize ?? 4, s.settings.tableMin ?? TABLE_SIZE_MIN, s.settings.tableMax ?? TABLE_SIZE_MAX) !== null;
  },
  needsWinner: () => false,
  mayChangeDone: () => true,
  podium: (ctx) => tableStandings(ctx.s).slice(0, 3).map((row) => row.player),
};

// ---------------------------------------------------------------------------
// Online: Bereit, Spielraum, Fristen

/** „Bereit“ an einem Tisch; sind alle bereit, läuft der Tisch. Ein Text bedeutet: abgelehnt. */
export function setTableReady(s: TournamentSnapshot, table: TableGame, seat: number, ready: boolean, now: number): string | null {
  if (table.status !== 'open') return 'Dieser Tisch ist gerade nicht spielbar.';
  table.readyAt[seat] = ready ? now : null;
  if (ready) table.everReady[seat] = true;
  if (table.readyAt.every((at) => at !== null && now - at < READY_WINDOW_MS)) table.status = 'running';
  return null;
}

/** Auftrag für einen Spielraum: alle Sitze, auch Zurückgezogene (sie kommen nicht und landen hinten). */
export function tableRoomRequest(s: TournamentSnapshot, table: TableGame): MatchRoomRequest | null {
  if (table.status !== 'running' || table.roomCode) return null;
  const tokens = table.seats.map((id) => s.players.find((p) => p.id === id)?.token ?? '');
  if (tokens.some((token) => !token)) return null;
  return { match: table.id, gameId: s.settings.gameId, time: s.settings.time, options: s.settings.options ?? {}, tokens, label: s.settings.name };
}

/** Frist abgelaufen: Wer je bereit war, teilt sich Platz 1, die anderen den letzten. */
export function tableDeadlinePlaces(table: TableGame): number[] {
  return rerank(table.everReady.map((ready) => (ready ? 0 : 1)));
}

/** Turnierabend: Tische einer gestarteten Runde laufen ohne „Bereit“ los. */
export function autoStartTables(s: TournamentSnapshot, now: number, held: (stage: number) => boolean): boolean {
  let moved = false;
  for (const table of s.tables ?? []) {
    if (table.status !== 'open' || held(table.stage) || table.everReady.some(Boolean)) continue;
    table.status = 'running';
    table.readyAt = table.seats.map(() => now);
    table.everReady = table.seats.map(() => true);
    moved = true;
  }
  return moved;
}
