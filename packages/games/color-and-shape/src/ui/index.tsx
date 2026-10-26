import type { SeatId } from '@brett-und-blatt/engine';
import { GridBoard, useElementSize, type BoardProps, type GameUi } from '@brett-und-blatt/ui';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { boardMap, checkPlacement, colorOf, shapeOf, type ColorShapeMove, type ColorShapeState, type Placed, type TileId } from '../rules';
import './styles.css';

/** Farben, die sich auch bei Farbschwäche unterscheiden lassen (Okabe-Ito), zusätzlich durch die Form. */
export const COLOR_NAMES = ['Rot', 'Orange', 'Gelb', 'Grün', 'Blau', 'Lila'];
const COLOR_VALUES = ['#e8483b', '#f39b1f', '#f4e04d', '#2fb67a', '#3a8ee6', '#c06fd8'];
export const SHAPE_NAMES = ['Kreis', 'Quadrat', 'Raute', 'Stern', 'Kreuz', 'Kleeblatt'];

const SHAPE_PATHS = [
  <circle key="c" cx="50" cy="50" r="30" />,
  <rect key="q" x="22" y="22" width="56" height="56" rx="4" />,
  <path key="r" d="M50 14 L86 50 L50 86 L14 50 Z" />,
  <path key="s" d="M50 12 L60 38 L88 38 L65 55 L74 84 L50 66 L26 84 L35 55 L12 38 L40 38 Z" />,
  <path key="k" d="M38 14 H62 V38 H86 V62 H62 V86 H38 V62 H14 V38 H38 Z" />,
  <g key="b">
    <circle cx="50" cy="30" r="17" />
    <circle cx="30" cy="54" r="17" />
    <circle cx="70" cy="54" r="17" />
    <path d="M45 60 L55 60 L58 88 L42 88 Z" />
  </g>,
];

export const tileName = (tile: TileId) => `${COLOR_NAMES[colorOf(tile)]}er ${SHAPE_NAMES[shapeOf(tile)]}`;

export function Tile({ tile, className = '' }: { tile: TileId; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={`cs-tile ${className}`} aria-hidden="true">
      <rect x="2" y="2" width="96" height="96" rx="14" className="cs-tile-bg" />
      <g fill={COLOR_VALUES[colorOf(tile)]}>{SHAPE_PATHS[shapeOf(tile)]}</g>
    </svg>
  );
}

/** Kleinste Feldgröße auf dem Tisch; darunter wird verschoben statt verkleinert. */
const MIN_CELL = 34;

function Board({ view, legalMoves, onMove, viewer, hint }: BoardProps<ColorShapeState, ColorShapeMove>) {
  const seat = typeof viewer === 'number' ? viewer : null;
  const hand = (seat !== null ? view.hands[seat] : [])?.filter((t): t is TileId => t !== null) ?? [];
  const myTurn = legalMoves.length > 0;
  const [pending, setPending] = useState<Placed[]>([]);
  const [selected, setSelected] = useState<TileId | null>(null);
  const [swapMode, setSwapMode] = useState(false);
  const [swapTiles, setSwapTiles] = useState<TileId[]>([]);
  const [lastView, setLastView] = useState(view);
  if (lastView !== view) {
    setLastView(view);
    setPending([]);
    setSelected(null);
    setSwapMode(false);
    setSwapTiles([]);
  }

  const map = useMemo(() => boardMap(view.board), [view.board]);
  const hintTiles = hint?.type === 'place' ? hint.tiles : [];
  const shown = [...view.board, ...pending, ...(pending.length === 0 ? hintTiles : [])];
  const xs = shown.map((p) => p.x);
  const ys = shown.map((p) => p.y);
  // Ein Feld Rand rundherum zum Anlegen, mindestens 7 × 7 Felder.
  let minX = Math.min(0, ...xs) - 1;
  let maxX = Math.max(0, ...xs) + 1;
  let minY = Math.min(0, ...ys) - 1;
  let maxY = Math.max(0, ...ys) + 1;
  while (maxX - minX + 1 < 7) {
    minX--;
    if (maxX - minX + 1 < 7) maxX++;
  }
  while (maxY - minY + 1 < 7) {
    minY--;
    if (maxY - minY + 1 < 7) maxY++;
  }
  const cols = maxX - minX + 1;
  const rows = maxY - minY + 1;

  const [areaRef, area] = useElementSize<HTMLDivElement>();
  const cell = Math.max(MIN_CELL, Math.min(area.width / cols, area.height / rows) || MIN_CELL);
  const scrollRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
    el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
  }, [view.board.length]);

  const pendingAt = (x: number, y: number) => pending.find((p) => p.x === x && p.y === y);
  const check = pending.length > 0 ? checkPlacement(view.board, hand, pending, map) : null;
  const canPlaceAt = (x: number, y: number) => {
    if (!myTurn || selected === null || swapMode || map.has(`${x},${y}`) || pendingAt(x, y)) return false;
    return checkPlacement(view.board, hand, [...pending, { x, y, tile: selected }], map).ok;
  };
  const targets = new Set<string>();
  if (selected !== null) for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) if (canPlaceAt(x, y)) targets.add(`${x},${y}`);

  const tapCell = (x: number, y: number) => {
    const own = pendingAt(x, y);
    if (own) {
      setPending(pending.filter((p) => p !== own));
      return;
    }
    if (selected === null || !targets.has(`${x},${y}`)) return;
    setPending([...pending, { x, y, tile: selected }]);
    setSelected(null);
  };

  const tapRack = (tile: TileId) => {
    if (!myTurn) return;
    if (swapMode) {
      setSwapTiles(swapTiles.includes(tile) ? swapTiles.filter((t) => t !== tile) : [...swapTiles, tile]);
      return;
    }
    setSelected(selected === tile ? null : tile);
  };

  const canSwap = legalMoves.some((m) => m.type === 'swap');
  const swapAllowed = swapTiles.length > 0 && legalMoves.some((m) => m.type === 'swap' && m.tiles.length === swapTiles.length);
  const pass = legalMoves.find((m) => m.type === 'pass');
  const lastPlaced = new Set(view.lastPlaced.map((p) => `${p.x},${p.y}`));
  const rack = hand.filter((t) => !pending.some((p) => p.tile === t));
  const hintRack = new Set(hint?.type === 'swap' ? hint.tiles : hintTiles.map((p) => p.tile));

  return (
    <div className="cs-layout">
      <div className="cs-area" ref={areaRef}>
        <div className="cs-scroll" ref={scrollRef}>
          <div className="cs-table" style={{ width: cols * cell, height: rows * cell }}>
            <GridBoard
              cols={cols}
              rows={rows}
              label="Tisch"
              className="cs-board"
              renderCell={(c, r) => {
                const x = c + minX;
                const y = r + minY;
                const tile = map.get(`${x},${y}`);
                if (tile !== undefined) return <Tile tile={tile} />;
                const own = pendingAt(x, y);
                if (own) return <Tile tile={own.tile} className="cs-pending" />;
                const ghost = pending.length === 0 ? hintTiles.find((p) => p.x === x && p.y === y) : undefined;
                if (ghost) return <Tile tile={ghost.tile} className="cs-ghost" />;
                return targets.has(`${x},${y}`) ? <span className="cs-dot" /> : null;
              }}
              isActive={(c, r) => {
                const x = c + minX;
                const y = r + minY;
                return pendingAt(x, y) !== undefined || targets.has(`${x},${y}`);
              }}
              onActivate={(c, r) => tapCell(c + minX, r + minY)}
              cellClassName={(c, r) => (lastPlaced.has(`${c + minX},${r + minY}`) ? 'cs-last' : '')}
              cellLabel={(c, r) => {
                const x = c + minX;
                const y = r + minY;
                const tile = map.get(`${x},${y}`) ?? pendingAt(x, y)?.tile;
                return `Feld ${x}, ${y}: ${tile !== undefined ? tileName(tile) : 'frei'}`;
              }}
            />
          </div>
        </div>
      </div>

      {seat !== null && (
        <div className="cs-rack" role="group" aria-label="Dein Bänkchen">
          {rack.map((tile) => (
            <button
              key={tile}
              type="button"
              className="cs-rack-tile"
              data-selected={selected === tile || swapTiles.includes(tile) || undefined}
              data-hint={hintRack.has(tile) || undefined}
              disabled={!myTurn}
              aria-pressed={selected === tile || swapTiles.includes(tile)}
              aria-label={tileName(tile)}
              onClick={() => tapRack(tile)}
            >
              <Tile tile={tile} />
            </button>
          ))}
        </div>
      )}

      <div className="cs-bar" aria-live="polite">
        <span className="cs-info">
          {swapMode ? 'Steine zum Tauschen wählen' : check ? (check.ok ? `${check.points} Punkte` : check.reason) : myTurn ? (selected !== null ? 'Feld antippen' : 'Stein wählen') : ''}
          <small>Beutel: {view.bag.length}</small>
        </span>
        {myTurn && !swapMode && pending.length > 0 && (
          <>
            <button type="button" className="cs-button" onClick={() => setPending([])}>
              Zurück
            </button>
            <button type="button" className="cs-button cs-primary" disabled={!check?.ok} onClick={() => onMove({ type: 'place', tiles: pending })}>
              Legen
            </button>
          </>
        )}
        {myTurn && pending.length === 0 && canSwap && !swapMode && (
          <button type="button" className={`cs-button ${hint?.type === 'swap' ? 'cs-primary' : ''}`} onClick={() => (setSwapMode(true), setSelected(null))}>
            Tauschen
          </button>
        )}
        {swapMode && (
          <>
            <button type="button" className="cs-button" onClick={() => (setSwapMode(false), setSwapTiles([]))}>
              Abbrechen
            </button>
            <button type="button" className="cs-button cs-primary" disabled={!swapAllowed} onClick={() => onMove({ type: 'swap', tiles: swapTiles })}>
              {swapTiles.length || ''} tauschen
            </button>
          </>
        )}
        {pass && (
          <button type="button" className="cs-button cs-primary" onClick={() => onMove(pass)}>
            Passen
          </button>
        )}
      </div>
    </div>
  );
}

function SeatSymbol({ seat, className = '' }: { seat: SeatId; className?: string }) {
  // Jeder Platz bekommt einen eigenen Stein als Zeichen.
  const tiles = [3 * 6 * 4 + 0, 0 * 18 + 3 * 3, 3 * 18 + 2 * 3, 2 * 18 + 5 * 3];
  return <Tile tile={tiles[seat % tiles.length]!} className={`cs-symbol ${className}`} />;
}

export const gameUi: GameUi<ColorShapeState, ColorShapeMove> = {
  Board,
  SeatSymbol,
  sounds: { placed: 'stein-setzen' },
  seatLabel: (seat) => `Platz ${seat + 1}`,
  seatDetail: (view, seat) => `${view.scores[seat]} Punkte`,
};
