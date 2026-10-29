import type { SeatId } from '@brett-und-blatt/engine';
import { usePointerDrag, type BoardProps, type GameUi } from '@brett-und-blatt/ui';
import { useState } from 'react';
import { halfLabel, isDouble, pipsOf, STONES, type DominoDisplay, type DominoMove, type DominoState, type StoneId } from '../rules';
import './styles.css';

/** Augenpositionen in einem Feld von 100 × 100. */
const PIPS: Record<number, [number, number][]> = {
  0: [],
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
};

function Half({ n, x, text, upright }: { n: number; x: number; text?: string; upright?: boolean }) {
  if (text !== undefined) {
    const fontSize = text.length > 6 ? 19 : text.length > 4 ? 22 : 26;
    return (
      <g transform={`translate(${x} 0)`}>
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={fontSize}
          className="dm-math-text"
          transform={upright ? 'rotate(-90 50 50)' : undefined}
        >
          {text}
        </text>
      </g>
    );
  }
  return (
    <g transform={`translate(${x} 0)`}>
      {PIPS[n]!.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="9" className="dm-pip" />
      ))}
    </g>
  );
}

/** Ein Dominostein, waagerecht mit `left` links; Pasche stehen quer (`upright`). */
export function Stone({
  left,
  right,
  stone,
  display = 'pips',
  upright,
  className = '',
  label,
}: {
  left: number;
  right: number;
  stone?: StoneId;
  display?: DominoDisplay;
  upright?: boolean;
  className?: string;
  label?: string;
}) {
  const sId = stone ?? 0;
  const orig = STONES[sId];
  const swapped = orig ? orig[0] !== left || orig[1] !== right : false;
  const leftText = display !== 'pips' ? halfLabel(left, display, sId, swapped ? 1 : 0) : undefined;
  const rightText = display !== 'pips' ? halfLabel(right, display, sId, swapped ? 0 : 1) : undefined;
  return (
    <svg viewBox="0 0 200 100" className={`dm-stone ${upright ? 'dm-upright' : ''} ${display !== 'pips' ? 'dm-stone-math' : ''} ${className}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <rect x="2" y="2" width="196" height="96" rx="14" className="dm-face" />
      <line x1="100" y1="12" x2="100" y2="88" className="dm-bar" />
      <Half n={left} x={0} text={leftText} upright={upright} />
      <Half n={right} x={100} text={rightText} upright={upright} />
    </svg>
  );
}

const stoneName = (s: StoneId, display: DominoDisplay = 'pips') => {
  const [a, b] = STONES[s]!;
  if (display === 'pips') return `[${a}|${b}]`;
  return `[${halfLabel(a, display, s, 0)} = ${a} | ${halfLabel(b, display, s, 1)} = ${b}]`;
};

function Board({ view, legalMoves, onMove, viewer, hint, seatNames }: BoardProps<DominoState, DominoMove>) {
  const seat = typeof viewer === 'number' ? viewer : null;
  const hand = seat !== null ? (view.hands[seat] ?? []).filter((s): s is StoneId => s !== null) : [];
  const [selected, setSelected] = useState<StoneId | null>(null);
  const [lastView, setLastView] = useState(view);
  if (lastView !== view) {
    setLastView(view);
    setSelected(null);
  }
  const plays = legalMoves.filter((m): m is Extract<DominoMove, { type: 'play' }> => m.type === 'play');
  const playable = new Set(plays.map((m) => m.stone));
  const endsFor = (stone: StoneId) => plays.filter((m) => m.stone === stone);
  const draw = legalMoves.find((m) => m.type === 'draw');
  const pass = legalMoves.find((m) => m.type === 'pass');
  const hintStone = hint?.type === 'play' ? hint.stone : null;

  const { dragState, bindDrag } = usePointerDrag<StoneId>({
    threshold: 6,
    onDrop: (stone, targetId) => {
      if (!targetId) return false;
      const options = endsFor(stone);
      if (targetId === 'board') {
        if (options.length === 1) {
          onMove(options[0]!);
          return true;
        }
      } else {
        const match = options.find((m) => m.end === targetId);
        if (match) {
          onMove(match);
          return true;
        }
      }
      return false;
    },
  });

  const draggedStone = dragState.isDragging && dragState.item !== null ? dragState.item : null;
  const activeStone = draggedStone ?? selected;

  const tapStone = (stone: StoneId) => {
    const options = endsFor(stone);
    if (options.length === 1) onMove(options[0]!);
    else if (options.length > 1) setSelected(selected === stone ? null : stone);
  };
  const choices = activeStone !== null ? endsFor(activeStone) : [];
  const endButton = (end: 'left' | 'right' | 'up' | 'down') => {
    const move = choices.find((m) => m.end === end);
    if (!move) return null;
    const labels = {
      left: 'Links anlegen',
      right: 'Rechts anlegen',
      up: 'Oben anlegen',
      down: 'Unten anlegen',
    };
    const symbols = {
      left: '◀',
      right: '▶',
      up: '▲',
      down: '▼',
    };
    const isTargetActive = dragState.isDragging && dragState.targetId === end;
    return (
      <button
        type="button"
        className={`dm-end dm-end-${end}`}
        onClick={() => onMove(move)}
        aria-label={labels[end]}
        data-drop-target={end}
        data-drop-active={isTargetActive ? 'true' : undefined}
      >
        {symbols[end]}
      </button>
    );
  };

  const summary = view.lastRound && view.chain.length === 0 ? view.lastRound : null;
  const name = (s: SeatId) => seatNames[s] ?? `Platz ${s + 1}`;

  return (
    <div className="dm-layout">
      <div
        className="dm-table"
        data-drop-target={draggedStone && endsFor(draggedStone).length === 1 ? 'board' : undefined}
        data-drop-active={dragState.isDragging && dragState.targetId === 'board' ? 'true' : undefined}
      >
        {summary && (
          <div className="dm-summary" role="status">
            <strong>
              Runde {summary.round}: {summary.winner === null ? 'gesperrt, niemand punktet' : `${name(summary.winner)} gewinnt +${summary.points}`}
              {summary.blocked && summary.winner !== null ? ' (gesperrt, wenigste Augen)' : ''}
            </strong>
            <div className="dm-reveal">
              {summary.hands.map((h, s) =>
                h.length === 0 ? null : (
                  <span key={s} className="dm-reveal-row">
                    {name(s)}: {h.map((st) => stoneName(st, view.display)).join(' ')} ({h.reduce((sum, st) => sum + pipsOf(st), 0)} Augen)
                  </span>
                ),
              )}
            </div>
          </div>
        )}
        <div className="dm-chain" aria-label="Kette">
          {endButton('left')}
          {view.chain.map((c, i) => {
            const isSpinner = view.spinnerIndex === i;
            const stoneEl = (
              <Stone
                key={`${c.stone}-${i}`}
                stone={c.stone}
                display={view.display}
                left={c.left}
                right={c.right}
                upright={isDouble(c.stone)}
                className={`${view.lastPlayed?.stone === c.stone ? 'dm-last' : ''} ${isSpinner ? 'dm-spinner' : ''}`}
                label={`${c.left} und ${c.right}`}
              />
            );
            if (!isSpinner || (!view.upBranch?.length && !view.downBranch?.length && !choices.some((m) => m.end === 'up' || m.end === 'down'))) {
              return stoneEl;
            }
            return (
              <div key={`spinner-col-${i}`} className="dm-spinner-col">
                {endButton('up')}
                {view.upBranch?.slice().reverse().map((b, bi) => (
                  <Stone key={`up-${b.stone}-${bi}`} stone={b.stone} display={view.display} left={b.right} right={b.left} upright className={view.lastPlayed?.stone === b.stone ? 'dm-last' : ''} />
                ))}
                {stoneEl}
                {view.downBranch?.map((b, bi) => (
                  <Stone key={`down-${b.stone}-${bi}`} stone={b.stone} display={view.display} left={b.left} right={b.right} upright className={view.lastPlayed?.stone === b.stone ? 'dm-last' : ''} />
                ))}
                {endButton('down')}
              </div>
            );
          })}
          {endButton('right')}
          {view.chain.length === 0 && !summary && <p className="dm-empty">Der erste Stein kommt in die Mitte.</p>}
        </div>
      </div>

      <div className="dm-controls" aria-live="polite">
        <span className="dm-info">
          {view.lastPlayed && view.lastPlayed.scored > 0 ? `${name(view.lastPlayed.seat)}: +${view.lastPlayed.scored} Fünferpunkte` : choices.length > 1 ? 'Wähle das Ende' : `Runde ${view.round} · Ziel ${view.target}`}
          <small>{view.variant === 'block' ? 'Block-Domino' : `Vorrat: ${view.boneyard.length}`}</small>
        </span>
        {draw && (
          <button type="button" className="dm-button dm-primary" onClick={() => onMove(draw)}>
            Ziehen
          </button>
        )}
        {pass && (
          <button type="button" className="dm-button dm-primary" onClick={() => onMove(pass)}>
            Passen
          </button>
        )}
      </div>

      {seat !== null && (
        <div className="dm-hand" role="group" aria-label="Deine Steine">
          {hand.map((stone) => {
            const [a, b] = STONES[stone]!;
            const isPlayable = playable.has(stone);
            const isDragged = (dragState.isDragging || dragState.snapping) && dragState.item === stone;
            const dragTransform = isDragged ? `translate3d(${dragState.delta.x}px, ${dragState.delta.y}px, 0)` : undefined;
            const dragBind = isPlayable ? bindDrag(stone) : undefined;
            return (
              <button
                key={stone}
                type="button"
                className={`dm-hand-stone ${isDragged ? 'bub-dragging' : ''} ${dragState.snapping && isDragged ? 'bub-snapping' : ''}`}
                disabled={!isPlayable}
                data-selected={selected === stone || undefined}
                data-hint={hintStone === stone || undefined}
                aria-label={`${stoneName(stone, view.display)}${isPlayable ? '' : ', passt nicht'}`}
                onClick={() => tapStone(stone)}
                onPointerDown={dragBind?.onPointerDown}
                style={{
                  transform: dragTransform,
                  position: isDragged ? 'relative' : undefined,
                  zIndex: isDragged ? 1000 : undefined,
                  touchAction: isPlayable ? 'none' : undefined,
                }}
              >
                <Stone stone={stone} display={view.display} left={a} right={b} upright />
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
    <span className={`dm-symbol ${className}`}>
      <Stone left={seat + 1} right={seat + 1} upright />
    </span>
  );
}

export const gameUi: GameUi<DominoState, DominoMove> = {
  Board,
  SeatSymbol,
  sounds: { played: 'domino-klack', drew: 'stein-ziehen' },
  seatLabel: (seat) => `Platz ${seat + 1}`,
  seatDetail: (view, seat) => `${view.scores[seat]} Pkt. · ${view.hands[seat]?.length ?? 0} St.`,
};
