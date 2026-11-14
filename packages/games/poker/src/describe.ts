/** Zugtexte (#335, #358): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser und die VR-App. */
import type { PokerMove, PokerView } from './rules';

export function describeMove(_view: PokerView, move: PokerMove): string {
  switch (move.type) {
    case 'fold':
      return 'Passen (Fold)';
    case 'check':
      return 'Schieben (Check)';
    case 'call':
      return 'Mitgehen';
    case 'bet':
      return `Setzen: ${move.amount}`;
    case 'raise':
      return `Erhöhen auf ${move.to}`;
    case 'allIn':
      return 'Alles setzen (All-in)';
    case 'joinSeat':
      return `Platz ${move.seat + 1} einnehmen`;
    case 'leaveSeat':
      return `Platz ${move.seat + 1} verlassen`;
  }
}
