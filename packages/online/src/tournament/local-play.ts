import type { MatchOutcome, MatchScore, MatchSide, TournamentMatch, TournamentSchedule, TournamentSnapshot } from './types';

/**
 * Austragung vor Ort (W-058 Stufe 1): Gespielt wird am echten Tisch oder auf dem Feld, die
 * Leitung ruft Partien an Tische auf und trägt das Ergebnis ein. Keine Kennungen, keine
 * Spielräume, keine Stichtage.
 */

export const isLocal = (s: TournamentSnapshot): boolean => s.settings.mode === 'local';

/** Höchster erlaubter Spielstand je Seite (Tore, Sätze, Punkte). */
export const MAX_SCORE = 999;

/** Was die Leitung einträgt: ein Spielstand oder, wenn nur der Sieger zählt, Sieger bzw. Remis. */
export type ResultEntry = { score: MatchScore } | { winner: MatchSide | 'draw' };

/**
 * Macht aus einem Eintrag ein Ergebnis. Ein Text bedeutet: abgelehnt.
 * `drawAllowed`: Remis erlaubt die Einstellung und die Form an dieser Stelle.
 */
export function outcomeFromEntry(entry: ResultEntry, drawAllowed: boolean): MatchOutcome | string {
  if ('score' in entry) {
    const [a, b] = entry.score;
    if (![a, b].every((n) => Number.isInteger(n) && n >= 0 && n <= MAX_SCORE)) return 'Bitte ganze Zahlen eintragen.';
    if (a === b && !drawAllowed) return 'Unentschieden gibt es hier nicht.';
    return { winner: a === b ? null : a > b ? 0 : 1, draw: a === b, walkover: false, score: [a, b] };
  }
  if (entry.winner === 'draw') return drawAllowed ? { winner: null, draw: true, walkover: false } : 'Unentschieden gibt es hier nicht.';
  return { winner: entry.winner, draw: false, walkover: false };
}

/** Partien, die gerade an einem Tisch laufen, nach Tisch. */
function busyFields(s: TournamentSnapshot): Map<number, TournamentMatch> {
  const busy = new Map<number, TournamentMatch>();
  for (const m of s.matches) if (m.status === 'running' && m.field !== undefined) busy.set(m.field, m);
  return busy;
}

/**
 * Ruft offene Partien an freie Tische auf: in der Reihenfolge der Phasen, wer schon an einem
 * Tisch steht, wartet. Partien auf weggefallenen Tischen gehen zurück in die Warteschlange.
 * Sagt, ob sich etwas geändert hat.
 */
export function assignFields(s: TournamentSnapshot, now: number): boolean {
  const count = s.fields ?? 0;
  let moved = false;
  for (const m of s.matches) {
    if (m.status === 'running' && (m.field === undefined || m.field >= count)) {
      m.status = 'open';
      delete m.field;
      delete m.calledAt;
      moved = true;
    }
  }
  if (count === 0) return moved;
  const busy = busyFields(s);
  // Wer pfeift, steht ebenfalls am Tisch und wird so lange nicht zum Spielen aufgerufen.
  const playing = new Set([...busy.values()].flatMap((m) => [...m.slots.map((slot) => slot.player), ...(m.referee ? [m.referee] : [])]));
  const queue = s.matches.filter((m) => m.status === 'open').sort((x, y) => x.stage - y.stage);
  for (let field = 0; field < count; field++) {
    if (busy.has(field)) continue;
    const next = queue.find((m) => m.status === 'open' && m.slots.every((slot) => slot.player && !playing.has(slot.player)));
    if (!next) break;
    next.status = 'running';
    next.field = field;
    next.calledAt = now;
    for (const slot of next.slots) playing.add(slot.player);
    if (s.referees) {
      const referee = pickReferee(s, playing);
      if (referee) {
        next.referee = referee;
        playing.add(referee);
      }
    }
    moved = true;
  }
  return moved;
}

/**
 * Teams pfeifen gegenseitig: Wer gerade weder spielt noch pfeift und bisher am seltensten
 * gepfiffen hat, pfeift. Bei Gleichstand der Reihe nach.
 */
function pickReferee(s: TournamentSnapshot, playing: Set<string | null>): string | undefined {
  const count = new Map<string, number>();
  for (const m of s.matches) if (m.referee) count.set(m.referee, (count.get(m.referee) ?? 0) + 1);
  const free = s.players.filter((p) => !p.withdrawn && !playing.has(p.id));
  free.sort((a, b) => (count.get(a.id) ?? 0) - (count.get(b.id) ?? 0));
  return free[0]?.id;
}

/** Längste Spieldauer und Pause in Minuten. */
export const SCHEDULE_MAX_MINUTES = 240;

/**
 * Uhrzeiten laut Zeitplan: Die Partien laufen in Phasenreihenfolge über alle Tische, je Durchgang
 * Spieldauer plus Pause. Freilose und Partien ohne Gegner zählen nicht. Ohne Tische gilt einer.
 */
export function plannedStarts(s: TournamentSnapshot, schedule: TournamentSchedule): Map<string, number> {
  const fields = Math.max(1, s.fields ?? 0);
  const slot = (schedule.matchMinutes + schedule.breakMinutes) * 60_000;
  const order = s.matches
    .map((m, index) => ({ m, index }))
    .filter(({ m }) => !m.outcome?.bye && !(m.status === 'done' && (!m.slots[0].player || !m.slots[1].player)))
    .sort((a, b) => a.m.stage - b.m.stage || a.index - b.index);
  return new Map(order.map(({ m }, i) => [m.id, schedule.start + Math.floor(i / fields) * slot]));
}
