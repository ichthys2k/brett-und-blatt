/** Zugtexte (#335, #358): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser und die VR-App. */
import type { LowFlightMove, LowFlightView } from './rules';

export function describeMove(view: LowFlightView, move: LowFlightMove): string {
  const slot = (s: number) => `Reihe ${Math.floor(s / view.cols) + 1}, Spalte ${(s % view.cols) + 1}`;
  switch (move.type) {
    case 'reveal':
      return `${slot(move.slot)} aufdecken`;
    case 'takeDiscard':
      return 'Ablage nehmen';
    case 'draw':
      return 'Vom Stapel ziehen';
    case 'swap':
      return `Gegen ${slot(move.slot)} tauschen`;
    case 'flip':
      return `Abwerfen und ${slot(move.slot)} aufdecken`;
    case 'discardDrawn':
      return 'Gezogene Karte abwerfen';
    case 'ready':
      return 'Bereit';
    case 'actionPeek':
      return `Bei Platz ${move.targetSeat + 1} ${slot(move.slot)} ansehen`;
    case 'actionSwap':
      return `Eigene ${slot(move.mySlot)} mit Platz ${move.targetSeat + 1} ${slot(move.targetSlot)} tauschen`;
    case 'actionExtraTurn':
      return 'Doppelzug';
    case 'actionDoubleFlip':
      return `${slot(move.slot1)} und ${slot(move.slot2)} aufdecken`;
  }
}
