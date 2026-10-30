import type { SeatId } from '@brett-und-blatt/engine';
import { FitBox, type BoardProps, type GameUi } from '@brett-und-blatt/ui';
import { useId, useState } from 'react';
import {
  TRACK_LENGTH,
  colorIndex,
  startTrackIndex,
  toAbsoluteTrackIndex,
  type LudoMove,
  type LudoState,
  type PiecePosition,
} from '../rules';
import './styles.css';

export interface PlayerStyle {
  name: string;
  fill: string;
  border: string;
  light: string;
  symbol: string;
  symbolName: string;
}

export const PLAYER_STYLES: readonly PlayerStyle[] = [
  {
    name: 'Gelb',
    fill: '#EAB308',
    border: '#CA8A04',
    light: '#FEF08A',
    symbol: '●',
    symbolName: 'Kreis',
  },
  {
    name: 'Grün',
    fill: '#22C55E',
    border: '#16A34A',
    light: '#BBF7D0',
    symbol: '▲',
    symbolName: 'Dreieck',
  },
  {
    name: 'Rot',
    fill: '#EF4444',
    border: '#DC2626',
    light: '#FECACA',
    symbol: '■',
    symbolName: 'Quadrat',
  },
  {
    name: 'Blau',
    fill: '#3B82F6',
    border: '#2563EB',
    light: '#BFDBFE',
    symbol: '★',
    symbolName: 'Stern',
  },
];

/** Die 40 Streckenfelder auf dem 11×11-Gitter (col, row 0..10). */
export const TRACK_COORDS: readonly { col: number; row: number }[] = [
  // 0..4 (Gelber Arm runter)
  { col: 6, row: 0 },
  { col: 6, row: 1 },
  { col: 6, row: 2 },
  { col: 6, row: 3 },
  { col: 6, row: 4 },
  // 5..8 (Grüner Arm rechts)
  { col: 7, row: 4 },
  { col: 8, row: 4 },
  { col: 9, row: 4 },
  { col: 10, row: 4 },
  // 9..10 (Grüner Arm Spitze & Start Grün)
  { col: 10, row: 5 },
  { col: 10, row: 6 },
  // 11..14 (Grüner Arm links)
  { col: 9, row: 6 },
  { col: 8, row: 6 },
  { col: 7, row: 6 },
  { col: 6, row: 6 },
  // 15..18 (Roter Arm runter)
  { col: 6, row: 7 },
  { col: 6, row: 8 },
  { col: 6, row: 9 },
  { col: 6, row: 10 },
  // 19..20 (Roter Arm Spitze & Start Rot)
  { col: 5, row: 10 },
  { col: 4, row: 10 },
  // 21..24 (Roter Arm rauf)
  { col: 4, row: 9 },
  { col: 4, row: 8 },
  { col: 4, row: 7 },
  { col: 4, row: 6 },
  // 25..28 (Blauer Arm links)
  { col: 3, row: 6 },
  { col: 2, row: 6 },
  { col: 1, row: 6 },
  { col: 0, row: 6 },
  // 29..30 (Blauer Arm Spitze & Start Blau)
  { col: 0, row: 5 },
  { col: 0, row: 4 },
  // 31..34 (Blauer Arm rechts)
  { col: 1, row: 4 },
  { col: 2, row: 4 },
  { col: 3, row: 4 },
  { col: 4, row: 4 },
  // 35..38 (Gelber Arm rauf)
  { col: 4, row: 3 },
  { col: 4, row: 2 },
  { col: 4, row: 1 },
  { col: 4, row: 0 },
  // 39 (Letztes Feld vor Gelb-Ziel)
  { col: 5, row: 0 },
];

/** Die 4 Zielfelder je Farbe (0..3: Gelb, Grün, Rot, Blau). */
export const GOAL_COORDS: readonly (readonly { col: number; row: number }[])[] = [
  // 0: Gelb (Spalte 5, Zeilen 1..4)
  [
    { col: 5, row: 1 },
    { col: 5, row: 2 },
    { col: 5, row: 3 },
    { col: 5, row: 4 },
  ],
  // 1: Grün (Zeile 5, Spalten 9..6)
  [
    { col: 9, row: 5 },
    { col: 8, row: 5 },
    { col: 7, row: 5 },
    { col: 6, row: 5 },
  ],
  // 2: Rot (Spalte 5, Zeilen 9..6)
  [
    { col: 5, row: 9 },
    { col: 5, row: 8 },
    { col: 5, row: 7 },
    { col: 5, row: 6 },
  ],
  // 3: Blau (Zeile 5, Spalten 1..4)
  [
    { col: 1, row: 5 },
    { col: 2, row: 5 },
    { col: 3, row: 5 },
    { col: 4, row: 5 },
  ],
];

/** Die 4 Warteplätze im Haus je Farbe. */
export const HOME_COORDS: readonly (readonly { col: number; row: number }[])[] = [
  // 0: Gelb oben links
  [
    { col: 0.8, row: 0.8 },
    { col: 2.2, row: 0.8 },
    { col: 0.8, row: 2.2 },
    { col: 2.2, row: 2.2 },
  ],
  // 1: Grün oben rechts
  [
    { col: 7.8, row: 0.8 },
    { col: 9.2, row: 0.8 },
    { col: 7.8, row: 2.2 },
    { col: 9.2, row: 2.2 },
  ],
  // 2: Rot unten rechts
  [
    { col: 7.8, row: 7.8 },
    { col: 9.2, row: 7.8 },
    { col: 7.8, row: 9.2 },
    { col: 9.2, row: 9.2 },
  ],
  // 3: Blau unten links
  [
    { col: 0.8, row: 7.8 },
    { col: 2.2, row: 7.8 },
    { col: 0.8, row: 9.2 },
    { col: 2.2, row: 9.2 },
  ],
];

/** Zeichnet die Augen eines Spielwürfels als SVG. */
function DiceFace({ value, size = 70 }: { value: number; size?: number }) {
  const r = size * 0.08;
  const c1 = size * 0.25;
  const c2 = size * 0.5;
  const c3 = size * 0.75;

  const dots: [number, number][] = [];
  if (value === 1) dots.push([c2, c2]);
  else if (value === 2) dots.push([c1, c1], [c3, c3]);
  else if (value === 3) dots.push([c1, c1], [c2, c2], [c3, c3]);
  else if (value === 4) dots.push([c1, c1], [c3, c1], [c1, c3], [c3, c3]);
  else if (value === 5) dots.push([c1, c1], [c3, c1], [c2, c2], [c1, c3], [c3, c3]);
  else if (value === 6) dots.push([c1, c1], [c3, c1], [c1, c2], [c3, c2], [c1, c3], [c3, c3]);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="inline-block" aria-hidden="true">
      <rect
        x={2}
        y={2}
        width={size - 4}
        height={size - 4}
        rx={size * 0.18}
        fill="#FFFFFF"
        stroke="#CBD5E1"
        strokeWidth={3}
      />
      {dots.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="#1E293B" />
      ))}
    </svg>
  );
}

/** Zeichnet eine 3D-Spielfigur (Püppchen) mit Farbverlauf und Symbol. */
function PiecePin({
  style,
  isMovable,
  onClick,
}: {
  style: PlayerStyle;
  isMovable?: boolean;
  onClick?: () => void;
}) {
  const gradId = useId();

  return (
    <g
      className={`ludo-piece ${isMovable ? 'ludo-piece-movable' : 'ludo-piece-static'}`}
      onClick={onClick}
    >
      <defs>
        <radialGradient id={gradId} cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
          <stop offset="40%" stopColor={style.fill} />
          <stop offset="100%" stopColor={style.border} />
        </radialGradient>
      </defs>

      {/* Schatten */}
      <ellipse cx="0" cy="18" rx="20" ry="8" fill="rgba(0, 0, 0, 0.25)" />

      {/* Sockel */}
      <circle cx="0" cy="8" r="22" fill={style.border} />
      <circle cx="0" cy="6" r="20" fill={`url(#${gradId})`} />

      {/* Kopf */}
      <circle cx="0" cy="-6" r="14" fill={`url(#${gradId})`} stroke={style.border} strokeWidth="1.5" />

      {/* Form-Symbol auf dem Kopf für Farbenblinde */}
      <text
        x="0"
        y="-2"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#FFFFFF"
        fontSize="12"
        fontWeight="bold"
        filter="drop-shadow(0 1px 2px rgba(0,0,0,0.6))"
      >
        {style.symbol}
      </text>
    </g>
  );
}

function Board({ view, legalMoves, onMove }: BoardProps<LudoState, LudoMove>) {
  const [hoveredMove, setHoveredMove] = useState<number | null>(null);

  const turn = view.turn;
  const color = colorIndex(turn, view.seats);
  const activeStyle = PLAYER_STYLES[color];

  const movablePieces = new Set<number>();
  let hasPassMove = false;
  let canRoll = false;

  for (const m of legalMoves) {
    if (m.type === 'move') movablePieces.add(m.pieceIndex);
    else if (m.type === 'pass') hasPassMove = true;
    else if (m.type === 'roll') canRoll = true;
  }

  // Zielkoordinaten für die Figuren ermitteln
  const pieceCoords: {
    seat: SeatId;
    pieceIndex: number;
    col: number;
    row: number;
    position: PiecePosition;
    style: PlayerStyle;
    isMovable: boolean;
  }[] = [];

  for (let s = 0; s < view.seats; s++) {
    const cIdx = colorIndex(s, view.seats);
    const style = PLAYER_STYLES[cIdx];
    const playerPieces = view.pieces[s];

    playerPieces.forEach((p, idx) => {
      let col = 0;
      let row = 0;

      if (p.area === 'home') {
        const homeCoord = HOME_COORDS[cIdx]?.[p.index] ?? { col: 0, row: 0 };
        col = homeCoord.col;
        row = homeCoord.row;
      } else if (p.area === 'track') {
        const absIdx = toAbsoluteTrackIndex(s, p.index, view.seats);
        const trackCoord = TRACK_COORDS[absIdx] ?? { col: 5, row: 5 };
        col = trackCoord.col;
        row = trackCoord.row;
      } else if (p.area === 'goal') {
        const goalCoord = GOAL_COORDS[cIdx]?.[p.index] ?? { col: 5, row: 5 };
        col = goalCoord.col;
        row = goalCoord.row;
      }

      pieceCoords.push({
        seat: s,
        pieceIndex: idx,
        col,
        row,
        position: p,
        style,
        isMovable: s === turn && movablePieces.has(idx),
      });
    });
  }

  return (
    <FitBox ratio={1}>
      <div className="ludo-container">
        <svg viewBox="0 0 1100 1100" className="ludo-board-svg">
          {/* Hintergrund-Brett */}
          <rect width="1100" height="1100" rx="32" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="6" />

          {/* 4 Ecken: Häuser (Hintergrund-Panels) */}
          {/* Gelb (oben links) */}
          <rect x="25" y="25" width="350" height="350" rx="28" fill="#FEF08A" opacity="0.45" stroke="#EAB308" strokeWidth="4" />
          {/* Grün (oben rechts) */}
          <rect x="725" y="25" width="350" height="350" rx="28" fill="#BBF7D0" opacity="0.45" stroke="#22C55E" strokeWidth="4" />
          {/* Rot (unten rechts) */}
          <rect x="725" y="725" width="350" height="350" rx="28" fill="#FECACA" opacity="0.45" stroke="#EF4444" strokeWidth="4" />
          {/* Blau (unten links) */}
          <rect x="25" y="725" width="350" height="350" rx="28" fill="#BFDBFE" opacity="0.45" stroke="#3B82F6" strokeWidth="4" />

          {/* Wartefelder im Haus (Kreise) */}
          {HOME_COORDS.map((homeSet, cIdx) => {
            const style = PLAYER_STYLES[cIdx];
            return homeSet.map((hc, slotIdx) => (
              <circle
                key={`home-${cIdx}-${slotIdx}`}
                cx={hc.col * 100 + 50}
                cy={hc.row * 100 + 50}
                r="30"
                fill="#FFFFFF"
                stroke={style.border}
                strokeWidth="4"
              />
            ));
          })}

          {/* Die 40 Streckenfelder */}
          {TRACK_COORDS.map((tc, idx) => {
            // Prüfen, ob es ein Startfeld ist (0: Gelb, 10: Grün, 20: Rot, 30: Blau)
            let isStart = false;
            let startColorIdx = 0;
            if (idx === 0) {
              isStart = true;
              startColorIdx = 0;
            } else if (idx === 10) {
              isStart = true;
              startColorIdx = 1;
            } else if (idx === 20) {
              isStart = true;
              startColorIdx = 2;
            } else if (idx === 30) {
              isStart = true;
              startColorIdx = 3;
            }

            const style = PLAYER_STYLES[startColorIdx];

            return (
              <g key={`track-${idx}`}>
                <circle
                  cx={tc.col * 100 + 50}
                  cy={tc.row * 100 + 50}
                  r="30"
                  fill={isStart ? style.fill : '#FFFFFF'}
                  stroke={isStart ? style.border : '#94A3B8'}
                  strokeWidth="3.5"
                />
                {isStart && (
                  <text
                    x={tc.col * 100 + 50}
                    y={tc.row * 100 + 52}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#FFFFFF"
                    fontSize="18"
                    fontWeight="900"
                  >
                    A
                  </text>
                )}
              </g>
            );
          })}

          {/* Die 4 Zielfelder-Reihen (a, b, c, d) */}
          {GOAL_COORDS.map((goalSet, cIdx) => {
            const style = PLAYER_STYLES[cIdx];
            const labels = ['a', 'b', 'c', 'd'];
            return goalSet.map((gc, slotIdx) => (
              <g key={`goal-${cIdx}-${slotIdx}`}>
                <circle
                  cx={gc.col * 100 + 50}
                  cy={gc.row * 100 + 50}
                  r="28"
                  fill={style.light}
                  stroke={style.border}
                  strokeWidth="3.5"
                />
                <text
                  x={gc.col * 100 + 50}
                  y={gc.row * 100 + 52}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={style.border}
                  fontSize="16"
                  fontWeight="bold"
                >
                  {labels[slotIdx]}
                </text>
              </g>
            ));
          })}

          {/* Zentrum: Interaktiver Würfel & Aktionsbereich (x=500, y=500, w=100, h=100) */}
          <g transform="translate(475, 475)">
            {/* Würfel-Hintergrund */}
            <rect
              x="0"
              y="0"
              width="150"
              height="150"
              rx="24"
              fill={activeStyle.light}
              stroke={activeStyle.border}
              strokeWidth="4"
              className={canRoll ? 'ludo-center-dice' : ''}
              onClick={canRoll ? () => onMove({ type: 'roll' }) : undefined}
            />

            {view.phase === 'roll' && (
              <g
                className="cursor-pointer"
                onClick={canRoll ? () => onMove({ type: 'roll' }) : undefined}
              >
                {view.dice !== null ? (
                  <g transform="translate(40, 25)">
                    <DiceFace value={view.dice} size={70} />
                  </g>
                ) : (
                  <text
                    x="75"
                    y="65"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="46"
                  >
                    🎲
                  </text>
                )}
                <text
                  x="75"
                  y="118"
                  textAnchor="middle"
                  fill={activeStyle.border}
                  fontSize="16"
                  fontWeight="bold"
                >
                  {view.rollsLeft > 1 ? `Noch ${view.rollsLeft}×` : 'Würfeln!'}
                </text>
              </g>
            )}

            {view.phase === 'move' && view.dice !== null && (
              <g>
                <g transform="translate(40, 25)">
                  <DiceFace value={view.dice} size={70} />
                </g>
                <text
                  x="75"
                  y="118"
                  textAnchor="middle"
                  fill={activeStyle.border}
                  fontSize="15"
                  fontWeight="bold"
                >
                  {hasPassMove ? 'Kein Zug' : view.canRollAgain ? '6! Noch mal' : 'Ziehen'}
                </text>
              </g>
            )}
          </g>

          {/* Pulsierender Ring um ziehbare Figuren */}
          {pieceCoords
            .filter((p) => p.isMovable)
            .map((p) => (
              <circle
                key={`pulse-${p.seat}-${p.pieceIndex}`}
                cx={p.col * 100 + 50}
                cy={p.row * 100 + 50}
                className="ludo-ring-pulse"
                fill="none"
                stroke={p.style.fill}
                strokeWidth="5"
              />
            ))}

          {/* Alle Spielfiguren */}
          {pieceCoords.map((p) => (
            <g
              key={`piece-${p.seat}-${p.pieceIndex}`}
              transform={`translate(${p.col * 100 + 50}, ${p.row * 100 + 50})`}
              onMouseEnter={() => p.isMovable && setHoveredMove(p.pieceIndex)}
              onMouseLeave={() => setHoveredMove(null)}
            >
              <PiecePin
                style={p.style}
                isMovable={p.isMovable}
                onClick={
                  p.isMovable
                    ? () => onMove({ type: 'move', pieceIndex: p.pieceIndex })
                    : undefined
                }
              />
            </g>
          ))}
        </svg>

        {/* Passen-Knopf, falls kein Zug möglich ist */}
        {hasPassMove && (
          <div className="mt-4">
            <button
              type="button"
              className="rounded-xl bg-slate-700 px-6 py-2.5 text-base font-semibold text-white shadow-md hover:bg-slate-800"
              onClick={() => onMove({ type: 'pass' })}
            >
              Kein Zug möglich – Weiter
            </button>
          </div>
        )}
      </div>
    </FitBox>
  );
}

function SeatSymbol({ seat, seats = 4, className = '' }: { seat: SeatId; seats?: number; className?: string }) {
  const cIdx = colorIndex(seat, seats);
  const style = PLAYER_STYLES[cIdx];

  return (
    <span
      className={`inline-flex items-center justify-center font-bold ${className}`}
      style={{ color: style.fill }}
      title={`${style.name} (${style.symbolName})`}
      aria-label={style.name}
    >
      {style.symbol}
    </span>
  );
}

export const gameUi: GameUi<LudoState, LudoMove> = {
  Board,
  SeatSymbol,
  sounds: {
    rolled: 'wuerfel-einzeln',
    entered: 'stein-heraus',
    moved: 'stein-ziehen',
    captured: 'stein-schlagen',
    goalEntered: 'ludo-haus',
    goalMoved: 'stein-setzen',
    win: 'sieg',
  },
  seatLabel: (seat, seats = 4) => PLAYER_STYLES[colorIndex(seat, seats)].name,
};
