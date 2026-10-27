/**
 * Analyse von Fesselungen und Schachbeschränkungen für Vierer-Schach.
 * Ermittelt, warum eine Figur nicht ziehen darf oder warum ein Zielfeld
 * den eigenen König im Schach belassen bzw. ins Schach setzen würde.
 */
import {
  attackers,
  enemiesOf,
  findKing,
  inCheck,
  squareName,
} from '../legacy/engine';
import type { Color, FourChessMove, FourChessState, Piece } from '../rules';

type PieceType = Piece['t'];

export interface CheckWarning {
  text: string;
  pinnedSquare?: number;
  kingSquare?: number;
  attackerSquares?: number[];
}

const PIECE_NAMES: Record<PieceType, string> = {
  K: 'König',
  Q: 'Dame',
  R: 'Turm',
  B: 'Läufer',
  N: 'Springer',
  P: 'Bauer',
};

const COLOR_NAMES: Record<Color, string> = {
  r: 'Rot',
  b: 'Blau',
  y: 'Gelb',
  g: 'Grün',
};

function colorName(c: unknown): string {
  return COLOR_NAMES[c as Color] ?? 'Gegner';
}

function pieceName(t: unknown): string {
  return PIECE_NAMES[t as PieceType] ?? 'Figur';
}

export function getCheckWarning(
  state: FourChessState,
  fromIndex: number,
  toIndex: number | null,
  legalMoves: FourChessMove[]
): CheckWarning | null {
  const activeColor = state.turn;
  const piece = state.board[fromIndex];
  if (!piece || piece.d || piece.c !== activeColor) return null;

  const kingSq = findKing(state.board, activeColor);
  if (kingSq < 0) return null;

  const isEnemyAttacker = enemiesOf(state, activeColor);

  // Fall 1: Spieler tippt eine eigene Figur an (noch kein Zielfeld gewählt)
  if (toIndex === null) {
    const hasLegalMoves = legalMoves.some((m) => m.t === 'm' && m.f === fromIndex);
    if (hasLegalMoves) {
      // Prüfen, ob die Figur entlang einer Fesselungslinie gebunden ist
      const tempBoard = state.board.slice();
      tempBoard[fromIndex] = null;
      const testKingSq = piece.t === 'K' ? -1 : findKing(tempBoard, activeColor);
      if (testKingSq >= 0) {
        const withoutPiece = attackers(tempBoard, testKingSq, isEnemyAttacker);
        const original = attackers(state.board, testKingSq, isEnemyAttacker);
        const pinning = withoutPiece.filter((a) => !original.some((o) => o.sq === a.sq));
        if (pinning.length > 0) {
          const att = pinning[0]!;
          return {
            text: `Diese Figur ist gefesselt: Sie kann nur entlang der Fesselungslinie von ${colorName(att.piece.c)} (${pieceName(att.piece.t)} auf ${squareName(att.sq)}) ziehen.`,
            pinnedSquare: fromIndex,
            kingSquare: kingSq,
            attackerSquares: pinning.map((a) => a.sq),
          };
        }
      }
      return null;
    }

    // Figur hat KEINE legalen Züge.
    // A) König steht im Schach -> Schach muss pariert werden
    if (inCheck(state, activeColor)) {
      const currentAtts = attackers(state.board, kingSq, isEnemyAttacker);
      const attDescs = currentAtts.map((a) => `${colorName(a.piece.c)} (${pieceName(a.piece.t)} auf ${squareName(a.sq)})`).join(', ');
      return {
        text: `Dein König steht im Schach durch ${attDescs}! Du musst das Schach abwehren (König ziehen, Angreifer schlagen oder Angriffslinie blockieren).`,
        kingSquare: kingSq,
        attackerSquares: currentAtts.map((a) => a.sq),
      };
    }

    // B) Figur ist an den König gefesselt (absolute Fesselung)
    if (piece.t !== 'K') {
      const tempBoard = state.board.slice();
      tempBoard[fromIndex] = null;
      const testKingSq = findKing(tempBoard, activeColor);
      if (testKingSq >= 0) {
        const newAtts = attackers(tempBoard, testKingSq, isEnemyAttacker);
        if (newAtts.length > 0) {
          const att = newAtts[0]!;
          return {
            text: `Diese Figur ist gefesselt: Sie schützt deinen König vor dem Schach durch ${colorName(att.piece.c)} (${pieceName(att.piece.t)} auf ${squareName(att.sq)}).`,
            pinnedSquare: fromIndex,
            kingSquare: kingSq,
            attackerSquares: newAtts.map((a) => a.sq),
          };
        }
      }
    }

    return null;
  }

  // Fall 2: Spieler versucht Zug von fromIndex nach toIndex
  // Ist der Zug regulär erlaubt?
  if (legalMoves.some((m) => m.t === 'm' && m.f === fromIndex && m.to === toIndex)) {
    return null;
  }

  // 2A: König versucht zu ziehen
  if (piece.t === 'K') {
    // Normaler Königsschritt auf ein angegriffenes Nachbarfeld
    const atts = attackers(state.board, toIndex, isEnemyAttacker);
    if (atts.length > 0) {
      const att = atts[0]!;
      return {
        text: `Der König darf nicht ins Schach ziehen: Feld ${squareName(toIndex)} wird von ${colorName(att.piece.c)} (${pieceName(att.piece.t)} auf ${squareName(att.sq)}) angegriffen.`,
        kingSquare: fromIndex,
        attackerSquares: atts.map((a) => a.sq),
      };
    }

    // Rochade prüfen
    const castleRights = (state.castle as Record<Color, number[]> | undefined)?.[activeColor];
    if (castleRights && castleRights.length > 0) {
      if (inCheck(state, activeColor)) {
        return {
          text: 'Rochade nicht möglich: Der König steht im Schach.',
          kingSquare: fromIndex,
          attackerSquares: attackers(state.board, kingSq, isEnemyAttacker).map((a) => a.sq),
        };
      }
      for (const rookSq of castleRights) {
        const step = Math.sign(Math.floor(rookSq / 14) - Math.floor(fromIndex / 14)) * 14 + Math.sign((rookSq % 14) - (fromIndex % 14));
        if (toIndex === fromIndex + 2 * step) {
          const transitSq = fromIndex + step;
          const transitAtts = attackers(state.board, transitSq, isEnemyAttacker);
          if (transitAtts.length > 0) {
            return {
              text: `Rochade nicht möglich: Der König darf kein angegriffenes Feld überqueren (${squareName(transitSq)} wird angegriffen).`,
              kingSquare: fromIndex,
              attackerSquares: transitAtts.map((a) => a.sq),
            };
          }
        }
      }
    }
  }

  // 2B: Andere Figur versucht zu ziehen
  const tempBoard = state.board.slice();
  tempBoard[fromIndex] = null;
  const testKingSq = findKing(tempBoard, activeColor);
  if (testKingSq >= 0) {
    const withoutPiece = attackers(tempBoard, testKingSq, isEnemyAttacker);
    const original = attackers(state.board, testKingSq, isEnemyAttacker);
    const pinning = withoutPiece.filter((a) => !original.some((o) => o.sq === a.sq));
    if (pinning.length > 0) {
      const att = pinning[0]!;
      return {
        text: `Zug nicht erlaubt: Diese Figur ist gefesselt. Sie schützt deinen König vor ${colorName(att.piece.c)} (${pieceName(att.piece.t)} auf ${squareName(att.sq)}).`,
        pinnedSquare: fromIndex,
        kingSquare: kingSq,
        attackerSquares: pinning.map((a) => a.sq),
      };
    }
  }

  // 2C: König stand schon im Schach
  if (inCheck(state, activeColor)) {
    const currentAtts = attackers(state.board, kingSq, isEnemyAttacker);
    return {
      text: 'Zug nicht erlaubt: Dein König steht im Schach und dieser Zug wehrt das Schach nicht ab.',
      kingSquare: kingSq,
      attackerSquares: currentAtts.map((a) => a.sq),
    };
  }

  return null;
}
