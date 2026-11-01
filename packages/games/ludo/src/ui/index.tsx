import type { GameEvent, SeatId } from '@brett-und-blatt/engine';
import { DIE_ROLL_MS, Die3D, FitBox, useRollCounter, type BoardProps, type GameUi } from '@brett-und-blatt/ui';
import { useEffect, useId, useState, type CSSProperties } from 'react';
import {
  colorIndex,
  toAbsoluteTrackIndex,
  trackLengthOf,
  type Board as BoardKind,
  type LudoMove,
  type LudoState,
  type PiecePosition,
} from '../rules';
import { cornerColors, cornerOf, geometryOf, type BoardGeometry, type Point } from './geometry';
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
  {
    name: 'Lila',
    fill: '#A855F7',
    border: '#9333EA',
    light: '#E9D5FF',
    symbol: '◆',
    symbolName: 'Raute',
  },
  {
    name: 'Türkis',
    fill: '#14B8A6',
    border: '#0D9488',
    light: '#99F6E4',
    symbol: '✚',
    symbolName: 'Kreuz',
  },
];

/** Graue Ecken für freie Arme des Sechser-Bretts. */
const FREE_STYLE = { fill: '#E2E8F0', border: '#94A3B8', light: '#F1F5F9' };

/**
 * Versatz der Figur gegenüber der Feldmitte: Der Sockel (Mitte bei y ≈ 7 in `PiecePin`) steht
 * genau auf der Feldmitte, die Figur ragt nach oben heraus (F-002, angepasst 31.10.2026).
 */
const PIECE_DROP = -7;

/** Dauer eines Hüpfers von Feld zu Feld. */
const HOP_MS = 150;
/** Flug einer geschlagenen Figur zurück in den Stall. */
const FLIGHT_MS = 650;

interface PieceAnimation {
  seat: SeatId;
  pieceIndex: number;
  /** Startpunkt und alle Felder, über die die Figur hüpft (das letzte ist das Ziel). */
  path: Point[];
  captured: { seat: SeatId; pieceIndex: number; from: Point; to: Point }[];
  start: number;
  /** Gesamtdauer: Hüpfer und danach der Flug der geschlagenen Figuren. */
  duration: number;
}

/** Aktuelle Zeichenposition einer bewegten Figur: Ort, Höhe über dem Brett, Drehung und Größe. */
interface AnimatedPose extends Point {
  lift: number;
  rotate: number;
  scale: number;
}

/**
 * Baut aus den Ereignissen eines Zugs die Animation: Die ziehende Figur hüpft Feld für Feld,
 * eine geschlagene Figur bleibt stehen, bis sie getroffen wird, und fliegt dann im Bogen in den Stall.
 */
function animationFromEvents(
  events: GameEvent[],
  seats: number,
  board: BoardKind,
  now: number,
): PieceAnimation | null {
  const geo = geometryOf(board);
  const trackLength = trackLengthOf(board);
  const trackPoint = (seat: SeatId, step: number) => geo.track[toAbsoluteTrackIndex(seat, step, seats, board)];
  const goalPoint = (seat: SeatId, slot: number) => geo.goals[cornerOf(seat, seats, board)][slot];
  const homePoint = (seat: SeatId, slot: number) => geo.homes[cornerOf(seat, seats, board)][slot];

  let mover: Pick<PieceAnimation, 'seat' | 'pieceIndex' | 'path'> | null = null;
  for (const event of events) {
    const e = event as GameEvent & Record<string, number>;
    if (event.type === 'entered') {
      mover = { seat: e.seat, pieceIndex: e.pieceIndex, path: [homePoint(e.seat, e.pieceIndex), trackPoint(e.seat, 0)] };
    } else if (event.type === 'moved') {
      const path = [trackPoint(e.seat, e.fromStep)];
      for (let step = e.fromStep + 1; step <= e.toStep; step++) path.push(trackPoint(e.seat, step));
      mover = { seat: e.seat, pieceIndex: e.pieceIndex, path };
    } else if (event.type === 'goalEntered') {
      const path = [trackPoint(e.seat, e.fromStep)];
      for (let step = e.fromStep + 1; step < trackLength; step++) path.push(trackPoint(e.seat, step));
      for (let slot = 0; slot <= e.goalSlot; slot++) path.push(goalPoint(e.seat, slot));
      mover = { seat: e.seat, pieceIndex: e.pieceIndex, path };
    } else if (event.type === 'goalMoved') {
      const path = [goalPoint(e.seat, e.fromSlot)];
      for (let slot = e.fromSlot + 1; slot <= e.toSlot; slot++) path.push(goalPoint(e.seat, slot));
      mover = { seat: e.seat, pieceIndex: e.pieceIndex, path };
    }
  }
  if (!mover || mover.path.length < 2) return null;

  const captured = events
    .filter((event) => event.type === 'captured')
    .map((event) => {
      const e = event as GameEvent & Record<string, number>;
      return {
        seat: e.capturedSeat,
        pieceIndex: e.capturedPieceIndex,
        from: geo.track[e.trackIndex],
        to: homePoint(e.capturedSeat, e.capturedPieceIndex),
      };
    });
  const hops = (mover.path.length - 1) * HOP_MS;
  return { ...mover, captured, start: now, duration: hops + (captured.length > 0 ? FLIGHT_MS : 0) };
}

/** Wo eine Figur gerade zu zeichnen ist, solange die Animation läuft – sonst null. */
function animatedPose(anim: PieceAnimation, seat: SeatId, pieceIndex: number, now: number): AnimatedPose | null {
  const elapsed = now - anim.start;
  if (elapsed >= anim.duration) return null;
  const hopsMs = (anim.path.length - 1) * HOP_MS;

  if (seat === anim.seat && pieceIndex === anim.pieceIndex) {
    if (elapsed >= hopsMs) return null;
    const hop = Math.floor(elapsed / HOP_MS);
    const t = (elapsed - hop * HOP_MS) / HOP_MS;
    const from = anim.path[hop];
    const to = anim.path[hop + 1];
    // Längere Sprünge (aus dem Stall aufs Startfeld) gehen höher.
    const height = Math.min(90, 28 + Math.hypot(to.x - from.x, to.y - from.y) * 0.12);
    return {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
      lift: Math.sin(Math.PI * t) * height,
      rotate: 0,
      // Kurz gestaucht beim Aufsetzen, gestreckt in der Luft.
      scale: 1 + Math.sin(Math.PI * t) * 0.08,
    };
  }

  const victim = anim.captured.find((c) => c.seat === seat && c.pieceIndex === pieceIndex);
  if (!victim) return null;
  if (elapsed < hopsMs) return { ...victim.from, lift: 0, rotate: 0, scale: 1 };
  const t = Math.min(1, (elapsed - hopsMs) / FLIGHT_MS);
  const ease = 1 - (1 - t) ** 2;
  return {
    x: victim.from.x + (victim.to.x - victim.from.x) * ease,
    y: victim.from.y + (victim.to.y - victim.from.y) * ease,
    lift: Math.sin(Math.PI * t) * 240,
    rotate: t * 540,
    scale: 1 + Math.sin(Math.PI * t) * 0.35,
  };
}

/**
 * Spielt die Zug-Animationen zu den neuesten Ereignissen ab und liefert die Zeichenpositionen.
 * Zieht schon der Nächste, während eine geschlagene Figur noch fliegt, laufen beide Animationen nebeneinander.
 */
function usePieceAnimation(events: GameEvent[], seats: number, board: BoardKind) {
  const [tracked, setTracked] = useState<{ events: GameEvent[]; anims: PieceAnimation[] }>({ events, anims: [] });
  const [now, setNow] = useState(0);
  let anims = tracked.anims;

  // Neue Ereignisse schon beim Zeichnen übernehmen, damit die Figur nicht erst kurz am Ziel aufblitzt.
  if (tracked.events !== events) {
    const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const start = performance.now();
    const next = reduced ? null : animationFromEvents(events, seats, board, start);
    // Ereignisse ohne Figurenzug (z. B. ein Wurf) lassen laufende Animationen weiterlaufen.
    if (next) anims = [...anims.filter((a) => start - a.start < a.duration), next];
    setTracked({ events, anims });
    if (next) setNow(start);
  }

  useEffect(() => {
    if (anims.length === 0) return;
    const end = Math.max(...anims.map((a) => a.start + a.duration));
    let frame = 0;
    const tick = (time: number) => {
      setNow(time);
      if (time < end) frame = requestAnimationFrame(tick);
      else setTracked((current) => (current.anims === anims ? { ...current, anims: [] } : current));
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [anims]);

  return (seat: SeatId, pieceIndex: number) => {
    // Die jüngste Animation zählt, wenn eine Figur in mehreren vorkommt.
    for (let i = anims.length - 1; i >= 0; i--) {
      const anim = anims[i];
      const involved =
        (anim.seat === seat && anim.pieceIndex === pieceIndex) ||
        anim.captured.some((c) => c.seat === seat && c.pieceIndex === pieceIndex);
      if (involved) return animatedPose(anim, seat, pieceIndex, Math.max(now, anim.start));
    }
    return null;
  };
}

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
  shadow = true,
}: {
  style: PlayerStyle;
  isMovable?: boolean;
  onClick?: () => void;
  /** Schatten mitzeichnen – nicht, wenn die Figur gerade in der Luft ist (der Schatten bleibt dann am Boden). */
  shadow?: boolean;
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
      {shadow && <ellipse cx="0" cy="18" rx="20" ry="8" fill="rgba(0, 0, 0, 0.25)" />}

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

/** Kleiner Würfel in der Ecke des Würfelfelds: „Gelb würfelte 3 – kein Zug“. */
function LastRollBadge({ seat, seats, dice }: { seat: SeatId; seats: number; dice: number }) {
  const style = PLAYER_STYLES[colorIndex(seat, seats)];
  return (
    <g transform="translate(-14, -14)" className="ludo-last-roll">
      <title>{`${style.name} würfelte ${dice} – kein Zug möglich`}</title>
      <rect x="0" y="0" width="48" height="48" rx="12" fill={style.fill} stroke={style.border} strokeWidth="3" />
      <g transform="translate(6, 6)">
        <DiceFace value={dice} size={36} />
      </g>
      <line x1="4" y1="44" x2="44" y2="4" stroke="#1E293B" strokeWidth="4" strokeLinecap="round" opacity="0.7" />
    </g>
  );
}

/** Hintergrund eines Wartehäuschens in der Farbe seiner Ecke. */
function HomePanelShape({ geo, corner, color }: { geo: BoardGeometry; corner: number; color: number | null }) {
  const panel = geo.panels[corner];
  const style = color === null ? FREE_STYLE : PLAYER_STYLES[color];
  const common = { fill: style.light, opacity: color === null ? 0.6 : 0.45, stroke: style.fill, strokeWidth: 4 };
  if (panel.kind === 'rect') {
    return <rect x={panel.x} y={panel.y} width={panel.size} height={panel.size} rx="28" {...common} />;
  }
  return <circle cx={panel.cx} cy={panel.cy} r={panel.r} {...common} />;
}

function Board({ view, legalMoves, onMove, events }: BoardProps<LudoState, LudoMove>) {
  const board: BoardKind = view.board ?? 'classic';
  const geo = geometryOf(board);
  const colors = cornerColors(view.seats, board);
  const poseOf = usePieceAnimation(events, view.seats, board);
  const rollKey = useRollCounter(events);
  // Ein Wurf ohne Zug bleibt nach dem Rollen blass liegen, bis der Nächste würfelt.
  const [rolling, setRolling] = useState(false);
  useEffect(() => {
    if (rollKey === 0) return;
    setRolling(true);
    const id = window.setTimeout(() => setRolling(false), DIE_ROLL_MS + 250);
    return () => window.clearTimeout(id);
  }, [rollKey]);

  const turn = view.turn;
  const activeStyle = PLAYER_STYLES[colorIndex(turn, view.seats)];
  const size = geo.size;
  const half = size / 2;

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
    point: Point;
    position: PiecePosition;
    style: PlayerStyle;
    isMovable: boolean;
  }[] = [];

  for (let s = 0; s < view.seats; s++) {
    const corner = cornerOf(s, view.seats, board);
    const style = PLAYER_STYLES[colorIndex(s, view.seats)];
    view.pieces[s].forEach((p, idx) => {
      let point: Point | undefined;
      if (p.area === 'home') point = geo.homes[corner]?.[p.index];
      else if (p.area === 'track') point = geo.track[toAbsoluteTrackIndex(s, p.index, view.seats, board)];
      else if (p.area === 'goal') point = geo.goals[corner]?.[p.index];
      pieceCoords.push({
        seat: s,
        pieceIndex: idx,
        point: point ?? { x: half, y: half },
        position: p,
        style,
        isMovable: s === turn && movablePieces.has(idx),
      });
    });
  }

  /** Farbe des Startfelds je absolutem Streckenindex. */
  const startColor = new Map<number, number | null>();
  geo.starts.forEach((trackIndex, corner) => startColor.set(trackIndex, colors[corner] ?? null));

  return (
    <FitBox ratio={1}>
      <div className="ludo-container">
        <div className="ludo-board-wrap" data-board={board}>
        <svg viewBox={`0 0 ${size} ${size}`} className="ludo-board-svg">
          {/* Hintergrund-Brett */}
          <rect width={size} height={size} rx="32" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="6" />

          {/* Häuser (Hintergrund-Flächen) */}
          {geo.panels.map((_, corner) => (
            <HomePanelShape key={`panel-${corner}`} geo={geo} corner={corner} color={colors[corner] ?? null} />
          ))}

          {/* Wartefelder im Haus (Kreise) */}
          {geo.homes.map((homeSet, corner) => {
            const color = colors[corner] ?? null;
            const border = color === null ? FREE_STYLE.border : PLAYER_STYLES[color].border;
            return homeSet.map((hc, slotIdx) => (
              <circle
                key={`home-${corner}-${slotIdx}`}
                cx={hc.x}
                cy={hc.y}
                r="30"
                fill="#FFFFFF"
                stroke={border}
                strokeWidth="4"
                opacity={color === null ? 0.5 : 1}
              />
            ));
          })}

          {/* Streckenfelder */}
          {geo.track.map((tc, idx) => {
            const color = startColor.get(idx);
            const isStart = color !== undefined && color !== null;
            const style = isStart ? PLAYER_STYLES[color] : null;
            return (
              <g key={`track-${idx}`}>
                <circle
                  cx={tc.x}
                  cy={tc.y}
                  r="30"
                  fill={style ? style.fill : '#FFFFFF'}
                  stroke={style ? style.border : '#94A3B8'}
                  strokeWidth="3.5"
                />
                {style && (
                  <text
                    x={tc.x}
                    y={tc.y + 2}
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

          {/* Zielfelder (a, b, c, d) */}
          {geo.goals.map((goalSet, corner) => {
            const color = colors[corner] ?? null;
            const style = color === null ? FREE_STYLE : PLAYER_STYLES[color];
            const labels = ['a', 'b', 'c', 'd'];
            return goalSet.map((gc, slotIdx) => (
              <g key={`goal-${corner}-${slotIdx}`} opacity={color === null ? 0.5 : 1}>
                <circle cx={gc.x} cy={gc.y} r="28" fill={style.light} stroke={style.border} strokeWidth="3.5" />
                <text
                  x={gc.x}
                  y={gc.y + 2}
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

          {/* Zentrum: Interaktiver Würfel & Aktionsbereich */}
          <g transform={`translate(${half - 75}, ${half - 75})`}>
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
                <text
                  x="75"
                  y="130"
                  textAnchor="middle"
                  fill={activeStyle.border}
                  fontSize="16"
                  fontWeight="bold"
                >
                  {view.rollsLeft > 1 ? `Noch ${view.rollsLeft}×` : 'Würfeln!'}
                </text>
              </g>
            )}

            {/* Wurf des Vorgängers, nach dem es keinen Zug gab – klein in dessen Farbe (F-004) */}
            {view.phase === 'roll' && view.dice === null && view.lastRoll && view.lastRoll.seat !== turn && (
              <LastRollBadge seat={view.lastRoll.seat} seats={view.seats} dice={view.lastRoll.dice} />
            )}

            {view.phase === 'move' && view.dice !== null && (
              <g>
                <text
                  x="75"
                  y="130"
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
                cx={p.point.x}
                cy={p.point.y}
                className="ludo-ring-pulse"
                fill="none"
                stroke={p.style.fill}
                strokeWidth="5"
              />
            ))}

          {/* Alle Spielfiguren – bewegte zuletzt, damit sie über den anderen hüpfen */}
          {pieceCoords
            .map((p) => ({ ...p, pose: poseOf(p.seat, p.pieceIndex) }))
            .sort((a, b) => Number(a.pose !== null) - Number(b.pose !== null))
            .map((p) => {
              const x = p.pose ? p.pose.x : p.point.x;
              const y = (p.pose ? p.pose.y : p.point.y) + PIECE_DROP;
              const lift = p.pose?.lift ?? 0;
              return (
                <g key={`piece-${p.seat}-${p.pieceIndex}`}>
                  {lift > 1 && (
                    <ellipse
                      cx={x}
                      cy={y + 18}
                      rx={20 - Math.min(8, lift / 12)}
                      ry={8 - Math.min(3, lift / 30)}
                      fill="rgba(0, 0, 0, 0.18)"
                    />
                  )}
                  <g
                    transform={`translate(${x}, ${y - lift})${p.pose ? ` rotate(${p.pose.rotate}) scale(${p.pose.scale})` : ''}`}
                  >
                    <PiecePin
                      style={p.style}
                      isMovable={p.isMovable}
                      shadow={lift <= 1}
                      onClick={p.isMovable ? () => onMove({ type: 'move', pieceIndex: p.pieceIndex }) : undefined}
                    />
                  </g>
                </g>
              );
            })}
        </svg>
          {/* Der Würfel liegt als HTML über der Brettmitte: 3D-Transformationen in SVG (foreignObject) sind in Safari unzuverlässig. */}
          <div className="ludo-dice-overlay" style={{ '--ludo-size': size } as CSSProperties}>
            <Die3D
              value={view.dice ?? view.lastRoll?.dice ?? null}
              rollKey={rollKey}
              crit={(view.dice ?? view.lastRoll?.dice) === 6}
              inviting={canRoll && view.dice === null}
              label={view.dice !== null ? `Würfel: ${view.dice}` : undefined}
              className={`ludo-die3d ${view.dice === null && !rolling ? 'ludo-die3d-old' : ''}`}
            />
          </div>
        </div>

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
