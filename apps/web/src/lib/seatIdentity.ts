import { parseCrest } from '@brett-und-blatt/engine';
import type { MemberInfo } from '@brett-und-blatt/online';
import { avatarUrl } from './avatarArt';
import map from './avatarMap.json';
import { botAvatar } from './botPortraits';

/**
 * Mindestens 30 gut unterscheidbare Emojis aus `avatarMap.json` (verschiedene Tiere, keine Doppelgänger).
 * Dient als festes Ausweichbild für Spieler ohne gewählten Avatar (#492).
 */
export const DEFAULT_AVATARS: readonly string[] = [
  '🐶', // hund
  '🐱', // katze
  '🐭', // maus
  '🐹', // hamster
  '🐰', // hase
  '🐮', // kuh
  '🐷', // schwein
  '🐎', // pferd
  '🐏', // widder
  '🐐', // ziege
  '🦙', // lama
  '🦌', // hirsch
  '🦊', // fuchs
  '🐻', // baer
  '🦡', // dachs
  '🦝', // waschbaer
  '🦨', // stinktier
  '🦦', // otter
  '🐿', // eichhoernchen
  '🦥', // faultier
  '🦁', // loewe
  '🐯', // tiger
  '🐆', // leopard
  '🦓', // zebra
  '🦍', // gorilla
  '🦧', // orangutan
  '🐵', // affe
  '🐘', // elefant
  '🦛', // nilpferd
  '🦏', // nashorn
  '🦒', // giraffe
  '🦘', // kaenguru
  '🐼', // panda
  '🐨', // koala
  '🐊', // krokodil
  '🐸', // frosch
  '🐢', // schildkroete
  '🦆', // ente
  '🦚', // pfau
  '🐙', // krake
  '🐬', // delphin
  '🦋', // schmetterling
];

/** Standard-Avatar für einen Platz nach Index (modulo Länge). */
export function defaultAvatar(index: number): string {
  const i = ((index % DEFAULT_AVATARS.length) + DEFAULT_AVATARS.length) % DEFAULT_AVATARS.length;
  return DEFAULT_AVATARS[i]!;
}

/** Acht kontrastreiche Farbkombinationen aus `crest-colors.ts` für das Standardschild (#492). */
export const DEFAULT_CREST_COLORS = [
  'rot-gold',
  'blau-silber',
  'gruen-gold',
  'schwarz-gold',
  'purpur-silber',
  'orange-blau',
  'land-se',
  'land-dk',
] as const;

/** Standardschild als Beschreibungstext nach Platz (modulo Länge). */
export function defaultCrest(index: number): string {
  const i = ((index % DEFAULT_CREST_COLORS.length) + DEFAULT_CREST_COLORS.length) % DEFAULT_CREST_COLORS.length;
  return `schild:klassisch;teilung:quer;farben:${DEFAULT_CREST_COLORS[i]};raum:1`;
}

/** Liefert das zugehörige Raum-Mitglied für einen Sitz oder `null`. */
export function seatMember(
  seat: { kind: string; memberId?: string | null },
  members: readonly MemberInfo[],
): MemberInfo | null {
  if (seat.kind !== 'human' || !seat.memberId) return null;
  return members.find((m) => m.id === seat.memberId) ?? null;
}

export interface SeatIdentity {
  avatar: string;
  crest: string;
}

/**
 * Ermittelt Avatar und Wappenschild für jeden Platz (#492).
 * Menschen ohne Avatar/Wappen erhalten feste Standardwerte je Platz; Bots ihr gemaltes Porträt und ein Standardschild.
 */
export function seatIdentity(input: {
  index: number;
  kind: 'human' | 'bot';
  gameId: string;
  seatAvatar?: string | null;      // aus der Sitzkonfiguration
  memberAvatar?: string | null;    // online: Avatar des Mitglieds
  memberCrest?: string | null;     // online: Wappen des Mitglieds
  own?: { avatar?: string | null; crest?: string | null } | null; // lokal: eigenes Profil, nur wenn es eindeutig zu diesem Platz gehört
}): SeatIdentity {
  if (input.kind === 'bot') {
    return {
      avatar: botAvatar(input.gameId),
      crest: defaultCrest(input.index),
    };
  }

  const candidateAvatar = input.seatAvatar ?? input.memberAvatar ?? input.own?.avatar ?? null;
  const avatar = candidateAvatar && avatarUrl(candidateAvatar) ? candidateAvatar : defaultAvatar(input.index);

  const candidateCrest = input.memberCrest ?? input.own?.crest ?? null;
  const crest = candidateCrest && parseCrest(candidateCrest) ? candidateCrest : defaultCrest(input.index);

  return { avatar, crest };
}
