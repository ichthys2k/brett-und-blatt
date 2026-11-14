/**
 * Die drei Spiele mit 3D-Figuren (#339): Tic-Tac-Toe, Vier in einer Reihe und Schach.
 * Ohne Regeln: Gezeigt wird die Sicht (`view`), anklickbar sind nur Ziele aus `legalMoves`,
 * und geschickt wird immer der passende Eintrag aus `legalMoves` selbst.
 */
import type { GameMessage } from '@brett-und-blatt/online';
import { useState, type ReactNode } from 'react';
import { TABLE_CENTER } from './Tavern';
import { GOLD } from './text';
import { Button3D } from './ui3d';
import { pulse } from '../haptics';
import { Bowl, movesFor, useGrab } from './grab';

export interface BoardProps {
  game: GameMessage;
  onMove: (move: unknown) => void;
}

const TOP = TABLE_CENTER[1] + 0.002;
const IVORY = '#efe3c8';
const EBONY = '#2b1b10';
const RED = '#a32a1c';
const YELLOW = '#e6b450';

/** Indizes der Züge, die ein Brett selbst anbietet; der Rest kommt ins 2D-Fenster. */
export function boardMoveIndexes(gameId: string, moves: unknown[]): Set<number> {
  const handled = new Set<number>();
  moves.forEach((m, i) => {
    const t = (m as { type?: string; t?: string }).type ?? (m as { t?: string }).t;
    if (gameId === 'tic-tac-toe' && t === 'place') handled.add(i);
    if (gameId === 'four-in-a-row' && (t === 'drop' || t === 'pop')) handled.add(i);
    if (gameId === 'chess' && t === 'move') handled.add(i);
    if ((gameId === 'reversi' || gameId === 'gomoku' || gameId === 'go') && t === 'place') handled.add(i);
    if (gameId === 'checkers' && t === 'move') handled.add(i);
    if (gameId === 'mill' && (t === 'place' || t === 'move')) handled.add(i);
    if (gameId === 'ultimate-tic-tac-toe' && t === 'place') handled.add(i);
    if (gameId === 'factor-grid' && t === 'pick') handled.add(i);
    if (gameId === 'battleship' && t === 'shoot') handled.add(i);
    if (gameId === 'four-player-chess' && t === 'm') handled.add(i);
    if (gameId === 'chinese-checkers' && t === 'move') handled.add(i);
    if (gameId === 'ludo' && (t === 'roll' || t === 'move')) handled.add(i);
    if (gameId === 'dominoes' && (t === 'play' || t === 'draw')) handled.add(i);
    if ((gameId === 'scrabble' || gameId === 'color-and-shape' || gameId === 'grafschaft') && (t === 'play' || t === 'place')) handled.add(i);
    if (gameId === 'kniffel' && (t === 'roll' || t === 'hold' || t === 'unhold' || t === 'toggleHold')) handled.add(i);
    if (gameId === 'maexle' && t === 'roll') handled.add(i);
    if (gameId === 'pairs' && t === 'flip') handled.add(i);
    if (gameId === 'low-flight' && (t === 'draw' || t === 'takeDiscard' || t === 'reveal' || t === 'swap' || t === 'flip')) handled.add(i);
  });
  return handled;
}

/** Ein leuchtendes Ziel auf dem Brett: Zeigen, Antippen oder Greifen löst den Zug aus. */
export function Target({ position, size, onPress, label }: { position: [number, number, number]; size: number; onPress: () => void; label?: string }) {
  const [hover, setHover] = useState(false);
  return (
    <mesh
      position={position}
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
      userData={{ label }}
    >
      <circleGeometry args={[size, 32]} />
      <meshBasicMaterial color={GOLD} transparent opacity={hover ? 0.85 : 0.45} toneMapped={false} />
    </mesh>
  );
}

export function Plate({ size, children, color = '#7a5230' }: { size: [number, number]; children?: ReactNode; color?: string }) {
  return (
    <group position={[TABLE_CENTER[0], TOP, TABLE_CENTER[2]]}>
      <mesh position={[0, 0.008, 0]}>
        <boxGeometry args={[size[0], 0.016, size[1]]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      {children}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Tic-Tac-Toe

interface TicTacToeView {
  board: (number | null)[];
  winLine: number[] | null;
}

export function TicTacToeBoard({ game, onMove }: BoardProps) {
  const view = game.view as TicTacToeView;
  const step = 0.12;
  const at = (cell: number): [number, number] => [((cell % 3) - 1) * step, (Math.floor(cell / 3) - 1) * step];
  const moves = game.legalMoves as { type: string; cell: number }[];
  const win = new Set(view.winLine ?? []);
  const places = moves.flatMap((move, i) => (move.type === 'place' ? [{ move, i }] : []));
  const bowlZ = 0.27;
  const grab = useGrab<string>({
    size: 0.4,
    radius: 0.05,
    targets: () => places.map((p) => ({ id: p.move.cell, x: at(p.move.cell)[0], z: at(p.move.cell)[1] })),
    onDrop: (_, to) => {
      const hit = places.find((p) => p.move.cell === to);
      if (hit) onMove(hit.move);
    },
  });
  const mark = (seat: number | null, x: number, z: number, y: number) =>
    seat === 0 ? (
      <group position={[x, y, z]} rotation={[0, Math.PI / 4, 0]}>
        <mesh>
          <boxGeometry args={[0.09, 0.02, 0.018]} />
          <meshStandardMaterial color={RED} />
        </mesh>
        <mesh>
          <boxGeometry args={[0.018, 0.02, 0.09]} />
          <meshStandardMaterial color={RED} />
        </mesh>
      </group>
    ) : (
      <mesh position={[x, y, z]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.035, 0.009, 12, 32]} />
        <meshStandardMaterial color="#2f5d3a" />
      </mesh>
    );
  return (
    <Plate size={[0.4, 0.4]}>
      {places.length > 0 && game.yourSeat !== null && (
        <Bowl x={0} z={bowlZ} onGrab={() => grab.begin('bowl', 0, bowlZ)}>
          {grab.held === null && mark(game.yourSeat, 0, 0, 0.04)}
        </Bowl>
      )}
      {grab.held && mark(game.yourSeat, grab.held.x, grab.held.z, 0.07)}
      {grab.layer}
      {[-0.5, 0.5].map((k) => (
        <group key={k}>
          <mesh position={[k * step, 0.018, 0]}>
            <boxGeometry args={[0.008, 0.004, 0.36]} />
            <meshStandardMaterial color="#2f1f12" />
          </mesh>
          <mesh position={[0, 0.018, k * step]}>
            <boxGeometry args={[0.36, 0.004, 0.008]} />
            <meshStandardMaterial color="#2f1f12" />
          </mesh>
        </group>
      ))}
      {view.board.map((seat, cell) => {
        if (seat === null) return null;
        const [x, z] = at(cell);
        const color = win.has(cell) ? GOLD : seat === 0 ? RED : '#2f5d3a';
        return seat === 0 ? (
          <group key={cell} position={[x, 0.03, z]} rotation={[0, Math.PI / 4, 0]}>
            <mesh>
              <boxGeometry args={[0.09, 0.02, 0.018]} />
              <meshStandardMaterial color={color} />
            </mesh>
            <mesh>
              <boxGeometry args={[0.018, 0.02, 0.09]} />
              <meshStandardMaterial color={color} />
            </mesh>
          </group>
        ) : (
          <mesh key={cell} position={[x, 0.03, z]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.035, 0.009, 12, 32]} />
            <meshStandardMaterial color={color} />
          </mesh>
        );
      })}
      {moves.map((move, i) =>
        move.type === 'place' ? <Target key={i} position={[at(move.cell)[0], 0.02, at(move.cell)[1]]} size={0.04} onPress={() => onMove(move)} label={game.moveLabels?.[i]} /> : null,
      )}
    </Plate>
  );
}

// ---------------------------------------------------------------------------
// Vier in einer Reihe: ein aufrechtes Gestell, Spalten zum Antippen

interface FourInARowView {
  cols: number;
  rows: number;
  cells: (number | null)[];
  winLines: number[][];
  popOut: boolean;
}

export function FourInARowBoard({ game, onMove }: BoardProps) {
  const view = game.view as FourInARowView;
  const s = 0.055;
  const width = view.cols * s;
  const height = view.rows * s;
  const moves = game.legalMoves as { type: 'drop' | 'pop'; column: number }[];
  const win = new Set(view.winLines.flat());
  const colX = (col: number) => (col - (view.cols - 1) / 2) * s;
  const base = TOP + 0.03;
  // Greifen: Scheibe oben über dem Gestell nehmen, über einer Spalte loslassen (#383).
  const drops = moves.flatMap((move) => (move.type === 'drop' ? [move] : []));
  const discY = base + height + 0.06;
  const grab = useGrab<string>({
    size: Math.max(width, height) + 0.1,
    plane: 'wall',
    wallCenterY: base + height / 2,
    alongX: true,
    radius: s * 0.55,
    targets: () => drops.map((m) => ({ id: m.column, x: colX(m.column), z: 0 })),
    onDrop: (_, to) => {
      const hit = drops.find((m) => m.column === to);
      if (hit) onMove(hit);
    },
  });
  const disc = (x: number, y: number, glow = false) => (
    <mesh position={[x, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[s * 0.42, s * 0.42, 0.012, 24]} />
      <meshStandardMaterial color={game.yourSeat === 0 ? RED : YELLOW} emissive={glow ? GOLD : '#000000'} emissiveIntensity={glow ? 0.5 : 0} />
    </mesh>
  );
  return (
    <group position={[TABLE_CENTER[0], 0, TABLE_CENTER[2] - 0.05]}>
      {drops.length > 0 && game.yourSeat !== null && (
        <group
          onPointerDown={(e) => {
            e.stopPropagation();
            grab.begin('disc', 0, discY);
          }}
        >
          {grab.held === null && disc(0, discY)}
          <mesh position={[0, discY, 0]} visible={false}>
            <boxGeometry args={[s, s, 0.03]} />
          </mesh>
        </group>
      )}
      {grab.held && disc(grab.held.x, grab.held.z, true)}
      {grab.layer}
      {/* Gestell: Rückwand und Füße */}
      <mesh position={[0, base + height / 2, -0.012]}>
        <boxGeometry args={[width + 0.03, height + 0.03, 0.008]} />
        <meshStandardMaterial color="#3f2a18" />
      </mesh>
      <mesh position={[0, TOP + 0.015, 0]}>
        <boxGeometry args={[width + 0.08, 0.03, 0.08]} />
        <meshStandardMaterial color="#5a3b22" />
      </mesh>
      {view.cells.map((seat, index) => {
        const col = Math.floor(index / view.rows);
        const row = index % view.rows;
        const pos: [number, number, number] = [colX(col), base + (row + 0.5) * s, 0];
        return (
          <mesh key={index} position={pos} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[s * 0.42, s * 0.42, 0.012, 24]} />
            {seat === null ? (
              <meshStandardMaterial color="#1d1510" />
            ) : (
              <meshStandardMaterial color={seat === 0 ? RED : YELLOW} emissive={win.has(index) ? GOLD : '#000000'} emissiveIntensity={win.has(index) ? 0.6 : 0} />
            )}
          </mesh>
        );
      })}
      {moves.map((move, i) =>
        move.type === 'drop' ? (
          <ColumnTarget key={`d${i}`} x={colX(move.column)} y={base + height / 2} width={s} height={height} onPress={() => onMove(move)} />
        ) : (
          <Button3D key={`p${i}`} label="⤓" position={[colX(move.column), TOP + 0.045, 0.05]} rotation={[-Math.PI / 3, 0, 0]} width={s * 0.9} height={0.035} onPress={() => onMove(move)} />
        ),
      )}
    </group>
  );
}

function ColumnTarget({ x, y, width, height, onPress }: { x: number; y: number; width: number; height: number; onPress: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <mesh
      position={[x, y, 0.012]}
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
      <boxGeometry args={[width * 0.95, height, 0.02]} />
      <meshBasicMaterial color={GOLD} transparent opacity={hover ? 0.3 : 0.06} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Schach: Figuren aus einfachen Körpern, Stellung aus dem FEN-Text der Sicht

interface ChessView {
  fen: string;
  lastMove: { from: string; to: string } | null;
}
interface ChessMove {
  type: 'move';
  from: string;
  to: string;
  promotion?: string;
}

function parsePlacement(fen: string): Map<string, { type: string; white: boolean }> {
  const pieces = new Map<string, { type: string; white: boolean }>();
  const rows = (fen.split(' ')[0] ?? '').split('/');
  rows.forEach((row, r) => {
    let file = 0;
    for (const ch of row) {
      if (ch >= '1' && ch <= '8') file += Number(ch);
      else {
        pieces.set(`${'abcdefgh'[file]}${8 - r}`, { type: ch.toLowerCase(), white: ch === ch.toUpperCase() });
        file++;
      }
    }
  });
  return pieces;
}

export function Piece({ type, white, tint }: { type: string; white: boolean; tint?: string }) {
  const color = tint ?? (white ? IVORY : EBONY);
  const mat = <meshStandardMaterial color={color} roughness={0.45} metalness={0.05} />;
  const body = type === 'p' ? 0.028 : type === 'k' || type === 'q' ? 0.05 : 0.04;
  return (
    <group>
      <mesh position={[0, 0.005, 0]}>
        <cylinderGeometry args={[0.016, 0.019, 0.01, 20]} />
        {mat}
      </mesh>
      <mesh position={[0, 0.01 + body / 2, 0]}>
        <cylinderGeometry args={[0.008, 0.014, body, 20]} />
        {mat}
      </mesh>
      {type === 'p' && (
        <mesh position={[0, 0.01 + body + 0.006, 0]}>
          <sphereGeometry args={[0.011, 16, 12]} />
          {mat}
        </mesh>
      )}
      {type === 'r' && (
        <mesh position={[0, 0.01 + body + 0.006, 0]}>
          <boxGeometry args={[0.024, 0.014, 0.024]} />
          {mat}
        </mesh>
      )}
      {type === 'b' && (
        <mesh position={[0, 0.01 + body + 0.01, 0]}>
          <coneGeometry args={[0.011, 0.026, 16]} />
          {mat}
        </mesh>
      )}
      {type === 'n' && (
        <mesh position={[0, 0.01 + body + 0.008, 0.004]} rotation={[0.5, 0, 0]}>
          <boxGeometry args={[0.014, 0.026, 0.02]} />
          {mat}
        </mesh>
      )}
      {type === 'q' && (
        <mesh position={[0, 0.01 + body + 0.008, 0]}>
          <sphereGeometry args={[0.013, 16, 12]} />
          <meshStandardMaterial color={GOLD} metalness={0.6} roughness={0.3} />
        </mesh>
      )}
      {type === 'k' && (
        <group position={[0, 0.01 + body + 0.012, 0]}>
          <mesh>
            <boxGeometry args={[0.006, 0.026, 0.006]} />
            <meshStandardMaterial color={GOLD} metalness={0.6} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.004, 0]}>
            <boxGeometry args={[0.018, 0.006, 0.006]} />
            <meshStandardMaterial color={GOLD} metalness={0.6} roughness={0.3} />
          </mesh>
        </group>
      )}
    </group>
  );
}

export function ChessBoard({ game, onMove }: BoardProps) {
  const view = game.view as ChessView;
  const [selected, setSelected] = useState<string | null>(null);
  const [promotion, setPromotion] = useState<{ moves: { move: ChessMove; label: string }[] } | null>(null);
  const s = 0.05;
  const flip = game.yourSeat === 1;
  const at = (square: string): [number, number] => {
    const file = square.charCodeAt(0) - 97;
    const rank = Number(square[1]) - 1;
    const x = (file - 3.5) * s;
    const z = (3.5 - rank) * s;
    return flip ? [-x, -z] : [x, z];
  };
  const pieces = parsePlacement(view.fen);
  const moves = (game.legalMoves as ChessMove[]).map((move, i) => ({ move, label: game.moveLabels?.[i] ?? `${move.from}–${move.to}` })).filter((m) => m.move.type === 'move');
  const movable = new Set(moves.map((m) => m.move.from));
  const last = view.lastMove ? new Set([view.lastMove.from, view.lastMove.to]) : new Set<string>();

  const grab = useGrab<string>({
    size: 8 * s,
    radius: s * 0.7,
    targets: (from) => [...new Set(moves.filter((m) => m.move.from === from).map((m) => m.move.to))].map((to) => ({ id: to, x: at(to)[0], z: at(to)[1] })),
    onDrop: (from, to) => {
      if (to === null) return;
      setSelected(from);
      const options = movesFor(moves, (m) => m.move.from, (m) => m.move.to, from, to);
      if (options.length === 1) {
        onMove(options[0]!.move);
        setSelected(null);
      } else if (options.length > 1) setPromotion({ moves: options });
    },
  });
  // Beim Greifen leuchten die Ziele der gegriffenen Figur, sonst die der angetippten.
  const source = grab.held?.id ?? selected;
  const targets = source ? moves.filter((m) => m.move.from === source) : [];
  const targetSquares = [...new Set(targets.map((m) => m.move.to))];
  const choose = (to: string) => {
    const options = targets.filter((m) => m.move.to === to);
    if (options.length === 1) {
      onMove(options[0]!.move);
      setSelected(null);
    } else if (options.length > 1) setPromotion({ moves: options });
  };

  const squares: ReactNode[] = [];
  for (let f = 0; f < 8; f++) {
    for (let r = 0; r < 8; r++) {
      const square = `${'abcdefgh'[f]}${r + 1}`;
      const [x, z] = at(square);
      const dark = (f + r) % 2 === 0;
      const piece = pieces.get(square);
      const canSelect = movable.has(square);
      squares.push(
        <group key={square} position={[x, 0, z]}>
          <mesh
            position={[0, 0.017, 0]}
            onClick={(e) => {
              e.stopPropagation();
              if (canSelect) {
                setPromotion(null);
                setSelected(square === selected ? null : square);
              }
            }}
          >
            <boxGeometry args={[s, 0.002, s]} />
            <meshStandardMaterial color={square === selected ? '#2f5d3a' : last.has(square) ? '#c49a4a' : dark ? '#6b4728' : '#d9b98a'} />
          </mesh>
          {piece && grab.held?.id !== square && (
            <group
              position={[0, 0.018, 0]}
              rotation={[0, flip ? Math.PI : 0, 0]}
              onPointerDown={(e) => {
                if (!canSelect) return;
                e.stopPropagation();
                grab.begin(square, x, z);
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (canSelect) {
                  setPromotion(null);
                  setSelected(square === selected ? null : square);
                } else if (selected && targetSquares.includes(square)) choose(square);
              }}
            >
              <Piece type={piece.type} white={piece.white} />
            </group>
          )}
        </group>,
      );
    }
  }
  return (
    <Plate size={[8 * s + 0.04, 8 * s + 0.04]} color="#3f2a18">
      {squares}
      {grab.held && pieces.get(grab.held.id) && (
        <group position={[grab.held.x, 0.06, grab.held.z]} rotation={[0, flip ? Math.PI : 0, 0]}>
          <Piece type={pieces.get(grab.held.id)!.type} white={pieces.get(grab.held.id)!.white} />
        </group>
      )}
      {grab.layer}
      {targetSquares.map((to) => {
        const [x, z] = at(to);
        return <Target key={to} position={[x, 0.02, z]} size={s * 0.3} onPress={() => choose(to)} label={targets.find((m) => m.move.to === to)?.label} />;
      })}
      {promotion && (
        <group position={[0, 0.12, 8 * s * 0.5 + 0.02]} rotation={[-Math.PI / 5, 0, 0]}>
          {promotion.moves.map((m, i) => (
            <Button3D
              key={m.label}
              label={m.label}
              position={[0, 0.07 - i * 0.045, 0]}
              width={0.34}
              height={0.04}
              onPress={() => {
                onMove(m.move);
                setPromotion(null);
                setSelected(null);
              }}
            />
          ))}
        </group>
      )}
    </Plate>
  );
}
