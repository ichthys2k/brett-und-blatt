/**
 * Geschlagene Figuren am Tischrand (#390): bei Schach und Dame stehen die geschlagenen Figuren
 * auf der Seite dessen, der sie geschlagen hat. Rein darstellend, nur aus der Sicht abgeleitet.
 */
import type { GameMessage } from '@brett-und-blatt/online';
import { TABLE_CENTER } from './Tavern';
import { Piece } from './boards';
import { chessCaptured, checkersCaptured, fourChessLost, millCaptured } from './captured';
import { seatAngle } from './Seats';

export const CAPTURED_GAMES = ['chess', 'checkers', 'mill', 'four-player-chess'] as const;

const STEP = 0.026;
const LIGHT = '#e8d8b8';
const DARK = '#3a2a1c';

function Row({ z, children }: { z: number; children: React.ReactNode }) {
  return <group position={[TABLE_CENTER[0], TABLE_CENTER[1] + 0.004, TABLE_CENTER[2] + z]}>{children}</group>;
}

export function CapturedTray({ game }: { game: GameMessage }) {
  const near = 0.29;
  const flip = game.yourSeat === 1;
  if (game.gameId === 'chess') {
    const lost = chessCaptured((game.view as { fen: string }).fen);
    // Weiß sitzt vorn, wenn ich nicht Schwarz bin; geschlagene schwarze Figuren stehen bei Weiß.
    const whiteZ = flip ? -near : near;
    const row = (types: string[], white: boolean, z: number) => (
      <Row z={z}>
        {types.map((type, i) => (
          <group key={i} position={[(i - (types.length - 1) / 2) * STEP, 0, 0]} scale={0.55}>
            <Piece type={type} white={white} />
          </group>
        ))}
      </Row>
    );
    return (
      <group>
        {row(lost.black, false, whiteZ)}
        {row(lost.white, true, -whiteZ)}
      </group>
    );
  }
  if (game.gameId === 'checkers') {
    const view = game.view as { size: number; cells: ({ seat: number } | null)[] };
    const [lost0, lost1] = checkersCaptured(view.size, view.cells);
    // Platz 0 sitzt vorn, wenn ich nicht Platz 1 bin; die geschlagenen Steine von Platz 1 stehen bei Platz 0.
    const zOf = (seat: number) => ((seat === 0) !== flip ? near : -near);
    const stones = (count: number, color: string, z: number) => (
      <Row z={z}>
        {Array.from({ length: count }, (_, i) => (
          <mesh key={i} position={[(i - (count - 1) / 2) * 0.02, 0.006, 0]}>
            <cylinderGeometry args={[0.009, 0.01, 0.007, 16]} />
            <meshStandardMaterial color={color} roughness={0.4} />
          </mesh>
        ))}
      </Row>
    );
    return (
      <group>
        {stones(lost1, DARK, zOf(0))}
        {stones(lost0, LIGHT, zOf(1))}
      </group>
    );
  }
  if (game.gameId === 'mill') {
    const view = game.view as { cells: (number | null)[]; inHand: [number, number] };
    const [lost0, lost1] = millCaptured(view.cells, view.inHand);
    // Wie bei der Dame: die geschlagenen Steine von Platz 1 stehen bei Platz 0 und umgekehrt.
    const zOf = (seat: number) => ((seat === 0) !== flip ? near : -near);
    const stones = (count: number, color: string, z: number) => (
      <Row z={z}>
        {Array.from({ length: count }, (_, i) => (
          <mesh key={i} position={[(i - (count - 1) / 2) * 0.022, 0.006, 0]}>
            <cylinderGeometry args={[0.009, 0.01, 0.007, 16]} />
            <meshStandardMaterial color={color} roughness={0.4} />
          </mesh>
        ))}
      </Row>
    );
    return (
      <group>
        {stones(lost1, DARK, zOf(0))}
        {stones(lost0, LIGHT, zOf(1))}
      </group>
    );
  }
  if (game.gameId === 'four-player-chess') {
    const lost = fourChessLost((game.view as { board: ({ c: string; t: string } | null)[] }).board);
    const colors = ['r', 'b', 'y', 'g'];
    const tints: Record<string, string> = { r: '#b3261e', b: '#1e5bb8', y: '#d9a400', g: '#2e7d32' };
    // Vor jedem Platz stehen die Figuren seiner Farbe, die nicht mehr auf dem Brett sind.
    return (
      <group>
        {game.seats.map((_, seat) => {
          const types = lost[colors[seat] ?? 'r'] ?? [];
          if (types.length === 0) return null;
          const angle = seatAngle(seat, game.yourSeat, game.seats.length);
          const r = 0.31;
          return (
            <group key={seat} position={[TABLE_CENTER[0] + Math.sin(angle) * r, TABLE_CENTER[1] + 0.004, TABLE_CENTER[2] + Math.cos(angle) * r]} rotation={[0, angle, 0]}>
              {types.map((type, i) => (
                <group key={i} position={[(i - (types.length - 1) / 2) * 0.02, 0, 0]} scale={0.4}>
                  <Piece type={type.toLowerCase()} white={false} tint={tints[colors[seat] ?? 'r']} />
                </group>
              ))}
            </group>
          );
        })}
      </group>
    );
  }
  return null;
}
