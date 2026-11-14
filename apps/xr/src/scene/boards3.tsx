/**
 * Brettspiele in 3D, Paket 2 von #358: Ultimate Tic-Tac-Toe, Teiler-Duell, Schiffe versenken,
 * Vierer-Schach, Sternhalma und Nicht ärgern!. Wie in boards.tsx: Gezeigt wird nur die Sicht,
 * anklickbar sind nur Ziele aus `legalMoves`, geschickt wird der Eintrag selbst. Lage der Felder
 * (Sternbrett, Laufstrecke) ist Darstellung, keine Regel.
 */
import { useState, type ReactNode } from 'react';
import { Piece, Plate, Target, type BoardProps } from './boards';
import { TABLE_CENTER } from './Tavern';
import { GOLD, labelTexture } from './text';
import { Button3D, Sign } from './ui3d';
import { pulse } from '../haptics';
import { useGrab } from './grab';

const TOP = TABLE_CENTER[1] + 0.002;
/** Farben der Plätze 1–6 (wie die Spielfarben der Web-App ungefähr). */
const SEAT_COLORS = ['#a32a1c', '#2f5d3a', '#1e5bb8', '#e0b000', '#7b2fa8', '#0d8478'];

/** Ein Plättchen mit Schrift, flach auf dem Tisch; leuchtet, wenn es antippbar ist. */
function Tile({ label, position, size, background, color = '#1d1510', onPress, glow }: { label: string; position: [number, number, number]; size: number; background: string; color?: string; onPress?: () => void; glow?: boolean }) {
  const [hover, setHover] = useState(false);
  const texture = labelTexture([label], { width: 128, height: 128, background, color, border: hover && onPress ? '#ffffff' : glow ? GOLD : null, font: label.length > 2 ? 40 : 54 });
  return (
    <mesh
      position={position}
      rotation={[-Math.PI / 2, 0, 0]}
      scale={hover && onPress ? 1.08 : 1}
      onClick={
        onPress
          ? (e) => {
              e.stopPropagation();
              onPress();
            }
          : undefined
      }
      onPointerOver={(e) => {
        if (!onPress) return;
        e.stopPropagation();
        setHover(true);
        pulse('hover');
      }}
      onPointerOut={() => setHover(false)}
    >
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  );
}

function Cross({ size, color }: { size: number; color: string }) {
  return (
    <group rotation={[0, Math.PI / 4, 0]}>
      <mesh>
        <boxGeometry args={[size, size * 0.22, size * 0.2]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh>
        <boxGeometry args={[size * 0.2, size * 0.22, size]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

function Ring({ size, color }: { size: number; color: string }) {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[size * 0.38, size * 0.1, 12, 32]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function Peg({ color, height = 0.012, radius = 0.007 }: { color: string; height?: number; radius?: number }) {
  return (
    <mesh position={[0, height / 2, 0]}>
      <cylinderGeometry args={[radius * 0.8, radius, height, 16]} />
      <meshStandardMaterial color={color} roughness={0.5} />
    </mesh>
  );
}

/** Ein Spielstein zum Antippen (Kugel auf Fuß); leuchtet, wenn er gewählt oder wählbar ist. */
function Stone({ color, selected, movable, onPress, onGrab, scale = 1 }: { color: string; selected?: boolean; movable?: boolean; onPress?: () => void; onGrab?: () => void; scale?: number }) {
  const [hover, setHover] = useState(false);
  return (
    <group
      scale={scale * (hover && onPress ? 1.12 : 1)}
      onPointerDown={
        onGrab
          ? (e) => {
              e.stopPropagation();
              onGrab();
            }
          : undefined
      }
      onClick={
        onPress
          ? (e) => {
              e.stopPropagation();
              onPress();
            }
          : undefined
      }
      onPointerOver={(e) => {
        if (!onPress) return;
        e.stopPropagation();
        setHover(true);
        pulse('hover');
      }}
      onPointerOut={() => setHover(false)}
    >
      <mesh position={[0, 0.006, 0]}>
        <cylinderGeometry args={[0.009, 0.011, 0.012, 18]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.017, 0]}>
        <sphereGeometry args={[0.008, 16, 12]} />
        <meshStandardMaterial color={color} roughness={0.35} />
      </mesh>
      {(selected || movable) && (
        <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.012, 0.016, 24]} />
          <meshBasicMaterial color={selected ? '#7fd18b' : GOLD} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

/** Erst Stein, dann Ziel: gemeinsame Auswahl für Vierer-Schach und Sternhalma. */
function useFromTo<M>(entries: { from: number; to: number; move: M; label: string }[]) {
  const [selected, setSelected] = useState<number | null>(null);
  const [options, setOptions] = useState<{ move: M; label: string }[] | null>(null);
  const movable = new Set(entries.map((e) => e.from));
  const targets = selected === null ? [] : entries.filter((e) => e.from === selected);
  return {
    selected,
    movable,
    targets: [...new Set(targets.map((t) => t.to))].map((to) => ({ to, label: targets.find((t) => t.to === to)?.label })),
    options,
    pick: (from: number) => {
      setOptions(null);
      setSelected(from === selected ? null : from);
    },
    choose: (to: number, send: (move: M) => void) => {
      const found = targets.filter((t) => t.to === to);
      if (found.length === 1) {
        send(found[0]!.move);
        setSelected(null);
      } else if (found.length > 1) setOptions(found.map((f) => ({ move: f.move, label: f.label })));
    },
    /** Gegriffene Figur über einem Ziel losgelassen: Zug senden, bei mehreren Möglichkeiten die Wahlknöpfe zeigen. */
    drop: (from: number, to: number, send: (move: M) => void) => {
      const found = entries.filter((e) => e.from === from && e.to === to);
      if (found.length === 1) {
        send(found[0]!.move);
        setSelected(null);
        setOptions(null);
      } else if (found.length > 1) {
        setSelected(from);
        setOptions(found.map((f) => ({ move: f.move, label: f.label })));
      }
    },
    clear: () => {
      setOptions(null);
      setSelected(null);
    },
  };
}

function OptionButtons<M>({ options, position, onPick }: { options: { move: M; label: string }[]; position: [number, number, number]; onPick: (move: M) => void }) {
  return (
    <group position={position} rotation={[-Math.PI / 5, 0, 0]}>
      {options.map((o, i) => (
        <Button3D key={o.label || i} label={o.label} position={[0, -i * 0.045, 0]} width={0.36} height={0.04} onPress={() => onPick(o.move)} />
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Ultimate Tic-Tac-Toe: neun kleine Felder, das erzwungene leuchtet

interface UltimateView {
  cells: (number | null)[];
  boards: (number | 'draw' | null)[];
  forced: number | null;
}

export function UltimateTicTacToeBoard({ game, onMove }: BoardProps) {
  const view = game.view as UltimateView;
  const step = 0.042;
  const gap = 0.018;
  const at = (board: number, cell: number): [number, number] => [((board % 3) - 1) * (3 * step + gap) + ((cell % 3) - 1) * step, (Math.floor(board / 3) - 1) * (3 * step + gap) + (Math.floor(cell / 3) - 1) * step];
  const moves = (game.legalMoves as { type: string; board: number; cell: number }[]).map((move, i) => ({ move, label: game.moveLabels?.[i] }));
  const active = new Set(moves.map((m) => m.move.board));
  const color = (seat: number) => (seat === 0 ? '#a32a1c' : '#2f5d3a');
  return (
    <Plate size={[9 * step + 2 * gap + 0.03, 9 * step + 2 * gap + 0.03]} color="#3f2a18">
      {Array.from({ length: 9 }, (_, board) => {
        const [x, z] = at(board, 4);
        const owner = view.boards[board];
        return (
          <group key={board} position={[x, 0, z]}>
            <mesh position={[0, 0.017, 0]}>
              <boxGeometry args={[3 * step - 0.004, 0.002, 3 * step - 0.004]} />
              <meshStandardMaterial color={active.has(board) && !game.result ? '#c49a4a' : '#d9b98a'} />
            </mesh>
            {typeof owner === 'number' && (
              <group position={[0, 0.04, 0]}>{owner === 0 ? <Cross size={3 * step * 0.8} color={color(0)} /> : <Ring size={3 * step} color={color(1)} />}</group>
            )}
          </group>
        );
      })}
      {view.cells.map((seat, i) => {
        if (seat === null) return null;
        const [x, z] = at(Math.floor(i / 9), i % 9);
        return (
          <group key={i} position={[x, 0.026, z]} scale={view.boards[Math.floor(i / 9)] === null ? 1 : 0.7}>
            {seat === 0 ? <Cross size={step * 0.7} color={color(0)} /> : <Ring size={step} color={color(1)} />}
          </group>
        );
      })}
      {moves.map(({ move, label }, i) => {
        const [x, z] = at(move.board, move.cell);
        return <Target key={i} position={[x, 0.02, z]} size={step * 0.32} onPress={() => onMove(move)} label={label} />;
      })}
    </Plate>
  );
}

// ---------------------------------------------------------------------------
// Teiler-Duell: Zahlenplättchen 1 bis n, eingefärbt nach Besitzer

interface FactorGridView {
  size: number;
  owners: (number | null)[];
}

export function FactorGridBoard({ game, onMove }: BoardProps) {
  const view = game.view as FactorGridView;
  const cols = view.size <= 36 ? 6 : 10;
  const rows = Math.ceil(view.size / cols);
  const t = Math.min(0.066, 0.46 / Math.max(cols, rows));
  const picks = new Map((game.legalMoves as { type: string; number: number }[]).map((m) => [m.number, m]));
  return (
    <Plate size={[cols * t + 0.03, rows * t + 0.03]} color="#3f2a18">
      {Array.from({ length: view.size }, (_, i) => {
        const n = i + 1;
        const owner = view.owners[i] ?? null;
        const move = picks.get(n);
        return (
          <Tile
            key={n}
            label={String(n)}
            position={[((i % cols) - (cols - 1) / 2) * t, 0.018, (Math.floor(i / cols) - (rows - 1) / 2) * t]}
            size={t * 0.9}
            background={owner === null ? '#efe3c8' : SEAT_COLORS[owner % SEAT_COLORS.length]!}
            color={owner === null ? '#1d1510' : '#fbf5e6'}
            glow={Boolean(move)}
            onPress={move ? () => onMove(move) : undefined}
          />
        );
      })}
    </Plate>
  );
}

// ---------------------------------------------------------------------------
// Schiffe versenken: links die eigene Flotte, rechts das Feld des Gegners

interface BattleshipView {
  fleets: { cells: number[]; sunk: boolean }[][];
  shots: { cell: number; result: string }[][];
}

function ShotPeg({ result }: { result: string }) {
  return result === 'water' ? <Peg color="#e8eef5" height={0.008} radius={0.005} /> : <Peg color="#c62828" height={0.016} radius={0.006} />;
}

export function BattleshipBoard({ game, onMove }: BoardProps) {
  const view = game.view as BattleshipView;
  const me = game.yourSeat ?? 0;
  const other = me === 0 ? 1 : 0;
  const c = 0.024;
  const grid = 10 * c;
  const cell = (i: number): [number, number] => [((i % 10) - 4.5) * c, (Math.floor(i / 10) - 4.5) * c];
  const shots = (game.legalMoves as { type: string; cell: number }[]).map((move, i) => ({ move, label: game.moveLabels?.[i] })).filter((m) => m.move.type === 'shoot');
  const Water = ({ x }: { x: number }) => (
    <mesh position={[x, 0.017, 0]}>
      <boxGeometry args={[grid + 0.01, 0.002, grid + 0.01]} />
      <meshStandardMaterial color="#2c5a7a" roughness={0.3} />
    </mesh>
  );
  const Lines = ({ x }: { x: number }) => (
    <group position={[x, 0.0185, 0]}>
      {Array.from({ length: 11 }, (_, k) => (
        <group key={k}>
          <mesh position={[(k - 5) * c, 0, 0]}>
            <boxGeometry args={[0.0008, 0.0005, grid]} />
            <meshBasicMaterial color="#9cc3dd" />
          </mesh>
          <mesh position={[0, 0, (k - 5) * c]}>
            <boxGeometry args={[grid, 0.0005, 0.0008]} />
            <meshBasicMaterial color="#9cc3dd" />
          </mesh>
        </group>
      ))}
    </group>
  );
  const left = -grid / 2 - 0.02;
  const right = grid / 2 + 0.02;
  // Greifen (#383): Kugel vom Stapel vorn nehmen und über dem Feld des Gegners loslassen.
  const ballX = right;
  const ballZ = grid / 2 + 0.07;
  const grab = useGrab<string>({
    size: 2 * grid,
    radius: c * 0.7,
    targets: () => shots.map(({ move }) => ({ id: move.cell, x: right + cell(move.cell)[0], z: cell(move.cell)[1] })),
    onDrop: (_, to) => {
      const hit = shots.find(({ move }) => move.cell === to);
      if (hit) onMove(hit.move);
    },
  });
  return (
    <Plate size={[2 * grid + 0.08, grid + 0.04]} color="#3f2a18">
      {shots.length > 0 && (
        <group
          position={[ballX, 0.03, ballZ]}
          onPointerDown={(e) => {
            e.stopPropagation();
            grab.begin('kugel', ballX, ballZ);
          }}
        >
          {grab.held === null && (
            <mesh>
              <sphereGeometry args={[0.012, 16, 12]} />
              <meshStandardMaterial color="#2a2a2e" metalness={0.6} roughness={0.35} />
            </mesh>
          )}
          <mesh visible={false}>
            <sphereGeometry args={[0.03, 8, 6]} />
          </mesh>
        </group>
      )}
      {grab.held && (
        <mesh position={[grab.held.x, 0.05, grab.held.z]}>
          <sphereGeometry args={[0.012, 16, 12]} />
          <meshStandardMaterial color="#c62828" metalness={0.4} roughness={0.35} emissive={GOLD} emissiveIntensity={0.4} />
        </mesh>
      )}
      {grab.layer}
      <Water x={left} />
      <Water x={right} />
      <Lines x={left} />
      <Lines x={right} />
      {(view.fleets[me] ?? []).flatMap((ship, k) =>
        ship.cells.map((i) => {
          const [x, z] = cell(i);
          return (
            <mesh key={`${k}-${i}`} position={[left + x, 0.023, z]}>
              <boxGeometry args={[c * 0.86, 0.01, c * 0.86]} />
              <meshStandardMaterial color={ship.sunk ? '#3a3a3a' : '#8a8f96'} />
            </mesh>
          );
        }),
      )}
      {(view.fleets[other] ?? []).filter((s) => s.sunk).flatMap((ship, k) =>
        ship.cells.map((i) => {
          const [x, z] = cell(i);
          return (
            <mesh key={`s${k}-${i}`} position={[right + x, 0.021, z]}>
              <boxGeometry args={[c * 0.86, 0.006, c * 0.86]} />
              <meshStandardMaterial color="#3a3a3a" />
            </mesh>
          );
        }),
      )}
      {(view.shots[other] ?? []).map((s, k) => {
        const [x, z] = cell(s.cell);
        return (
          <group key={`o${k}`} position={[left + x, 0.028, z]}>
            <ShotPeg result={s.result} />
          </group>
        );
      })}
      {(view.shots[me] ?? []).map((s, k) => {
        const [x, z] = cell(s.cell);
        return (
          <group key={`m${k}`} position={[right + x, 0.019, z]}>
            <ShotPeg result={s.result} />
          </group>
        );
      })}
      {shots.map(({ move, label }) => {
        const [x, z] = cell(move.cell);
        return <Target key={move.cell} position={[right + x, 0.02, z]} size={c * 0.32} onPress={() => onMove(move)} label={label} />;
      })}
      <Sign lines={['Deine Flotte']} position={[left, 0.03, -grid / 2 - 0.035]} rotation={[-Math.PI / 3, 0, 0]} width={0.16} height={0.03} />
      <Sign lines={[game.seats[other]?.name ?? 'Gegner']} position={[right, 0.03, -grid / 2 - 0.035]} rotation={[-Math.PI / 3, 0, 0]} width={0.16} height={0.03} />
    </Plate>
  );
}

// ---------------------------------------------------------------------------
// Vierer-Schach: 14 × 14 ohne Ecken, die eigene Farbe sitzt vorn

interface FourChessView {
  board: ({ c: string; t: string; d?: boolean } | null)[];
}
interface FourChessMove {
  t: string;
  f: number;
  to: number;
}

const FOUR_COLORS = ['r', 'b', 'y', 'g'];
const FOUR_TINTS: Record<string, string> = { r: '#b3261e', b: '#1e5bb8', y: '#d9a400', g: '#2e7d32' };
/** Drehung, damit die eigene Seite vorn liegt: Rot unten, Blau links, Gelb oben, Grün rechts. */
const FOUR_TURN: Record<string, number> = { r: 0, b: Math.PI / 2, y: Math.PI, g: -Math.PI / 2 };

export function FourPlayerChessBoard({ game, onMove }: BoardProps) {
  const view = game.view as FourChessView;
  const s = 0.032;
  const corner = (row: number, col: number) => (row < 3 || row > 10) && (col < 3 || col > 10);
  const pos = (i: number): [number, number] => [((i % 14) - 6.5) * s, (Math.floor(i / 14) - 6.5) * s];
  const entries = (game.legalMoves as FourChessMove[]).flatMap((move, i) => (move.t === 'm' ? [{ from: move.f, to: move.to, move: move as unknown, label: game.moveLabels?.[i] ?? '' }] : []));
  const select = useFromTo(entries);
  const grab = useGrab<number>({
    size: 14 * s,
    radius: s * 0.7,
    targets: (from) => [...new Set(entries.filter((e) => e.from === from).map((e) => e.to))].map((to) => ({ id: to, x: pos(to)[0], z: pos(to)[1] })),
    onDrop: (from, to) => {
      if (to !== null) select.drop(from, to as number, onMove);
    },
  });
  const shownTargets = grab.held ? [...new Set(entries.filter((e) => e.from === grab.held!.id).map((e) => e.to))].map((to) => ({ to, label: entries.find((e) => e.from === grab.held!.id && e.to === to)?.label })) : select.targets;
  const turn = FOUR_TURN[FOUR_COLORS[game.yourSeat ?? 0] ?? 'r'] ?? 0;
  const squares: ReactNode[] = [];
  for (let i = 0; i < 196; i++) {
    const row = Math.floor(i / 14);
    const col = i % 14;
    if (corner(row, col)) continue;
    const [x, z] = pos(i);
    const piece = view.board[i];
    const canSelect = select.movable.has(i);
    const isTarget = shownTargets.some((t) => t.to === i);
    const press = () => (canSelect ? select.pick(i) : isTarget ? select.choose(i, onMove) : undefined);
    squares.push(
      <group key={i} position={[x, 0, z]}>
        <mesh
          position={[0, 0.017, 0]}
          onClick={(e) => {
            e.stopPropagation();
            press();
          }}
        >
          <boxGeometry args={[s, 0.002, s]} />
          <meshStandardMaterial color={i === select.selected ? '#2f5d3a' : (row + col) % 2 === 0 ? '#d9b98a' : '#6b4728'} />
        </mesh>
        {piece && grab.held?.id !== i && (
          <group
            position={[0, 0.018, 0]}
            scale={0.62}
            onPointerDown={(e) => {
              if (!canSelect) return;
              e.stopPropagation();
              grab.begin(i, x, z);
            }}
            onClick={(e) => {
              e.stopPropagation();
              press();
            }}
          >
            <Piece type={piece.t.toLowerCase()} white={false} tint={piece.d ? '#7d7d7d' : FOUR_TINTS[piece.c]} />
          </group>
        )}
      </group>,
    );
  }
  return (
    <Plate size={[14 * s + 0.03, 14 * s + 0.03]} color="#3f2a18">
      <group rotation={[0, turn, 0]}>
        {squares}
        {grab.held && view.board[grab.held.id] && (
          <group position={[grab.held.x, 0.05, grab.held.z]} scale={0.62}>
            <Piece type={view.board[grab.held.id]!.t.toLowerCase()} white={false} tint={view.board[grab.held.id]!.d ? '#7d7d7d' : FOUR_TINTS[view.board[grab.held.id]!.c]} />
          </group>
        )}
        {grab.layer}
        {shownTargets.map(({ to, label }) => {
          const [x, z] = pos(to);
          return <Target key={to} position={[x, 0.02, z]} size={s * 0.3} onPress={() => select.choose(to, onMove)} label={label} />;
        })}
      </group>
      {select.options && (
        <OptionButtons
          options={select.options}
          position={[0, 0.16, 14 * s * 0.5 + 0.02]}
          onPick={(move) => {
            onMove(move);
            select.clear();
          }}
        />
      )}
    </Plate>
  );
}

// ---------------------------------------------------------------------------
// Sternhalma: 121 Löcher im Sechsstern, die eigene Zacke liegt vorn

interface ChineseCheckersView {
  board: (number | null)[];
  homes: number[];
}

/** Die Löcher des Sterns in derselben Reihenfolge wie im Spiel: zeilenweise von oben. */
const STAR: { q: number; r: number }[] = (() => {
  const cells: { q: number; r: number }[] = [];
  for (let r = -8; r <= 8; r++) {
    for (let q = -8; q <= 8; q++) {
      const s = -q - r;
      if ((q >= -4 && r >= -4 && s >= -4) || (q <= 4 && r <= 4 && s <= 4)) cells.push({ q, r });
    }
  }
  return cells;
})();

export function ChineseCheckersBoard({ game, onMove }: BoardProps) {
  const view = game.view as ChineseCheckersView;
  const d = 0.027;
  const pos = (i: number): [number, number] => {
    const { q, r } = STAR[i]!;
    return [(q + r / 2) * d, r * d * 0.866];
  };
  const entries = (game.legalMoves as { type: string; from: number; to: number }[]).flatMap((move, i) => (move.type === 'move' ? [{ from: move.from, to: move.to, move: move as unknown, label: game.moveLabels?.[i] ?? '' }] : []));
  const select = useFromTo(entries);
  const grab = useGrab<number>({
    size: 0.5,
    radius: d * 0.7,
    targets: (from) => [...new Set(entries.filter((e) => e.from === from).map((e) => e.to))].map((to) => ({ id: to, x: pos(to)[0], z: pos(to)[1] })),
    onDrop: (from, to) => {
      if (to !== null) select.drop(from, to as number, onMove);
    },
  });
  const shownTargets = grab.held ? [...new Set(entries.filter((e) => e.from === grab.held!.id).map((e) => e.to))].map((to) => ({ to, label: undefined as string | undefined })) : select.targets;
  // Zacke 3 liegt unten; jede weitere Zacke ist 60° weiter im Uhrzeigersinn.
  const arm = view.homes[game.yourSeat ?? 0] ?? 3;
  const turn = ((arm - 3) * Math.PI) / 3;
  return (
    <group position={[TABLE_CENTER[0], TOP, TABLE_CENTER[2]]}>
      <mesh position={[0, 0.008, 0]}>
        <cylinderGeometry args={[0.27, 0.27, 0.016, 6]} />
        <meshStandardMaterial color="#7a5230" roughness={0.7} />
      </mesh>
      <group rotation={[0, turn, 0]}>
        {STAR.map((_, i) => {
          const [x, z] = pos(i);
          const owner = view.board[i];
          const isTarget = shownTargets.some((t) => t.to === i);
          return (
            <group key={i} position={[x, 0.016, z]}>
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0005, 0]}>
                <circleGeometry args={[0.0075, 16]} />
                <meshStandardMaterial color="#3f2a18" />
              </mesh>
              {owner !== null && owner !== undefined && grab.held?.id !== i && (
                <Stone color={SEAT_COLORS[owner % SEAT_COLORS.length]!} selected={select.selected === i} movable={select.movable.has(i) && select.selected === null} onPress={select.movable.has(i) ? () => select.pick(i) : undefined} onGrab={select.movable.has(i) ? () => grab.begin(i, x, z) : undefined} />
              )}
              {isTarget && <Target position={[0, 0.003, 0]} size={0.01} onPress={() => select.choose(i, onMove)} label={select.targets.find((t) => t.to === i)?.label} />}
            </group>
          );
        })}
        {grab.held && view.board[grab.held.id] !== null && view.board[grab.held.id] !== undefined && (
          <group position={[grab.held.x, 0.03, grab.held.z]}>
            <Stone color={SEAT_COLORS[view.board[grab.held.id]! % SEAT_COLORS.length]!} selected />
          </group>
        )}
        {grab.layer}
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Nicht ärgern!: Laufstrecke als Ring, Häuser außen, Ziele nach innen

interface LudoView {
  seats: number;
  turn: number;
  dice: number | null;
  board?: string;
  pieces: { area: 'home' | 'track' | 'goal'; index: number }[][];
}

const LUDO_COLORS = ['#e0b000', '#2e7d32', '#c62828', '#1e5bb8', '#7b2fa8', '#0d8478'];
const SIX_ARMS: Record<number, number[]> = { 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5] };

function ludoStart(seat: number, seats: number, six: boolean): number {
  if (six) return ((SIX_ARMS[seats] ?? SIX_ARMS[6]!)[seat] ?? seat) * 9 + 5;
  if (seats === 2) return seat === 0 ? 0 : 20;
  return (seat * 10) % 40;
}

function ludoColor(seat: number, seats: number): string {
  return LUDO_COLORS[seats === 2 ? (seat === 0 ? 0 : 2) : seat % 6]!;
}

export function LudoBoard({ game, onMove }: BoardProps) {
  const view = game.view as LudoView;
  const six = view.board === 'six';
  const length = six ? 54 : 40;
  const me = game.yourSeat ?? 0;
  const R = 0.2;
  const angle = (abs: number) => (2 * Math.PI * (abs - ludoStart(me, view.seats, six))) / length;
  const point = (r: number, a: number): [number, number] => [Math.sin(a) * r, Math.cos(a) * r];
  const where = (seat: number, p: { area: string; index: number }, k: number): [number, number] => {
    const start = ludoStart(seat, view.seats, six);
    if (p.area === 'track') return point(R, angle(start + p.index));
    if (p.area === 'goal') return point(R - 0.03 * (p.index + 1), angle(start - 1));
    const a = angle(start) - 0.14 + (k % 2) * 0.07;
    return point(R + 0.045 + Math.floor(k / 2) * 0.03, a);
  };
  const moves = game.legalMoves.map((move, i) => ({ move: move as { type: string; pieceIndex?: number }, label: game.moveLabels?.[i] ?? '' }));
  const roll = moves.find((m) => m.move.type === 'roll');
  const pieceMoves = new Map(moves.filter((m) => m.move.type === 'move').map((m) => [m.move.pieceIndex!, m.move]));
  // Greifen (#383): Der Zug nennt nur die Figur, das Ziel ergibt sich aus der Augenzahl. Figur greifen und aufs Brett legen = Zug.
  const grab = useGrab<number>({
    size: 0.8,
    radius: 0.35,
    targets: () => [{ id: 'brett', x: 0, z: 0 }],
    onDrop: (piece, to) => {
      const move = pieceMoves.get(piece);
      if (to !== null && move) onMove(move);
    },
  });
  return (
    <group position={[TABLE_CENTER[0], TOP, TABLE_CENTER[2]]}>
      {grab.held && <group position={[grab.held.x, 0.04, grab.held.z]}><Stone color={ludoColor(me, view.seats)} selected scale={1.25} /></group>}
      {grab.layer}
      <mesh position={[0, 0.008, 0]}>
        <cylinderGeometry args={[0.31, 0.31, 0.016, 48]} />
        <meshStandardMaterial color="#efe3c8" roughness={0.8} />
      </mesh>
      {Array.from({ length }, (_, abs) => {
        const [x, z] = point(R, angle(abs));
        const owner = Array.from({ length: view.seats }, (_, s) => s).find((s) => ludoStart(s, view.seats, six) === abs);
        return (
          <mesh key={abs} position={[x, 0.0165, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.011, 20]} />
            <meshStandardMaterial color={owner === undefined ? '#d9c7a2' : ludoColor(owner, view.seats)} />
          </mesh>
        );
      })}
      {Array.from({ length: view.seats }, (_, seat) =>
        Array.from({ length: 4 }, (_, k) => {
          const start = ludoStart(seat, view.seats, six);
          const [gx, gz] = point(R - 0.03 * (k + 1), angle(start - 1));
          const [hx, hz] = where(seat, { area: 'home', index: k }, k);
          return (
            <group key={`${seat}-${k}`}>
              <mesh position={[gx, 0.0165, gz]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.006, 0.01, 20]} />
                <meshBasicMaterial color={ludoColor(seat, view.seats)} />
              </mesh>
              <mesh position={[hx, 0.0165, hz]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.01, 20]} />
                <meshStandardMaterial color={ludoColor(seat, view.seats)} transparent opacity={0.35} />
              </mesh>
            </group>
          );
        }),
      )}
      {view.pieces.map((pieces, seat) =>
        pieces.map((p, k) => {
          const [x, z] = where(seat, p, k);
          const move = seat === me ? pieceMoves.get(k) : undefined;
          if (seat === me && grab.held?.id === k) return null;
          return (
            <group key={`p${seat}-${k}`} position={[x, 0.016, z]}>
              <Stone color={ludoColor(seat, view.seats)} movable={Boolean(move)} onPress={move ? () => onMove(move) : undefined} onGrab={move ? () => grab.begin(k, x, z) : undefined} scale={1.25} />
            </group>
          );
        }),
      )}
      {view.dice !== null && (
        <group position={[0, 0.03, 0]}>
          <mesh>
            <boxGeometry args={[0.03, 0.03, 0.03]} />
            <meshStandardMaterial color="#fbf5e6" />
          </mesh>
          <Tile label={String(view.dice)} position={[0, 0.0152, 0]} size={0.028} background="#fbf5e6" />
        </group>
      )}
      {roll && <Button3D label="🎲 Würfeln" position={[0, 0.07, 0.06]} rotation={[-Math.PI / 4, 0, 0]} width={0.16} height={0.045} active onPress={() => onMove(roll.move)} />}
    </group>
  );
}
