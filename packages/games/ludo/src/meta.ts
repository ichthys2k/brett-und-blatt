import type { GameInfo } from '@brett-und-blatt/engine';

/**
 * Steckbrief des Spiels. Die Plattform liest ihn für das Menü, ohne das ganze
 * Spiel zu laden – deshalb steht er in einer eigenen, kleinen Datei.
 */
export const meta: GameInfo = {
  id: 'ludo',
  name: 'Nicht ärgern!',
  description: 'Der beliebte Laufspiel-Klassiker: Figuren aus dem Häuschen bringen, den Rundkurs meistern (zu sechst auf dem Sternbrett), gegnerische Steine rauskegeln und die eigenen Püppchen sicher ins Ziel retten.',
  emoji: '🎲',
  players: { min: 2, max: 6 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['open'],
  hiddenInformation: false,
  hints: true,
  ruleVersion: 3,
  howToPlay: [
    'Bringe alle vier Figuren deiner Farbe aus dem Wartehäuschen ins Ziel.',
    'Bei einer 6 musst du eine Figur auf das Startfeld setzen und darfst noch einmal würfeln.',
    'Hast du keinen Stein auf der Strecke, darfst du bis zu dreimal würfeln.',
    'Endet dein Zug auf einem gegnerischen Stein, wird dieser geschlagen und muss zurück ins Häuschen.',
    'Schlagen ist freiwillig. Mit der Option „Schlagpflicht“ musst du schlagen, wenn du kannst.',
    'Zu fünft oder sechst spielt ihr auf dem Sternbrett mit sechs Armen und 54 Feldern; auf Wunsch geht das auch mit weniger Spielern.',
    'Wer zuerst alle vier Figuren in den Zielfeldern hat, gewinnt die Partie.',
  ],
};
