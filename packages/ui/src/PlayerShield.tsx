import { DEFAULT_CREST, parseCrest, type ClockReading } from '@brett-und-blatt/engine';
import type { ReactNode } from 'react';
import { avatarImageOf } from './avatarRenderer';
import { CREST_ORNAMENT_MIN_SIZE, PlayerCrest } from './crest/PlayerCrest';
import { clockTone } from './clockTone';

/** Das Medaillon hat höchstens diesen Durchmesser (px): Bilder werden nie größer als ihre Datei (192 px bei Avataren). */
export const SHIELD_MAX_PORTRAIT = 192;
/** Größter Medaillon-Durchmesser in Schildbreiten (Radius 34 von 100). */
const MEDALLION_PER_WIDTH = 0.68;

export interface PlayerShieldProps {
  /** Avatar-Kennung des Spielers (Emoji oder `bot:<kennung>`). */
  avatar: string;
  /** Wappen als Beschreibung (wie `MemberInfo.crest`); ungültig oder leer → Standardschild. */
  crest?: string;
  /** Breite in px. */
  size: number;
  clock?: ClockReading | null;
  /** Platzzeichen des Spiels; sitzt als kleine Plakette unten rechts am Schild. */
  symbol?: ReactNode;
  label?: string;
}

/** Breite, bei der das Medaillon höchstens `SHIELD_MAX_PORTRAIT` px misst. */
export function shieldWidth(size: number): number {
  return Math.min(size, Math.floor(SHIELD_MAX_PORTRAIT / MEDALLION_PER_WIDTH));
}

/** Ein Spieler als Porträt im Wappenschild mit Uhr-Ring und Platzzeichen (#491). */
export function PlayerShield({ avatar, crest, size, clock = null, symbol, label }: PlayerShieldProps) {
  const spec = parseCrest(crest) ?? DEFAULT_CREST;
  const width = shieldWidth(size);
  const image = avatarImageOf(avatar);
  const emoji = avatar.startsWith('bot:') ? '🤖' : avatar || spec.animal;
  const ring = clock && clock.kind !== 'none' ? { fraction: clock.fraction, tone: clockTone(clock) } : undefined;
  const badge = Math.max(18, Math.round(width * 0.3));
  const height = width < CREST_ORNAMENT_MIN_SIZE ? (width * 106) / 80 : width * 1.5;
  return (
    <span className="bub-shield" style={{ width, height }}>
      <PlayerCrest spec={spec} size={width} label={label} portrait={image ?? ''} portraitEmoji={emoji} ring={ring} />
      {symbol ? (
        <span className="bub-shield-badge" style={{ width: badge, height: badge }}>
          {symbol}
        </span>
      ) : null}
    </span>
  );
}
