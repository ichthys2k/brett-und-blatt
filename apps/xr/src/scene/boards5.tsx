/**
 * Paket 3 von #358: Würfelblock und Mäxle mit Würfeln, Paare finden und Tiefflug mit Karten,
 * dazu die Spieltafel für alle Spiele ohne eigenen Tisch. Wie überall in der VR-App: Gezeigt
 * wird nur die Sicht, anklickbar sind nur Ziele aus `legalMoves`, geschickt wird der Eintrag selbst.
 */
import type { GameMessage } from '@brett-und-blatt/online';
import { useState } from 'react';
import type { BoardProps } from './boards';
import { Choices, Tile } from './boards4';
import { peterFace } from './card-views';
import { Card } from './cards';
import { seatAngle } from './Seats';
import { tafelLines } from './tafel-lines';
import { TABLE_CENTER, TABLE_RADIUS } from './Tavern';
import { GOLD, WOOD_DARK } from './text';
import { Button3D, Sign } from './ui3d';

const TOP = TABLE_CENTER[1] + 0.002;

/** Die Tafel: aufgestellt hinter der Tischmitte, mit dem Stand in kurzen Zeilen. */
export function Tafel({ game, lines: extra }: { game: GameMessage; lines?: string[] }) {
  const lines = (extra ?? tafelLines(game)).slice(0, 12);
  if (lines.length === 0) return null;
  const height = 0.03 + lines.length * 0.034;
  return <Sign lines={lines} position={[TABLE_CENTER[0], TOP + 0.03 + height / 2, TABLE_CENTER[2] - 0.2]} rotation={[-0.25, 0, 0]} width={0.62} height={height} background={WOOD_DARK} />;
}

/** Ein Würfel mit Augenzahl; gehaltene Würfel stehen etwas höher und leuchten. */
function Die({ value, position, held, onPress }: { value: number | null; position: [number, number, number]; held?: boolean; onPress?: () => void }) {
  const s = 0.05;
  return (
    <group position={[position[0], position[1] + (held ? 0.012 : 0), position[2]]}>
      <mesh
        position={[0, s / 2, 0]}
        onClick={
          onPress
            ? (e) => {
                e.stopPropagation();
                onPress();
              }
            : undefined
        }
      >
        <boxGeometry args={[s, s, s]} />
        <meshStandardMaterial color={held ? '#f6e3a8' : '#fbf5e6'} roughness={0.35} />
      </mesh>
      <Tile label={value === null ? '?' : String(value)} position={[0, s + 0.0006, 0]} size={s * 0.92} background={held ? '#f6e3a8' : '#fbf5e6'} glow={Boolean(onPress)} onPress={onPress} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Würfelblock

interface KniffelView {
  turn: number;
  rollsLeft: number;
  dice: { values: number[]; held: boolean[] } | null;
  sheets: { total: number }[];
}

export function KniffelBoard({ game, onMove }: BoardProps) {
  const view = game.view as KniffelView;
  const moves = game.legalMoves as { type: string; index?: number }[];
  const roll = moves.find((m) => m.type === 'roll');
  const holdMove = (index: number) => moves.find((m) => (m.type === 'toggleHold' || m.type === 'hold' || m.type === 'unhold') && m.index === index);
  return (
    <>
      <group position={[TABLE_CENTER[0], TOP, TABLE_CENTER[2]]}>
        {(view.dice?.values ?? [null, null, null, null, null]).map((value, i) => {
          const move = holdMove(i);
          return <Die key={i} value={value} position={[(i - 2) * 0.08, 0, 0.05]} held={view.dice?.held[i]} onPress={move ? () => onMove(move) : undefined} />;
        })}
        {roll && <Button3D label={`🎲 Würfeln (noch ${view.rollsLeft})`} position={[0.27, 0.07, 0.1]} rotation={[-0.6, -0.3, 0]} width={0.24} height={0.045} active onPress={() => onMove(roll)} />}
      </group>
      <Tafel game={game} lines={[`${game.seats[view.turn]?.name ?? ''} ist dran · noch ${view.rollsLeft} Würfe`, `Punkte: ${view.sheets.map((s, i) => `${game.seats[i]?.name ?? i + 1} ${s.total}`).join(' · ')}`, 'Würfel antippen hält sie; Eintragen im Fenster.']} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Mäxle

interface MaexleView {
  phase: string;
  dice: number[] | null;
  history: { seat: number; value: number }[];
  penalties: number[];
  limit: number;
  scoring: string;
}

const maexleText = (v: number) => (v === 21 ? 'Mäxle' : Math.floor(v / 10) === v % 10 ? `Pasch ${v % 10}` : String(v));

export function MaexleBoard({ game, onMove }: BoardProps) {
  const view = game.view as MaexleView;
  const roll = (game.legalMoves as { type: string }[]).find((m) => m.type === 'roll');
  const last = view.history[view.history.length - 1];
  return (
    <>
      <group position={[TABLE_CENTER[0], TOP, TABLE_CENTER[2]]}>
        {view.dice ? (
          view.dice.map((value, i) => <Die key={i} value={value} position={[(i - 0.5) * 0.07, 0, 0.05]} />)
        ) : (
          <mesh position={[0, 0.04, 0.05]}>
            <cylinderGeometry args={[0.05, 0.06, 0.08, 24]} />
            <meshStandardMaterial color="#5a3b22" roughness={0.6} />
          </mesh>
        )}
        {roll && <Button3D label="🎲 Würfeln" position={[0.27, 0.07, 0.1]} rotation={[-0.6, -0.3, 0]} width={0.18} height={0.045} active onPress={() => onMove(roll)} />}
      </group>
      <Tafel
        game={game}
        lines={[
          last ? `Angesagt: ${maexleText(last.value)} (${game.seats[last.seat]?.name ?? ''})` : 'Noch nichts angesagt',
          view.dice ? `Dein Wurf: ${maexleText(Math.max(view.dice[0]!, view.dice[1]!) * 10 + Math.min(view.dice[0]!, view.dice[1]!))}` : '',
          `${view.scoring === 'lives' ? 'Verlorene Leben' : 'Strafpunkte'}: ${view.penalties.map((p, i) => `${game.seats[i]?.name ?? i + 1} ${p}`).join(' · ')}`,
        ].filter(Boolean)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Paare finden

interface PairsView {
  set: string;
  cols: number;
  rows: number;
  faces: ({ pair: number; side: 'a' | 'b' } | null)[];
  status: string[];
  custom?: { a: string; b: string }[];
  scores: number[];
}

export function PairsBoard({ game, onMove }: BoardProps) {
  const view = game.view as PairsView;
  const flips = new Map((game.legalMoves as { type: string; card: number }[]).filter((m) => m.type === 'flip').map((m) => [m.card, m]));
  const step = Math.min(0.085, 0.5 / Math.max(view.cols, view.rows));
  return (
    <>
      <group position={[TABLE_CENTER[0], TOP, TABLE_CENTER[2]]}>
        {view.faces.map((face, i) => {
          if (view.status[i] === 'gone') return null;
          const x = ((i % view.cols) - (view.cols - 1) / 2) * step;
          const z = (Math.floor(i / view.cols) - (view.rows - 1) / 2) * step;
          const text = face ? (view.custom?.[face.pair]?.[face.side] ?? peterFace(view.set, face).center) : null;
          const move = flips.get(i);
          return (
            <Card
              key={i}
              face={text === null ? null : { center: text, corner: '', color: '#1d1510', background: '#fbf5e6' }}
              position={[x, 0.002, z]}
              rotation={[-Math.PI / 2, 0, 0]}
              scale={step / 0.11}
              highlight={Boolean(move)}
              onPress={move ? () => onMove(move) : undefined}
            />
          );
        })}
      </group>
      <Tafel game={game} lines={[`Paare: ${view.scores.map((s, i) => `${game.seats[i]?.name ?? i + 1} ${s}`).join(' · ')}`]} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Tiefflug: eigenes Raster vorn, die der anderen an ihren Plätzen

interface LowFlightView {
  rows: number;
  cols: number;
  discard: number[];
  drawn: { value: number; from: string } | null;
  players: { grid: { value: number | null; open: boolean }[]; total: number }[];
}

function lowColor(value: number): string {
  if (value < 0) return '#3a6fb0';
  if (value === 0) return '#7fb7d9';
  if (value <= 4) return '#2f7d4a';
  if (value <= 8) return '#d9a400';
  return '#b3261e';
}

export function LowFlightBoard({ game, onMove }: BoardProps) {
  const view = game.view as LowFlightView;
  const [slot, setSlot] = useState<number | null>(null);
  const me = game.yourSeat ?? 0;
  const moves = game.legalMoves.map((move, i) => ({ move: move as { type: string; slot?: number }, label: game.moveLabels?.[i] ?? '' }));
  const forSlot = (s: number) => moves.filter((m) => ['reveal', 'swap', 'flip'].includes(m.move.type) && m.move.slot === s);
  const draw = moves.find((m) => m.move.type === 'draw');
  const take = moves.find((m) => m.move.type === 'takeDiscard');
  const top = view.discard[view.discard.length - 1];
  const grid = (seat: number, size: number, interactive: boolean) =>
    (view.players[seat]?.grid ?? []).map((c, i) => {
      const x = ((i % view.cols) - (view.cols - 1) / 2) * size * 1.08;
      const z = (Math.floor(i / view.cols) - (view.rows - 1) / 2) * size * 1.08;
      const options = interactive ? forSlot(i) : [];
      const press = options.length === 1 ? () => onMove(options[0]!.move) : options.length > 1 ? () => setSlot(i) : undefined;
      return c.open && c.value !== null ? (
        <Tile key={i} label={String(c.value)} position={[x, 0.004, z]} size={size} background={lowColor(c.value)} color="#fbf5e6" glow={Boolean(press)} onPress={press} />
      ) : (
        <Tile key={i} label="" position={[x, 0.004, z]} size={size} background="#7a1f1a" glow={Boolean(press)} onPress={press} />
      );
    });
  return (
    <group>
      <group position={[TABLE_CENTER[0], TOP, TABLE_CENTER[2] + TABLE_RADIUS - 0.3]}>{grid(me, 0.05, true)}</group>
      {view.players.map((_, seat) => {
        if (seat === me) return null;
        const angle = seatAngle(seat, game.yourSeat, view.players.length);
        const r = TABLE_RADIUS - 0.2;
        return (
          <group key={seat} position={[TABLE_CENTER[0] + Math.sin(angle) * r, TOP, TABLE_CENTER[2] + Math.cos(angle) * r]} rotation={[0, angle, 0]}>
            {grid(seat, 0.03, false)}
          </group>
        );
      })}
      <group position={[TABLE_CENTER[0], TOP, TABLE_CENTER[2] - 0.02]}>
        <Tile label="" position={[-0.06, 0.004, 0]} size={0.06} background="#7a1f1a" glow={Boolean(draw)} onPress={draw ? () => onMove(draw.move) : undefined} />
        {top !== undefined && <Tile label={String(top)} position={[0.03, 0.004, 0]} size={0.06} background={lowColor(top)} color="#fbf5e6" glow={Boolean(take)} onPress={take ? () => onMove(take.move) : undefined} />}
        {view.drawn && <Tile label={String(view.drawn.value)} position={[0.12, 0.09, 0.04]} size={0.07} background={lowColor(view.drawn.value)} color="#fbf5e6" rotation={[-0.6, 0, 0]} />}
        {view.drawn && (
          <mesh position={[0.12, 0.09, 0.0395]} rotation={[-0.6, 0, 0]}>
            <planeGeometry args={[0.078, 0.078]} />
            <meshBasicMaterial color={GOLD} toneMapped={false} />
          </mesh>
        )}
      </group>
      {slot !== null && (
        <group position={[TABLE_CENTER[0], TOP, TABLE_CENTER[2]]}>
          <Choices
            options={forSlot(slot)}
            onPick={(move) => {
              onMove(move);
              setSlot(null);
            }}
            onClose={() => setSlot(null)}
          />
        </group>
      )}
    </group>
  );
}
