/**
 * Lege-Spiele in 3D, Paket 2 von #358: Domino, Wortgitter, Farbe & Form und Grafschaft.
 * Wie überall in der VR-App: Gezeigt wird nur die Sicht, anklickbar sind nur Ziele aus
 * `legalMoves`, geschickt wird der Eintrag selbst. Wo ein Feld zu mehreren Zügen gehört
 * (Wörter beim Wortgitter, Reihen bei Farbe & Form), erscheinen Knöpfe mit den Zugtexten.
 */
import { useState } from 'react';
import { Plate, Target, type BoardProps } from './boards';
import { TABLE_CENTER, TABLE_RADIUS } from './Tavern';
import { GOLD, labelTexture } from './text';
import { Button3D, Sign } from './ui3d';
import { pulse } from '../haptics';
import { useGrab } from './grab';
import { choiceOffset } from '../ui-state';

const TOP = TABLE_CENTER[1] + 0.002;
const SEAT_COLORS = ['#3a6fb0', '#a32a1c', '#2f7d4a', '#d9a400', '#7b2fa8', '#0d8478'];
/** Vorderkante, von der Tischmitte aus: Hier stehen Hand und Markt, leicht erhöht wie der Kartenfächer. */
const FRONT = TABLE_RADIUS - 0.2;
const HAND_Y = 0.11;

/** Ein Plättchen mit Schrift; flach (Standard) oder aufgestellt. */
export function Tile({ label, position, size, background, color = '#1d1510', onPress, glow, selected, rotation = [-Math.PI / 2, 0, 0] }: { label: string; position: [number, number, number]; size: number; background: string; color?: string; onPress?: () => void; glow?: boolean; selected?: boolean; rotation?: [number, number, number] }) {
  const [hover, setHover] = useState(false);
  const texture = labelTexture([label], { width: 128, height: 128, background, color, border: selected ? '#7fd18b' : hover && onPress ? '#ffffff' : glow ? GOLD : null, font: label.length > 2 ? 38 : label.length === 2 ? 50 : 70 });
  return (
    <mesh
      position={position}
      rotation={rotation}
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

/** Knöpfe zur Wahl zwischen mehreren Zügen, seitenweise zu acht; liegt in einer Gruppe in der Tischmitte. */
export function Choices({ options, onPick, onClose }: { options: { move: unknown; label: string }[]; onPick: (move: unknown) => void; onClose: () => void }) {
  const [page, setPage] = useState(0);
  const per = 8;
  const pages = Math.max(1, Math.ceil(options.length / per));
  const shown = options.slice(page * per, page * per + per);
  return (
    <group position={[choiceOffset(), 0.3, FRONT - 0.1]} rotation={[-0.35, 0, 0]}>
      {shown.map((o, i) => (
        <Button3D key={`${page}-${o.label || i}`} label={o.label} position={[0, -i * 0.042, 0]} width={0.46} height={0.038} onPress={() => onPick(o.move)} />
      ))}
      {pages > 1 && <Button3D label={`Weitere (${page + 1}/${pages})`} position={[-0.12, -shown.length * 0.042, 0]} width={0.22} height={0.034} onPress={() => setPage((page + 1) % pages)} />}
      <Button3D label="Abbrechen" position={[pages > 1 ? 0.12 : 0, -shown.length * 0.042, 0]} width={0.2} height={0.034} onPress={onClose} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Domino

interface DominoView {
  chain: { stone: number; left: number; right: number }[];
  spinnerIndex: number | null;
  upBranch: { stone: number; left: number; right: number }[];
  downBranch: { stone: number; left: number; right: number }[];
  hands: (number | null)[][];
  boneyard: unknown[];
}

const STONES: [number, number][] = [];
for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) STONES.push([a, b]);

function DominoStone({ a, b, position, rotation, onPress, glow, size = 0.026 }: { a: number; b: number; position: [number, number, number]; rotation?: [number, number, number]; onPress?: () => void; glow?: boolean; size?: number }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, size * 0.15, 0]}>
        <boxGeometry args={[size * 2.04, size * 0.3, size * 1.02]} />
        <meshStandardMaterial color="#fbf5e6" roughness={0.4} />
      </mesh>
      <Tile label={String(a)} position={[-size / 2, size * 0.31, 0]} size={size * 0.94} background="#fbf5e6" onPress={onPress} glow={glow} />
      <Tile label={String(b)} position={[size / 2, size * 0.31, 0]} size={size * 0.94} background="#fbf5e6" onPress={onPress} glow={glow} />
    </group>
  );
}

export function DominoBoard({ game, onMove }: BoardProps) {
  const view = game.view as DominoView;
  const me = game.yourSeat ?? 0;
  const [choice, setChoice] = useState<number | null>(null);
  const moves = game.legalMoves.map((move, i) => ({ move: move as { type: string; stone?: number }, label: game.moveLabels?.[i] ?? '' }));
  const plays = moves.filter((m) => m.move.type === 'play');
  const draw = moves.find((m) => m.move.type === 'draw');
  const size = 0.03;
  const perRow = 10;
  // Kette: Schlange in Reihen zu 10 Steinen, abwechselnd von links und von rechts.
  const chainAt = (k: number): [number, number] => {
    const row = Math.floor(k / perRow);
    const col = k % perRow;
    const x = ((row % 2 === 0 ? col : perRow - 1 - col) - (perRow - 1) / 2) * size * 2.1;
    return [x, (row - 1) * size * 1.6];
  };
  const spinner = view.spinnerIndex !== null ? chainAt(view.spinnerIndex) : null;
  const hand = (view.hands[me] ?? []).filter((s): s is number => s !== null);
  const press = (stone: number) => {
    const options = plays.filter((m) => m.move.stone === stone);
    if (options.length === 1) onMove(options[0]!.move);
    else if (options.length > 1) setChoice(stone);
  };
  // Greifen (#383): Stein aus der Hand nehmen und auf die Kette legen; mehrere Enden: Wahlknöpfe.
  const grab = useGrab<number>({
    size: 0.9,
    radius: 0.4,
    targets: () => [{ id: 'kette', x: 0, z: 0 }],
    onDrop: (stone, to) => {
      if (to !== null) press(stone);
    },
  });
  return (
    <group position={[TABLE_CENTER[0], TOP, TABLE_CENTER[2]]}>
      {grab.held && <DominoStone a={STONES[grab.held.id]![0]} b={STONES[grab.held.id]![1]} position={[grab.held.x, 0.03, grab.held.z]} size={size * 1.2} glow />}
      {grab.layer}
      {view.chain.map((c, k) => {
        const [x, z] = chainAt(k);
        const double = c.left === c.right;
        return <DominoStone key={`c${k}`} a={c.left} b={c.right} position={[x, 0, z]} rotation={[0, double ? Math.PI / 2 : 0, 0]} size={size} />;
      })}
      {spinner &&
        [...view.upBranch.map((c, k) => ({ c, z: spinner[1] - (k + 1) * size * 2.1 })), ...view.downBranch.map((c, k) => ({ c, z: spinner[1] + (k + 1) * size * 2.1 }))].map(({ c, z }, k) => (
          <DominoStone key={`b${k}`} a={c.left} b={c.right} position={[spinner[0], 0, z]} rotation={[0, Math.PI / 2, 0]} size={size} />
        ))}
      {hand.map((stone, i) => {
        const [a, b] = STONES[stone]!;
        const playable = plays.some((m) => m.move.stone === stone);
        if (grab.held?.id === stone) return null;
        const at: [number, number, number] = [(i - (hand.length - 1) / 2) * size * 3, HAND_Y, FRONT];
        return (
          <group
            key={stone}
            onPointerDown={(e) => {
              if (!playable) return;
              e.stopPropagation();
              grab.begin(stone, at[0], at[2]);
            }}
          >
            <DominoStone a={a} b={b} position={at} rotation={[-0.55 + Math.PI / 2, 0, 0]} size={size * 1.2} glow={playable} onPress={playable ? () => press(stone) : undefined} />
          </group>
        );
      })}
      {view.boneyard.length > 0 && (
        <group position={[-0.3, 0, 0.12]}>
          {Array.from({ length: Math.min(6, view.boneyard.length) }, (_, k) => (
            <mesh key={k} position={[0, 0.005 + k * 0.009, 0]}>
              <boxGeometry args={[size * 2, size * 0.3, size]} />
              <meshStandardMaterial color="#2b1b10" />
            </mesh>
          ))}
          {draw && <Button3D label="Stein ziehen" position={[0, 0.08, 0]} rotation={[-0.5, 0, 0]} width={0.14} height={0.035} active onPress={() => onMove(draw.move)} />}
        </group>
      )}
      {choice !== null && (
        <Choices
          options={plays.filter((m) => m.move.stone === choice)}
          onPick={(move) => {
            onMove(move);
            setChoice(null);
          }}
          onClose={() => setChoice(null)}
        />
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Wortgitter: 15 × 15, eigene Bank vorn; Feld antippen zeigt die Wörter, die es berühren

interface WordView {
  board: ({ letter: string; blank: boolean; by: number } | null)[];
  racks: (string | null)[][];
}

export function WordGridBoard({ game, onMove }: BoardProps) {
  const view = game.view as WordView;
  const me = game.yourSeat ?? 0;
  const [cell, setCell] = useState<number | null>(null);
  const c = 0.028;
  const plays = game.legalMoves.flatMap((move, i) => {
    const m = move as { type: string; tiles?: { row: number; col: number }[] };
    return m.type === 'play' && m.tiles ? [{ move, label: game.moveLabels?.[i] ?? '', cells: m.tiles.map((t) => t.row * 15 + t.col) }] : [];
  });
  const reachable = new Set(plays.flatMap((p) => p.cells));
  const options = cell === null ? [] : plays.filter((p) => p.cells.includes(cell)).sort((a, b) => b.cells.length - a.cells.length || a.label.localeCompare(b.label));
  const rack = (view.racks[me] ?? []).filter((t): t is string => t !== null);
  const cellAt = (i: number): [number, number] => [((i % 15) - 7) * c, (Math.floor(i / 15) - 7) * c];
  // Greifen (#383): Buchstabe aus der Bank auf ein leuchtendes Feld legen, dann das Wort wählen.
  const grab = useGrab<number>({
    size: 15 * c,
    radius: c * 0.75,
    targets: () => [...reachable].map((i) => ({ id: i, x: cellAt(i)[0], z: cellAt(i)[1] })),
    onDrop: (_, to) => {
      if (to !== null) setCell(to as number);
    },
  });
  return (
    <Plate size={[15 * c + 0.03, 15 * c + 0.03]} color="#3f2a18">
      {grab.held && <Tile label={rack[grab.held.id] === '?' || rack[grab.held.id] === '' ? '?' : (rack[grab.held.id] ?? '')} position={[grab.held.x, 0.05, grab.held.z]} size={c * 0.92} background="#f3dfae" glow />}
      {grab.layer}
      {view.board.map((tile, i) => {
        const x = ((i % 15) - 7) * c;
        const z = (Math.floor(i / 15) - 7) * c;
        if (tile) return <Tile key={i} label={tile.letter} position={[x, 0.0185, z]} size={c * 0.92} background={tile.blank ? '#d8cbb0' : '#f3dfae'} />;
        return (
          <Tile
            key={i}
            label={i === 112 ? '★' : ''}
            position={[x, 0.0175, z]}
            size={c * 0.92}
            background={i === cell ? '#2f5d3a' : '#2f6a4f'}
            color="#efe3c8"
            glow={reachable.has(i)}
            onPress={reachable.has(i) ? () => setCell(i === cell ? null : i) : undefined}
          />
        );
      })}
      {rack.map((letter, i) =>
        grab.held?.id === i ? null : (
          <group
            key={`r${i}`}
            onPointerDown={(e) => {
              if (reachable.size === 0) return;
              e.stopPropagation();
              grab.begin(i, (i - (rack.length - 1) / 2) * 0.05, 15 * c * 0.5 + 0.09);
            }}
          >
            <Tile label={letter === '?' || letter === '' ? '?' : letter} position={[(i - (rack.length - 1) / 2) * 0.05, 0.06, 15 * c * 0.5 + 0.09]} size={0.044} background="#f3dfae" rotation={[-0.6, 0, 0]} />
          </group>
        ),
      )}
      {cell !== null && options.length > 0 && (
        <Choices
          options={options}
          onPick={(move) => {
            onMove(move);
            setCell(null);
          }}
          onClose={() => setCell(null)}
        />
      )}
    </Plate>
  );
}

// ---------------------------------------------------------------------------
// Farbe & Form: offenes Raster, Plättchen mit Form und Farbe

interface ColorShapeView {
  board: { x: number; y: number; tile: number }[];
  hands: (number | null)[][];
}

const CS_COLORS = ['#e8483b', '#f39b1f', '#f4e04d', '#2fb67a', '#3a8ee6', '#c06fd8'];
const CS_SHAPES = ['●', '■', '◆', '★', '✚', '♣'];
const csColor = (tile: number) => CS_COLORS[Math.floor(tile / 18)]!;
const csShape = (tile: number) => CS_SHAPES[Math.floor(tile / 3) % 6]!;

export function ColorShapeBoard({ game, onMove }: BoardProps) {
  const view = game.view as ColorShapeView;
  const me = game.yourSeat ?? 0;
  const [spot, setSpot] = useState<string | null>(null);
  const places = game.legalMoves.flatMap((move, i) => {
    const m = move as { type: string; tiles?: { x: number; y: number }[] };
    return m.type === 'place' && m.tiles ? [{ move, label: game.moveLabels?.[i] ?? '', spots: m.tiles.map((t) => `${t.x},${t.y}`) }] : [];
  });
  const reachable = new Map<string, { x: number; y: number }>();
  for (const p of places) for (const s of p.spots) reachable.set(s, { x: Number(s.split(',')[0]), y: Number(s.split(',')[1]) });
  const all = [...view.board.map((b) => ({ x: b.x, y: b.y })), ...reachable.values()];
  const minX = Math.min(0, ...all.map((p) => p.x));
  const maxX = Math.max(0, ...all.map((p) => p.x));
  const minY = Math.min(0, ...all.map((p) => p.y));
  const maxY = Math.max(0, ...all.map((p) => p.y));
  const span = Math.max(maxX - minX + 1, maxY - minY + 1);
  const c = Math.min(0.04, 0.5 / span);
  const at = (x: number, y: number): [number, number] => [(x - (minX + maxX) / 2) * c, (y - (minY + maxY) / 2) * c];
  const options = spot === null ? [] : places.filter((p) => p.spots.includes(spot));
  const hand = (view.hands[me] ?? []).filter((t): t is number => t !== null);
  const grab = useGrab<number>({
    size: Math.max(0.5, span * c),
    radius: c * 0.75,
    targets: () => [...reachable.entries()].map(([key, p]) => ({ id: key, x: at(p.x, p.y)[0], z: at(p.x, p.y)[1] })),
    onDrop: (_, to) => {
      if (to !== null) setSpot(String(to));
    },
  });
  return (
    <Plate size={[Math.max(0.3, (maxX - minX + 2) * c), Math.max(0.3, (maxY - minY + 2) * c)]} color="#2b1b10">
      {grab.held && <Tile label={csShape(grab.held.id)} position={[grab.held.x, 0.05, grab.held.z]} size={c * 0.92} background="#1d1510" color={csColor(grab.held.id)} glow />}
      {grab.layer}
      {view.board.map((b) => {
        const [x, z] = at(b.x, b.y);
        return <Tile key={`${b.x},${b.y}`} label={csShape(b.tile)} position={[x, 0.0185, z]} size={c * 0.92} background="#1d1510" color={csColor(b.tile)} />;
      })}
      {[...reachable.entries()].map(([key, p]) => {
        const [x, z] = at(p.x, p.y);
        return <Target key={key} position={[x, 0.019, z]} size={c * 0.3} onPress={() => setSpot(key === spot ? null : key)} />;
      })}
      {hand.map((tile, i) => {
        if (grab.held?.id === tile) return null;
        const hx = (i - (hand.length - 1) / 2) * 0.055;
        const hz = Math.max(0.3, (maxY - minY + 2) * c) / 2 + 0.08;
        return (
          <group
            key={`h${tile}`}
            onPointerDown={(e) => {
              if (reachable.size === 0) return;
              e.stopPropagation();
              grab.begin(tile, hx, hz);
            }}
          >
            <Tile label={csShape(tile)} position={[hx, 0.06, hz]} size={0.048} background="#1d1510" color={csColor(tile)} rotation={[-0.6, 0, 0]} />
          </group>
        );
      })}
      {spot !== null && options.length > 0 && (
        <Choices
          options={options}
          onPick={(move) => {
            onMove(move);
            setSpot(null);
          }}
          onClose={() => setSpot(null)}
        />
      )}
    </Plate>
  );
}

// ---------------------------------------------------------------------------
// Grafschaft: Sechseck-Landschaft, Markt vorn; erst Plättchen wählen, dann Platz

interface GrafschaftView {
  board: Record<string, { type: string; q: number; r: number; owner: number; river?: boolean; road?: boolean }>;
  market: { type: string; river?: boolean; road?: boolean }[];
}

const LAND: Record<string, { color: string; sign: string }> = {
  wald: { color: '#2f6b35', sign: '🌲' },
  wiese: { color: '#8cbf4f', sign: '🌼' },
  feld: { color: '#d9b84a', sign: '🌾' },
  teich: { color: '#3a7fb8', sign: '🐟' },
  dorf: { color: '#b0603a', sign: '🏠' },
  berg: { color: '#8a8580', sign: '⛰️' },
};

function Hex({ land, position, owner, onPress, glow, r = 0.036 }: { land: string; position: [number, number, number]; owner?: number; onPress?: () => void; glow?: boolean; r?: number }) {
  const info = LAND[land] ?? { color: '#777', sign: '?' };
  const [hover, setHover] = useState(false);
  return (
    <group position={position}>
      <mesh
        rotation={[0, Math.PI / 6, 0]}
        position={[0, 0.006, 0]}
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
        <cylinderGeometry args={[r, r, 0.012, 6]} />
        <meshStandardMaterial color={glow || hover ? GOLD : info.color} roughness={0.8} />
      </mesh>
      <Tile label={info.sign} position={[0, 0.0125, 0]} size={r} background={info.color} />
      {owner !== undefined && owner >= 0 && (
        <mesh position={[0, 0.0128, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[r * 0.75, r * 0.9, 6, 1, Math.PI / 6]} />
          <meshBasicMaterial color={SEAT_COLORS[owner % SEAT_COLORS.length]} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

export function GrafschaftBoard({ game, onMove }: BoardProps) {
  const view = game.view as GrafschaftView;
  const [market, setMarket] = useState<number | null>(null);
  const moves = game.legalMoves.flatMap((move, i) => {
    const m = move as { type: string; marketIndex: number; q: number; r: number };
    return m.type === 'place' ? [{ move, m, label: game.moveLabels?.[i] ?? '' }] : [];
  });
  const usable = new Set(moves.map((x) => x.m.marketIndex));
  const targets = market === null ? [] : moves.filter((x) => x.m.marketIndex === market);
  const d = 0.036;
  const hexAt = (q: number, r: number): [number, number] => [d * Math.sqrt(3) * (q + r / 2), d * 1.5 * r];
  // Greifen (#383): Plättchen vom Markt auf einen leuchtenden Platz legen.
  const grab = useGrab<number>({
    size: 0.7,
    radius: d * 0.9,
    targets: (index) => moves.filter((x) => x.m.marketIndex === index).map((x) => ({ id: `${x.m.q},${x.m.r}`, x: hexAt(x.m.q, x.m.r)[0], z: hexAt(x.m.q, x.m.r)[1] })),
    onDrop: (index, to) => {
      const hit = moves.find((x) => x.m.marketIndex === index && `${x.m.q},${x.m.r}` === to);
      if (hit) {
        onMove(hit.move);
        setMarket(null);
      }
    },
  });
  const shown = grab.held ? moves.filter((x) => x.m.marketIndex === grab.held!.id) : targets;
  return (
    <group position={[TABLE_CENTER[0], TOP, TABLE_CENTER[2]]}>
      {grab.held && <Hex land={view.market[grab.held.id]?.type ?? ''} position={[grab.held.x, 0.03, grab.held.z]} glow />}
      {grab.layer}
      {Object.values(view.board).map((t) => {
        const [x, z] = hexAt(t.q, t.r);
        return <Hex key={`${t.q},${t.r}`} land={t.type} owner={t.owner} position={[x, 0, z]} />;
      })}
      {shown.map(({ m, move, label }) => {
        const [x, z] = hexAt(m.q, m.r);
        return <Target key={`${m.q},${m.r}`} position={[x, 0.004, z]} size={0.018} onPress={() => (onMove(move), setMarket(null))} label={label} />;
      })}
      {view.market.map((t, i) =>
        grab.held?.id === i ? null : (
          <group
            key={i}
            position={[(i - (view.market.length - 1) / 2) * 0.09, HAND_Y, FRONT]}
            rotation={[Math.PI / 2 - 0.55, 0, 0]}
            onPointerDown={(e) => {
              if (!usable.has(i)) return;
              e.stopPropagation();
              grab.begin(i, (i - (view.market.length - 1) / 2) * 0.09, FRONT);
            }}
          >
            <Hex land={t.type} position={[0, 0, 0]} glow={market === i} onPress={usable.has(i) ? () => setMarket(market === i ? null : i) : undefined} />
          </group>
        ),
      )}
      <Sign lines={[market === null ? 'Plättchen vom Markt wählen' : 'Leuchtenden Platz antippen']} position={[0, HAND_Y + 0.07, FRONT - 0.03]} rotation={[-0.55, 0, 0]} width={0.3} height={0.03} />
    </group>
  );
}
