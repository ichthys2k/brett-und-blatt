import { seededShuffle } from './pairing';
import type { ScoringRules, StandingRow, Tiebreak, TournamentFormat, TournamentMatch } from './types';

/**
 * Wertung: Punkte je Ergebnis und Gleichstandsregeln. Unabhängig davon, ob online oder vor Ort
 * gespielt wird; die Form bestimmt nur die Voreinstellung.
 */

/**
 * Voreinstellung je Form: Sieg 3, Remis 1. Online: Gruppen nach direktem Vergleich, Schweizer
 * System nach Buchholz. Mit Spielstand (vor Ort, Liga) wie in der Bundesliga zuerst Tordifferenz
 * und erzielte Tore, dann der direkte Vergleich.
 */
export function defaultScoring(format: TournamentFormat, withScore = false): ScoringRules {
  if (format === 'swiss') return { win: 3, draw: 1, loss: 0, tiebreaks: withScore ? ['buchholz', 'difference', 'wins'] : ['buchholz', 'wins'] };
  if (withScore || format === 'league') return { win: 3, draw: 1, loss: 0, tiebreaks: ['difference', 'scored', 'direct', 'wins'] };
  return { win: 3, draw: 1, loss: 0, tiebreaks: ['direct', 'wins'] };
}

/** Punkte einer Seite aus einer entschiedenen Partie. */
function pointsFor(match: TournamentMatch, side: number, rules: ScoringRules): number {
  const outcome = match.outcome!;
  if (outcome.winner === side) return rules.win;
  if (outcome.draw) return rules.draw;
  return rules.loss;
}

/**
 * Tabelle aus entschiedenen Partien. Kampflose zählen, ein Freilos als Sieg. Die Reihenfolge:
 * Punkte, dann `rules.tiebreaks` der Reihe nach, zuletzt das Los aus dem Seed.
 */
export function standings(players: readonly string[], matches: readonly TournamentMatch[], seed: string, rules: ScoringRules): StandingRow[] {
  const rows = new Map<string, StandingRow>(players.map((player) => [player, { player, played: 0, wins: 0, draws: 0, losses: 0, points: 0, buchholz: 0, scored: 0, conceded: 0 }]));
  const done = matches.filter((m) => m.outcome);
  for (const m of done) {
    const outcome = m.outcome!;
    m.slots.forEach((slot, side) => {
      const row = slot.player ? rows.get(slot.player) : undefined;
      if (!row) return;
      row.played++;
      if (outcome.winner === side) row.wins++;
      else if (outcome.draw) row.draws++;
      else row.losses++;
      row.points += pointsFor(m, side, rules);
      if (outcome.score) {
        row.scored += outcome.score[side]!;
        row.conceded += outcome.score[1 - side]!;
      }
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
      points += pointsFor(m, side, rules);
    }
    return points;
  };
  const compare = (rule: Tiebreak, x: StandingRow, y: StandingRow): number => {
    switch (rule) {
      case 'direct': {
        const tied = new Set([...rows.values()].filter((r) => r.points === x.points).map((r) => r.player));
        return direct(y.player, tied) - direct(x.player, tied);
      }
      case 'buchholz':
        return y.buchholz - x.buchholz;
      case 'wins':
        return y.wins - x.wins;
      case 'difference':
        return y.scored - y.conceded - (x.scored - x.conceded);
      case 'scored':
        return y.scored - x.scored;
    }
  };
  return [...rows.values()].sort((x, y) => {
    if (x.points !== y.points) return y.points - x.points;
    for (const rule of rules.tiebreaks) {
      const diff = compare(rule, x, y);
      if (diff !== 0) return diff;
    }
    return lot.get(x.player)! - lot.get(y.player)!;
  });
}
