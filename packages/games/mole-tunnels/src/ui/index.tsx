/**
 * Oberfläche für Maulwurfsgänge (M3): eigenes Brett mit SVG-Gängen, Schiebe-Pfeilen an allen
 * Schiebestellen, Freiteil mit Drehen und Vorschau, Laufen durch die verbundenen Gänge,
 * Handy-Layout und Tastaturbedienung. M4: Teile gleiten beim Schieben (CSS-Übergang auf `transform`,
 * Schlüssel = Teil-id), der Hase hüpft den Weg ab, Ernte und Nachwachsen haben kleine Effekte, Hasen,
 * Rübe und Maulwurf sind die gemalten Bilder aus dem Rübenacker (die SVG-Figuren bleiben Rückfall),
 * Klänge laufen über `gameUi.sounds`. Alles Bewegte ist reine Anzeige: nichts wartet darauf, und bei
 * `prefers-reduced-motion` springt alles sofort. Alle Klassen tragen das Präfix mt-.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FocusEvent as ReactFocusEvent, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import type { SeatId } from '@brett-und-blatt/engine';
import { teilImage, type TeilName } from '@brett-und-blatt/game-turnip-patch/teile';
import { FitBox, type BoardProps, type GameUi } from '@brett-und-blatt/ui';
import { describeMove, KIND_NAMES } from '../describe';
import {
  E,
  N,
  S,
  W,
  isFixed,
  isPushForbidden,
  pathTo,
  pushGeometry,
  pushTile,
  reachable,
  result,
  rotated,
  rotations,
  tileMask,
  type MoleMove,
  type MoleState,
  type Pos,
  type Rot,
  type Tile,
} from '../rules';
import { arrowCenter, hareSlots, openingNames, pushRing, type PushSpot } from './helpers';
import { useMoveFx } from './useMoveFx';
import './styles.css';

const SEAT_NAMES = ['Rot', 'Blau', 'Grün', 'Gelb'];
/** Spielerfarben (Rückfall-Hase, Zahlenplakette); die gemalten Hasen tragen dieselben Farben an Mütze und Halstuch. */
const SEAT_COLORS = ['#c0392b', '#2c6fbb', '#2e8b57', '#d9a516'];
const HARE_IMAGES: TeilName[] = ['hase-rot', 'hase-blau', 'hase-gruen', 'hase-gelb'];

const hareImage = (seat: SeatId) => teilImage(HARE_IMAGES[seat % HARE_IMAGES.length]!);

/** Gerätevorliebe: erreichbare Felder leuchten lassen (nur Anzeige, ändert keine Regel). */
const REACH_KEY = 'brett-und-blatt:maulwurf-leuchtfelder';
function loadReach(): boolean {
  try {
    return window.localStorage.getItem(REACH_KEY) !== 'aus';
  } catch {
    return true;
  }
}
function saveReach(on: boolean) {
  try {
    window.localStorage.setItem(REACH_KEY, on ? 'an' : 'aus');
  } catch {
    // ohne Speicher bleibt es bei der Sitzung
  }
}

const ARMS: { bit: number; x: number; y: number }[] = [
  { bit: N, x: 50, y: 0 },
  { bit: E, x: 100, y: 50 },
  { bit: S, x: 50, y: 100 },
  { bit: W, x: 0, y: 50 },
];

// ------------------------------------------------------------------ Figuren

/** Eine Rübe um den Nullpunkt (etwa 36 × 52 Einheiten). */
function TurnipShape() {
  return (
    <g>
      <path className="mt-halo" d="M-17,-4 Q-17,18 0,23 Q17,18 17,-4 Q0,-12 -17,-4Z" />
      <path className="mt-turnip-leaf" d="M0,-8 C-6,-22 -14,-26 -19,-22 M0,-8 C0,-24 4,-31 9,-31 M0,-8 C6,-20 14,-22 19,-18" />
      <path className="mt-turnip-bulb" d="M-17,-4 Q-17,18 0,23 Q17,18 17,-4 Q0,-12 -17,-4Z" />
      <path className="mt-turnip-cap" d="M-17,-4 Q0,-12 17,-4 Q10,3 0,3 Q-10,3 -17,-4Z" />
    </g>
  );
}

/** Gärtner Maulwurf von vorn um den Nullpunkt (etwa 56 × 44 Einheiten). */
function MoleShape() {
  return (
    <g>
      <ellipse className="mt-halo" cx="0" cy="2" rx="27" ry="21" />
      <ellipse className="mt-mole-body" cx="0" cy="2" rx="25" ry="19" />
      <ellipse className="mt-mole-claw" cx="-15" cy="17" rx="7" ry="4" />
      <ellipse className="mt-mole-claw" cx="15" cy="17" rx="7" ry="4" />
      <circle className="mt-mole-eye" cx="-9" cy="-4" r="3" />
      <circle className="mt-mole-eye" cx="9" cy="-4" r="3" />
      <ellipse className="mt-mole-nose" cx="0" cy="5" rx="7" ry="5" />
    </g>
  );
}

/** Ein Hase in Spielerfarbe um den Nullpunkt (etwa 30 × 40 Einheiten), mit Platznummer. */
function HareShape({ seat, active }: { seat: SeatId; active?: boolean }) {
  const color = SEAT_COLORS[seat % SEAT_COLORS.length]!;
  const shapes = (
    <>
      <ellipse cx="-7" cy="-17" rx="4.6" ry="10" />
      <ellipse cx="7" cy="-17" rx="4.6" ry="10" />
      <circle cx="0" cy="2" r="13" />
    </>
  );
  return (
    <g>
      {active && <circle className="mt-active-ring" cx="0" cy="-4" r="25" />}
      <g className="mt-halo">{shapes}</g>
      <g fill={color} className="mt-hare-body">
        {shapes}
      </g>
      <text className="mt-hare-no" x="0" y="7" textAnchor="middle">
        {seat + 1}
      </text>
    </g>
  );
}

type TileFx = 'harvest' | 'sprout';

/** Ein Gangteil mit allem, was fest darauf liegt (Rübe, Maulwurf); die Hasen laufen auf einer eigenen Ebene. */
function TileArt({ tile, fixed, fx }: { tile: Tile; fixed: boolean; fx?: TileFx }) {
  const mask = tileMask(tile);
  const arms = ARMS.filter((arm) => mask & arm.bit);
  const turnipUrl = teilImage('ruebe');
  const moleUrl = teilImage('maulwurf');
  const small = tile.mole;
  return (
    <svg className="mt-art" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <rect className={fixed ? 'mt-soil mt-soil-fixed' : 'mt-soil'} x="1" y="1" width="98" height="98" rx="8" />
      {fixed && (
        <g className="mt-stud">
          <circle cx="9" cy="9" r="4" />
          <circle cx="91" cy="9" r="4" />
          <circle cx="9" cy="91" r="4" />
          <circle cx="91" cy="91" r="4" />
        </g>
      )}
      <g className="mt-rim">
        {arms.map((arm) => (
          <line key={arm.bit} x1="50" y1="50" x2={arm.x} y2={arm.y} />
        ))}
        <circle cx="50" cy="50" r="23" />
      </g>
      <g className="mt-way">
        {arms.map((arm) => (
          <line key={arm.bit} x1="50" y1="50" x2={arm.x} y2={arm.y} />
        ))}
        <circle cx="50" cy="50" r="19" />
      </g>
      {tile.mole && (
        <>
          <rect className="mt-mole-shade" x="1" y="1" width="98" height="98" rx="8" />
          {moleUrl ? (
            <image className="mt-pic" href={moleUrl} x="12" y="14" width="76" height="76" />
          ) : (
            <g transform="translate(50 52) scale(1.2)">
              <MoleShape />
            </g>
          )}
        </>
      )}
      {tile.turnip && (
        <g className={fx === 'sprout' ? 'mt-fx-sprout' : undefined}>
          {turnipUrl ? (
            <image className="mt-pic" href={turnipUrl} x={small ? 56 : 20} y={small ? 4 : 12} width={small ? 40 : 60} height={small ? 40 : 60} />
          ) : (
            <g transform={`translate(${small ? 76 : 50} ${small ? 26 : 42}) scale(${small ? 0.6 : 0.95})`}>
              <TurnipShape />
            </g>
          )}
        </g>
      )}
      {fx === 'harvest' && (
        <g className="mt-fx-harvest">
          {turnipUrl ? (
            <image href={turnipUrl} x="20" y="12" width="60" height="60" />
          ) : (
            <g transform="translate(50 42) scale(0.95)">
              <TurnipShape />
            </g>
          )}
        </g>
      )}
      {fx === 'harvest' && <circle className="mt-fx-ring" cx="50" cy="50" r="30" />}
    </svg>
  );
}

/** Ein Hase auf der Hasenebene: gemaltes Bild mit Zahlenplakette (nie nur Farbe), Rückfall ist die SVG-Figur. */
function HareSprite({ seat }: { seat: SeatId }) {
  const url = hareImage(seat);
  const color = SEAT_COLORS[seat % SEAT_COLORS.length]!;
  return (
    <>
      {url ? (
        <img className="mt-hare-img" src={url} alt="" draggable={false} />
      ) : (
        <svg className="mt-hare-img" viewBox="-18 -30 36 46" aria-hidden="true" focusable="false">
          <HareShape seat={seat} />
        </svg>
      )}
      <span className="mt-hare-badge" style={{ borderColor: color }} aria-hidden="true">
        {seat + 1}
      </span>
    </>
  );
}

function SeatSymbol({ seat, className = '' }: { seat: SeatId; seats?: number; className?: string }) {
  const url = hareImage(seat);
  const color = SEAT_COLORS[seat % SEAT_COLORS.length]!;
  return (
    <span className={`mt-seat-symbol ${className}`} style={{ borderColor: color }} aria-hidden="true">
      {url ? <img src={url} alt="" draggable={false} /> : <svg viewBox="-18 -30 36 46" focusable="false"><HareShape seat={seat} /></svg>}
      <b style={{ background: color }}>{seat + 1}</b>
    </span>
  );
}

function TurnipIcon() {
  const url = teilImage('ruebe');
  if (url) return <img className="mt-turnip-icon" src={url} alt="" draggable={false} />;
  return (
    <svg className="mt-turnip-icon" viewBox="-22 -34 44 62" aria-hidden="true" focusable="false">
      <TurnipShape />
    </svg>
  );
}

function ArrowGlyph({ side, locked }: { side: PushSpot['side']; locked: boolean }) {
  const turn = { top: 0, right: 90, bottom: 180, left: 270 }[side];
  if (locked) {
    return (
      <svg className="mt-arrow-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path className="mt-lock" d="M7 11V8a5 5 0 0 1 10 0v3h1.5v10h-13V11zm2.2 0h5.6V8a2.8 2.8 0 0 0-5.6 0z" />
      </svg>
    );
  }
  return (
    <svg className="mt-arrow-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={{ transform: `rotate(${turn}deg)` }}>
      <path className="mt-arrow-shape" d="M3 6h18L12 20z" />
    </svg>
  );
}

// ------------------------------------------------------------------- Brett

function pushKey(spot: PushSpot): string {
  return `${spot.side}:${spot.index}`;
}

/** Kann dieses Gerät ein Fingerzeig sein (Handy)? Dann schiebt erst der zweite Tipp. */
type PointerKind = 'mouse' | 'touch' | 'pen' | 'key';

function Board({ view, legalMoves, onMove, hint, seatNames, events }: BoardProps<MoleState, MoleMove>) {
  const n = view.size;
  const over = result(view) !== null;
  const yourMove = legalMoves.length > 0 && !over;
  const canPush = yourMove && view.phase === 'push';
  const canWalk = yourMove && view.phase === 'walk';
  const name = (seat: SeatId) => seatNames[seat] ?? SEAT_NAMES[seat] ?? `Platz ${seat + 1}`;

  const wrapRef = useRef<HTMLDivElement>(null);
  const pointer = useRef<{ kind: PointerKind; wasSelected: boolean }>({ kind: 'mouse', wasSelected: false });

  // Freiteil: zusätzliche Vierteldrehungen; mit jedem neuen Freiteil beginnt es bei 0.
  const [rotState, setRotState] = useState({ id: -1, turns: 0 });
  const turns = rotState.id === view.spare.id ? rotState.turns : 0;
  const spareShown = rotated(view.spare, turns);
  const rotate = () => setRotState({ id: view.spare.id, turns: (turns + 1) % rotations(view.spare.kind) });

  // Gewählte (Fingertipp oder Tastatur) und überfahrene (Maus) Schiebestelle.
  const [selected, setSelected] = useState<{ side: PushSpot['side']; index: number; spare: number } | null>(null);
  const [hover, setHover] = useState<PushSpot | null>(null);
  const [aim, setAim] = useState<Pos | null>(null);

  const pushMoves = new Map<string, MoleMove[]>();
  const walkMoves = new Map<number, Extract<MoleMove, { type: 'walk' }>>();
  for (const move of legalMoves) {
    if (move.type === 'push') {
      const key = pushKey(move);
      pushMoves.set(key, [...(pushMoves.get(key) ?? []), move]);
    } else walkMoves.set(move.to[0] * n + move.to[1], move);
  }

  const chosen: PushSpot | null = (() => {
    if (!canPush) return null;
    const spot = hover ?? (selected && selected.spare === view.spare.id ? selected : null);
    return spot && pushMoves.has(pushKey(spot)) ? spot : null;
  })();
  const chosenMove = chosen ? ((pushMoves.get(pushKey(chosen)) ?? []).find((m) => m.type === 'push' && m.rot === turns) ?? null) : null;

  const preview = useMemo(() => (chosen ? pushTile(view, chosen.side, chosen.index, turns) : null), [view, chosen?.side, chosen?.index, turns]);
  const shownCells = preview?.cells ?? view.cells;
  const shownHares = preview?.hares ?? view.hares;

  // Erreichbare Felder: beim Laufen die echten Ziele, in der Schub-Vorschau eine blasse Vorschau.
  const softReach = useMemo(() => {
    if (!preview) return new Set<number>();
    const from = preview.hares[view.turn];
    return new Set(from ? reachable({ size: n, cells: preview.cells }, from).map(([r, c]) => r * n + c) : []);
  }, [preview, n, view.turn]);

  const turnHare = view.hares[view.turn]!;
  const path = canWalk && aim ? pathTo(view, turnHare, aim) : null;

  // Bewegung: Schieben, Hüpfen, Ernte (nur Anzeige; bei reduzierter Bewegung springt alles).
  const previewShown = useRef(false);
  const { push: pushFx, walk: walkFx, done: doneFx } = useMoveFx(view, events, previewShown);
  const [reach, setReach] = useState(loadReach);
  const toggleReach = () => {
    saveReach(!reach);
    setReach(!reach);
  };
  const tileFor = (tile: Tile): Tile => {
    if (walkFx && tile.id === walkFx.harvest) return { ...tile, turnip: true };
    if (walkFx && tile.id === walkFx.sprout) return { ...tile, turnip: false };
    return tile;
  };
  const fxFor = (tile: Tile): TileFx | undefined => (doneFx?.harvest === tile.id ? 'harvest' : doneFx?.sprout === tile.id ? 'sprout' : undefined);

  // Hasen: eigene Ebene; der laufende Hase folgt dem Weg Feld für Feld.
  const placed = shownHares.map((pos, seat): Pos => (walkFx && walkFx.seat === seat ? (walkFx.path[walkFx.step] ?? pos) : pos));
  const seatsAt = new Map<number, SeatId[]>();
  placed.forEach(([r, c], seat) => seatsAt.set(r * n + c, [...(seatsAt.get(r * n + c) ?? []), seat]));
  const lastPlaced = useRef<Pos[]>([]);
  const facing = useRef<Record<number, 1 | -1>>({});
  if (walkFx && walkFx.step > 0) {
    const a = walkFx.path[walkFx.step - 1]!;
    const b = walkFx.path[walkFx.step]!;
    if (b[1] !== a[1]) facing.current[walkFx.seat] = b[1] > a[1] ? 1 : -1;
  }
  // Springt ein Hase mehr als ein Feld (mit dem hinausgeschobenen Teil), gleitet er nicht quer übers Brett.
  const jumping = new Set<number>();
  placed.forEach(([r, c], seat) => {
    const before = lastPlaced.current[seat];
    if (before && Math.abs(before[0] - r) + Math.abs(before[1] - c) > 1) jumping.add(seat);
  });
  useLayoutEffect(() => {
    lastPlaced.current = placed;
  });

  const hintPush = hint?.type === 'push' ? hint : null;
  const hintWalk = hint?.type === 'walk' ? hint : null;

  const doPush = (spot: PushSpot) => {
    const move = (pushMoves.get(pushKey(spot)) ?? []).find((m) => m.type === 'push' && m.rot === turns);
    if (!move) return;
    previewShown.current = chosen?.side === spot.side && chosen.index === spot.index;
    setSelected(null);
    setHover(null);
    onMove(move);
  };

  // Taste R dreht das Freiteil, solange man schieben darf (auch ohne Fokus im Brett).
  useEffect(() => {
    if (!canPush) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key !== 'r' && event.key !== 'R') return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      event.preventDefault();
      setRotState({ id: view.spare.id, turns: (turns + 1) % rotations(view.spare.kind) });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canPush, view.spare.id, view.spare.kind, turns]);

  // Wer mit Tastatur oder Controller spielt, soll nach jedem Schritt wieder im Brett landen:
  // beim Laufen auf dem eigenen Feld, beim Schieben auf dem ersten erlaubten Pfeil.
  const stepKey = `${view.phase}:${view.moves}:${yourMove}`;
  useEffect(() => {
    if (!yourMove || typeof document === 'undefined') return;
    if (document.documentElement.dataset.inputMode === 'pointer') return;
    const active = document.activeElement;
    if (active && active !== document.body && wrapRef.current && !wrapRef.current.contains(active)) return;
    const root = wrapRef.current;
    const target = root?.querySelector<HTMLElement>(view.phase === 'walk' ? '.mt-target[data-self]' : '.mt-arrow:not(:disabled)');
    target?.focus({ preventScroll: true });
  }, [stepKey]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    pointer.current.kind = 'key';
    if (event.key === 'Escape') {
      if (selected || hover) {
        event.preventDefault();
        event.stopPropagation();
        setSelected(null);
        setHover(null);
      }
      return;
    }
  };

  const onWrapBlur = (event: ReactFocusEvent<HTMLDivElement>) => {
    if (!event.relatedTarget || !wrapRef.current?.contains(event.relatedTarget as Node)) setAim(null);
  };

  // Statuszeile
  const turnName = name(view.turn);
  const stayMove = walkMoves.get(turnHare[0] * n + turnHare[1]);
  const status = (() => {
    if (over) return 'Die Partie ist zu Ende.';
    if (!yourMove) return view.phase === 'push' ? `${turnName} schiebt ein Gangteil ein …` : `${turnName} sucht den Weg zu einer Rübe …`;
    if (view.phase === 'push') {
      return chosen ? 'Gefällt dir der Schub? Dann schiebe ein – oder wähle einen anderen Pfeil.' : 'Drehe das Freiteil und schiebe es an einem Pfeil ein.';
    }
    return 'Tippe ein leuchtendes Feld an – oder bleib stehen.';
  })();
  const hintText = hint && yourMove ? `Tipp: ${describeMove(view, hint)}` : null;

  const field = (
    <div className="mt-board" style={{ '--mt-n': n } as CSSProperties}>
      <div className="mt-field" role="group" aria-label={`Spielfeld, ${n} mal ${n} Teile`}>
        {chosen && (
          <div
            className="mt-line"
            style={
              chosen.side === 'top' || chosen.side === 'bottom'
                ? { left: `${(chosen.index / n) * 100}%`, top: 0, width: `${100 / n}%`, height: '100%' }
                : { top: `${(chosen.index / n) * 100}%`, left: 0, height: `${100 / n}%`, width: '100%' }
            }
          />
        )}
        {shownCells.map((tile, index) => {
          const row = Math.floor(index / n);
          const col = index % n;
          const isPreviewTile = preview !== null && tile.id === view.spare.id;
          const entering = pushFx !== null && !pushFx.fromPreview && tile.id === pushFx.entered;
          return (
            <div
              key={tile.id}
              className="mt-tile"
              data-tile={tile.id}
              data-ghost={isPreviewTile || undefined}
              data-enter={entering || undefined}
              data-soft={(reach && canPush && softReach.has(index)) || undefined}
              style={({ '--mt-r': row, '--mt-c': col, ...(entering ? { '--mt-dr': pushFx.dr, '--mt-dc': pushFx.dc } : {}) }) as CSSProperties}
            >
              <TileArt tile={tileFor(tile)} fixed={isFixed(row, col)} fx={fxFor(tile)} />
            </div>
          );
        })}
        {pushFx && (
          <div
            key={`exit-${pushFx.key}`}
            className="mt-tile mt-exit"
            data-from-preview={pushFx.fromPreview || undefined}
            style={
              {
                '--mt-r': pushFx.exit[0] + (pushFx.fromPreview ? pushFx.dr : 0),
                '--mt-c': pushFx.exit[1] + (pushFx.fromPreview ? pushFx.dc : 0),
                '--mt-dr': pushFx.dr,
                '--mt-dc': pushFx.dc,
              } as CSSProperties
            }
          >
            <TileArt tile={pushFx.out} fixed={false} />
          </div>
        )}
        {preview && chosen && !pushFx && (
          // Vorschau: auch das Teil, das hinausfallen würde, bleibt blass hinter dem Rand sichtbar.
          <div
            key="exit-preview"
            className="mt-tile mt-exit mt-exit-preview"
            style={
              {
                '--mt-r': pushGeometry(n, chosen.side, chosen.index).exit[0] + pushGeometry(n, chosen.side, chosen.index).dr,
                '--mt-c': pushGeometry(n, chosen.side, chosen.index).exit[1] + pushGeometry(n, chosen.side, chosen.index).dc,
              } as CSSProperties
            }
          >
            <TileArt tile={preview.out} fixed={false} />
          </div>
        )}
        {path && path.length > 1 && (
          <svg className="mt-path" viewBox={`0 0 ${n} ${n}`} aria-hidden="true" focusable="false">
            <polyline className="mt-path-under" points={path.map(([r, c]) => `${c + 0.5},${r + 0.5}`).join(' ')} />
            <polyline className="mt-path-line" points={path.map(([r, c]) => `${c + 0.5},${r + 0.5}`).join(' ')} />
          </svg>
        )}
        <div className="mt-hares" aria-hidden="true">
          {placed.map(([row, col], seat) => {
            const group = seatsAt.get(row * n + col) ?? [seat];
            const slot = hareSlots(group.length)[Math.max(0, group.indexOf(seat))] ?? hareSlots(1)[0]!;
            const walking = walkFx?.seat === seat;
            return (
              <div
                key={seat}
                className="mt-hare"
                data-seat={seat}
                data-active={(!over && seat === view.turn) || undefined}
                data-jump={jumping.has(seat) || undefined}
                data-walking={(walking && walkFx.step > 0) || undefined}
                style={
                  {
                    '--mt-r': row,
                    '--mt-c': col,
                    '--mt-x': slot.x,
                    '--mt-y': slot.y,
                    '--mt-s': slot.scale,
                    '--mt-face': facing.current[seat] ?? 1,
                    '--mt-hop-ms': walking ? `${walkFx.stepMs}ms` : undefined,
                  } as CSSProperties
                }
              >
                <span key={walking ? walkFx.step : 0} className="mt-hop">
                  <HareSprite seat={seat} />
                </span>
              </div>
            );
          })}
        </div>
        {canWalk &&
          [...walkMoves.values()].map((move) => {
            const [row, col] = move.to;
            const tile = view.cells[row * n + col]!;
            const self = row === turnHare[0] && col === turnHare[1];
            const harvest = tile.turnip && !tile.mole;
            return (
              <button
                key={`${row},${col}`}
                type="button"
                className="mt-target"
                data-mt-target={`${row},${col}`}
                data-self={self || undefined}
                data-harvest={harvest || undefined}
                data-hint={(hintWalk && hintWalk.to[0] === row && hintWalk.to[1] === col) || undefined}
                style={{ '--mt-r': row, '--mt-c': col } as CSSProperties}
                aria-label={describeMove(view, move)}
                onPointerEnter={(e) => e.pointerType === 'mouse' && setAim([row, col])}
                onPointerLeave={() => setAim(null)}
                onFocus={() => setAim([row, col])}
                onClick={() => onMove(move)}
              />
            );
          })}
      </div>
      {pushRing(n).map((spot) => {
        const key = pushKey(spot);
        const legal = canPush && pushMoves.has(key);
        const locked = view.phase === 'push' && !over && isPushForbidden(view, spot.side, spot.index);
        const center = arrowCenter(n, spot.side, spot.index);
        const base = describeMove(view, { type: 'push', side: spot.side, index: spot.index, rot: turns as Rot });
        const isSelected = chosen?.side === spot.side && chosen.index === spot.index;
        return (
          <button
            key={key}
            type="button"
            className="mt-arrow"
            data-mt-push={key}
            data-side={spot.side}
            data-locked={locked || undefined}
            data-selected={isSelected || undefined}
            data-hint={(legal && hintPush?.side === spot.side && hintPush.index === spot.index) || undefined}
            style={{ left: `${center.x * 100}%`, top: `${center.y * 100}%` }}
            disabled={!legal}
            aria-label={locked ? `${base} – gesperrt, den Schub des Vorgängers darfst du nicht zurückschieben` : base}
            aria-pressed={legal ? isSelected : undefined}
            onPointerDown={(e: ReactPointerEvent<HTMLButtonElement>) => {
              pointer.current = { kind: e.pointerType as PointerKind, wasSelected: isSelected && selected !== null };
            }}
            onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(spot)}
            onPointerLeave={() => setHover(null)}
            onFocus={() => setSelected({ ...spot, spare: view.spare.id })}
            onClick={(e) => {
              const kind: PointerKind = e.detail === 0 ? 'key' : pointer.current.kind;
              if (kind === 'touch' && !pointer.current.wasSelected) {
                // Erster Tipp zeigt nur die Vorschau; zweiter Tipp oder „Einschieben“ schiebt.
                setSelected({ ...spot, spare: view.spare.id });
                return;
              }
              doPush(spot);
            }}
          >
            <ArrowGlyph side={spot.side} locked={locked} />
          </button>
        );
      })}
    </div>
  );

  const mask = tileMask(spareShown);
  const stayText = stayMove ? (describeMove(view, stayMove).includes('Rübe') ? 'Bleiben und ernten' : 'Bleiben') : 'Bleiben';
  const goal = view.options.goal;

  return (
    <div className="mt-wrap" ref={wrapRef} data-reach={reach ? 'on' : 'off'} data-phase={view.phase} data-yours={yourMove || undefined} onKeyDown={onKeyDown} onBlur={onWrapBlur}>
      <div className="mt-layout">
        <div className="mt-status" role="status" aria-live="polite">
          <ol className="mt-steps" aria-label="Schritte deines Zugs">
            <li data-on={(view.phase === 'push' && !over) || undefined} aria-current={view.phase === 'push' && !over ? 'step' : undefined}>
              <span className="mt-step-no">1</span> Schieben
            </li>
            <li data-on={(view.phase === 'walk' && !over) || undefined} aria-current={view.phase === 'walk' && !over ? 'step' : undefined}>
              <span className="mt-step-no">2</span> Laufen
            </li>
          </ol>
          <p className="mt-status-text">{status}</p>
          {hintText && <p className="mt-hint-text">{hintText}</p>}
        </div>

        <div className="mt-stage">
          <FitBox ratio={1}>{field}</FitBox>
        </div>

        <div className="mt-side">
          <section className="mt-spare-box" aria-label="Freiteil">
            <h3 className="mt-side-title">Freiteil</h3>
            <button
              type="button"
              className="mt-spare"
              onClick={rotate}
              disabled={!canPush}
              aria-label={`Freiteil: ${KIND_NAMES[view.spare.kind]}, offen nach ${openingNames(mask)}. Antippen dreht um eine Vierteldrehung (Taste R).`}
            >
              <span className="mt-tile mt-tile-spare" data-tile={spareShown.id}>
                <TileArt tile={spareShown} fixed={false} />
              </span>
            </button>
            <div className="mt-actions">
              <button type="button" className="mt-btn" onClick={rotate} disabled={!canPush}>
                <span aria-hidden="true">↻</span> Drehen <kbd>R</kbd>
              </button>
              {canPush && (
                <button type="button" className="mt-btn mt-btn-primary" disabled={!chosenMove} onClick={() => chosen && doPush(chosen)} aria-label={chosenMove ? `Einschieben: ${describeMove(view, chosenMove)}` : 'Einschieben – zuerst einen Pfeil wählen'}>
                  Einschieben <span aria-hidden="true">✓</span>
                </button>
              )}
              {canWalk && stayMove && (
                <button type="button" className="mt-btn mt-btn-primary" onClick={() => onMove(stayMove)} aria-label={describeMove(view, stayMove)}>
                  {stayText}
                </button>
              )}
            </div>
          </section>
          <ul className="mt-scores" data-seats={view.hares.length} aria-label="Rüben je Hase">
            {view.hares.map((_, seat) => (
              <li key={seat} className="mt-score" data-active={(!over && seat === view.turn) || undefined} aria-current={!over && seat === view.turn ? 'true' : undefined}>
                <SeatSymbol seat={seat} />
                <span className="mt-score-name">{name(seat)}</span>
                <span className="mt-score-count" data-bump={(doneFx?.seat === seat && doneFx.harvest !== null) || undefined} aria-label={`${view.harvested[seat] ?? 0} von ${goal} Rüben`}>
                  <TurnipIcon /> {view.harvested[seat] ?? 0}<span className="mt-score-goal"> / {goal}</span>
                </span>
              </li>
            ))}
          </ul>
          <button type="button" className="mt-reach-toggle" aria-pressed={reach} onClick={toggleReach}>
            Leuchtfelder: {reach ? 'an' : 'aus'}
          </button>
        </div>
      </div>
    </div>
  );
}

export const gameUi: GameUi<MoleState, MoleMove> = {
  Board,
  SeatSymbol,
  seatLabel: (seat) => SEAT_NAMES[seat] ?? `Platz ${seat + 1}`,
  seatScore: (view, seat) => view.harvested[seat] ?? 0,
  seatDetail: (view) => `von ${view.options.goal} Rüben`,
  // Vorläufig aus dem Katalog gewählt (M4); Cornelius wählt die endgültige Zuordnung. Sieg, Niederlage,
  // Zeit und „Dein Zug“ vertont die Plattform selbst.
  sounds: {
    push: 'stein-schiefer',
    // Stehenbleiben ist kein Hüpfen.
    walk: (event) => (Array.isArray(event.path) && event.path.length > 1 ? 'ruebenacker-hopps' : null),
    harvest: 'punkte-sammeln',
  },
};
