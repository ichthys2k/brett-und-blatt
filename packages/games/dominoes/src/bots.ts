import { stateFor, type BotDefinition, type Rng } from '@brett-und-blatt/engine';
import { applyMove, endSum, isDouble, legalMoves, pipsOf, STONES, type DominoMove, type DominoState, type StoneId } from './rules';

function best<T>(items: T[], score: (item: T) => number, rng: Rng): T {
  let top = items[0] as T;
  let topScore = -Infinity;
  for (const item of items) {
    const s = score(item) + rng.next() * 0.01;
    if (s > topScore) {
      top = item;
      topScore = s;
    }
  }
  return top;
}

/**
 * Der Domino-Bot.
 * - leicht: irgendein passender Stein
 * - mittel: Fünfer-Punkte zuerst, sonst den schwersten Stein loswerden
 * - schwer: zusätzlich Pasche früh legen, eigene Zahlen offen halten, Zahlen legen, die der Gegner
 *   nicht hat, und beim Fünfer-Domino dem Nächsten möglichst keine Punkte vorlegen (geschätzt aus
 *   mehreren Belegungen der verdeckten Steine)
 */
export const dominoBot: BotDefinition<DominoState, DominoMove> = {
  id: 'dominoes',
  name: 'Domino-Bot',
  levels: ['easy', 'medium', 'hard'],
  chooseMove(ctx) {
    const view = ctx.view;
    const moves = legalMoves(view, ctx.seat);
    const plays = moves.filter((m): m is Extract<DominoMove, { type: 'play' }> => m.type === 'play');
    if (plays.length === 0) return moves[0]!;
    if (ctx.level === 'easy') return ctx.rng.pick(plays);

    const hand = (view.hands[ctx.seat] ?? []).filter((s): s is StoneId => s !== null);
    // Für Probezüge eine vollständige Belegung (applyMove rechnet am Rundenende mit allen Händen).
    const base = stateFor(ctx);
    const fives = view.variant === 'fives';
    const immediate = (m: Extract<DominoMove, { type: 'play' }>) => {
      if (!fives) return 0;
      const sum = endSum(applyMove(base, ctx.seat, m).state.chain);
      return sum > 0 && sum % 5 === 0 ? sum : 0;
    };
    if (ctx.level === 'medium') return best(plays, (m) => immediate(m) * 10 + pipsOf(m.stone), ctx.rng);

    const next = (ctx.seat + 1) % view.seats;
    const samples = fives ? Array.from({ length: 6 }, () => stateFor(ctx)) : [];
    return best(
      plays,
      (m) => {
        const after = applyMove(base, ctx.seat, m).state;
        // Damit ist die Runde (oder das Spiel) gewonnen.
        if (after.round !== view.round || after.over) return 1_000 + immediate(m);
        const rest = hand.filter((s) => s !== m.stone);
        const [l, r] = [after.chain[0]!.left, after.chain[after.chain.length - 1]!.right];
        // Wie viele eigene Steine passen danach noch? Wer seine Zahlen offen hält, muss seltener ziehen.
        const keep = rest.filter((s) => STONES[s]!.some((n) => n === l || n === r)).length;
        const blocks = (view.lacks[next] ?? []).filter((n) => n === l || n === r).length;
        let value = immediate(m) * 3 + pipsOf(m.stone) + (isDouble(m.stone) ? 4 : 0) + keep * 2 + blocks * 3;
        if (fives) {
          // Was kann der Nächste daraus machen? Mittel über einige mögliche Hände.
          let reply = 0;
          for (const sample of samples) {
            const s = { ...after, hands: after.hands.map((h, i) => (i === next ? sample.hands[next]! : h)) };
            const replies = legalMoves(s, next).filter((x) => x.type === 'play');
            let top = 0;
            for (const x of replies) {
              const sum = endSum(applyMove(s, next, x).state.chain);
              if (sum > 0 && sum % 5 === 0) top = Math.max(top, sum);
            }
            reply += top;
          }
          value -= (reply / Math.max(1, samples.length)) * 2;
        }
        return value;
      },
      ctx.rng,
    );
  },
};
