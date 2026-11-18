import { useEffect, useRef, type CSSProperties } from 'react';
import { battleSpriteMarkup } from './zeitfiguren';

/**
 * Kampfszene der Pixelschlacht (Jahrgang 1988 der Zeitmaschine, #512): Schlägt eine Figur, treten Angreifer und
 * Opfer in einer Seitenansicht gegeneinander an. Jede Figurenart greift anders an; das Opfer blitzt auf, fällt
 * und zerfällt in Pixel. Etwa 2,6 Sekunden, ein Tipp oder eine Taste überspringt die Szene.
 * Eigene Gestaltung mit den Pixelfiguren des Spiels.
 */
type PieceType = 'k' | 'q' | 'r' | 'b' | 'n' | 'p';

export interface Battle {
  key: number;
  attacker: PieceType;
  attackerWhite: boolean;
  victim: PieceType;
}

export const BATTLE_MS = 2600;

const NAMES: Record<PieceType, string> = { k: 'König', q: 'Dame', r: 'Turm', b: 'Läufer', n: 'Springer', p: 'Bauer' };

/** Lautmalerei je Angriff. */
const BANG: Record<PieceType, string> = {
  p: 'PIEKS!',
  n: 'HUFSCHLAG!',
  b: 'ZAPP!',
  r: 'RUMMS!',
  q: 'WUSCH!',
  k: 'ZACK!',
};

function Sprite({ type, white, flip }: { type: PieceType; white: boolean; flip: boolean }) {
  return (
    <svg
      className={`ch-battle-sprite ${flip ? 'ch-battle-flip' : ''}`}
      viewBox="0 0 100 100"
      aria-hidden="true"
      // Eigene, feste Pixelzeichnung aus dem Repo.
      dangerouslySetInnerHTML={{ __html: battleSpriteMarkup(type, white) }}
    />
  );
}

export function BattleScene({ battle, onDone }: { battle: Battle; onDone: () => void }) {
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const id = window.setTimeout(() => done.current(), BATTLE_MS);
    const skip = () => done.current();
    window.addEventListener('keydown', skip);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('keydown', skip);
    };
  }, [battle.key]);

  const { attacker, attackerWhite, victim } = battle;
  // Der Springer schaut in der Zeichnung nach links: links stehend wird er gespiegelt.
  const label = `Kampf: ${attackerWhite ? 'weißer' : 'schwarzer'} ${NAMES[attacker]} schlägt ${attackerWhite ? 'schwarzen' : 'weißen'} ${NAMES[victim]}`;
  return (
    <div className={`ch-battle ch-battle-by-${attacker}`} role="img" aria-label={label} onPointerDown={() => done.current()}>
      <div className="ch-battle-stage">
        <span className="ch-battle-banner">{attackerWhite ? 'Weiß' : 'Schwarz'} greift an</span>
        <div className="ch-battle-fighter ch-battle-atk">
          <Sprite type={attacker} white={attackerWhite} flip={attacker === 'n'} />
        </div>
        <div className="ch-battle-fighter ch-battle-def">
          <Sprite type={victim} white={!attackerWhite} flip={false} />
        </div>
        <span className="ch-battle-shot" />
        <span className="ch-battle-slash" />
        <span className="ch-battle-bang">{BANG[attacker]}</span>
        <span className="ch-battle-dust" aria-hidden="true">
          {Array.from({ length: 10 }, (_, i) => (
            <i key={i} style={{ '--i': i } as CSSProperties} />
          ))}
        </span>
      </div>
    </div>
  );
}
