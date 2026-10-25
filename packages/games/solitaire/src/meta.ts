import type { GameInfo } from '@brett-und-blatt/engine';

export const meta: GameInfo = {
  id: 'solitaire',
  name: 'Solitaire',
  description: 'Klondike, FreeCell, Spider und Pyramide – Patiencen für eine Person, mit Tipps.',
  emoji: '🂡',
  players: { min: 1, max: 1 },
  modes: ['solo'],
  patterns: ['hidden'],
  hiddenInformation: true,
  privateViews: false,
  ruleVersion: 1,
  howToPlay: [
    'Klondike: Lege alle Karten nach Farbe vom Ass bis zum König auf die vier Ablagen oben. Auf den Stapeln wird absteigend mit wechselnden Farben angelegt (rot auf schwarz), leere Stapel nehmen nur Könige. Tippe auf den Talon, um Karten zu ziehen.',
    'FreeCell: Alle Karten liegen offen. Die vier freien Zellen nehmen je eine Karte auf. Angelegt wird wie bei Klondike, leere Spalten nehmen jede Karte.',
    'Spider: Lege absteigend an, egal in welcher Farbe – verschieben lassen sich aber nur Folgen in einer Farbe. Eine vollständige Folge vom König bis zum Ass wird abgelegt. Der Talon gibt jedem Stapel eine neue Karte.',
    'Pyramide: Entferne zwei freie Karten, die zusammen 13 ergeben (Bube 11, Dame 12), Könige allein. Frei ist eine Karte, auf der keine andere mehr liegt.',
    'Bedienung: Antippen schiebt eine Karte an den naheliegendsten Platz. Gibt es mehrere, leuchten die Ziele auf. „Tipp“ zeigt einen sinnvollen Zug.',
  ],
  hints: true,
};
