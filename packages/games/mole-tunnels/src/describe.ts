/** Zugtexte (#335): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser. */
import { tileAt, type MoleMove, type MoleState, type Side } from './rules';

export const KIND_NAMES = { I: 'Gerade', L: 'Kurve', T: 'Abzweig' } as const;

const SIDE_TEXT: Record<Side, string> = {
  top: 'von oben in Spalte',
  bottom: 'von unten in Spalte',
  left: 'von links in Zeile',
  right: 'von rechts in Zeile',
};

export function describeMove(view: MoleState, move: MoleMove): string {
  if (move.type === 'push') {
    const turns = move.rot === 0 ? 'ohne Drehung' : `${move.rot}× gedreht`;
    return `Gang ${SIDE_TEXT[move.side]} ${move.index + 1} einschieben, ${turns} (${KIND_NAMES[view.spare.kind]})`;
  }
  const [row, col] = move.to;
  const own = view.hares[view.turn];
  const tile = tileAt(view, row, col);
  const harvest = tile.turnip && !tile.mole ? ' und Rübe ernten' : '';
  if (own && own[0] === row && own[1] === col) return `Stehen bleiben${harvest}`;
  return `Zu Zeile ${row + 1}, Spalte ${col + 1} laufen${harvest}`;
}
