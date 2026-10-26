import type { GameInfo } from '@brett-und-blatt/engine';

export const meta: GameInfo = {
  id: 'go',
  name: 'Go',
  description: 'Steine setzen, Gebiet umschließen, Gruppen fangen – das alte Strategiespiel aus Ostasien.',
  emoji: '⚪',
  players: { min: 2, max: 2 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['open'],
  hiddenInformation: false,
  ruleVersion: 1,
  hints: true,
  howToPlay: [
    'Schwarz beginnt. Abwechselnd setzt ihr einen Stein auf einen freien Schnittpunkt; Steine bewegen sich nie.',
    'Steine, die waagerecht oder senkrecht aneinanderliegen, bilden eine Gruppe. Ihre freien Nachbarpunkte heißen Freiheiten.',
    'Nimmst du einer gegnerischen Gruppe die letzte Freiheit, schlägst du sie und nimmst sie vom Brett. Eine eigene Gruppe ohne Freiheit darfst du nicht bilden.',
    'Ko: Keine Stellung darf sich wiederholen – einen eben geschlagenen Stein kannst du nicht sofort zurückschlagen.',
    'Passen beide nacheinander, wird ausgezählt: Ihr markiert tote Steine und bestätigt. Jeder bekommt einen Punkt für jeden eigenen Stein und jeden umschlossenen freien Punkt; Weiß erhält Komi als Ausgleich.',
    'Atari-Go für den Einstieg: Wer zuerst einen Stein schlägt, gewinnt.',
  ],
};
