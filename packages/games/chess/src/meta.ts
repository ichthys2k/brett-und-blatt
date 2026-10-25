import type { GameInfo } from '@brett-und-blatt/engine';

export const meta: GameInfo = {
  id: 'chess',
  name: 'Schach',
  description: 'Das klassische Schach für zwei – gegen den Computer in drei Stärken oder zu zweit.',
  emoji: '♞',
  players: { min: 2, max: 2 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['open'],
  hiddenInformation: false,
  ruleVersion: 1,
  hints: true,
  howToPlay: [
    'Weiß beginnt. Jede Figur zieht auf ihre Weise: König ein Feld, Dame beliebig weit in alle Richtungen, Turm gerade, Läufer schräg, Springer im L-Sprung, Bauern ein Feld vorwärts (vom Start auch zwei) und schlagen schräg.',
    'Ziel ist das Schachmatt: Der gegnerische König wird angegriffen und kann dem Angriff nicht mehr entkommen.',
    'Sonderzüge: Rochade (König und Turm tauschen die Seite), en passant (ein Bauer schlägt einen Bauern, der gerade zwei Felder an ihm vorbeigezogen ist) und Umwandlung (ein Bauer auf der letzten Reihe wird zu Dame, Turm, Läufer oder Springer).',
    'Unentschieden: Patt (kein erlaubter Zug, aber nicht im Schach), dreimal dieselbe Stellung, 50 Züge ohne Schlagen und Bauernzug, oder zu wenig Material für ein Matt.',
    'Bedienung: Figur antippen, dann das leuchtende Zielfeld. „Tipp“ schlägt einen Zug vor.',
  ],
};
