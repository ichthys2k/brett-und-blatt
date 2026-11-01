import type { GameInfo, Options, OptionSpec, SeatId } from './types';

/*
 * Baustein Teams: Spiele mit `info.teams` bekommen die Teamzuordnung als verborgene Option
 * `teams` („0,1,0,1“ – Team je Platz in Tisch-Reihenfolge). Online füllt sie die Lobby beim
 * Start aus der Teamwahl der Plätze; lokal (und wenn die Angabe fehlt oder nicht passt) gilt
 * die Sitzordnung im Wechsel: Platz 1 Team 1, Platz 2 Team 2, Platz 3 Team 1 …
 */

export const TEAM_OPTION_ID = 'teams';

/** Die verborgene Option, die jedes Teamspiel in `options` aufnimmt. */
export function teamOption(): OptionSpec {
  return {
    id: TEAM_OPTION_ID,
    label: 'Teams',
    hidden: true,
    pattern: '[0-9](,[0-9])*',
    maxLength: 128,
    choices: [{ value: '', label: 'Im Wechsel' }],
    default: '',
  };
}

/** Teams im Wechsel nach Sitzordnung. */
export function alternatingTeams(seats: number, count = 2): number[] {
  return Array.from({ length: seats }, (_, seat) => seat % count);
}

/**
 * Teamzuordnung aus der Option. Fällt auf den Wechsel zurück, wenn die Angabe fehlt,
 * nicht zur Platzzahl passt oder ein Team weniger als `minPerTeam` Plätze hätte.
 */
export function teamsFromOptions(options: Options, seats: number, count = 2, minPerTeam = 1): number[] {
  const raw = options[TEAM_OPTION_ID];
  if (raw) {
    const parsed = raw.split(',').map(Number);
    const valid = parsed.length === seats && parsed.every((team) => Number.isInteger(team) && team >= 0 && team < count);
    if (valid && Array.from({ length: count }, (_, team) => parsed.filter((t) => t === team).length).every((n) => n >= minPerTeam)) return parsed;
  }
  return alternatingTeams(seats, count);
}

/** Die Plätze eines Teams in Tisch-Reihenfolge. */
export function teamMembers(teams: readonly number[], team: number): SeatId[] {
  return teams.flatMap((t, seat) => (t === team ? [seat] : []));
}

/** Name eines Teams aus dem Steckbrief, sonst „Team 1“ … */
export function teamName(info: Pick<GameInfo, 'teams'>, team: number): string {
  return info.teams?.names[team] ?? `Team ${team + 1}`;
}

/**
 * Verteilt die Plätze zufällig und gleichmäßig auf die Teams (Größen unterscheiden sich
 * höchstens um eins). `random` liefert Zahlen in [0, 1) – in der Lobby `Math.random`.
 */
export function shuffledTeams(seats: number, count: number, random: () => number): number[] {
  const order = Array.from({ length: seats }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const teams = Array.from({ length: seats }, () => 0);
  order.forEach((seat, position) => {
    teams[seat] = position % count;
  });
  return teams;
}
