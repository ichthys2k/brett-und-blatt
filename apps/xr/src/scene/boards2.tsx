/**
 * Weitere Spiele mit 3D-Figuren (#349): Reversi, Gomoku und Go auf einem gemeinsamen
 * Steinbrett, dazu Dame und Mühle. Wie in boards.tsx gilt: Gezeigt wird nur die Sicht,
 * anklickbar sind nur Ziele aus `legalMoves`, geschickt wird der Eintrag selbst.
 */
import { useState, type ReactNode } from 'react';
import { TABLE_CENTER } from './Tavern';
import { GOLD } from './text';
import type { BoardProps } from './boards';
import { pulse } from '../haptics';
import { movesFor, useGrab } from './grab';

const TOP = TABLE_CENTER[1] + 0.002;
const BOARD = 0.42;
const DARK = '#1f1712';
const LIGHT = '#efe3c8';

function Plate({ size, color, children }: { size: number; color: string; children?: ReactNode }) {
  return (
    <group position={[TABLE_CENTER[0], TOP, TABLE_CENTER[2]]}>
      <mesh position={[0, 0.008, 0]}>
        <boxGeometry args={[size, 0.016, size]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      {children}
    </group>
  );
}

/** Ein anklickbares, leuchtendes Ziel; flach auf dem Brett. */
function Spot({ x, z, r, onPress, y = 0.019 }: { x: number; z: number; r: number; onPress: () => void; y?: number }) {
  const [hover, setHover] = useState(false);
  return (
    <mesh
      position={[x, y, z]}
      rotation={[-Math.PI / 2, 0, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onPress();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
        pulse('hover');
      }}
      onPointerOut={() => setHover(false)}
    >
      <circleGeometry args={[r, 24]} />
      <meshBasicMaterial color={GOLD} transparent opacity={hover ? 0.95 : 0.6} toneMapped={false} />
    </mesh>
  );
}

function Stone({ x, z, r, white, glow = false }: { x: number; z: number; r: number; white: boolean; glow?: boolean }) {
  return (
    <mesh position={[x, 0.016 + r * 0.25, z]} scale={[1, 0.38, 1]}>
      <sphereGeometry args={[r, 20, 12]} />
      <meshStandardMaterial color={white ? LIGHT : DARK} roughness={0.35} emissive={glow ? GOLD : '#000000'} emissiveIntensity={glow ? 0.5 : 0} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Steinbrett für Reversi (Felder), Gomoku und Go (Schnittpunkte)

interface GridSpec {
  size: number;
  /** Steine auf Schnittpunkten (Go, Gomoku) statt in Feldern (Reversi). */
  points: boolean;
  /** Farbe eines Feldes: true = weißer Stein, false = schwarzer, null = leer. */
  stone(index: number): boolean | null;
  /** Feld des Zugs, null wenn der Zug nicht aufs Brett gehört (Passen, Auszählen …). */
  targetOf(move: unknown): number | null;
  surface: string;
  lines: string;
  last?: number | null;
}

function GridBoard({ game, onMove, spec }: BoardProps & { spec: GridSpec }) {
  const { size, points } = spec;
  const cell = BOARD / size;
  const offset = (size - 1) / 2;
  const at = (index: number): [number, number] => [((index % size) - offset) * cell, (Math.floor(index / size) - offset) * cell];
  const lines: ReactNode[] = [];
  const extent = points ? (size - 1) * cell : size * cell;
  for (let i = 0; i <= (points ? size - 1 : size); i++) {
    const pos = points ? (i - offset) * cell : (i - size / 2) * cell;
    lines.push(
      <mesh key={`h${i}`} position={[0, 0.0165, pos]}>
        <boxGeometry args={[extent, 0.001, 0.0018]} />
        <meshBasicMaterial color={spec.lines} />
      </mesh>,
      <mesh key={`v${i}`} position={[pos, 0.0165, 0]}>
        <boxGeometry args={[0.0018, 0.001, extent]} />
        <meshBasicMaterial color={spec.lines} />
      </mesh>,
    );
  }
  const r = cell * 0.43;
  return (
    <Plate size={BOARD + (points ? cell : 0.02)} color={spec.surface}>
      {lines}
      {Array.from({ length: size * size }, (_, i) => {
        const white = spec.stone(i);
        if (white === null) return null;
        const [x, z] = at(i);
        return <Stone key={i} x={x} z={z} r={r} white={white} glow={spec.last === i} />;
      })}
      {game.legalMoves.map((move, i) => {
        const target = spec.targetOf(move);
        if (target === null) return null;
        const [x, z] = at(target);
        return <Spot key={i} x={x} z={z} r={r * 0.75} onPress={() => onMove(move)} />;
      })}
    </Plate>
  );
}

export function ReversiBoard(props: BoardProps) {
  const view = props.game.view as { size: number; cells: (number | null)[]; lastMove: number | null };
  return (
    <GridBoard
      {...props}
      spec={{
        size: view.size,
        points: false,
        stone: (i) => (view.cells[i] === null || view.cells[i] === undefined ? null : view.cells[i] === 1),
        targetOf: (m) => ((m as { type?: string }).type === 'place' ? (m as { cell: number }).cell : null),
        surface: '#2f5d3a',
        lines: '#163020',
        last: view.lastMove,
      }}
    />
  );
}

export function GomokuBoard(props: BoardProps) {
  const view = props.game.view as { size: number; board: (number | null)[] };
  return (
    <GridBoard
      {...props}
      spec={{
        size: view.size,
        points: true,
        stone: (i) => (view.board[i] === null || view.board[i] === undefined ? null : view.board[i] === 1),
        targetOf: (m) => ((m as { type?: string }).type === 'place' ? (m as { cell: number }).cell : null),
        surface: '#d6a861',
        lines: '#4a3020',
      }}
    />
  );
}

export function GoBoard(props: BoardProps) {
  const view = props.game.view as { size: number; board: number[]; lastMove: number | null; dead: number[] };
  const dead = new Set(view.dead ?? []);
  return (
    <GridBoard
      {...props}
      spec={{
        size: view.size,
        points: true,
        // 1 Schwarz, 2 Weiß; als tot markierte Steine bleiben sichtbar, die Liste nennt sie.
        stone: (i) => (view.board[i] === 1 ? false : view.board[i] === 2 ? true : null),
        targetOf: (m) => ((m as { type?: string }).type === 'place' ? (m as { point: number }).point : null),
        surface: '#d6a861',
        lines: '#4a3020',
        last: view.lastMove !== null && view.lastMove >= 0 && !dead.has(view.lastMove) ? view.lastMove : null,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Dame: Steine wählen, dann Ziel; Mehrfachsprünge kommen als ein Zug aus legalMoves

interface CheckersMove {
  type: string;
  from: number;
  to: number;
  san: string;
}

export function CheckersBoard({ game, onMove }: BoardProps) {
  const view = game.view as { size: number; cells: ({ seat: number; king: boolean } | null)[] };
  const [selected, setSelected] = useState<number | null>(null);
  const size = view.size;
  const cell = BOARD / size;
  const flip = game.yourSeat === 1;
  const at = (index: number): [number, number] => {
    const x = ((index % size) - (size - 1) / 2) * cell;
    const z = (Math.floor(index / size) - (size - 1) / 2) * cell;
    return flip ? [-x, -z] : [x, z];
  };
  const moves = (game.legalMoves as CheckersMove[]).filter((m) => m.type === 'move');
  const movable = new Set(moves.map((m) => m.from));
  const grab = useGrab<number>({
    size: BOARD,
    radius: cell * 0.7,
    targets: (from) => [...new Set(moves.filter((m) => m.from === from).map((m) => m.to))].map((to) => ({ id: to, x: at(to)[0], z: at(to)[1] })),
    onDrop: (from, to) => {
      if (to === null) return;
      const options = movesFor(moves, (m) => m.from, (m) => m.to, from, to);
      // Gleiches Ziel über verschiedene Sprungwege: erst einen der Wege antippen.
      if (options.length === 1) {
        onMove(options[0]);
        setSelected(null);
      } else setSelected(from);
    },
  });
  const source = grab.held?.id ?? selected;
  const targets = source === null ? [] : moves.filter((m) => m.from === source);
  const squares: ReactNode[] = [];
  for (let i = 0; i < size * size; i++) {
    const dark = ((i % size) + Math.floor(i / size)) % 2 === 1;
    const [x, z] = at(i);
    const piece = view.cells[i];
    squares.push(
      <group key={i} position={[x, 0, z]}>
        <mesh
          position={[0, 0.017, 0]}
          onClick={(e) => {
            e.stopPropagation();
            if (movable.has(i)) setSelected(i === selected ? null : i);
          }}
        >
          <boxGeometry args={[cell, 0.002, cell]} />
          <meshStandardMaterial color={i === selected ? '#2f5d3a' : dark ? '#6b4728' : '#d9b98a'} />
        </mesh>
        {piece && grab.held?.id !== i && (
          <group
            onPointerDown={(e) => {
              if (!movable.has(i)) return;
              e.stopPropagation();
              grab.begin(i, x, z);
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (movable.has(i)) setSelected(i === selected ? null : i);
            }}
          >
            <mesh position={[0, 0.024, 0]}>
              <cylinderGeometry args={[cell * 0.38, cell * 0.4, 0.012, 24]} />
              <meshStandardMaterial color={piece.seat === 0 ? LIGHT : DARK} roughness={0.4} />
            </mesh>
            {piece.king && (
              <mesh position={[0, 0.036, 0]}>
                <cylinderGeometry args={[cell * 0.32, cell * 0.36, 0.012, 24]} />
                <meshStandardMaterial color={GOLD} metalness={0.5} roughness={0.35} />
              </mesh>
            )}
          </group>
        )}
      </group>,
    );
  }
  // Mehrere Züge mit gleichem Ziel (verschiedene Sprungwege): jeder bekommt ein eigenes Ziel, leicht versetzt.
  const byTarget = new Map<number, CheckersMove[]>();
  for (const m of targets) byTarget.set(m.to, [...(byTarget.get(m.to) ?? []), m]);
  return (
    <Plate size={BOARD + 0.03} color="#3f2a18">
      {squares}
      {grab.held && view.cells[grab.held.id] && (
        <group position={[grab.held.x, 0.04, grab.held.z]}>
          <mesh position={[0, 0.024, 0]}>
            <cylinderGeometry args={[cell * 0.38, cell * 0.4, 0.012, 24]} />
            <meshStandardMaterial color={view.cells[grab.held.id]!.seat === 0 ? LIGHT : DARK} roughness={0.4} />
          </mesh>
          {view.cells[grab.held.id]!.king && (
            <mesh position={[0, 0.036, 0]}>
              <cylinderGeometry args={[cell * 0.32, cell * 0.36, 0.012, 24]} />
              <meshStandardMaterial color={GOLD} metalness={0.5} roughness={0.35} />
            </mesh>
          )}
        </group>
      )}
      {grab.layer}
      {[...byTarget.entries()].flatMap(([to, list]) => {
        const [x, z] = at(to);
        return list.map((m, k) => (
          <Spot
            key={m.san}
            x={x + (k - (list.length - 1) / 2) * cell * 0.3}
            z={z}
            r={cell * (list.length > 1 ? 0.14 : 0.25)}
            y={0.032}
            onPress={() => {
              onMove(m);
              setSelected(null);
            }}
          />
        ));
      })}
    </Plate>
  );
}

// ---------------------------------------------------------------------------
// Mühle: 24 Punkte auf drei Quadraten. Lage wie im Spiel (Ring * 8 + j, j im Uhrzeigersinn ab links oben).

const MILL_STEPS: [number, number][] = [
  [0, 0],
  [1, 0],
  [2, 0],
  [2, 1],
  [2, 2],
  [1, 2],
  [0, 2],
  [0, 1],
];

function millPoint(point: number): [number, number] {
  const ring = Math.floor(point / 8);
  const [px, py] = MILL_STEPS[point % 8]!;
  const step = 3 - ring;
  return [((ring + px * step) / 6 - 0.5) * BOARD * 0.9, ((ring + py * step) / 6 - 0.5) * BOARD * 0.9];
}

interface MillMove {
  type: 'place' | 'move';
  from?: number;
  to: number;
  remove: number[];
}

export function MillBoard({ game, onMove }: BoardProps) {
  const view = game.view as { cells: (number | null)[]; inHand: [number, number] };
  const [from, setFrom] = useState<number | null>(null);
  const [to, setTo] = useState<number | null>(null);
  const moves = game.legalMoves as MillMove[];
  const forFrom = moves.filter((m) => (m.type === 'move' ? m.from === from : from === null));
  const movable = new Set(moves.flatMap((m) => (m.type === 'move' ? [m.from!] : [])));
  const targets = to === null ? [...new Set(forFrom.map((m) => m.to))] : [];
  const removing = to === null ? [] : forFrom.filter((m) => m.to === to);
  const removable = [...new Set(removing.flatMap((m) => m.remove))];

  // Greifen: Stein auf dem Brett (Zugphase) oder Stein aus dem Vorrat (Setzphase, id -1).
  const HAND = -1;
  const placing = moves.some((m) => m.type === 'place');
  const grab = useGrab<number>({
    size: BOARD,
    radius: 0.03,
    targets: (source) =>
      [...new Set(moves.filter((m) => (source === HAND ? m.type === 'place' : m.type === 'move' && m.from === source)).map((m) => m.to))].map((point) => ({ id: point, x: millPoint(point)[0], z: millPoint(point)[1] })),
    onDrop: (source, point) => {
      if (point === null) return;
      const options = moves.filter((m) => m.to === point && (source === HAND ? m.type === 'place' : m.type === 'move' && m.from === source));
      if (source !== HAND) setFrom(source);
      if (options.length === 1 && options[0]!.remove.length === 0) {
        onMove(options[0]);
        setFrom(null);
      } else setTo(point as number);
    },
  });
  const grabTargets = (source: number) => [...new Set(moves.filter((m) => (source === HAND ? m.type === 'place' : m.type === 'move' && m.from === source)).map((m) => m.to))];
  const chooseTarget = (point: number) => {
    const options = forFrom.filter((m) => m.to === point);
    if (options.length === 1 && options[0]!.remove.length === 0) {
      onMove(options[0]);
      setFrom(null);
    } else setTo(point);
  };
  const chooseRemove = (point: number) => {
    const move = removing.find((m) => m.remove.length === 1 && m.remove[0] === point) ?? removing.find((m) => m.remove.includes(point));
    if (move) onMove(move);
    setFrom(null);
    setTo(null);
  };

  const lines: ReactNode[] = [];
  for (let p = 0; p < 24; p++) {
    const ring = Math.floor(p / 8);
    const j = p % 8;
    const pairs = [[p, ring * 8 + ((j + 1) % 8)]];
    if (j % 2 === 1 && ring < 2) pairs.push([p, p + 8]);
    for (const [a, b] of pairs) {
      const [x1, z1] = millPoint(a!);
      const [x2, z2] = millPoint(b!);
      lines.push(
        <mesh key={`${a}-${b}`} position={[(x1 + x2) / 2, 0.0168, (z1 + z2) / 2]}>
          <boxGeometry args={[Math.abs(x2 - x1) + 0.003, 0.001, Math.abs(z2 - z1) + 0.003]} />
          <meshBasicMaterial color="#2f1f12" />
        </mesh>,
      );
    }
  }
  const r = 0.018;
  return (
    <Plate size={BOARD + 0.02} color="#c49a6c">
      {lines}
      {view.cells.map((seat, p) => {
        const [x, z] = millPoint(p);
        if (seat === null || seat === undefined || grab.held?.id === p) return null;
        return (
          <group
            key={p}
            onPointerDown={(e) => {
              if (!movable.has(p) || removable.includes(p)) return;
              e.stopPropagation();
              grab.begin(p, x, z);
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (removable.includes(p)) chooseRemove(p);
              else if (movable.has(p)) {
                setTo(null);
                setFrom(p === from ? null : p);
              }
            }}
          >
            <Stone x={x} z={z} r={r} white={seat === 0} glow={p === from || removable.includes(p)} />
          </group>
        );
      })}
      {grab.held && view.cells[grab.held.id] !== undefined && view.cells[grab.held.id] !== null && (
        <Stone x={grab.held.x} z={grab.held.z} r={r} white={view.cells[grab.held.id] === 0} glow />
      )}
      {grab.held && grab.held.id === HAND && <Stone x={grab.held.x} z={grab.held.z} r={r} white={game.yourSeat === 0} glow />}
      {grab.layer}
      {(grab.held ? grabTargets(grab.held.id) : targets).map((p) => {
        const [x, z] = millPoint(p);
        return <Spot key={`t${p}`} x={x} z={z} r={r} onPress={() => chooseTarget(p)} />;
      })}
      {/* Steine im Vorrat neben dem Brett */}
      {[0, 1].map((seat) =>
        Array.from({ length: view.inHand[seat as 0 | 1] }, (_, k) => {
          const x = (seat === 0 ? 1 : -1) * (BOARD / 2 + 0.03);
          const z = -BOARD / 2 + 0.02 + k * 0.042;
          const last = k === view.inHand[seat as 0 | 1] - 1;
          // Der oberste Stein des eigenen Vorrats lässt sich in der Setzphase greifen.
          const grabbable = placing && seat === game.yourSeat && last && grab.held?.id !== HAND;
          return grab.held?.id === HAND && grabbable === false && seat === game.yourSeat && last ? null : (
            <group
              key={`h${seat}-${k}`}
              onPointerDown={(e) => {
                if (!grabbable) return;
                e.stopPropagation();
                grab.begin(HAND, x, z);
              }}
            >
              <Stone x={x} z={z} r={0.014} white={seat === 0} />
            </group>
          );
        }),
      )}
    </Plate>
  );
}
