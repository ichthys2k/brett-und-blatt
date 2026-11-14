/**
 * Geschlagene Figuren am Tischrand (#390): bei Schach und Dame stehen die geschlagenen Figuren
 * auf der Seite dessen, der sie geschlagen hat. Rein darstellend, nur aus der Sicht abgeleitet.
 */
import type { GameMessage } from '@brett-und-blatt/online';
import { TABLE_CENTER } from './Tavern';
import { Piece } from './boards';
import { chessCaptured, checkersCaptured } from './captured';

export const CAPTURED_GAMES = ['chess', 'checkers'] as const;

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
  return null;
}
