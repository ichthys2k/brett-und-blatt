import type { GameInfo } from '@brett-und-blatt/engine';

export const meta: GameInfo = {
  id: 'four-in-a-row',
  name: 'Vier in einer Reihe',
  description: 'Steine fallen nach unten – wer zuerst vier in einer Reihe hat, gewinnt.',
  emoji: '🔴',
  players: { min: 2, max: 2 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['open'],
  hiddenInformation: false,
  ruleVersion: 1,
  howToPlay: [
    'Werft abwechselnd einen Stein in eine Spalte. Er fällt auf den untersten freien Platz.',
    'Wer zuerst vier eigene Steine in einer Reihe hat – waagerecht, senkrecht oder diagonal –, gewinnt.',
    'Ist das Brett voll, endet die Partie unentschieden.',
    'PopOut (Option): Statt einzuwerfen darfst du einen eigenen Stein ganz unten herausziehen; die Steine darüber rutschen nach.',
  ],
};
