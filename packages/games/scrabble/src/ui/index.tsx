import { GridBoard, usePointerDrag, type BoardProps, type GameUi } from '@brett-und-blatt/ui';
import { useState } from 'react';
import { BOARD_SIZE, squareTypeAt, type SquareType } from '../board';
import { LETTER_VALUES, type Letter, type Tile } from '../letters';
import { checkPlay, EXCHANGE_MIN_BAG, type PlacedTile, type ScrabbleMove, type ScrabbleState } from '../rules';
import './styles.css';

const N = BOARD_SIZE;
const LETTERS = Object.keys(LETTER_VALUES) as Letter[];
const SQUARE_LABEL: Record<SquareType, string> = { normal: '', dl: '2B', tl: '3B', dw: '2W', tw: '3W', star: '★' };
const SQUARE_NAME: Record<SquareType, string> = {
  normal: '',
  dl: 'doppelter Buchstabenwert',
  tl: 'dreifacher Buchstabenwert',
  dw: 'doppelter Wortwert',
  tw: 'dreifacher Wortwert',
  star: 'Mittelfeld',
};
const coord = (row: number, col: number) => `${String.fromCharCode(65 + col)}${row + 1}`;

interface Pending extends PlacedTile {
  /** Platz auf dem Bänkchen, von dem der Stein kam. */
  slot: number;
}

function TileFace({ letter, blank, className = '' }: { letter: string; blank?: boolean; className?: string }) {
  const value = blank || letter === '?' ? null : LETTER_VALUES[letter as Letter];
  return (
    <span className={`wg-tile ${blank ? 'wg-blank' : ''} ${className}`}>
      <span className="wg-letter">{letter === '?' ? '' : letter}</span>
      {value !== null && <span className="wg-value">{value}</span>}
    </span>
  );
}

function Board({ view, legalMoves, onMove, viewer, hint, seatNames }: BoardProps<ScrabbleState, ScrabbleMove>) {
  const seat = typeof viewer === 'number' ? viewer : null;
  const rack = (seat !== null ? view.racks[seat] : [])?.filter((t): t is Tile => t !== null) ?? [];
  const myTurn = legalMoves.length > 0;

  const [pending, setPending] = useState<Pending[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [blankFor, setBlankFor] = useState<{ row: number; col: number; slot: number } | null>(null);
  const [swapMode, setSwapMode] = useState(false);
  const [swapSlots, setSwapSlots] = useState<number[]>([]);
  const [order, setOrder] = useState<number[]>(() => rack.map((_, i) => i));
  const rackKey = `${viewer}|${rack.join('')}|${view.moveCount}`;
  const [lastKey, setLastKey] = useState(rackKey);
  if (lastKey !== rackKey) {
    setLastKey(rackKey);
    setPending([]);
    setSelected(null);
    setBlankFor(null);
    setSwapMode(false);
    setSwapSlots([]);
    setOrder(rack.map((_, i) => i));
  }

  const used = new Set(pending.map((p) => p.slot));
  const pendingAt = (row: number, col: number) => pending.find((p) => p.row === row && p.col === col);
  const check = pending.length > 0 ? checkPlay(view.board, pending, view.bingoBonus) : null;
  const hintTiles = pending.length === 0 && hint?.type === 'play' ? hint.tiles : [];
  const lastCells = new Set(view.lastMove?.cells ?? []);

  const place = (row: number, col: number, slot: number) => {
    if (view.board[row * N + col] || pendingAt(row, col)) return false;
    const tile = rack[slot]!;
    if (tile === '?') {
      setBlankFor({ row, col, slot });
      return true;
    }
    setPending([...pending, { row, col, letter: tile, slot }]);
    setSelected(null);
    return true;
  };

  const { dragState, bindDrag } = usePointerDrag<number>({
    threshold: 6,
    onDrop: (slot, targetId) => {
      if (!targetId?.startsWith('wg-')) return false;
      const [row, col] = targetId.slice(3).split('-').map(Number);
      return place(row!, col!, slot);
    },
  });

  const tapCell = (row: number, col: number) => {
    const own = pendingAt(row, col);
    if (own) {
      setPending(pending.filter((p) => p !== own));
      return;
    }
    if (selected !== null) place(row, col, selected);
  };

  const tapRack = (slot: number) => {
    if (!myTurn) return;
    if (swapMode) {
      setSwapSlots(swapSlots.includes(slot) ? swapSlots.filter((s) => s !== slot) : [...swapSlots, slot]);
      return;
    }
    setSelected(selected === slot ? null : slot);
  };

  const canExchange = myTurn && view.bag.length >= EXCHANGE_MIN_BAG;
  const playMove: ScrabbleMove | null = check?.ok ? { type: 'play', tiles: pending.map(({ slot: _slot, ...t }) => t) } : null;
  const names = (s: number) => seatNames[s] ?? `Platz ${s + 1}`;

  const last = view.lastMove;
  const lastText = !last
    ? 'Das erste Wort muss über das Mittelfeld ★.'
    : last.kind === 'pass'
      ? `${names(last.seat)} hat gepasst.`
      : last.kind === 'exchange'
        ? `${names(last.seat)} hat ${last.count} ${last.count === 1 ? 'Stein' : 'Steine'} getauscht.`
        : `${names(last.seat)}: ${last.words.map((w) => w.word).join(', ')} (+${last.score})`;

  const info = swapMode
    ? 'Steine zum Tauschen antippen'
    : check
      ? check.ok
        ? `${check.words.map((w) => w.word).join(', ')}: ${check.score} Punkte${check.bingo ? ' mit Prämie' : ''}`
        : check.reason
      : myTurn
        ? selected !== null
          ? 'Feld antippen'
          : 'Stein wählen oder aufs Brett ziehen'
        : view.final
          ? 'Partie beendet'
          : `${names(view.turn)} ist am Zug`;

  return (
    <div className="wg-layout">
      <div className="wg-status">
        <span>{lastText}</span>
        <span className="wg-bag">Beutel: {view.bag.length}</span>
      </div>

      <div className="wg-board-wrap">
        <GridBoard
          cols={N}
          rows={N}
          label="Spielbrett"
          className="wg-board"
          renderCell={(col, row) => {
            const cell = view.board[row * N + col];
            if (cell) return <TileFace letter={cell.letter} blank={cell.blank} />;
            const own = pendingAt(row, col);
            if (own) return <TileFace letter={own.letter} blank={own.blank} className="wg-pending" />;
            const ghost = hintTiles.find((t) => t.row === row && t.col === col);
            if (ghost) return <TileFace letter={ghost.letter} blank={ghost.blank} className="wg-ghost" />;
            const square = squareTypeAt(row, col);
            return square !== 'normal' ? <span className="wg-premium">{SQUARE_LABEL[square]}</span> : null;
          }}
          isActive={(col, row) => !!pendingAt(row, col) || (myTurn && !swapMode && selected !== null && !view.board[row * N + col])}
          onActivate={(col, row) => tapCell(row, col)}
          cellClassName={(col, row) => {
            const i = row * N + col;
            return `wg-sq-${squareTypeAt(row, col)} ${lastCells.has(i) ? 'wg-last' : ''}`;
          }}
          cellProps={(col, row) => ({
            'data-drop-target': view.board[row * N + col] ? undefined : `wg-${row}-${col}`,
            'data-drop-active': dragState.isDragging && dragState.targetId === `wg-${row}-${col}` ? 'true' : undefined,
          })}
          cellLabel={(col, row) => {
            const cell = view.board[row * N + col] ?? pendingAt(row, col);
            const square = squareTypeAt(row, col);
            return `${coord(row, col)}: ${cell ? cell.letter : 'frei'}${square !== 'normal' ? `, ${SQUARE_NAME[square]}` : ''}`;
          }}
        />
      </div>

      {seat !== null && !view.final && (
        <div className="wg-rack" role="group" aria-label="Dein Bänkchen">
          {order
            .filter((slot) => slot < rack.length && !used.has(slot))
            .map((slot) => {
              const tile = rack[slot]!;
              const dragged = (dragState.isDragging || dragState.snapping) && dragState.item === slot;
              const bind = myTurn && !swapMode ? bindDrag(slot) : undefined;
              const chosen = selected === slot || swapSlots.includes(slot);
              return (
                <button
                  key={slot}
                  type="button"
                  className="wg-rack-tile"
                  data-selected={chosen || undefined}
                  disabled={!myTurn}
                  aria-pressed={chosen}
                  aria-label={tile === '?' ? 'Joker' : `${tile}, ${LETTER_VALUES[tile]} Punkte`}
                  onClick={() => tapRack(slot)}
                  onPointerDown={bind?.onPointerDown}
                  style={{
                    transform: dragged ? `translate3d(${dragState.delta.x}px, ${dragState.delta.y}px, 0)` : undefined,
                    zIndex: dragged ? 1000 : undefined,
                    position: dragged ? 'relative' : undefined,
                    touchAction: bind ? 'none' : undefined,
                  }}
                >
                  <TileFace letter={tile} blank={tile === '?'} />
                </button>
              );
            })}
        </div>
      )}

      {blankFor && (
        <div className="wg-blank-picker" role="dialog" aria-label="Buchstaben für den Joker wählen">
          <div className="wg-blank-title">Welcher Buchstabe soll der Joker sein?</div>
          <div className="wg-blank-grid">
            {LETTERS.map((letter) => (
              <button
                key={letter}
                type="button"
                className="wg-button"
                onClick={() => {
                  setPending([...pending, { row: blankFor.row, col: blankFor.col, letter, blank: true, slot: blankFor.slot }]);
                  setBlankFor(null);
                  setSelected(null);
                }}
              >
                {letter}
              </button>
            ))}
          </div>
          <button type="button" className="wg-button" onClick={() => setBlankFor(null)}>
            Abbrechen
          </button>
        </div>
      )}

      <div className="wg-bar" aria-live="polite">
        <span className="wg-info" data-error={check && !check.ok ? 'true' : undefined}>
          {info}
        </span>
        {myTurn && !swapMode && pending.length > 0 && (
          <>
            <button type="button" className="wg-button" onClick={() => setPending([])}>
              Zurück
            </button>
            <button type="button" className="wg-button wg-primary" disabled={!playMove} onClick={() => playMove && onMove(playMove)}>
              Legen
            </button>
          </>
        )}
        {myTurn && !swapMode && pending.length === 0 && (
          <>
            <button type="button" className="wg-button" onClick={() => setOrder(shuffled(order))} aria-label="Bänkchen mischen">
              Mischen
            </button>
            {canExchange && (
              <button type="button" className={`wg-button ${hint?.type === 'exchange' ? 'wg-primary' : ''}`} onClick={() => (setSwapMode(true), setSelected(null))}>
                Tauschen
              </button>
            )}
            <button type="button" className={`wg-button ${hint?.type === 'pass' ? 'wg-primary' : ''}`} onClick={() => onMove({ type: 'pass' })}>
              Passen
            </button>
          </>
        )}
        {swapMode && (
          <>
            <button type="button" className="wg-button" onClick={() => (setSwapMode(false), setSwapSlots([]))}>
              Abbrechen
            </button>
            <button
              type="button"
              className="wg-button wg-primary"
              disabled={swapSlots.length === 0}
              onClick={() => onMove({ type: 'exchange', tiles: swapSlots.map((s) => rack[s]!) })}
            >
              {swapSlots.length || ''} tauschen
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function shuffled(list: number[]): number[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

const SEAT_LETTERS = ['W', 'O', 'R', 'T'];

export const gameUi: GameUi<ScrabbleState, ScrabbleMove> = {
  Board,
  SeatSymbol: ({ seat, className = '' }) => <TileFace letter={SEAT_LETTERS[seat % 4]!} className={`wg-symbol ${className}`} />,
  seatLabel: (seat) => `Platz ${seat + 1}`,
  seatDetail: (view, seat) => `${(view.final ?? view.scores)[seat]} Punkte · ${view.racks[seat]?.length ?? 0} Steine`,
  sounds: { played: 'plaettchen-setzen', exchanged: 'mischen' },
};
