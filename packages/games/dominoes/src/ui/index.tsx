import type { SeatId } from '@brett-und-blatt/engine';
import { SeatRing, usePointerDrag, type BoardProps, type GameUi } from '@brett-und-blatt/ui';
import { useState } from 'react';
import { halfLabel, isDouble, pipsOf, stoneIdOf, STONES, type ChainStone, type DominoDisplay, type DominoEnd, type DominoMove, type DominoState, type StoneId } from '../rules';
import './styles.css';

/** Augenpositionen in einem Feld von 100 × 100 (für Werte 0 … 12). */
const PIPS: Record<number, [number, number][]> = {
  0: [],
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
  7: [[26, 24], [74, 24], [26, 50], [50, 50], [74, 50], [26, 76], [74, 76]],
  8: [[26, 20], [74, 20], [26, 40], [74, 40], [26, 60], [74, 60], [26, 80], [74, 80]],
  9: [[26, 24], [50, 24], [74, 24], [26, 50], [50, 50], [74, 50], [26, 76], [50, 76], [74, 76]],
  10: [[26, 20], [74, 20], [26, 40], [50, 32], [74, 40], [26, 60], [50, 68], [74, 60], [26, 80], [74, 80]],
  11: [[24, 20], [76, 20], [24, 40], [50, 30], [76, 40], [50, 50], [24, 60], [50, 70], [76, 60], [24, 80], [76, 80]],
  12: [[24, 20], [50, 20], [76, 20], [24, 40], [50, 40], [76, 40], [24, 60], [50, 60], [76, 60], [24, 80], [50, 80], [76, 80]],
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
  const dots = PIPS[n] ?? [];
  const radius = n >= 10 ? 6.5 : n >= 7 ? 7.5 : 9;
  return (
    <g transform={`translate(${x} 0)`}>
      {dots.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={radius} className="dm-pip" />
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
  const sId = stone ?? stoneIdOf(left, right);
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

function Board({ view, legalMoves, onMove, viewer, hint, seatNames, table, handOnly }: BoardProps<DominoState, DominoMove>) {
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
  const name = (s: SeatId) => seatNames[s] ?? `Platz ${s + 1}`;
  const teamLabel = (s: SeatId) => {
    if (!view.teams || view.seats !== 4) return name(s);
    const partner = (s + 2) % 4;
    const lo = Math.min(s, partner);
    const hi = Math.max(s, partner);
    return `Team ${name(lo)} & ${name(hi)}`;
  };

  const endButton = (end: DominoEnd, customLabel?: string) => {
    const move = choices.find((m) => m.end === end);
    if (!move) return null;
    const defaultLabels: Record<string, string> = {
      left: 'Links anlegen',
      right: 'Rechts anlegen',
      up: 'Oben anlegen',
      down: 'Unten anlegen',
      mexican: 'An Mexican Train anlegen',
    };
    const defaultSymbols: Record<string, string> = {
      left: '◀',
      right: '▶',
      up: '▲',
      down: '▼',
      mexican: '🚂',
    };
    const labelText = customLabel ?? defaultLabels[end] ?? 'Anlegen';
    const symbolText = defaultSymbols[end] ?? '▶';
    const isTargetActive = dragState.isDragging && dragState.targetId === end;
    return (
      <button
        type="button"
        className={`dm-end dm-end-${end}`}
        onClick={() => onMove(move)}
        aria-label={labelText}
        data-drop-target={end}
        data-drop-active={isTargetActive ? 'true' : undefined}
      >
        {symbolText}
      </button>
    );
  };

  const summary = view.lastRound && (view.variant === 'mexican' ? (view.playerTrains ?? []).every((t) => t.length === 0) && (view.mexicanTrain?.length ?? 0) === 0 : view.chain.length === 0) ? view.lastRound : null;

  const renderTrainRow = (end: DominoEnd, title: string, train: readonly ChainStone[], isOpen: boolean, engineVal: number) => {
    const currentEndVal = train.length > 0 ? train[train.length - 1]!.right : engineVal;
    return (
      <div key={end} className={`dm-train-row ${isOpen ? 'dm-train-open' : ''}`}>
        <div className="dm-train-head">
          <span className="dm-train-title">{title}</span>
          {isOpen && <span className="dm-train-badge" title="Öffentlich spielbar">🪙 Offen</span>}
          <span className="dm-train-val">Ende: {currentEndVal}</span>
        </div>
        <div className="dm-train-stones">
          {train.length === 0 ? (
            <span className="dm-train-empty">Start am Bahnhof [{engineVal}|{engineVal}]</span>
          ) : (
            train.map((c, i) => (
              <Stone
                key={`${end}-${c.stone}-${i}`}
                stone={c.stone}
                display={view.display}
                left={c.left}
                right={c.right}
                upright={isDouble(c.stone)}
                className={view.lastPlayed?.stone === c.stone ? 'dm-last' : ''}
                label={`${c.left} und ${c.right}`}
              />
            ))
          )}
          {endButton(end, `An ${title} anlegen`)}
        </div>
      </div>
    );
  };

  const center = (
    <>
      <div
        className="dm-table"
        data-drop-target={draggedStone && endsFor(draggedStone).length === 1 ? 'board' : undefined}
        data-drop-active={dragState.isDragging && dragState.targetId === 'board' ? 'true' : undefined}
      >
        {summary && (
          <div className="dm-summary" role="status">
            <strong>
              Runde {summary.round}: {summary.winner === null ? 'gesperrt, niemand punktet' : `${teamLabel(summary.winner)} gewinnt +${summary.points}`}
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
        {view.variant === 'mexican' ? (
          <div className="dm-mexican-board" aria-label="Mexican Train">
            <div className="dm-hub">
              <span className="dm-hub-label">🚂 Bahnhof [{view.engineValue ?? 0}|{view.engineValue ?? 0}]</span>
              {view.chain[0] && (
                <Stone
                  stone={view.chain[0].stone}
                  display={view.display}
                  left={view.chain[0].left}
                  right={view.chain[0].right}
                  label={`Bahnhof ${view.engineValue}`}
                />
              )}
            </div>
            <div className="dm-trains">
              {(view.playerTrains ?? []).map((tr, s) =>
                renderTrainRow(
                  `seat-${s}`,
                  `Zug ${name(s)}${s === seat ? ' (deiner)' : ''}`,
                  tr,
                  Boolean(view.trainOpen?.[s]),
                  view.engineValue ?? 0,
                ),
              )}
              {renderTrainRow('mexican', 'Mexican Train (gemeinsam)', view.mexicanTrain ?? [], true, view.engineValue ?? 0)}
            </div>
          </div>
        ) : handOnly ? (
          // Hand-Ansicht fürs Handy (#214): Die Kette zeigt der Tisch-Bildschirm; hier stehen nur die Enden zum Anlegen.
          <div className="dm-ends" aria-label="Enden der Kette">
            {view.chain.length === 0 ? (
              <p className="dm-empty">Der erste Stein kommt in die Mitte.</p>
            ) : (
              <>
                {endButton('left')}
                <span className="dm-end-value">{view.chain[0]!.left}</span>
                <span className="dm-end-sep">·</span>
                <span className="dm-end-value">{view.chain[view.chain.length - 1]!.right}</span>
                {endButton('right')}
                {endButton('up')}
                {endButton('down')}
              </>
            )}
          </div>
        ) : (
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
        )}
      </div>

      <div className="dm-controls" aria-live="polite">
        <span className="dm-info">
          {view.lastPlayed && view.lastPlayed.scored > 0
            ? `${teamLabel(view.lastPlayed.seat)}: +${view.lastPlayed.scored} Fünferpunkte`
            : choices.length > 1
              ? 'Wähle das Ende'
              : `Runde ${view.round} · Ziel ${view.target}${view.teams ? ' · Teams (2 vs 2)' : ''}`}
          <small>
            {view.variant === 'block'
              ? `Block-Domino (Doppel-${view.setSize ?? 6})`
              : view.variant === 'mexican'
                ? `Mexican Train (Doppel-${view.setSize ?? 9}) · Vorrat: ${view.boneyard.length}`
                : `Vorrat: ${view.boneyard.length} (Doppel-${view.setSize ?? 6})`}
          </small>
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

    </>
  );

  const own = (
    <>
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
    </>
  );

  return (
    <div className="dm-layout" data-around={table ? '' : undefined}>
      {table ? (
        <SeatRing
          seats={view.hands.length}
          bottomSeat={seat ?? 0}
          status={table.status}
          bottom={own}
          renderSeat={(s) => table.seatChip(s)}
        >
          {center}
        </SeatRing>
      ) : (
        <>{center}{own}</>
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
  seatsAround: true,
  handView: true,
  SeatSymbol,
  sounds: { played: 'domino-klack', drew: 'stein-ziehen' },
  seatLabel: (seat) => `Platz ${seat + 1}`,
  seatDetail: (view, seat) => {
    const teamTag = view.teams && view.seats === 4 ? `Team ${(seat % 2) + 1} · ` : '';
    return `${teamTag}${view.scores[seat]} Pkt. · ${view.hands[seat]?.length ?? 0} St.`;
  },
};
