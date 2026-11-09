/*
 * Serien (W-058 Stufe 5, #189; auf dem Server seit #205): mehrere abgeschlossene Turniere mit gemeinsamer Rangliste, z. B. ein
 * Kicker-Monatsturnier oder ein Schuljahr. Wer in mehreren Turnieren mitspielt, wird online über eine Kennung (Kurzform
 * der Geräte-Kennung, `key`) erkannt, sonst über den Namen (Groß- und Kleinschreibung zählt nicht).
 * Optional eine Elo-Zahl aus allen Partien in der Reihenfolge der Turniere.
 */

export type PointScheme = 'linear' | 'f1';

export interface SeriesTournament {
  name: string;
  players: { id: string; name: string; pair?: boolean; /** Online: Kurzform der Geräte-Kennung, erkennt dieselbe Person über Turniere hinweg. */ key?: string }[];
  matches: { stage: number; id: string; slots: { player: string | null }[]; outcome: { winner: 0 | 1 | null; draw: boolean; bye?: boolean } | null }[];
  /** Plätze am Ende, bester zuerst (Spieler-ids). */
  ranking: string[];
}

export interface SeriesRow {
  name: string;
  tournaments: number;
  points: number;
  /** Beste Platzierung. */
  best: number;
  elo: number;
}

const F1 = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
export const ELO_START = 1000;
const ELO_K = 32;

/** Punkte für einen Platz (ab 1): linear = Teilnehmer − Platz + 1, f1 = 25, 18, 15, … */
export function seriesPlacePoints(scheme: PointScheme, place: number, participants: number): number {
  return scheme === 'f1' ? (F1[place - 1] ?? 0) : Math.max(0, participants - place + 1);
}

const keyOf = (name: string, key?: string) => (key ? `k:${key}` : `n:${name.trim().toLocaleLowerCase('de')}`);

/** Gesamtwertung über alle Turniere (in der gegebenen Reihenfolge), nach Punkten, dann Elo. */
export function seriesStandings(tournaments: readonly SeriesTournament[], scheme: PointScheme): SeriesRow[] {
  const rows = new Map<string, SeriesRow>();
  const row = (name: string, id?: string): SeriesRow => {
    const key = keyOf(name, id);
    let r = rows.get(key);
    if (!r) {
      r = { name: name.trim(), tournaments: 0, points: 0, best: Infinity, elo: ELO_START };
      rows.set(key, r);
    }
    // Wer über die Kennung erkannt wird, behält den jüngsten Namen; sonst gilt die erste Schreibweise.
    if (id) r.name = name.trim();
    return r;
  };
  for (const tournament of tournaments) {
    const singles = tournament.players.filter((p) => !p.pair);
    const names = new Map(singles.map((p) => [p.id, p.name]));
    const keys = new Map(singles.map((p) => [p.id, p.key]));
    const ranked = tournament.ranking.filter((id) => names.has(id));
    ranked.forEach((id, i) => {
      const r = row(names.get(id)!, keys.get(id));
      r.tournaments++;
      r.points += seriesPlacePoints(scheme, i + 1, ranked.length);
      r.best = Math.min(r.best, i + 1);
    });
    // Elo aus den Partien dieses Turniers, in der Reihenfolge der Phasen.
    const played = [...tournament.matches].filter((m) => m.outcome && !m.outcome.bye && m.slots.length === 2 && m.slots.every((s) => s.player && names.has(s.player))).sort((a, b) => a.stage - b.stage);
    for (const m of played) {
      const [a, b] = [row(names.get(m.slots[0]!.player!)!, keys.get(m.slots[0]!.player!)), row(names.get(m.slots[1]!.player!)!, keys.get(m.slots[1]!.player!))];
      if (a === b) continue;
      const score = m.outcome!.draw ? 0.5 : m.outcome!.winner === 0 ? 1 : m.outcome!.winner === 1 ? 0 : 0.5;
      const expected = 1 / (1 + 10 ** ((b.elo - a.elo) / 400));
      const [da, db] = [ELO_K * (score - expected), ELO_K * (1 - score - (1 - expected))];
      a.elo += da;
      b.elo += db;
    }
  }
  return [...rows.values()]
    .map((r) => ({ ...r, best: Number.isFinite(r.best) ? r.best : 0, elo: Math.round(r.elo) }))
    .sort((a, b) => b.points - a.points || b.elo - a.elo || a.name.localeCompare(b.name, 'de'));
}

/** Die Rangliste als CSV (Semikolon, für deutsche Tabellenprogramme). */
export function seriesCsv(rows: readonly SeriesRow[]): string {
  const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  return ['Rang;Name;Turniere;Punkte;Beste Platzierung;Elo', ...rows.map((r, i) => [i + 1, r.name, r.tournaments, r.points, r.best || '', r.elo].map(cell).join(';'))].join('\n');
}
