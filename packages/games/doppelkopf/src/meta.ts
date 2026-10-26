import type { GameInfo } from '@brett-und-blatt/engine';

export const meta: GameInfo = {
  id: 'doppelkopf',
  name: 'Doppelkopf',
  description:
    'Der strategische Kartenspiel-Klassiker nach den Turnierspielregeln (TSR) des DDV: 48 Karten, geheime Teams mit den Kreuz-Damen, Hochzeit, Solospiele und Sonderpunkte wie Fuchs und Karlchen.',
  emoji: '🎴',
  players: { min: 4, max: 5 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['hidden'],
  hiddenInformation: true,
  ruleVersion: 1,
  howToPlay: [
    'Doppelkopf wird zu viert mit 48 Karten gespielt (9 bis Ass doppelt). Jeder Spieler erhält 12 Karten (am 5er-Tisch setzt der Geber jeweils aus).',
    'Teams: Wer eine Kreuz-Dame hat, spielt im Team „Re“, die beiden anderen spielen „Kontra“. Die Teams sind zu Beginn geheim und klären sich erst im Verlauf der Partie.',
    'Trümpfe im Normalspiel (von hoch nach tief): Herz-10 („Dulle“), Damen (Kreuz > Pik > Herz > Karo), Buben (Kreuz > Pik > Herz > Karo), dann Karo (Ass, 10, König, 9). Bei zwei identischen Karten sticht stets die zuerst gespielte!',
    'Vorbehalte: Vor Beginn kann jeder Spieler einen Vorbehalt anmelden: Hochzeit (beide Kreuz-Damen suchen Partner in den ersten 3 Stichen) oder Solospiele (Damen-, Buben-, Farbsoli oder Fleischlos). Soli haben Vorrang.',
    'Ansagen: Zu Beginn darf man „Re“ oder „Kontra“ ansagen (solange man noch mindestens 11 Karten hält). Danach folgen Absagen wie „keine 90“ usw.',
    'Gewinn: Re gewinnt ab 121 Augen (Kontra ab 120 von 240 Augen). Zusatzpunkte gibt es für Ansagen, gefangene Füchse (Karo-Ass), Doppelkopf-Stiche (≥ 40 Augen) und Karlchen Müller (Kreuz-Bube im letzten Stich).',
  ],
};
