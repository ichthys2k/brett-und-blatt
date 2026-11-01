import type { BotContext, BotDefinition } from '@brett-und-blatt/engine';
import { CARDS_DB } from './cards';
import { scenarioFrom } from './modes/scenarios';
import { HARD_PLAN, MEDIUM_PLAN, planTurn } from './planner';
import { legalMoves } from './rules';
import type { DrachenspielMove, DrachenspielState, DrachenspielView } from './types';

export const botDrachenhueter: BotDefinition<
  DrachenspielState,
  DrachenspielMove,
  DrachenspielView
> = {
  id: 'drachenhueter',
  name: 'Drachenhüter',
  levels: ['easy', 'medium', 'hard'],
  delayMs({ move, level }) {
    if (move.type === 'attack' || move.type === 'heroAttack') {
      return 1100;
    }
    if (move.type === 'playCard' || move.type === 'heroPower' || move.type === 'tradeCard' || move.type === 'useBuilding') {
      return level === 'easy' ? 800 : 700;
    }
    if (move.type === 'endTurn') {
      return 350;
    }
    return 350;
  },
  chooseMove(ctxIn: BotContext<DrachenspielState, DrachenspielMove, DrachenspielView>): DrachenspielMove {
    // Im Solo-Kampf bestimmt der Gegner seine Stärke selbst; der Tipp-Knopf für Platz 0 rechnet weiter wie gewohnt.
    const forced = ctxIn.seat === 1 ? scenarioFrom(ctxIn.view.options)?.level : undefined;
    const ctx = forced ? { ...ctxIn, level: forced } : ctxIn;
    // If in deck selection or mulligan, handle straightforwardly
    if (ctx.view.phase === 'deckSelection') {
      const themes = ['forest', 'sea', 'farm', 'wild', 'bugs'] as const;
      return { type: 'chooseDeck', deck: ctx.rng.pick(themes) };
    }

    if (ctx.view.phase === 'mulligan') {
      const me = ctx.view.players[ctx.seat];
      const costs = (me.hand ?? []).map((card) => CARDS_DB[card.defId]?.cost ?? 0);
      const discardIndices = costs.flatMap((cost, idx) => (cost >= 4 ? [idx] : []));
      // Schwer behält eine Vierer-Karte, wenn der frühe Zug schon gesichert ist.
      if (ctx.level === 'hard' && costs.filter((cost) => cost <= 2).length >= 2) {
        const keep = discardIndices.findIndex((idx) => costs[idx] === 4);
        if (keep >= 0) discardIndices.splice(keep, 1);
      }
      return { type: 'mulligan', discardIndices };
    }

    // Offene Wahl: Bei „leicht“ zufällig, sonst plant die Suche mit den Möglichkeiten weiter.
    if (ctx.view.pending && ctx.level === 'easy') {
      return { type: 'choose', index: ctx.rng.int(Math.max(1, ctx.view.pending.options.length)) };
    }

    if (ctx.level === 'easy') {
      // Spielt plausibel: legt, was geht, greift aber wahllos an und übersieht Chancen.
      const moves = legalMoves(ctx.module.sampleHidden!(ctx.view, ctx.seat, ctx.rng), ctx.seat);
      const actions = moves.filter((m) => m.type !== 'endTurn');
      if (actions.length === 0 || ctx.rng.next() < 0.1) return { type: 'endTurn' };
      return ctx.rng.pick(actions);
    }

    // Je Stichprobe der verdeckten Karten den ganzen Zug planen; gespielt wird der erste Schritt des besten Plans.
    const settings = ctx.level === 'hard' ? HARD_PLAN : MEDIUM_PLAN;
    const samples = ctx.level === 'hard' ? 3 : 1;
    const started = ctx.now();
    const totals = new Map<string, { move: DrachenspielMove; sum: number; count: number }>();
    for (let sample = 0; sample < samples; sample++) {
      if (sample > 0 && ctx.now() - started > (ctx.timeBudgetMs * sample) / samples) break;
      const state = ctx.module.sampleHidden!(ctx.view, ctx.seat, ctx.rng);
      const sliceEnd = started + (ctx.timeBudgetMs * (sample + 1)) / samples;
      const plans = planTurn(state, ctx.seat, settings, () => ctx.now() > sliceEnd);
      for (const [key, plan] of plans) {
        if (plan.value === -Infinity) continue;
        const total = totals.get(key) ?? { move: plan.move, sum: 0, count: 0 };
        total.sum += plan.value;
        total.count++;
        totals.set(key, total);
      }
    }

    let best: DrachenspielMove = ctx.view.pending ? { type: 'choose', index: 0 } : { type: 'endTurn' };
    let bestScore = -Infinity;
    for (const total of totals.values()) {
      // Pläne, die nur in einzelnen Stichproben vorkamen, zählen entsprechend weniger.
      const score = total.sum / total.count + total.count;
      if (score > bestScore) {
        bestScore = score;
        best = total.move;
      }
    }
    return best;
  },
};

export const bots = [botDrachenhueter];
