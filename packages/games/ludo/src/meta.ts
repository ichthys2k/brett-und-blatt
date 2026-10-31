import type { GameInfo } from '@brett-und-blatt/engine';

/**
 * Steckbrief des Spiels. Die Plattform liest ihn für das Menü, ohne das ganze
 * Spiel zu laden – deshalb steht er in einer eigenen, kleinen Datei.
 */
export const meta: GameInfo = {
  id: 'ludo',
  name: 'Nicht ärgern!',
  description: 'Der beliebte Laufspiel-Klassiker: Figuren aus dem Häuschen bringen, den 40-Felder-Rundkurs meistern, gegnerische Steine rauskegeln und die eigenen Püppchen sicher ins Ziel retten.',
  emoji: '🎲',
  players: { min: 2, max: 4 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['open'],
  hiddenInformation: false,
  hints: true,
  ruleVersion: 2,
  howToPlay: [
    'Bringe alle vier Figuren deiner Farbe aus dem Wartehäuschen ins Ziel.',
    'Bei einer 6 musst du eine Figur auf das Startfeld setzen und darfst noch einmal würfeln.',
    'Hast du keinen Stein auf der Strecke, darfst du bis zu dreimal würfeln.',
    'Endet dein Zug auf einem gegnerischen Stein, wird dieser geschlagen und muss zurück ins Häuschen.',
    'Schlagen ist freiwillig. Mit der Option „Schlagpflicht“ musst du schlagen, wenn du kannst.',
    'Wer zuerst alle vier Figuren in den Zielfeldern hat, gewinnt die Partie.',
  ],
};
