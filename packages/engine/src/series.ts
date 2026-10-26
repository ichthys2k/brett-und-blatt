/**
 * Runden- und Serienverwaltung für Stichspiele (Skat, Schafkopf, Doppelkopf).
 */

export interface SeriesConfig {
  totalGames: number;
  totalPlayers: number;
  activePlayersPerGame: number; // 3 bei Skat, 4 bei Schafkopf/Doppelkopf
}

export interface SeriesPlayerScore {
  player: number;
  score: number;
  gamesWon: number;
  gamesLost: number;
}

/**
 * Ermittelt den nächsten Geber im Uhrzeigersinn.
 */
export function nextDealerIndex(currentDealer: number, totalPlayers: number): number {
  return (currentDealer + 1) % totalPlayers;
}

/**
 * Ermittelt die aktiven Spielerplätze bezogen auf den Geber.
 * - Bei Skat am 3er-Tisch: Vorhand = (dealer+1)%3, Mittelhand = (dealer+2)%3, Hinterhand = dealer.
 * - Bei Skat am 4er-Tisch (Geber setzt aus): Vorhand = (dealer+1)%4, Mittelhand = (dealer+2)%4, Hinterhand = (dealer+3)%4.
 * - Bei Doppelkopf am 5er-Tisch (Geber setzt aus): Die 4 Spieler nach dem Geber spielen.
 */
export function getActivePlayers(dealer: number, totalPlayers: number, activeCount: number): number[] {
  const active: number[] = [];
  for (let i = 1; i <= activeCount; i++) {
    active.push((dealer + i) % totalPlayers);
  }
  return active;
}

/**
 * Wandelt eine relative Position bezogen auf das Ausspiel (0 = Vorhand, 1 = Mittelhand usw.)
 * in den tatsächlichen Sitzplatz am Tisch um.
 */
export function handToSeat(handIndex: number, activePlayers: number[]): number {
  return activePlayers[handIndex % activePlayers.length];
}

/**
 * Wandelt einen Sitzplatz am Tisch in die relative Hand-Position um (-1 falls aussetzend).
 */
export function seatToHand(seat: number, activePlayers: number[]): number {
  return activePlayers.indexOf(seat);
}
