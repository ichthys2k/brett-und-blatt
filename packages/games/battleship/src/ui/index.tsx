import { Rng, type SeatId } from '@brett-und-blatt/engine';
import { useElementSize, type BoardProps, type GameUi } from '@brett-und-blatt/ui';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  CELLS,
  FLEETS,
  SIZE,
  colLabels,
  colOf,
  fleetProblem,
  formatCoord,
  knownWater,
  neighbors8,
  opponentOf,
  randomFleet,
  rowLabels,
  rowOf,
  salvoSize,
  shipCells,
  type BattleshipMove,
  type BattleshipState,
  type CoordMode,
  type Shot,
} from '../rules';
import './styles.css';

const SHIP_NAMES: Record<number, string> = { 5: 'Schlachtschiff', 4: 'Kreuzer', 3: 'Zerstörer', 2: 'U-Boot' };

interface CellLook {
  className: string;
  content?: ReactNode;
  label: string;
}

/** Ein Meer mit Koordinaten am Rand. Jede Zelle ist ein Knopf, auch per Tastatur bedienbar. */
function Sea({
  size,
  label,
  coords = 'classic',
  look,
  active,
  onCell,
  onHover,
  className = '',
}: {
  size: number;
  label: string;
  coords?: CoordMode;
  look: (cell: number) => CellLook;
  active?: (cell: number) => boolean;
  onCell?: (cell: number) => void;
  onHover?: (cell: number | null) => void;
  className?: string;
}) {
  const xLabels = colLabels(coords);
  const yLabels = rowLabels(coords);
  const cells: ReactNode[] = [];
  for (let cell = 0; cell < CELLS; cell++) {
    const { className: cellClass, content, label: cellLabel } = look(cell);
    const enabled = active?.(cell) ?? false;
    const axisBorder =
      coords === 'quadrants4'
        ? `${colOf(cell) === 4 ? 'bs-axis-r' : ''} ${colOf(cell) === 5 ? 'bs-axis-l' : ''} ${rowOf(cell) === 4 ? 'bs-axis-b' : ''} ${rowOf(cell) === 5 ? 'bs-axis-t' : ''}`
        : '';
    cells.push(
      <button
        key={cell}
        type="button"
        className={`bs-cell ${axisBorder} ${cellClass}`}
        disabled={!enabled}
        aria-label={`${formatCoord(cell, coords)}: ${cellLabel}`}
        onClick={enabled ? () => onCell?.(cell) : undefined}
        onPointerEnter={onHover ? () => onHover(cell) : undefined}
      >
        {content}
      </button>,
    );
  }
  return (
    <div className={`bs-sea-frame ${coords !== 'classic' ? `bs-coords-${coords}` : ''} ${className}`} style={{ width: size, height: size }}>
      <div className="bs-letters" aria-hidden="true">
        {xLabels.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
      <div className="bs-numbers" aria-hidden="true">
        {yLabels.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
      <div className="bs-sea" role="group" aria-label={label} onPointerLeave={onHover ? () => onHover(null) : undefined}>
        {cells}
        {coords === 'quadrants4' && (
          <div className="bs-axes-overlay" aria-hidden="true">
            <span className="bs-quad bs-quad-1">I</span>
            <span className="bs-quad bs-quad-2">II</span>
            <span className="bs-quad bs-quad-3">III</span>
            <span className="bs-quad bs-quad-4">IV</span>
            <span className="bs-axis-label bs-axis-x">x</span>
            <span className="bs-axis-label bs-axis-y">y</span>
          </div>
        )}
        {coords === 'quadrant1' && (
          <div className="bs-axes-overlay bs-axes-q1" aria-hidden="true">
            <span className="bs-axis-label bs-axis-x">x →</span>
            <span className="bs-axis-label bs-axis-y">↑ y</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Wie ein Feld im Meer des Gegners aussieht: nur, was man durch Schüsse weiß. */
function targetLook(view: BattleshipState, target: SeatId): (cell: number) => CellLook {
  const shots = new Map<number, Shot>((view.shots[opponentOf(target)] ?? []).map((s) => [s.cell, s]));
  const sunkCells = new Set((view.fleets[target] ?? []).filter((s) => s.sunk).flatMap((s) => s.cells));
  const water = view.autoWater ? knownWater(view, target) : new Set<number>();
  const aimed = new Set(view.turn === opponentOf(target) ? view.aim : []);
  return (cell) => {
    if (sunkCells.has(cell)) return { className: 'bs-sunk', content: <span className="bs-mark">✕</span>, label: 'versenkt' };
    const shot = shots.get(cell);
    if (shot?.result === 'hit') return { className: 'bs-hit', content: <span className="bs-mark">✕</span>, label: 'Treffer' };
    if (shot) return { className: 'bs-water', content: <span className="bs-dot" />, label: 'Wasser' };
    if (aimed.has(cell)) return { className: 'bs-aimed', content: <span className="bs-mark">◎</span>, label: 'anvisiert' };
    if (water.has(cell)) return { className: 'bs-known', content: <span className="bs-dot" />, label: 'sicher Wasser' };
    return { className: '', label: 'unbekannt' };
  };
}

/** Das eigene Meer: Schiffe und die Schüsse des Gegners darauf. */
function ownLook(view: BattleshipState, seat: SeatId): (cell: number) => CellLook {
  const ships = new Map<number, boolean>();
  for (const ship of view.fleets[seat] ?? []) for (const cell of ship.cells) ships.set(cell, ship.sunk);
  const shots = new Map<number, Shot>((view.shots[opponentOf(seat)] ?? []).map((s) => [s.cell, s]));
  return (cell) => {
    const ship = ships.get(cell);
    const shot = shots.get(cell);
    if (ship !== undefined) {
      if (shot) return { className: `bs-ship ${ship ? 'bs-sunk' : 'bs-hit'}`, content: <span className="bs-mark">✕</span>, label: ship ? 'eigenes Schiff, versenkt' : 'eigenes Schiff, getroffen' };
      return { className: 'bs-ship', label: 'eigenes Schiff' };
    }
    if (shot) return { className: 'bs-water', content: <span className="bs-dot" />, label: 'Wasser' };
    return { className: '', label: 'Wasser' };
  };
}

/** Die Flottenleiste: welche Schiffe noch schwimmen. */
function FleetBar({ view, owner, label }: { view: BattleshipState; owner: SeatId; label: string }) {
  const sunk = (view.fleets[owner] ?? []).filter((s) => s.sunk).map((s) => s.cells.length);
  const sizes = FLEETS[view.fleetKind].map((length) => {
    const i = sunk.indexOf(length);
    if (i >= 0) sunk.splice(i, 1);
    return { length, sunk: i >= 0 };
  });
  return (
    <ul className="bs-fleetbar" aria-label={label}>
      {sizes.map((ship, i) => (
        <li key={i} className={ship.sunk ? 'bs-gone' : ''} title={`${SHIP_NAMES[ship.length]}${ship.sunk ? ' (versenkt)' : ''}`}>
          {Array.from({ length: ship.length }, (_, k) => (
            <span key={k} />
          ))}
        </li>
      ))}
    </ul>
  );
}

/** Aufstellen: Schiff aus der Leiste wählen, Feld antippen; ein gesetztes Schiff antippen hebt es auf, noch einmal dreht es. */
function Placement({ view, size, onDone, hint }: { view: BattleshipState; size: number; onDone: (ships: number[][]) => void; hint: BattleshipMove | null }) {
  const sizes = FLEETS[view.fleetKind];
  const [ships, setShips] = useState<(number[] | null)[]>(() => sizes.map(() => null));
  const [selected, setSelected] = useState<number | null>(0);
  const [vertical, setVertical] = useState(false);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    if (hint?.type === 'placeFleet') {
      setShips(hint.ships.map((cells) => [...cells]));
      setSelected(null);
    }
  }, [hint]);

  const owner = new Map<number, number>();
  ships.forEach((cells, i) => cells?.forEach((c) => owner.set(c, i)));
  // Ungültig: Überlappen oder (Papierversion) Berühren mit einem anderen Schiff.
  const bad = new Set<number>();
  ships.forEach((cells, i) =>
    cells?.forEach((c) => {
      const clash = [c, ...(view.noTouch ? neighbors8(c) : [])].some((n) => owner.has(n) && owner.get(n) !== i) || ships.some((other, j) => j !== i && other?.includes(c));
      if (clash) bad.add(i);
    }),
  );
  const preview = selected !== null && hover !== null ? shipCells(hover, sizes[selected]!, vertical) : null;
  const complete = ships.every((s) => s !== null);
  const valid = complete && fleetProblem(ships, view.fleetKind, view.noTouch) === null;

  const place = (cell: number) => {
    const hit = owner.get(cell);
    if (hit !== undefined && hit !== selected) {
      // Gesetztes Schiff antippen: aufnehmen (zum Verschieben oder Drehen).
      setSelected(hit);
      setVertical(ships[hit]!.length > 1 && ships[hit]![1]! - ships[hit]![0]! === SIZE);
      return;
    }
    if (selected === null) return;
    if (hit === selected) {
      // Dasselbe Schiff noch einmal antippen: drehen, wenn es passt.
      const turned = shipCells(ships[hit]![0]!, sizes[hit]!, !vertical);
      if (turned) {
        setVertical(!vertical);
        setShips(ships.map((s, i) => (i === hit ? turned : s)));
      }
      return;
    }
    const cells = shipCells(cell, sizes[selected]!, vertical);
    if (!cells) return;
    const next = ships.map((s, i) => (i === selected ? cells : s));
    setShips(next);
    const open = next.findIndex((s) => s === null);
    setSelected(open >= 0 ? open : null);
  };

  const random = () => {
    const rng = new Rng([Date.now() >>> 0, (Math.random() * 2 ** 32) >>> 0, 7, 11]);
    setShips(randomFleet(view.fleetKind, view.noTouch, rng));
    setSelected(null);
  };

  const look = (cell: number): CellLook => {
    const i = owner.get(cell);
    const inPreview = preview?.includes(cell);
    if (i !== undefined) return { className: `bs-ship ${bad.has(i) ? 'bs-bad' : ''} ${i === selected ? 'bs-selected' : ''}`, label: SHIP_NAMES[sizes[i]!] ?? 'Schiff' };
    if (inPreview) return { className: 'bs-preview', label: 'Vorschau' };
    return { className: '', label: 'frei' };
  };

  return (
    <div className="bs-placement">
      <Sea size={size} coords={view.coords} label="Dein Meer – Schiffe aufstellen" look={look} active={() => true} onCell={place} onHover={setHover} />
      <div className="bs-shipyard" role="group" aria-label="Deine Schiffe">
        {sizes.map((length, i) => (
          <button
            key={i}
            type="button"
            className={`bs-yard-ship ${ships[i] ? 'bs-done' : ''} ${selected === i ? 'bs-selected' : ''} ${bad.has(i) ? 'bs-bad' : ''}`}
            aria-pressed={selected === i}
            aria-label={`${SHIP_NAMES[length]} (${length} Felder)${ships[i] ? ', gesetzt' : ''}`}
            onClick={() => setSelected(selected === i ? null : i)}
          >
            {Array.from({ length }, (_, k) => (
              <span key={k} />
            ))}
          </button>
        ))}
      </div>
      <p className="bs-help">
        {selected !== null ? `${SHIP_NAMES[sizes[selected]!]} (${sizes[selected]}): Feld antippen.` : complete ? (valid ? 'Alles gesetzt.' : 'Rot markierte Schiffe liegen zu nah beieinander.') : 'Schiff unten wählen.'}{' '}
        {view.noTouch ? 'Schiffe dürfen sich nicht berühren, auch nicht über Eck.' : ''}
      </p>
      <div className="bs-actions">
        <button type="button" className="bs-button" onClick={() => setVertical(!vertical)} aria-pressed={vertical}>
          ↻ {vertical ? 'senkrecht' : 'waagerecht'}
        </button>
        <button type="button" className="bs-button" onClick={random}>
          🎲 Zufällig
        </button>
        <button type="button" className="bs-button bs-primary" disabled={!valid} onClick={() => onDone(ships as number[][])}>
          ✓ Fertig
        </button>
      </div>
    </div>
  );
}

function Board({ view, legalMoves, onMove, viewer, seatNames, events, hint }: BoardProps<BattleshipState, BattleshipMove>) {
  const [ref, { width, height }] = useElementSize<HTMLDivElement>();
  const [ownBig, setOwnBig] = useState(false);
  const placing = legalMoves.some((m) => m.type === 'placeFleet');
  const canShoot = legalMoves.some((m) => m.type === 'shoot');
  const shootable = useMemo(() => new Set(legalMoves.flatMap((m) => (m.type === 'shoot' ? [m.cell] : []))), [legalMoves]);
  // Nebeneinander, wenn das Zielmeer dabei kaum kleiner wird als untereinander.
  const sideSize = Math.min(width / 2 - 24, height - 80);
  const stackSize = Math.min(width - 24, (height - 110) * 0.7);
  const wide = sideSize >= stackSize * 0.9;
  const name = (seat: SeatId) => seatNames[seat] ?? `Platz ${seat + 1}`;

  if (viewer !== 'spectator' && placing) {
    const size = Math.max(160, Math.min(width - 8, height - 190));
    return (
      <div ref={ref} className="bs-table">
        <Placement key={view.fleetKind} view={view} size={size} hint={hint} onDone={(ships) => onMove({ type: 'placeFleet', ships })} />
      </div>
    );
  }

  if (view.phase === 'place') {
    const waitingFor = view.placed.flatMap((done, seat) => (done ? [] : [seat]));
    const size = Math.max(140, Math.min(width - 8, height - 90));
    return (
      <div ref={ref} className="bs-table bs-center">
        <p className="bs-help">{waitingFor.length > 0 ? `${waitingFor.map(name).join(' und ')} stellt noch auf …` : ''}</p>
        {viewer !== 'spectator' && view.placed[viewer] && <Sea size={size} coords={view.coords} label="Deine Flotte" look={ownLook(view, viewer)} />}
      </div>
    );
  }

  const last = [...events].reverse().find((e) => e.type === 'shot') as { seat: SeatId; result: string; cell: number } | undefined;
  const sunkNow = events.some((e) => e.type === 'sunk');
  const news = last ? `${name(last.seat)}: ${formatCoord(last.cell, view.coords)} – ${sunkNow ? 'versenkt!' : last.result === 'water' ? 'Wasser' : 'Treffer!'}` : null;
  const shots = view.salvo && canShoot && viewer !== 'spectator' ? salvoSize(view, viewer) - view.aim.length : null;

  if (viewer === 'spectator') {
    const size = Math.max(100, wide ? sideSize : Math.min(width - 24, (height - 120) / 2));
    return (
      <div ref={ref} className={`bs-table ${wide ? 'bs-wide' : ''}`}>
        {news && <p className="bs-news">{news}</p>}
        <div className="bs-seas">
          {[0, 1].map((seat) => (
            <section key={seat} className="bs-side">
              <h3>Meer von {name(seat)}</h3>
              <Sea size={size} coords={view.coords} label={`Meer von ${name(seat)}`} look={targetLook(view, seat)} />
              <FleetBar view={view} owner={seat} label={`Flotte von ${name(seat)}`} />
            </section>
          ))}
        </div>
      </div>
    );
  }

  const target = opponentOf(viewer);
  const big = Math.max(120, wide ? sideSize : stackSize);
  const small = Math.max(80, wide ? big : ownBig ? stackSize : Math.min(width * 0.45, height - 110 - stackSize));
  const hintCell = hint?.type === 'shoot' ? hint.cell : null;
  const look = targetLook(view, target);

  const targetSea = (
    <section className="bs-side">
      <h3>Meer von {name(target)}</h3>
      <Sea
        size={big}
        coords={view.coords}
        label={`Meer von ${name(target)} – hierhin schießt du`}
        look={(cell) => {
          const l = look(cell);
          return cell === hintCell ? { ...l, className: `${l.className} bs-hint` } : l;
        }}
        active={(cell) => shootable.has(cell)}
        onCell={(cell) => onMove({ type: 'shoot', cell })}
        className={canShoot ? 'bs-armed' : ''}
      />
      <FleetBar view={view} owner={target} label={`Flotte von ${name(target)}`} />
    </section>
  );
  const ownSea = (
    <section className={`bs-side bs-own ${!wide && !ownBig ? 'bs-mini' : ''}`}>
      <button type="button" className="bs-toggle" disabled={wide} onClick={() => setOwnBig(!ownBig)} aria-expanded={wide || ownBig}>
        Deine Flotte {wide ? '' : ownBig ? '▴' : '▾'}
      </button>
      <Sea size={small} coords={view.coords} label="Dein Meer" look={ownLook(view, viewer)} />
    </section>
  );

  return (
    <div ref={ref} className={`bs-table ${wide ? 'bs-wide' : ''}`}>
      <p className="bs-news" aria-live="polite">
        {news ?? ' '}
        {shots !== null && shots > 0 && ` · noch ${shots} ${shots === 1 ? 'Schuss' : 'Schüsse'} in dieser Salve`}
      </p>
      <div className="bs-seas">
        {!wide && ownBig ? ownSea : targetSea}
        {!wide && ownBig ? null : ownSea}
      </div>
    </div>
  );
}

function SeatSymbol({ seat, className = '' }: { seat: SeatId; className?: string }) {
  return (
    <span className={`bs-symbol ${className}`} aria-hidden="true">
      {seat === 0 ? '🚢' : '⛴️'}
    </span>
  );
}

export const gameUi: GameUi<BattleshipState, BattleshipMove> = {
  Board,
  SeatSymbol,
  sounds: {
    placed: 'schiff-setzen',
    aimed: 'zielen',
    shot: (event) => (event.result === 'water' ? 'wasser' : 'schiff-treffer'),
    sunk: 'schiff-versenkt',
    won: 'flotte-versenkt',
  },
  seatLabel: (seat) => `Flotte ${seat + 1}`,
  seatDetail: (view, seat) => {
    if (view.phase === 'place') return view.placed[seat] ? 'aufgestellt' : 'stellt auf …';
    const total = FLEETS[view.fleetKind].length;
    const sunk = (view.fleets[seat] ?? []).filter((s) => s.sunk).length;
    return `${total - sunk} von ${total} Schiffen`;
  },
};
