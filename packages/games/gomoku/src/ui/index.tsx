import type { SeatId } from '@brett-und-blatt/engine';
import { FitBox, GridBoard, type BoardProps, type GameUi } from '@brett-und-blatt/ui';
import type { GomokuMove, GomokuState } from '../types';
import './styles.css';

const LABELS = ['Schwarz', 'Weiß'];

function Stone({ seat, win = false }: { seat: SeatId; win?: boolean }) {
  return (
    <span className={`gomoku-stone gomoku-seat-${seat} ${win ? 'gomoku-win' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="42" />
      </svg>
    </span>
  );
}

function Board({ view, legalMoves, onMove }: BoardProps<GomokuState, GomokuMove>) {
  const playable = new Set(legalMoves.map((move) => move.cell));
  const winning = new Set(view.winLine ?? []);
  const size = view.size ?? 15;

  return (
    <FitBox ratio={1}>
      <GridBoard
        cols={size}
        rows={size}
        label="Spielfeld"
        className="gomoku-board"
        renderCell={(col, row) => {
          const cell = row * size + col;
          const seat = view.board[cell];
          return seat === null || seat === undefined ? null : <Stone seat={seat} win={winning.has(cell)} />;
        }}
        isActive={(col, row) => playable.has(row * size + col)}
        onActivate={(col, row) => onMove({ type: 'place', cell: row * size + col })}
        cellClassName={(col, row) => (winning.has(row * size + col) ? 'gomoku-win-cell' : '')}
        cellLabel={(col, row) => {
          const cell = row * size + col;
          const seat = view.board[cell];
          return `Reihe ${row + 1}, Spalte ${col + 1}: ${seat === null || seat === undefined ? 'frei' : LABELS[seat]}`;
        }}
      />
    </FitBox>
  );
}

function SeatSymbol({ seat, className = '' }: { seat: SeatId; className?: string }) {
  return (
    <span className={className}>
      <Stone seat={seat} />
    </span>
  );
}

export const gameUi: GameUi<GomokuState, GomokuMove> = {
  Board,
  SeatSymbol,
  sounds: { placed: 'stein-schiefer', win: 'gomoku-fuenf' },
  seatLabel: (seat) => LABELS[seat] ?? `Platz ${seat + 1}`,
};
