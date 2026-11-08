import { isEvening } from './evening';
import { pairSwissRound, lastStage, type FormatContext, type TournamentFormatRules } from './formats';
import { seededShuffle } from './pairing';
import { DAY_MS, TOURNAMENT_MIN_PLAYERS, type StandingRow, type TournamentSnapshot } from './types';

/**
 * Last One Standing (W-058 Stufe 4, #188): Jeder startet mit n Leben, in jeder Runde wird wie im
 * Schweizer System gepaart (nach Leben, ohne Wiederholung, bei ungerader Zahl ein Freilos), wer eine
 * Partie verliert, verliert ein Leben. Wer kein Leben mehr hat, scheidet aus; wer als Letzter übrig
 * bleibt, gewinnt. Remis gibt es nicht. Eine kampflose Partie ohne Sieger kostet beide ein Leben.
 */

export const LIVES_CHOICES = [1, 2, 3, 4, 5] as const;
export const LIVES_DEFAULT = 2;

export const isLives = (s: Pick<TournamentSnapshot, 'settings'>): boolean => s.settings.format === 'lives';

/** Verbleibende Leben je Spieler und die Runde, in der er ausgeschieden ist (sonst -1). */
export function livesState(s: TournamentSnapshot): Map<string, { lives: number; out: number }> {
  const start = s.settings.lives ?? LIVES_DEFAULT;
  const state = new Map(s.players.map((p) => [p.id, { lives: start, out: -1 }]));
  const matches = [...s.matches].filter((m) => m.outcome && !m.outcome.bye).sort((a, b) => a.stage - b.stage);
  for (const m of matches) {
    const { winner, draw } = m.outcome!;
    if (draw) continue;
    m.slots.forEach((slot, side) => {
      const row = slot.player ? state.get(slot.player) : undefined;
      if (!row || row.lives <= 0) return;
      // Wer nicht gewonnen hat, verliert ein Leben (auch beide bei einer kampflosen Partie ohne Sieger).
      if (winner !== side) {
        row.lives--;
        if (row.lives === 0) row.out = m.stage;
      }
    });
  }
  return state;
}

/** Spieler mit Leben, ohne Zurückgezogene, in Tabellenreihenfolge. */
export function alivePlayers(s: TournamentSnapshot): string[] {
  const state = livesState(s);
  const lot = new Map(seededShuffle(s.players.map((p) => p.id), `${s.seed}/leben`).map((id, i) => [id, i]));
  return s.players
    .filter((p) => !p.withdrawn && (state.get(p.id)?.lives ?? 0) > 0)
    .map((p) => p.id)
    .sort((a, b) => state.get(b)!.lives - state.get(a)!.lives || lot.get(a)! - lot.get(b)!);
}

/** Tabelle: Wer noch lebt nach Leben, danach die Ausgeschiedenen, die zuletzt Ausgeschiedenen vorn. */
export function livesRows(s: TournamentSnapshot): StandingRow[] {
  const state = livesState(s);
  const lot = new Map(seededShuffle(s.players.map((p) => p.id), `${s.seed}/leben`).map((id, i) => [id, i]));
  const rows = new Map<string, StandingRow>(s.players.map((p) => [p.id, { player: p.id, played: 0, wins: 0, draws: 0, losses: 0, points: 0, buchholz: 0, scored: 0, conceded: 0, lives: state.get(p.id)!.lives }]));
  for (const m of s.matches) {
    if (!m.outcome || m.outcome.bye) continue;
    m.slots.forEach((slot, side) => {
      const row = slot.player ? rows.get(slot.player) : undefined;
      if (!row) return;
      row.played++;
      if (m.outcome!.winner === side) row.wins++;
      else row.losses++;
    });
  }
  for (const row of rows.values()) row.points = row.lives ?? 0;
  const withdrawn = new Set(s.players.filter((p) => p.withdrawn).map((p) => p.id));
  const key = (id: string) => (withdrawn.has(id) ? -2 : state.get(id)!.lives > 0 ? Infinity : state.get(id)!.out);
  return [...rows.values()].sort((a, b) => {
    const [ka, kb] = [key(a.player), key(b.player)];
    if (ka !== kb) return kb - ka;
    return (b.lives ?? 0) - (a.lives ?? 0) || b.wins - a.wins || lot.get(a.player)! - lot.get(b.player)!;
  });
}

export const livesFormat: TournamentFormatRules = {
  minPlayers: TOURNAMENT_MIN_PLAYERS.lives,
  setup(ctx, ids, deadline) {
    // Die Runden ergeben sich aus den Ergebnissen; die erste legt der Start an, jede weitere `advance`.
    ctx.s.stages = [{ kind: 'swiss', round: 1, deadline: deadline(0) }];
    pairSwissRound(ctx, 0, ids);
  },
  advance(ctx: FormatContext) {
    const s = ctx.s;
    if (s.phase !== 'running') return false;
    const stage = lastStage(ctx);
    if (s.matches.some((m) => m.stage === stage && !m.outcome)) return false;
    const alive = alivePlayers(s);
    if (alive.length < 2) return false;
    const last = s.stages[stage]!;
    s.stages.push({ kind: 'swiss', round: stage + 2, deadline: isEvening(s) ? 0 : Math.max(last.deadline, ctx.now()) + s.settings.days * DAY_MS });
    pairSwissRound(ctx, stage + 1, alive);
    return true;
  },
  moreRounds: (ctx) => alivePlayers(ctx.s).length >= 2,
  needsWinner: () => true,
  // Nur die letzte Runde ist noch offen für Berichtigungen: Die nächste Paarung hängt an den Leben.
  mayChangeDone: (ctx, match) => match.stage === lastStage(ctx),
  podium: (ctx) => livesRows(ctx.s).slice(0, 3).map((r) => r.player),
};
