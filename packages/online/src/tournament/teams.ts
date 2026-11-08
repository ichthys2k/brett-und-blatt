import type { GameInfo } from '@brett-und-blatt/engine';
import { seededShuffle } from './pairing';
import { ENTRANT_NAME_LENGTH, type TournamentPlayer, type TournamentSnapshot } from './types';

/**
 * Teams in Online-Turnieren (W-058 Stufe 3 Teil 4, #127): Spiele mit `GameInfo.teams` (zwei
 * Teams, z. B. „Verboten!“). Eingeschrieben wird einzeln; beim Start teilt das Turnier die
 * Eingeschriebenen nach dem Los auf Teams fester Größe auf. Ein Team ist danach ein
 * Teilnehmer wie jeder andere (K.-o., Schweizer System …), nur mit mehreren Kennungen:
 * `token` ist die des ersten Mitglieds, alle stehen in `members`. Ein Mitglied sagt für das
 * ganze Team „Bereit“; der Raum bekommt alle Kennungen und die Teamzuordnung als Option.
 */

export const TEAM_SIZE_CHOICES = [2, 3, 4, 5, 6] as const;

/** Spiel mit genau zwei festen Teams, ohne laufenden Einstieg und ohne Rollenspiel. */
export function isTeamGame(info: GameInfo): boolean {
  return info.teams?.count === 2 && !info.joinMidGame && !info.draft && (info.minHumans ?? 1) <= 2;
}

/** Ist die Teamgröße für dieses Spiel möglich (zwei Teams, passend zu den Plätzen)? */
export function validTeamSize(info: GameInfo, size: unknown): boolean {
  return TEAM_SIZE_CHOICES.includes(size as 2) && (size as number) * 2 >= info.players.min && (size as number) * 2 <= info.players.max;
}

export function isTeamed(s: Pick<TournamentSnapshot, 'settings'>): boolean {
  return (s.settings.teamSize ?? 0) >= 2;
}

/** Alle Kennungen eines Teilnehmers: bei einem Team die der Mitglieder, sonst die eigene. */
export function tokensOf(player: Pick<TournamentPlayer, 'token' | 'members'>): string[] {
  return player.members ? player.members.map((m) => m.token) : [player.token];
}

/** Hat dieses Gerät mit dem Teilnehmer zu tun (als Einzelner oder als Mitglied)? */
export function ownsToken(player: Pick<TournamentPlayer, 'token' | 'members'>, token: string): boolean {
  return player.token === token || (player.members?.some((m) => m.token === token) ?? false);
}

/**
 * Teilt die Eingeschriebenen auf Teams auf. Gibt die Teams zurück oder einen Text, warum es
 * nicht geht (die Zahl muss aufgehen). Die Reihenfolge im Team folgt dem Los.
 */
export function formTeams(s: TournamentSnapshot): TournamentPlayer[] | string {
  const size = s.settings.teamSize ?? 0;
  const singles = s.players.filter((p) => !p.withdrawn);
  if (singles.length % size !== 0) return `Die ${singles.length} Eingeschriebenen gehen nicht in Teams zu je ${size} auf.`;
  const order = seededShuffle(singles.map((p) => p.id), `${s.seed}/teams`).map((id) => singles.find((p) => p.id === id)!);
  const teams: TournamentPlayer[] = [];
  for (let at = 0; at < order.length; at += size) {
    const members = order.slice(at, at + size);
    const name = members.map((m) => m.name).join(' & ');
    teams.push({
      id: `t${teams.length + 1}`,
      token: members[0]!.token,
      name: name.length > ENTRANT_NAME_LENGTH ? `${name.slice(0, ENTRANT_NAME_LENGTH - 1)}…` : name,
      avatar: members[0]!.avatar,
      withdrawn: false,
      members: members.map((m) => ({ token: m.token, name: m.name, avatar: m.avatar })),
    });
  }
  return teams;
}
