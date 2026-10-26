import type { BotDefinition, BotLevel } from '@brett-und-blatt/engine';
import { legalMoves, missing, type BingoMove, type BingoState } from './rules';

/** Bedenkpausen in Millisekunden: [Mindestwert, Spielraum]. */
const MARK_MS: Record<BotLevel, [number, number]> = { easy: [2_000, 2_000], medium: [1_000, 1_000], hard: [250, 350] };
const CALL_MS: Record<BotLevel, [number, number]> = { easy: [2_500, 3_000], medium: [1_000, 1_500], hard: [300, 300] };
/** Wie oft ein Bot eine Zahl erst mal übersieht (und sie später nachholt). */
const OVERLOOK: Record<BotLevel, number> = { easy: 0.25, medium: 0.08, hard: 0 };
/** Eine Spielleitung am Computer lässt allen Zeit für die Zieh-Animation und zum Markieren. */
const DRAW_MS: [number, number] = [6_000, 2_000];

/**
 * Bingo braucht kein Nachdenken: Der Bot markiert, was gezogen wurde, und ruft „Bingo!“,
 * sobald es gilt – nie falsch. Die Stufen unterscheiden sich nur im Tempo (`delayMs`).
 * Als Spielleitung zieht er die nächste Zahl, wenn er selbst nichts mehr zu tun hat.
 */
export const bingoBot: BotDefinition<BingoState, BingoMove> = {
  id: 'bingo',
  name: 'Bingo-Bot',
  levels: ['easy', 'medium', 'hard'],
  chooseMove({ view, seat, rng, level }) {
    const moves = legalMoves(view, seat);
    const bingo = moves.find((m) => m.type === 'bingo');
    if (bingo && missing(view, seat) === 0) return bingo;
    const marks = moves.filter((m) => m.type === 'mark');
    if (marks.length > 0) return level === 'hard' ? marks[0]! : rng.pick(marks);
    const draw = moves.find((m) => m.type === 'draw');
    if (draw) return draw;
    // Nur ein Bingo-Ruf wäre noch möglich, aber falsch: Das kommt nicht vor, weil der Platz dann nicht am Zug ist.
    return moves[0]!;
  },
  delayMs({ move, level, rng }) {
    const [base, spread] = move.type === 'draw' ? DRAW_MS : move.type === 'bingo' ? CALL_MS[level] : MARK_MS[level];
    const overlooked = move.type === 'mark' && rng.chance(OVERLOOK[level]) ? 4_000 : 0;
    return base + Math.floor(rng.next() * spread) + overlooked;
  },
};
