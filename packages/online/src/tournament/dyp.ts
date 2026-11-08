import { isEvening } from './evening';
import { lastStage, type FormatContext, type TournamentFormatRules } from './formats';
import { seededShuffle } from './pairing';
import { DAY_MS, ENTRANT_NAME_LENGTH, TOURNAMENT_MIN_PLAYERS, type StandingRow, type TournamentPlayer, type TournamentSnapshot } from './types';

/**
 * Zufallspartner (DYP, „Draw Your Partner“, W-058 Stufe 4, #188): In jeder Runde werden aus allen Einzelspielern
 * neue Zweierteams gelost, die Teams spielen gegeneinander, gewertet wird jeder Einzelne mit dem Ergebnis seines
 * Teams. Lose und Gegner wechseln jede Runde (Monster-DYP), Wiederholungen werden möglichst vermieden. Bei
 * ungerader Zahl setzt ein Spieler aus, bei ungerader Teamzahl ein Team; wer aussetzt, bekommt ein Freilos (Sieg),
 * und zwar der, der bisher am seltensten ausgesetzt hat. Nur vor Ort: ein Team ist hier ein Teilnehmer
 * (`TournamentPlayer.pair`), der nur für die Runde besteht.
 */

export const DYP_ROUND_CHOICES = [3, 4, 5, 6, 8] as const;
export const DYP_ROUNDS_DEFAULT = 4;

export const isDyp = (s: Pick<TournamentSnapshot, 'settings'>): boolean => s.settings.format === 'dyp';

/** Einzelspieler (keine Teams der Runden), ohne Zurückgezogene. */
const singles = (s: TournamentSnapshot): TournamentPlayer[] => s.players.filter((p) => !p.pair);
const activeIds = (s: TournamentSnapshot): string[] => singles(s).filter((p) => !p.withdrawn).map((p) => p.id);

/** Wer mit wem schon zusammen oder gegeneinander gespielt hat, und wie oft ausgesetzt wurde. */
function history(s: TournamentSnapshot) {
  const partners = new Map<string, number>();
  const opponents = new Map<string, number>();
  const byes = new Map<string, number>();
  const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const bump = (map: Map<string, number>, k: string) => map.set(k, (map.get(k) ?? 0) + 1);
  const pairOf = (id: string | null) => (id ? s.players.find((p) => p.id === id)?.pair : undefined);
  for (const m of s.matches) {
    const [a, b] = [pairOf(m.slots[0].player), pairOf(m.slots[1].player)];
    if (a?.length === 2) bump(partners, key(a[0], a[1]));
    if (b?.length === 2) bump(partners, key(b[0], b[1]));
    if (a && b) for (const x of a) for (const y of b) bump(opponents, key(x, y));
    if (a && !b) for (const x of a) bump(byes, x);
  }
  return { partners, opponents, byes, key };
}

/** Lost die Teams einer Runde; mehrere Versuche, der mit den wenigsten Wiederholungen gewinnt. */
export function drawRound(s: TournamentSnapshot, round: number): { teams: [string, string][]; rest: string[]; bye: [string, string] | null; versus: [[string, string], [string, string]][] } {
  const ids = activeIds(s);
  const { partners, opponents, byes, key } = history(s);
  // Wer aussetzt (ungerade Zahl): der mit den wenigsten bisherigen Freilosen, unter Gleichen nach Los.
  const fewestByes = (list: string[]) => [...list].sort((a, b) => (byes.get(a) ?? 0) - (byes.get(b) ?? 0));
  let best: { teams: [string, string][]; rest: string[]; bye: [string, string] | null; versus: [[string, string], [string, string]][] } | null = null;
  let bestCost = Infinity;
  for (let attempt = 0; attempt < 300; attempt++) {
    const shuffled = seededShuffle(ids, `${s.seed}/dyp/${round}/${attempt}`);
    const rest: string[] = [];
    let pool = shuffled;
    if (pool.length % 2 === 1) {
      const sitter = fewestByes(shuffled)[0]!;
      rest.push(sitter);
      pool = shuffled.filter((id) => id !== sitter);
    }
    const teams: [string, string][] = [];
    for (let i = 0; i + 1 < pool.length; i += 2) teams.push([pool[i]!, pool[i + 1]!]);
    let bye: [string, string] | null = null;
    let playing = teams;
    if (teams.length % 2 === 1) {
      const sitting = [...teams].sort((a, b) => (byes.get(a[0]) ?? 0) + (byes.get(a[1]) ?? 0) - ((byes.get(b[0]) ?? 0) + (byes.get(b[1]) ?? 0)))[0]!;
      bye = sitting;
      playing = teams.filter((t) => t !== sitting);
    }
    const versus: [[string, string], [string, string]][] = [];
    for (let i = 0; i + 1 < playing.length; i += 2) versus.push([playing[i]!, playing[i + 1]!]);
    let cost = 0;
    for (const t of teams) cost += (partners.get(key(t[0], t[1])) ?? 0) * 100;
    for (const [x, y] of versus) for (const a of x) for (const b of y) cost += opponents.get(key(a, b)) ?? 0;
    if (bye) cost += ((byes.get(bye[0]) ?? 0) + (byes.get(bye[1]) ?? 0)) * 10;
    if (cost < bestCost) {
      bestCost = cost;
      best = { teams, rest, bye, versus };
      if (cost === 0) break;
    }
  }
  return best!;
}

/** Legt die Teams und Partien der Runde an (ein Team ist ein eigener Teilnehmer für diese Runde). */
function addRound(ctx: FormatContext, stage: number): void {
  const s = ctx.s;
  const draw = drawRound(s, stage);
  const nameOf = (id: string) => s.players.find((p) => p.id === id)?.name ?? '?';
  const makeTeam = (members: string[], index: number): string => {
    const id = `d${stage}-${index}`;
    const name = members.map(nameOf).join(' & ');
    s.players.push({ id, token: '', name: name.length > ENTRANT_NAME_LENGTH ? `${name.slice(0, ENTRANT_NAME_LENGTH - 1)}…` : name, avatar: '', withdrawn: false, pair: members });
    return id;
  };
  let n = 0;
  draw.versus.forEach(([a, b], i) => {
    s.matches.push(ctx.newMatch(`d${stage}-${i}`, stage, null, [{ player: makeTeam(a, n++) }, { player: makeTeam(b, n++) }], 'open'));
  });
  const free = [...(draw.bye ? [draw.bye as string[]] : []), ...draw.rest.map((id) => [id])];
  free.forEach((members, i) => {
    const match = ctx.newMatch(`d${stage}-frei${i}`, stage, null, [{ player: makeTeam(members, n++) }, { player: null }], 'done');
    match.outcome = { winner: 0, draw: false, walkover: true, bye: true };
    match.finishedAt = ctx.now();
    s.matches.push(match);
  });
}

/** Tabelle der Einzelspieler: jeder zählt mit dem Ergebnis seines Teams; ein Freilos ist ein Sieg. */
export function dypRows(s: TournamentSnapshot): StandingRow[] {
  const rows = new Map<string, StandingRow>(singles(s).map((p) => [p.id, { player: p.id, played: 0, wins: 0, draws: 0, losses: 0, points: 0, buchholz: 0, scored: 0, conceded: 0 }]));
  const rules = s.scoring;
  for (const m of s.matches) {
    const outcome = m.outcome;
    if (!outcome) continue;
    m.slots.forEach((slot, side) => {
      const members = slot.player ? s.players.find((p) => p.id === slot.player)?.pair : undefined;
      for (const id of members ?? []) {
        const row = rows.get(id);
        if (!row) continue;
        row.played++;
        if (outcome.winner === side) {
          row.wins++;
          row.points += rules.win;
        } else if (outcome.draw) {
          row.draws++;
          row.points += rules.draw;
        } else {
          row.losses++;
          row.points += rules.loss;
        }
        if (outcome.score) {
          row.scored += outcome.score[side]!;
          row.conceded += outcome.score[1 - side]!;
        }
      }
    });
  }
  const lot = new Map(seededShuffle([...rows.keys()], `${s.seed}/los`).map((id, i) => [id, i]));
  return [...rows.values()].sort((a, b) => b.points - a.points || b.scored - b.conceded - (a.scored - a.conceded) || b.scored - a.scored || b.wins - a.wins || lot.get(a.player)! - lot.get(b.player)!);
}

export const dypFormat: TournamentFormatRules = {
  minPlayers: TOURNAMENT_MIN_PLAYERS.dyp,
  setup(ctx, _ids, deadline) {
    const rounds = ctx.s.settings.rounds ?? DYP_ROUNDS_DEFAULT;
    ctx.s.stages = Array.from({ length: rounds }, (_, i) => ({ kind: 'swiss' as const, round: i + 1, deadline: deadline(i) }));
    addRound(ctx, 0);
  },
  advance(ctx: FormatContext) {
    const s = ctx.s;
    if (s.phase !== 'running') return false;
    const stage = lastStage(ctx);
    if (stage + 1 >= s.stages.length || s.matches.some((m) => m.stage === stage && !m.outcome) || activeIds(s).length < 4) return false;
    if (isEvening(s)) s.stages[stage + 1]!.deadline = 0;
    else s.stages[stage + 1]!.deadline = Math.max(s.stages[stage]!.deadline, ctx.now()) + s.settings.days * DAY_MS;
    addRound(ctx, stage + 1);
    return true;
  },
  moreRounds: (ctx) => lastStage(ctx) + 1 < ctx.s.stages.length && activeIds(ctx.s).length >= 4,
  needsWinner: () => false,
  mayChangeDone: (ctx, match) => match.stage === lastStage(ctx),
  podium: (ctx) => dypRows(ctx.s).slice(0, 3).map((r) => r.player),
};
