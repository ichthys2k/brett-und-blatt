/** Zugtexte (#335, #358): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser und die VR-App. */
import { colorOf, kindOf, shapeOf, type ColorShapeMove, type ColorShapeState, type TileId } from './rules';

const COLOR_NAMES = ['Roter', 'Oranger', 'Gelber', 'Grüner', 'Blauer', 'Lila'];
const SHAPE_NAMES = ['Kreis', 'Quadrat', 'Raute', 'Stern', 'Kreuz', 'Kleeblatt'];

/** Etwa „Roter Kreis“; liegt dasselbe Plättchen zweimal in der Hand, bekommt das zweite „(2)“. */
function tileText(tile: TileId, hand: readonly (TileId | null)[]): string {
  const same = hand.filter((t): t is TileId => t !== null && kindOf(t) === kindOf(tile) && t < tile).length;
  const name = `${COLOR_NAMES[colorOf(tile)]} ${SHAPE_NAMES[shapeOf(tile)]}`;
  return same > 0 ? `${name} (${same + 1})` : name;
}

export function describeMove(view: ColorShapeState, move: ColorShapeMove): string {
  const hand = view.hands.find((h) => move.type !== 'pass' && move.tiles.every((t) => h.includes(typeof t === 'number' ? t : t.tile))) ?? [];
  switch (move.type) {
    case 'place':
      return `Legen: ${move.tiles.map((t) => `${tileText(t.tile, hand)} auf (${t.x}|${t.y})`).join(', ')}`;
    case 'swap':
      return `Tauschen: ${move.tiles.map((t) => tileText(t, hand)).join(', ')}`;
    case 'pass':
      return 'Passen';
  }
}
