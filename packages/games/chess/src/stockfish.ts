import type { ChessMove, Promotion } from './rules';

const UCI_MOVE = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/;

/**
 * Wandelt einen Zug im UCI-Format (z. B. `e2e4` oder `e7e8q`) in einen `ChessMove` um.
 * Gibt `null` zurück, wenn der Text kein gültiger UCI-Zug ist.
 */
export function parseUciMove(uci: string): ChessMove | null {
  const match = UCI_MOVE.exec(uci.trim());
  if (!match) return null;
  const from = match[1]!;
  const to = match[2]!;
  const promotion = match[3] as Promotion | undefined;
  return promotion ? { type: 'move', from, to, promotion } : { type: 'move', from, to };
}
