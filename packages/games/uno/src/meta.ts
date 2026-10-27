import type { GameInfo } from '@brett-und-blatt/engine';

export const meta: GameInfo = {
  id: 'uno',
  name: 'Eins!',
  description: 'Das bunte Ablegespiel für Familie und Freunde: Passend zur Farbe oder Zahl ablegen, mit Aussetzen, Richtungswechsel und Strafkarten. Vor der letzten Karte heißt es: „Eins!“',
  emoji: '🃏',
  players: { min: 2, max: 10 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['hidden'],
  hiddenInformation: true,
  ruleVersion: 1,
  howToPlay: [
    'Lege reihum eine Karte ab, die in Farbe oder Zahl/Symbol zur obersten Karte passt.',
    'Aktionskarten zwingen zum Aussetzen, kehren die Spielrichtung um oder lassen den Nächsten Karten ziehen.',
    'Joker bestimmen eine neue Wunschfarbe.',
    'Hast du nur noch eine Karte auf der Hand, musst du „Eins!“ rufen, bevor der Nächste zieht – sonst drohen zwei Strafkarten!',
    'Wer zuerst alle Karten abgelegt hat, gewinnt die Runde.',
  ],
};
