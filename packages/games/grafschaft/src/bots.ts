import { type BotDefinition, type SeatId } from '@brett-und-blatt/engine';
import {
  checkQuestCondition,
  getNeighbors,
  hexKey,
  legalMoves,
  type GrafschaftMove,
  type GrafschaftState,
  type PlacedTile,
} from './rules';

/**
 * Bot „Landvogt“:
 * - leicht: wählt Plättchen und Feld zufällig.
 * - mittel: maximiert sofortige Dorf-Punkte und erfüllt Aufträge direkt.
 * - schwer: bewertet zusätzlich Kettenbildung (Wege, Flüsse, Gewässer), Flächenwachstum und Nachbarschaftsdichte.
 */
export const grafschaftBot: BotDefinition<GrafschaftState, GrafschaftMove> = {
  id: 'grafschaft',
  name: 'Landvogt',
  levels: ['easy', 'medium', 'hard'],
  chooseMove({ view, seat, level, rng }) {
    const moves = legalMoves(view, seat);
    if (moves.length === 0) {
      throw new Error('Keine Züge möglich');
    }
    if (level === 'easy') {
      return rng.pick(moves);
    }

    let bestMove = moves[0]!;
    let bestScore = -Infinity;

    // Für Gleichstand-Abwechslung
    const shuffledMoves = rng.shuffle(moves);

    for (const move of shuffledMoves) {
      const tile = view.market[move.marketIndex];
      if (!tile) continue;

      const posKey = hexKey(move.q, move.r);
      const hypotheticalBoard: Record<string, PlacedTile> = {
        ...view.board,
        [posKey]: {
          ...tile,
          q: move.q,
          r: move.r,
          owner: seat,
        },
      };

      let score = 0;

      // 1. Sofortige Dorf-Vielfalt
      if (tile.type === 'dorf') {
        const neighbors = getNeighbors(hypotheticalBoard, move.q, move.r);
        const types = new Set(neighbors.map((n) => n.type));
        score += types.size * 3;
      }

      // 2. Erfüllte Aufträge
      const ownQuests = view.playerQuests[seat] ?? [];
      for (const quest of ownQuests) {
        if (checkQuestCondition(quest.id, hypotheticalBoard)) {
          score += quest.points * 6;
        }
      }

      // 3. Zusätzliche Heuristiken für „schwer“
      if (level === 'hard') {
        const neighbors = getNeighbors(hypotheticalBoard, move.q, move.r);

        // Kompaktheit (mehr Nachbarn schließen Lücken)
        score += neighbors.length * 0.8;

        // Zusammenhängende gleiche Landschaften fördern
        const sameTypeNeighbors = neighbors.filter((n) => n.type === tile.type).length;
        score += sameTypeNeighbors * 0.6;

        // Fluss- und Wegverbindungen
        if (tile.river && neighbors.some((n) => n.river)) {
          score += 1.2;
        }
        if (tile.road && neighbors.some((n) => n.road)) {
          score += 1.0;
        }

        // Mühle neben Wasser/Feld
        if (tile.mill && neighbors.some((n) => n.type === 'teich' || n.river)) {
          score += 1.5;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    return bestMove;
  },
};
