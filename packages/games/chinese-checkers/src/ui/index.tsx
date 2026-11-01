/**
 * Die Oberfläche von Sternhalma: Sternbrett als SVG, eigene Zacke unten. Stein antippen, dann
 * ein markiertes Ziel; Sprungketten laufen Loch für Loch ab.
 */
import type { SeatId } from '@brett-und-blatt/engine';
import { FitBox, useLatestEvent, type BoardProps, type GameUi } from '@brett-und-blatt/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CELLS,
  armOfCell,
  destinations,
  targetArm,
  type ChineseCheckersMove,
  type ChineseCheckersState,
} from '../rules';
import './styles.css';

/** Farben je Platz mit Formzeichen, damit sie auch ohne Farbsehen unterscheidbar sind. */
const PLAYERS = [
  { name: 'Rot', fill: '#DC2626', light: '#FECACA', mark: '●' },
  { name: 'Blau', fill: '#2563EB', light: '#BFDBFE', mark: '▲' },
  { name: 'Grün', fill: '#16A34A', light: '#BBF7D0', mark: '■' },
  { name: 'Gelb', fill: '#EAB308', light: '#FEF08A', mark: '★' },
  { name: 'Lila', fill: '#9333EA', light: '#E9D5FF', mark: '◆' },
  { name: 'Türkis', fill: '#0D9488', light: '#99F6E4', mark: '✚' },
] as const;

const SQRT3_2 = Math.sqrt(3) / 2;
const HOP_MS = 200;
/** Ecken des Mittelsechsecks: die äußersten Löcher liegen bei 4, dazu etwas Rand. */
const HEX_RADIUS = 4.6;

function point(cell: number): { x: number; y: number } {
  const { q, r } = CELLS[cell]!;
  return { x: q + r / 2, y: r * SQRT3_2 };
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Dreieck einer Zacke für die Hintergrundfarbe. */
function armPolygon(arm: number): string {
  const angle = (-90 + 60 * arm) * (Math.PI / 180);
  const tip = { x: Math.cos(angle) * 7.55, y: Math.sin(angle) * 7.55 };
  // Basis: die beiden Ecken des Mittelsechsecks links und rechts der Zacke.
  const corner = (shift: number) => {
    const a = angle + shift * (Math.PI / 180);
    return { x: Math.cos(a) * HEX_RADIUS, y: Math.sin(a) * HEX_RADIUS };
  };
  const left = corner(-30);
  const right = corner(30);
  return [tip, right, left].map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(' ');
}

function Board({ view, legalMoves, onMove, events, viewer, activeSeat, hint, seatNames }: BoardProps<ChineseCheckersState, ChineseCheckersMove>) {
  const [selected, setSelected] = useState<number | null>(null);
  const pieceRefs = useRef(new Map<number, SVGGElement>());
  const movers = useMemo(
    () => new Set(legalMoves.flatMap((m) => (m.type === 'move' ? [m.from] : []))),
    [legalMoves],
  );
  const canPass = legalMoves.some((m) => m.type === 'pass');
  const mover = movers.size > 0 ? (activeSeat ?? view.turn) : null;

  // Auswahl verwerfen, wenn der Stein nicht mehr ziehen darf (anderer Zug, Partie vorbei).
  useEffect(() => {
    if (selected !== null && !movers.has(selected)) setSelected(null);
  }, [movers, selected]);

  const targets = useMemo(() => {
    if (selected === null || mover === null) return new Map<number, number[]>();
    return destinations(view, mover, selected);
  }, [selected, mover, view]);

  // Eigene Zacke nach unten drehen.
  const ownSeat = typeof viewer === 'number' ? viewer : null;
  const rotation = ownSeat !== null ? (3 - view.homes[ownSeat]!) * 60 : 0;

  // Sprungkette Loch für Loch ablaufen lassen.
  const lastMove = useLatestEvent(events, (e) => e.type === 'jumped' || e.type === 'stepped');
  useEffect(() => {
    const event = lastMove.event as { to?: number; path?: number[] } | null;
    if (!event?.path || event.to === undefined || prefersReducedMotion()) return;
    const element = pieceRefs.current.get(event.to);
    if (!element?.animate) return;
    const end = point(event.to);
    const frames = event.path.map((cell) => {
      const p = point(cell);
      return { transform: `translate(${p.x - end.x}px, ${p.y - end.y}px)` };
    });
    element.animate(frames, { duration: HOP_MS * (event.path.length - 1), easing: 'ease-in-out' });
  }, [lastMove.count]);

  const hintMove = hint?.type === 'move' ? hint : null;
  const lastPath = view.lastMove?.path ?? [];

  // Farbe je Zacke: Heimat in kräftig, Ziel eines Spielers ohne eigenen Besitzer hell.
  const armFill = (arm: number): string => {
    const home = view.homes.indexOf(arm);
    if (home >= 0) return PLAYERS[home]!.light;
    const aiming = view.homes.findIndex((_, seat) => targetArm(view, seat) === arm);
    return aiming >= 0 ? PLAYERS[aiming]!.light : 'var(--color-surface-2, #e5e7eb)';
  };

  const status = (() => {
    if (view.winners) {
      if (view.winners.length > 1 && view.endReason === 'limit') return 'Rundengrenze: Gleichstand.';
      const names = view.winners.map((s) => seatNames[s] ?? PLAYERS[s]!.name).join(' und ');
      return view.endReason === 'limit' ? `Nach 150 Runden liegt ${names} vorn.` : `${names} hat gewonnen!`;
    }
    if (mover === null) return `${seatNames[view.turn] ?? PLAYERS[view.turn]!.name} ist dran.`;
    if (canPass) return 'Kein Zug möglich – du musst passen.';
    return selected === null ? 'Wähle einen Stein.' : 'Wähle ein Ziel – Sprünge lassen sich verketten.';
  })();

  const click = (cell: number) => {
    if (mover === null) return;
    if (selected !== null && targets.has(cell)) {
      onMove({ type: 'move', from: selected, to: cell });
      setSelected(null);
      return;
    }
    if (movers.has(cell)) setSelected(cell === selected ? null : cell);
    else setSelected(null);
  };

  return (
    <div className="chk-wrap">
      <FitBox ratio={1}>
        <svg className="chk-board" viewBox="-7.8 -7.8 15.6 15.6" role="group" aria-label="Sternbrett">
          <g transform={`rotate(${rotation})`}>
            <polygon className="chk-hex" points={Array.from({ length: 6 }, (_, i) => {
              const a = (-60 + 60 * i) * (Math.PI / 180);
              return `${(Math.cos(a) * HEX_RADIUS).toFixed(3)},${(Math.sin(a) * HEX_RADIUS).toFixed(3)}`;
            }).join(' ')} />
            {Array.from({ length: 6 }, (_, arm) => (
              <polygon key={arm} className="chk-arm" points={armPolygon(arm)} fill={armFill(arm)} />
            ))}
            {lastPath.length > 1 && (
              <polyline
                className="chk-path"
                points={lastPath.map((c) => {
                  const p = point(c);
                  return `${p.x},${p.y}`;
                }).join(' ')}
              />
            )}
            {CELLS.map((_, cell) => {
              const p = point(cell);
              const owner = view.board[cell];
              const isTarget = targets.has(cell);
              const isHint = hintMove !== null && (hintMove.from === cell || hintMove.to === cell);
              const canSelect = movers.has(cell);
              const interactive = isTarget || canSelect;
              const label =
                owner !== null
                  ? `Stein ${PLAYERS[owner]!.name}${canSelect ? ', wählbar' : ''}`
                  : isTarget
                    ? 'Freies Loch, Ziel'
                    : 'Freies Loch';
              return (
                <g
                  key={cell}
                  className={`chk-cell${interactive ? ' chk-cell-active' : ''}`}
                  onClick={interactive ? () => click(cell) : undefined}
                  role={interactive ? 'button' : undefined}
                  tabIndex={interactive ? 0 : undefined}
                  aria-label={label}
                  onKeyDown={interactive ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), click(cell)) : undefined}
                >
                  <circle className="chk-hole" cx={p.x} cy={p.y} r={0.24} data-arm={armOfCell(cell) ?? 'mitte'} />
                  {isTarget && <circle className="chk-target" cx={p.x} cy={p.y} r={0.36} />}
                  {isHint && <circle className="chk-hint" cx={p.x} cy={p.y} r={0.46} />}
                  <circle className="chk-hit" cx={p.x} cy={p.y} r={0.5} />
                </g>
              );
            })}
            {view.board.map((owner, cell) => {
              if (owner === null) return null;
              const p = point(cell);
              const style = PLAYERS[owner]!;
              const isSelected = cell === selected;
              return (
                <g
                  key={`p${cell}`}
                  ref={(el) => {
                    if (el) pieceRefs.current.set(cell, el);
                    else pieceRefs.current.delete(cell);
                  }}
                  className={`chk-piece${isSelected ? ' chk-piece-selected' : ''}${movers.has(cell) ? ' chk-piece-movable' : ''}${view.out[owner] ? ' chk-piece-out' : ''}`}
                  onClick={movers.has(cell) ? () => click(cell) : undefined}
                >
                  <circle cx={p.x} cy={p.y} r={0.4} fill={style.fill} />
                  <text x={p.x} y={p.y} transform={`rotate(${-rotation} ${p.x} ${p.y})`} className="chk-mark">
                    {style.mark}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </FitBox>
      <div className="chk-controls">
        <p className="chk-status" aria-live="polite">{status}</p>
        {canPass && (
          <button type="button" className="chk-btn" onClick={() => onMove({ type: 'pass' })}>
            Passen
          </button>
        )}
      </div>
    </div>
  );
}

function SeatSymbol({ seat, className = '' }: { seat: SeatId; seats?: number; className?: string }) {
  const style = PLAYERS[Number(seat) % PLAYERS.length]!;
  return (
    <span className={`chk-symbol ${className}`} style={{ background: style.fill }} aria-hidden="true">
      {style.mark}
    </span>
  );
}

export const gameUi: GameUi<ChineseCheckersState, ChineseCheckersMove> = {
  Board,
  SeatSymbol,
  seatLabel: (seat) => PLAYERS[Number(seat) % PLAYERS.length]!.name,
  seatDetail: (view, seat) => {
    const target = new Set(view.board.flatMap((_, cell) => (armOfCell(cell) === targetArm(view, seat) ? [cell] : [])));
    const home = view.board.filter((owner, cell) => owner === seat && target.has(cell)).length;
    return view.out[seat] ? 'aufgegeben' : `${home}/${view.pieces} im Ziel`;
  },
  sounds: {
    stepped: 'stein-ziehen',
    jumped: 'stein-setzen',
    arrived: 'ludo-haus',
    win: 'sieg',
  },
};
