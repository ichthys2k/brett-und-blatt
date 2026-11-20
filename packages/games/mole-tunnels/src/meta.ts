import type { GameInfo } from '@brett-und-blatt/engine';

/**
 * Steckbrief des Spiels. Die Plattform liest ihn für das Menü, ohne das ganze
 * Spiel zu laden – deshalb steht er in einer eigenen, kleinen Datei.
 */
export const meta: GameInfo = {
  id: 'mole-tunnels',
  name: 'Maulwurfsgänge',
  description: 'Hasen suchen Rüben in einem Tunnelsystem, das sich bei jedem Zug verschiebt – und Gärtner Maulwurf versperrt einen Gang.',
  emoji: '🕳️',
  players: { min: 2, max: 4 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['open'],
  hiddenInformation: false,
  hints: true,
  takeBack: true,
  ruleVersion: 1,
  // Bis zur Freigabe (M5) bleibt das Spiel ein Entwurf.
  draft: true,
  howToPlay: [
    'Jeder Hase startet in einer Ecke. Die Rüben liegen offen auf dem Brett; wer zuerst die Zielzahl geerntet hat, gewinnt.',
    'Dein Zug hat zwei Schritte: Erst drehst du das Freiteil und schiebst es an einer der Pfeilstellen ins Brett – die ganze Reihe rutscht mit allem, was darauf liegt.',
    'Dann läufst du mit deinem Hasen durch die verbundenen Gänge, so weit du willst, oder bleibst stehen. Eine Rübe erntest du, wenn dein Hase auf ihrem Feld ankommt.',
    'Den Schub deines Vorgängers darfst du nicht sofort zurückschieben. Eine geerntete Rübe wächst an anderer Stelle nach.',
    'Gärtner Maulwurf sitzt auf einem Gangteil: Dieses Feld darfst du nicht betreten oder durchqueren, bis es weitergeschoben ist.',
  ],
};
