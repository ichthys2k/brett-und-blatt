import { firstRoundSlots, groupCountFor, koFirstRound, loserOf, pairKey, roundRobinPairs, roundRobinRounds, swissPairing, swissRoundsFor, winnerOf } from './pairing';
import { TOURNAMENT_MIN_PLAYERS, DAY_MS, type MatchSlot, type MatchStatus, type StandingRow, type TournamentFormat, type TournamentMatch, type TournamentSnapshot } from './types';

/**
 * Turnierformen: wer gegen wen spielt, wann die nächste Runde kommt und wer am Ende vorn ist.
 * Eine Form weiß nicht, ob online im Spielraum oder vor Ort gespielt wird; das regelt die
 * Austragung. Neue Formen (Liga, Gruppen frei, Zufallspartner …) kommen hier als weiterer
 * Eintrag in `FORMATS` dazu.
 */

/** Was eine Form vom Turnier braucht. */
export interface FormatContext {
  readonly s: TournamentSnapshot;
  now(): number;
  newMatch(id: string, stage: number, group: number | null, slots: [MatchSlot, MatchSlot], status: MatchStatus): TournamentMatch;
  match(id: string): TournamentMatch | undefined;
  groupTable(group: number): StandingRow[];
  groupSettled(group: number): boolean;
  /** Gesamttabelle über alle Partien (Schweizer System). */
  overallTable(): StandingRow[];
  isWithdrawn(id: string): boolean;
}

export interface TournamentFormatRules {
  minPlayers: number;
  /** Legt Phasen und Partien an; `ids` sind schon ausgelost. */
  setup(ctx: FormatContext, ids: string[], deadline: (stage: number) => number): void;
  /** Neue Partien, die sich erst aus Ergebnissen ergeben (nächste Schweizer Runde, Entscheidungspartie). */
  advance(ctx: FormatContext): boolean;
  /** Stehen noch Runden aus, obwohl alle vorhandenen Partien entschieden sind? */
  moreRounds(ctx: FormatContext): boolean;
  /** Braucht diese Partie einen Sieger (sonst ist Remis ein Ergebnis)? */
  needsWinner(ctx: FormatContext, match: TournamentMatch): boolean;
  /** Darf ein schon entschiedenes Ergebnis noch geändert werden? */
  mayChangeDone(ctx: FormatContext, match: TournamentMatch): boolean;
  /** Plätze am Ende: Sieger, Zweiter, ggf. Dritter. */
  podium(ctx: FormatContext): string[];
}

// ---------------------------------------------------------------------------
// Gemeinsame Bausteine

/** Legt einen K.-o.-Baum an. Hat die erste Runde schon Spieler, ist sie sofort spielbar. */
function addKnockoutTree(ctx: FormatContext, first: [MatchSlot, MatchSlot][], firstStage: number, deadline: (index: number) => number): void {
  const s = ctx.s;
  let slots = first;
  let stage = firstStage;
  let round = Math.log2(first.length * 2);
  while (slots.length > 0) {
    s.stages.push({ kind: 'ko', round, deadline: deadline(stage) });
    const ids: string[] = [];
    slots.forEach((pair, i) => {
      const id = `k${round}-${i}`;
      ids.push(id);
      const ready = !pair[0].from && !pair[1].from;
      s.matches.push(ctx.newMatch(id, stage, null, pair, ready ? 'open' : 'waiting'));
    });
    if (round === 1 && s.settings.thirdPlace) {
      const semis = s.matches.filter((m) => m.stage === stage - 1);
      if (semis.length === 2) {
        const third = ctx.newMatch('k-3', stage, null, [loserOf(semis[0]!.id), loserOf(semis[1]!.id)], 'waiting');
        third.thirdPlace = true;
        s.matches.push(third);
      }
    }
    const next: [MatchSlot, MatchSlot][] = [];
    for (let i = 0; i + 1 < ids.length; i += 2) next.push([winnerOf(ids[i]!), winnerOf(ids[i + 1]!)]);
    slots = next;
    stage++;
    round--;
  }
}

/** Ein Ergebnis im Baum darf sich ändern, solange keine Folgepartie schon feststeht. */
function bracketMayChange(ctx: FormatContext, match: TournamentMatch): boolean {
  return !ctx.s.matches.some((m) => m.status !== 'waiting' && m.slots.some((slot) => slot.from && 'match' in slot.from && slot.from.match === match.id));
}

/** Ein Gruppenergebnis darf sich ändern, solange die Gruppe offen ist oder noch niemand aus ihr im Baum steht. */
function groupMayChange(ctx: FormatContext, group: number): boolean {
  return !ctx.groupSettled(group) || !ctx.s.matches.some((m) => m.slots.some((slot) => slot.from?.kind === 'groupPlace' && slot.from.group === group && slot.player !== null));
}

/** Sieger oder Verlierer einer Partie als Platzliste (leer, wenn offen oder ohne Sieger). */
function place(m: TournamentMatch | undefined, winner: boolean): string[] {
  if (m?.outcome?.winner == null) return [];
  const player = m.slots[winner ? m.outcome.winner : 1 - m.outcome.winner]!.player;
  return player ? [player] : [];
}

function knockoutPodium(ctx: FormatContext): string[] {
  const final = ctx.match('k1-0');
  return [...place(final, true), ...place(final, false), ...place(ctx.match('k-3'), true)];
}

const lastStage = (ctx: FormatContext) => Math.max(...ctx.s.matches.map((m) => m.stage));

// ---------------------------------------------------------------------------
// WM-Form: Gruppen jeder gegen jeden, die zwei Besten in den Baum

const world: TournamentFormatRules = {
  minPlayers: TOURNAMENT_MIN_PLAYERS.world,
  setup(ctx, ids, deadline) {
    // Vor Ort darf die Leitung die Gruppenzahl wählen, solange jede Gruppe mindestens zwei hat.
    const wanted = ctx.s.settings.groupCount;
    const groupCount = wanted && wanted * 2 <= ids.length ? wanted : groupCountFor(ids.length);
    const groups: string[][] = Array.from({ length: groupCount }, () => []);
    ids.forEach((id, i) => groups[i % groupCount]!.push(id));
    ctx.s.groups = groups;
    ctx.s.stages = [{ kind: 'group', round: 0, deadline: deadline(0) }];
    groups.forEach((players, group) => {
      roundRobinPairs(players).forEach(([a, b], i) => {
        ctx.s.matches.push(ctx.newMatch(`g${group}-${i}`, 0, group, [{ player: a }, { player: b }], 'open'));
      });
    });
    // Der Baum steht von Anfang an, mit der Herkunft jedes Platzes.
    addKnockoutTree(ctx, koFirstRound(groupCount).map(([a, b]) => [{ player: null, from: a }, { player: null, from: b }]), 1, deadline);
  },
  advance: () => false,
  moreRounds: () => false,
  needsWinner: (_ctx, match) => match.group === null,
  mayChangeDone: (ctx, match) => (match.group !== null ? groupMayChange(ctx, match.group) : bracketMayChange(ctx, match)),
  podium: knockoutPodium,
};

// ---------------------------------------------------------------------------
// K.-o.

const knockout: TournamentFormatRules = {
  minPlayers: TOURNAMENT_MIN_PLAYERS.knockout,
  setup: (ctx, ids, deadline) => addKnockoutTree(ctx, firstRoundSlots(ids), 0, deadline),
  advance: () => false,
  moreRounds: () => false,
  needsWinner: () => true,
  mayChangeDone: bracketMayChange,
  podium: knockoutPodium,
};

// ---------------------------------------------------------------------------
// Doppel-K.-o.

/** Gewinnt im Großen Finale der Herausforderer, haben beide je eine Niederlage: eine Partie mehr. */
function addDecider(ctx: FormatContext): boolean {
  const s = ctx.s;
  const final = ctx.match('gf');
  if (!final?.outcome || final.outcome.winner !== 1 || final.outcome.walkover || ctx.match('gf2')) return false;
  const stage = s.stages.length;
  const last = s.stages[stage - 1]!;
  s.stages.push({ kind: 'double', round: stage, deadline: Math.max(last.deadline, ctx.now()) + s.settings.days * DAY_MS });
  s.matches.push(ctx.newMatch('gf2', stage, null, [{ player: final.slots[0].player }, { player: final.slots[1].player }], 'open'));
  return true;
}

const double: TournamentFormatRules = {
  minPlayers: TOURNAMENT_MIN_PLAYERS.double,
  /**
   * Wer in der Gewinnerrunde verliert, fällt in die Verliererrunde. Dort wechseln sich Runden
   * unter Verlierern und Runden mit neu Herabgefallenen ab. Gewinner- und Verliererrunde laufen
   * teils zur selben Zeit, darum teilen sie sich Stichtage.
   */
  setup(ctx, ids, deadline) {
    const s = ctx.s;
    const first = firstRoundSlots(ids);
    const rounds = Math.log2(first.length * 2);
    const upperStage = (round: number) => (round === 1 ? 0 : 2 * round - 3);
    const lastLower = 2 * rounds - 2;
    for (let stage = 0; stage <= lastLower + 1; stage++) s.stages.push({ kind: 'double', round: stage, deadline: deadline(stage) });

    // Gewinnerrunde
    let upper = first;
    for (let round = 1; round <= rounds; round++) {
      const pairs = upper;
      pairs.forEach((pair, i) => s.matches.push(ctx.newMatch(`w${round}-${i}`, upperStage(round), null, pair, round === 1 ? 'open' : 'waiting')));
      upper = [];
      for (let i = 0; i + 1 < pairs.length; i += 2) upper.push([winnerOf(`w${round}-${i}`), winnerOf(`w${round}-${i + 1}`)]);
    }

    // Verliererrunde
    let survivors = first.map((_, i) => loserOf(`w1-${i}`));
    for (let round = 1; round <= lastLower; round++) {
      const pairs: [MatchSlot, MatchSlot][] = [];
      if (round % 2 === 1) {
        for (let i = 0; i + 1 < survivors.length; i += 2) pairs.push([survivors[i]!, survivors[i + 1]!]);
      } else {
        // Herabgefallene umgekehrt einsortieren, damit sich Paarungen nicht gleich wiederholen.
        const upperRound = round / 2 + 1;
        const count = survivors.length;
        survivors.forEach((slot, i) => pairs.push([loserOf(`w${upperRound}-${count - 1 - i}`), slot]));
      }
      pairs.forEach((pair, i) => s.matches.push(ctx.newMatch(`l${round}-${i}`, round, null, pair, 'waiting')));
      survivors = pairs.map((_, i) => winnerOf(`l${round}-${i}`));
    }

    s.matches.push(ctx.newMatch('gf', lastLower + 1, null, [winnerOf(`w${rounds}-0`), winnerOf(`l${lastLower}-0`)], 'waiting'));
  },
  advance: addDecider,
  moreRounds: () => false,
  needsWinner: () => true,
  mayChangeDone: (ctx, match) => (match.id === 'gf' && ctx.match('gf2') ? false : bracketMayChange(ctx, match)),
  podium(ctx) {
    const final = ctx.match('gf2') ?? ctx.match('gf');
    const lower = Math.max(...ctx.s.matches.filter((m) => m.id.startsWith('l')).map((m) => m.stage));
    return [...place(final, true), ...place(final, false), ...place(ctx.match(`l${lower}-0`), false)];
  },
};

// ---------------------------------------------------------------------------
// Schweizer System

function pairSwissRound(ctx: FormatContext, stage: number, ranked: string[]): void {
  const s = ctx.s;
  const played = new Set<string>();
  const hadBye = new Set<string>();
  for (const m of s.matches) {
    const [a, b] = [m.slots[0].player, m.slots[1].player];
    if (a && b) played.add(pairKey(a, b));
    else if (a && m.outcome?.bye) hadBye.add(a);
  }
  const { pairs, bye } = swissPairing(ranked, played, hadBye);
  pairs.forEach(([a, b], i) => s.matches.push(ctx.newMatch(`s${stage}-${i}`, stage, null, [{ player: a }, { player: b }], 'open')));
  if (bye) {
    const match = ctx.newMatch(`s${stage}-frei`, stage, null, [{ player: bye }, { player: null }], 'done');
    match.outcome = { winner: 0, draw: false, walkover: true, bye: true };
    match.finishedAt = ctx.now();
    s.matches.push(match);
  }
}

const swiss: TournamentFormatRules = {
  minPlayers: TOURNAMENT_MIN_PLAYERS.swiss,
  setup(ctx, ids, deadline) {
    const rounds = swissRoundsFor(ids.length);
    ctx.s.stages = Array.from({ length: rounds }, (_, i) => ({ kind: 'swiss' as const, round: i + 1, deadline: deadline(i) }));
    pairSwissRound(ctx, 0, ids);
  },
  advance(ctx) {
    const s = ctx.s;
    if (s.phase !== 'running') return false;
    const stage = lastStage(ctx);
    if (stage + 1 >= s.stages.length) return false;
    if (s.matches.some((m) => m.stage === stage && !m.outcome)) return false;
    const ranked = ctx.overallTable().map((row) => row.player).filter((id) => !ctx.isWithdrawn(id));
    if (ranked.length < 2) return false;
    pairSwissRound(ctx, stage + 1, ranked);
    return true;
  },
  moreRounds: (ctx) => lastStage(ctx) + 1 < ctx.s.stages.length && ctx.s.players.filter((p) => !p.withdrawn).length >= 2,
  needsWinner: () => false,
  mayChangeDone: (ctx, match) => match.stage === lastStage(ctx),
  podium: (ctx) => ctx.overallTable().slice(0, 3).map((r) => r.player),
};

// ---------------------------------------------------------------------------
// Bundesliga-Modus: jeder gegen jeden auf Spieltagen, optional mit Rückrunde

const league: TournamentFormatRules = {
  minPlayers: TOURNAMENT_MIN_PLAYERS.league,
  setup(ctx, ids, deadline) {
    const first = roundRobinRounds(ids);
    // Die Rückrunde wiederholt die Hinrunde in derselben Reihenfolge mit getauschtem Heimrecht.
    const rounds = ctx.s.settings.returnRound ? [...first, ...first.map((pairs) => pairs.map(([a, b]) => [b, a] as [string, string]))] : first;
    ctx.s.stages = rounds.map((_, i) => ({ kind: 'league' as const, round: i + 1, deadline: deadline(i) }));
    rounds.forEach((pairs, stage) => pairs.forEach(([a, b], i) => ctx.s.matches.push(ctx.newMatch(`t${stage}-${i}`, stage, null, [{ player: a }, { player: b }], 'open'))));
  },
  advance: () => false,
  moreRounds: () => false,
  needsWinner: () => false,
  // An einem Ligaergebnis hängt keine andere Partie.
  mayChangeDone: () => true,
  podium: (ctx) => ctx.overallTable().slice(0, 3).map((r) => r.player),
};

export const FORMATS: Record<TournamentFormat, TournamentFormatRules> = { world, knockout, double, swiss, league };
