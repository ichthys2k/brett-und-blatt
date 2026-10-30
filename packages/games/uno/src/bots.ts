import type { BotDefinition } from '@brett-und-blatt/engine';
import { getActiveFace } from './rules';
import { DARK_COLORS, LIGHT_COLORS, type UnoCard, type UnoColor, type UnoMove, type UnoState } from './types';

/** Zählt die Häufigkeit jeder Farbe auf der Hand. */
function countColors(cards: UnoCard[], side: 'light' | 'dark'): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const c of cards) {
    const f = getActiveFace(c, side);
    if (f.color !== 'wild') {
      counts[f.color] = (counts[f.color] ?? 0) + 1;
    }
  }
  return counts;
}

/** Ermittelt die häufigste Farbe auf der Hand. */
function mostFrequentColor(cards: UnoCard[], side: 'light' | 'dark'): UnoColor {
  const counts = countColors(cards, side);
  const colors = side === 'dark' ? DARK_COLORS : LIGHT_COLORS;
  let bestCol: UnoColor = colors[0];
  let maxCount = -1;
  for (const col of colors) {
    const c = counts[col] ?? 0;
    if (c > maxCount) {
      maxCount = c;
      bestCol = col;
    }
  }
  return bestCol;
}

/** Standard-Bot für Eins! */
export const unoBot: BotDefinition<UnoState, UnoMove> = {
  id: 'standard',
  name: 'Kartenprofi',
  levels: ['easy', 'medium', 'hard'],
  chooseMove(ctx) {
    const { view, seat: actor, level, rng, module } = ctx;
    const moves = module.legalMoves(view, actor);
    if (moves.length === 1) return moves[0];

    const hand = view.hands[actor];
    const side = view.activeSide;

    // 1. Zuerst prüfen: Gibt es jemanden zum Anprangern (catchUno)?
    const catchMove = moves.find((m) => m.type === 'catchUno');
    if (catchMove) {
      const chance = level === 'hard' ? 1.0 : level === 'medium' ? 0.85 : 0.4;
      if (rng.next() < chance) return catchMove;
    }

    // 2. Muss/kann gestapelt werden?
    if (view.pendingDraw > 0) {
      const stackMoves = moves.filter((m) => m.type === 'play');
      if (stackMoves.length > 0) {
        // Größte oder passende Strafe legen
        return stackMoves[stackMoves.length - 1];
      }
      return moves.find((m) => m.type === 'draw') ?? moves[0];
    }

    // 3. Wenn die 7er-Regel aktiv ist und getauscht werden kann:
    const swapMoves = moves.filter(
      (m): m is Extract<UnoMove, { type: 'play' }> => m.type === 'play' && m.targetPlayer !== undefined,
    );
    if (swapMoves.length > 0) {
      // Finde den Gegner mit den wenigsten Karten
      let bestTarget = -1;
      let minCards = 999;
      for (let s = 0; s < view.hands.length; s++) {
        if (s !== actor && !view.eliminated[s] && view.hands[s].length < minCards) {
          minCards = view.hands[s].length;
          bestTarget = s;
        }
      }
      // Nur tauschen, wenn der Gegner deutlich weniger Karten hat
      if (bestTarget !== -1 && minCards < hand.length) {
        const move = swapMoves.find((m) => m.targetPlayer === bestTarget);
        if (move) return move;
      }
    }

    // 4. Spielbare Karten filtern
    const playMoves = moves.filter((m) => m.type === 'play');
    if (playMoves.length === 0) {
      return moves.find((m) => m.type === 'draw') ?? moves.find((m) => m.type === 'pass') ?? moves[0];
    }

    // Heuristik je nach Schwierigkeitsgrad
    if (level === 'easy') {
      return rng.pick(playMoves);
    }

    const bestColor = mostFrequentColor(hand, side);

    // Auf 'medium' und 'hard':
    // Karten bewerten
    const scored = playMoves.map((m) => {
      let score = 0;
      const card = hand.find((c) => c.id === m.cardId);
      if (!card) return { move: m, score: -1 };

      const face = getActiveFace(card, side);

      // Eigene Mehrheitsfarbe bevorzugen
      if (face.color === bestColor) score += 10;

      // Farbkarten vor Jokern loswerden (Joker für Notfall aufsparen)
      if (face.color !== 'wild') score += 5;

      // Aktionskarten taktisch spielen
      if (face.type === 'skip' || face.type === 'draw2' || face.type === 'skipAll') {
        score += 8;
      }

      // Bei Farbwahl bevorzugt die eigene stärkste Farbe wählen
      if (m.chosenColor === bestColor) {
        score += 15;
      }

      return { move: m, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.move ?? playMoves[0];
  },
  delayMs(ctx) {
    return ctx.move.type === 'catchUno' ? 3000 : 0;
  },
};
