/**
 * Die Oberfläche von Tic-Tac-Toe. Sie zeigt nur die Sicht (`view`) an und meldet
 * Züge über `onMove` – ob ein Zug erlaubt ist, entscheidet allein das Regelwerk.
 */
import type { SeatId } from '@brett-und-blatt/engine';
import { FitBox, GridBoard, type BoardProps, type GameUi } from '@brett-und-blatt/ui';
import type { TicTacToeMove, TicTacToeState } from '../rules';
import './styles.css';

const LABELS = ['Kreuz', 'Kreis'];

function Mark({ seat }: { seat: SeatId }) {
  return seat === 0 ? (
    <svg viewBox="0 0 100 100" className="ttt-mark ttt-x" aria-hidden="true">
      <path d="M24 24 L76 76" />
      <path d="M76 24 L24 76" />
    </svg>
  ) : (
    <svg viewBox="0 0 100 100" className="ttt-mark ttt-o" aria-hidden="true">
      <circle cx="50" cy="50" r="28" />
    </svg>
  );
}

function Board({ view, legalMoves, onMove }: BoardProps<TicTacToeState, TicTacToeMove>) {
  const playable = new Set(legalMoves.map((move) => move.cell));
  const winning = new Set(view.winLine ?? []);
  const cellAt = (col: number, row: number) => row * 3 + col;

  return (
    <FitBox ratio={1}>
      <GridBoard
        cols={3}
        rows={3}
        label="Spielfeld"
        className="ttt-board"
        renderCell={(col, row) => {
          const seat = view.board[cellAt(col, row)];
          return seat === null || seat === undefined ? null : <Mark seat={seat} />;
        }}
        isActive={(col, row) => playable.has(cellAt(col, row))}
        onActivate={(col, row) => onMove({ type: 'place', cell: cellAt(col, row) })}
        cellClassName={(col, row) => (winning.has(cellAt(col, row)) ? 'ttt-win' : '')}
        cellLabel={(col, row) => {
          const seat = view.board[cellAt(col, row)];
          return `Reihe ${row + 1}, Spalte ${col + 1}: ${seat === null || seat === undefined ? 'frei' : LABELS[seat]}`;
        }}
      />
    </FitBox>
  );
}

function SeatSymbol({ seat, className = '' }: { seat: SeatId; className?: string }) {
  return (
    <span className={className}>
      <Mark seat={seat} />
    </span>
  );
}

export const gameUi: GameUi<TicTacToeState, TicTacToeMove> = {
  Board,
  SeatSymbol,
  sounds: { placed: 'stein-setzen' },
  seatLabel: (seat) => LABELS[seat] ?? `Platz ${seat + 1}`,
};
