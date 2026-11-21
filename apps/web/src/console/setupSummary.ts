/*
 * Kurze Zeile zur Besetzung einer Partie für die Spielseite der Konsole (#617), rein und testbar.
 * Die Wörter kommen als Parameter, damit die Funktion ohne i18n auskommt.
 */

export interface SummaryWords {
  /** „Du gegen Computer ({level})“ */
  duel: (level: string) => string;
  /** „{n} Mensch“ / „{n} Menschen“ */
  humans: (n: number) => string;
  /** „{n} Computer ({levels})“ */
  bots: (n: number, levels: string) => string;
}

/** z. B. „Du gegen Computer (mittel)“, „2 Menschen, 1 Computer (schwer)“, „3 Menschen“. */
export function seatSummary(seats: readonly { kind: 'human' | 'bot'; level: string }[], levelName: (level: string) => string, words: SummaryWords): string {
  const humans = seats.filter((seat) => seat.kind === 'human').length;
  const bots = seats.filter((seat) => seat.kind === 'bot');
  const levels = [...new Set(bots.map((seat) => levelName(seat.level)))].join('/');
  if (humans === 1 && bots.length === 1) return words.duel(levels);
  const parts: string[] = [];
  if (humans > 0) parts.push(words.humans(humans));
  if (bots.length > 0) parts.push(words.bots(bots.length, levels));
  return parts.join(', ');
}
