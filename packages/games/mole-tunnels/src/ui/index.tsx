/**
 * Platzhalter-Oberfläche für Maulwurfsgänge (M1): zeigt das Brett als einfaches Raster aus Zeichen
 * und lässt Schieben und Laufen über Knöpfe zu. Das richtige Brett mit SVG-Gängen folgt in M3.
 */
import type { SeatId } from '@brett-und-blatt/engine';
import type { BoardProps, GameUi } from '@brett-und-blatt/ui';
import { describeMove } from '../describe';
import { tileMask, type MoleMove, type MoleState, type Tile } from '../rules';
import './styles.css';

const SEAT_NAMES = ['Rot', 'Blau', 'Grün', 'Gelb'];
const SEAT_COLORS = ['#c0392b', '#2c6fbb', '#2e8b57', '#c9a227'];

/** Zeichen je Öffnungsmaske (N = 1, E = 2, S = 4, W = 8). */
const GLYPHS: Record<number, string> = { 5: '┃', 10: '━', 3: '┗', 6: '┏', 12: '┓', 9: '┛', 11: '┻', 7: '┣', 14: '┳', 13: '┫' };

function TileView({ tile }: { tile: Tile }) {
  return (
    <span className="mt-tile-glyph" aria-hidden="true">
      {GLYPHS[tileMask(tile)] ?? '?'}
      {tile.turnip && <span className="mt-turnip">🥕</span>}
      {tile.mole && <span className="mt-mole">🦫</span>}
    </span>
  );
}

function Board({ view, legalMoves, onMove }: BoardProps<MoleState, MoleMove>) {
  const walks = new Map<number, MoleMove>();
  const pushes: MoleMove[] = [];
  for (const move of legalMoves) {
    if (move.type === 'walk') walks.set(move.to[0] * view.size + move.to[1], move);
    else pushes.push(move);
  }
  return (
    <div className="mt-board">
      <div className="mt-grid" style={{ gridTemplateColumns: `repeat(${view.size}, 1fr)` }} role="group" aria-label="Spielfeld">
        {view.cells.map((tile, index) => {
          const row = Math.floor(index / view.size);
          const col = index % view.size;
          const haresHere = view.hares.flatMap((pos, seat) => (pos[0] === row && pos[1] === col ? [seat] : []));
          const move = walks.get(index);
          return (
            <button
              key={tile.id}
              type="button"
              className={`mt-cell${move ? ' mt-cell-reach' : ''}`}
              disabled={!move}
              aria-label={move ? describeMove(view, move) : `Zeile ${row + 1}, Spalte ${col + 1}`}
              onClick={() => move && onMove(move)}
            >
              <TileView tile={tile} />
              {haresHere.map((seat) => (
                <span key={seat} className="mt-hare" style={{ color: SEAT_COLORS[seat] }}>
                  ●
                </span>
              ))}
            </button>
          );
        })}
      </div>
      <div className="mt-spare">
        <span>Freiteil: </span>
        <TileView tile={view.spare} />
      </div>
      {pushes.length > 0 && (
        <div className="mt-pushes" role="group" aria-label="Einschieben">
          {pushes.map((move) => {
            const text = describeMove(view, move);
            return (
              <button key={text} type="button" className="mt-push" onClick={() => onMove(move)}>
                {text}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SeatSymbol({ seat, className = '' }: { seat: SeatId; className?: string }) {
  return (
    <span className={className} style={{ color: SEAT_COLORS[seat] }} aria-hidden="true">
      ●
    </span>
  );
}

export const gameUi: GameUi<MoleState, MoleMove> = {
  Board,
  SeatSymbol,
  seatLabel: (seat) => SEAT_NAMES[seat] ?? `Platz ${seat + 1}`,
  seatScore: (view, seat) => view.harvested[seat] ?? 0,
};
