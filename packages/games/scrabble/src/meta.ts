import type { GameInfo } from '@brett-und-blatt/engine';

export const meta: GameInfo = {
  id: 'scrabble',
  name: 'Wortgitter',
  description:
    'Kreuzworträtsel-Legespiel für 2–4 Spieler. Wörter anlegen, Multiplikatoren nutzen und geschickt aus dem Beutel ziehen.',
  emoji: '🔤',
  players: { min: 2, max: 4 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['hidden', 'simultaneous'],
  hiddenInformation: true,
  privateViews: true,
  ruleVersion: 3,
  hints: true,
  howToPlay: [
    'Tippe einen Stein auf deinem Bänkchen an und dann ein Feld – oder ziehe ihn hin. Ein gelegter Stein geht per Antippen zurück.',
    'Lege abwechselnd Wörter waagerecht oder senkrecht an die liegenden Steine an. Unbekannte Wörter werden den übrigen Mitspielern geheim zur Abstimmung vorgelegt.',
    'Du kannst deinen Zug schon während des gegnerischen Zuges vorbereiten. Er wird geprüft, sobald du dran bist. Mit „Bänkchen ordnen“ änderst du die Reihenfolge deiner Steine nur für dich.',
    'Der erste Zug muss das Mittelfeld H8 (Stern) überdecken und zählt als doppelter Wortwert.',
    'Buchstaben- und Wortprämien gelten nur beim ersten Belegen dieser Felder. Joker zählen 0 Punkte.',
    'Legst du alle 7 Steine auf einmal, gibt es 50 Punkte dazu. Statt zu legen darfst du Steine tauschen (wenn noch mindestens 7 im Beutel sind) oder passen.',
    'Schluss ist, wenn der Beutel leer ist und jemand alle Steine gelegt hat, oder nach sechs Zügen ohne Punkte. Reststeine werden abgezogen.',
  ],
};
