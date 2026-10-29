/**
 * Analyse von Fesselungen und Schachbeschränkungen für das Standard-Schach.
 * Ermittelt, warum eine Figur nicht ziehen darf oder warum ein Zielfeld
 * den eigenen König im Schach belassen bzw. ins Schach setzen würde.
 */
import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js';
import type { BoardMove } from '../rules';

export interface CheckWarning {
  text: string;
  pinnedSquare?: number;
  kingSquare?: number;
  attackerSquares?: number[];
}

const PIECE_NAMES: Record<PieceSymbol, string> = {
  k: 'König',
  q: 'Dame',
  r: 'Turm',
  b: 'Läufer',
  n: 'Springer',
  p: 'Bauer',
};

const FILES = 'abcdefgh';

export function squareName(index: number): Square {
  const file = FILES[index % 8] ?? 'a';
  const rank = 8 - Math.floor(index / 8);
  return `${file}${rank}` as Square;
}

export function squareIndex(name: string): number {
  const file = FILES.indexOf(name[0] ?? 'a');
  const rank = Number(name[1] ?? '1');
  return (8 - rank) * 8 + file;
}

function findKingSquare(chess: Chess, color: Color): Square | null {
  for (let r = 8; r >= 1; r--) {
    for (let c = 0; c < 8; c++) {
      const sq = `${FILES[c]}${r}` as Square;
      const p = chess.get(sq);
      if (p && p.type === 'k' && p.color === color) return sq;
    }
  }
  return null;
}

/**
 * Ermittelt eine verständliche Erklärung, wenn ein Zug oder eine Figurenauswahl
 * wegen des Schachgebots (Fesselung, König im Schach, König zieht ins Schach) nicht erlaubt ist.
 */
export function getCheckWarning(
  fen: string,
  fromIndex: number,
  toIndex: number | null,
  legalMoves: BoardMove[]
): CheckWarning | null {
  const chess = new Chess(fen);
  const activeColor: Color = fen.split(' ')[1] === 'w' ? 'w' : 'b';
  const enemyColor: Color = activeColor === 'w' ? 'b' : 'w';

  const fromSq = squareName(fromIndex);
  const piece = chess.get(fromSq);
  if (!piece || piece.color !== activeColor) return null;

  const kingSq = findKingSquare(chess, activeColor);
  if (!kingSq) return null;
  const kingIndex = squareIndex(kingSq);

  // Fall 1: Spieler tippt eine eigene Figur an (noch kein Zielfeld gewählt)
  if (toIndex === null) {
    const hasLegalMoves = legalMoves.some((m) => m.from === fromSq);
    if (hasLegalMoves) {
      // Figur kann ziehen, aber ist sie vielleicht dennoch entlang der Fesselungslinie gefesselt?
      const testChess = new Chess(fen);
      testChess.remove(fromSq);
      const testKingSq = piece.type === 'k' ? null : findKingSquare(testChess, activeColor);
      if (testKingSq) {
        const newAttackers = testChess.attackers(testKingSq, enemyColor);
        const originalAttackers = chess.attackers(testKingSq, enemyColor);
        const pinningAttackers = newAttackers.filter((a) => !originalAttackers.includes(a));
        if (pinningAttackers.length > 0) {
          const attSq = pinningAttackers[0]!;
          const attPiece = testChess.get(attSq);
          const attName = attPiece ? PIECE_NAMES[attPiece.type] : 'Figur';
          return {
            text: `Diese Figur ist gefesselt: Sie kann nur entlang der Fesselungslinie ziehen (Schutz vor gegnerischem ${attName} auf ${attSq}).`,
            pinnedSquare: fromIndex,
            kingSquare: kingIndex,
            attackerSquares: pinningAttackers.map(squareIndex),
          };
        }
      }
      return null;
    }

    // Figur hat KEINE legalen Züge. Warum?
    // A) König steht aktuell im Schach -> Schachparade ist nötig
    if (chess.inCheck()) {
      const currentAttackers = chess.attackers(kingSq, enemyColor);
      return {
        text: 'Dein König steht im Schach! Du musst das Schach abwehren (König ziehen, Angreifer schlagen oder Angriffslinie blockieren).',
        kingSquare: kingIndex,
        attackerSquares: currentAttackers.map(squareIndex),
      };
    }

    // B) Figur ist an den König gefesselt (absolute Fesselung)
    if (piece.type !== 'k') {
      const testChess = new Chess(fen);
      testChess.remove(fromSq);
      const testKingSq = findKingSquare(testChess, activeColor);
      if (testKingSq) {
        const newAttackers = testChess.attackers(testKingSq, enemyColor);
        if (newAttackers.length > 0) {
          const attSq = newAttackers[0]!;
          const attPiece = testChess.get(attSq);
          const attName = attPiece ? PIECE_NAMES[attPiece.type] : 'Figur';
          return {
            text: `Diese Figur ist gefesselt: Sie schützt deinen König vor dem Schach durch den gegnerischen ${attName} auf ${attSq}.`,
            pinnedSquare: fromIndex,
            kingSquare: kingIndex,
            attackerSquares: newAttackers.map(squareIndex),
          };
        }
      }
    }

    return null;
  }

  // Fall 2: Spieler versucht von fromIndex nach toIndex zu ziehen
  const toSq = squareName(toIndex);

  // Ist der Zug bereits regulär erlaubt?
  if (legalMoves.some((m) => m.from === fromSq && m.to === toSq)) {
    return null;
  }

  // 2A: König versucht zu ziehen
  if (piece.type === 'k') {
    // Rochade-Versuch prüfen
    const isCastling = (fromSq === 'e1' && (toSq === 'g1' || toSq === 'c1')) || (fromSq === 'e8' && (toSq === 'g8' || toSq === 'c8'));
    if (isCastling) {
      if (chess.inCheck()) {
        const atts = chess.attackers(kingSq, enemyColor);
        return {
          text: 'Rochade nicht möglich: Der König steht im Schach.',
          kingSquare: kingIndex,
          attackerSquares: atts.map(squareIndex),
        };
      }
      const transitSq = toSq === 'g1' ? 'f1' : toSq === 'c1' ? 'd1' : toSq === 'g8' ? 'f8' : 'd8';
      if (chess.isAttacked(transitSq, enemyColor)) {
        const atts = chess.attackers(transitSq, enemyColor);
        return {
          text: `Rochade nicht möglich: Der König darf kein angegriffenes Feld überqueren (${transitSq} wird angegriffen).`,
          kingSquare: kingIndex,
          attackerSquares: atts.map(squareIndex),
        };
      }
      if (chess.isAttacked(toSq, enemyColor)) {
        const atts = chess.attackers(toSq, enemyColor);
        return {
          text: `Rochade nicht möglich: Das Zielfeld ${toSq} wird angegriffen.`,
          kingSquare: kingIndex,
          attackerSquares: atts.map(squareIndex),
        };
      }
    }

    // Normaler Königsschritt auf ein angegriffenes Nachbarfeld
    if (chess.isAttacked(toSq, enemyColor)) {
      const atts = chess.attackers(toSq, enemyColor);
      const attPiece = chess.get(atts[0]!);
      const attName = attPiece ? PIECE_NAMES[attPiece.type] : 'Figur';
      return {
        text: `Der König darf nicht ins Schach ziehen: Feld ${toSq} wird von gegnerischem ${attName} auf ${atts[0]} angegriffen.`,
        kingSquare: fromIndex,
        attackerSquares: atts.map(squareIndex),
      };
    }
  }

  // 2B: Andere Figur zieht
  // Prüfen, ob Fesselung den Zug verbietet
  const testChess = new Chess(fen);
  testChess.remove(fromSq);
  const testKingSq = findKingSquare(testChess, activeColor);
  if (testKingSq) {
    const attackersWithoutPiece = testChess.attackers(testKingSq, enemyColor);
    const originalAttackers = chess.attackers(testKingSq, enemyColor);
    const pinningAttackers = attackersWithoutPiece.filter((a) => !originalAttackers.includes(a));
    if (pinningAttackers.length > 0) {
      const attSq = pinningAttackers[0]!;
      const attPiece = testChess.get(attSq);
      const attName = attPiece ? PIECE_NAMES[attPiece.type] : 'Figur';
      return {
        text: `Zug nicht erlaubt: Diese Figur ist gefesselt. Sie schützt deinen König vor dem Schach durch den gegnerischen ${attName} auf ${attSq}.`,
        pinnedSquare: fromIndex,
        kingSquare: kingIndex,
        attackerSquares: pinningAttackers.map(squareIndex),
      };
    }
  }

  // 2C: König stand schon im Schach und Zug pariert das Schach nicht
  if (chess.inCheck()) {
    const currentAttackers = chess.attackers(kingSq, enemyColor);
    return {
      text: 'Zug nicht erlaubt: Dein König steht im Schach und dieser Zug wehrt das Schach nicht ab.',
      kingSquare: kingIndex,
      attackerSquares: currentAttackers.map(squareIndex),
    };
  }

  return null;
}
