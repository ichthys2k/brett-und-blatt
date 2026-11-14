/** Zugtexte (#335, #358): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser und die VR-App. */
import type { WolvesSheepMove, WolvesSheepState } from './rules';

const seat = (s: number) => `Platz ${s + 1}`;

export function describeMove(_view: WolvesSheepState, move: WolvesSheepMove): string {
  switch (move.type) {
    case 'tap':
      return `${seat(move.target)} wählen`;
    case 'confirm':
      return move.target === undefined ? 'Wahl festlegen' : `${seat(move.target)} festlegen`;
    case 'done':
      return 'Weiter';
    case 'swap':
      return move.card === null ? 'Eigene Karte behalten' : `Karte ${move.card + 1} nehmen`;
    case 'bind':
      return `${seat(move.a)} und ${seat(move.b)} verbinden`;
    case 'peek':
      return 'Bei den Wölfen linsen';
    case 'shepherd':
      return `${move.save ? 'Hirtenruf' : 'Kein Hirtenruf'}${move.expel === null ? '' : `, ${seat(move.expel)} verbannen`}`;
    case 'elect':
      return move.target === null ? 'Niemanden wählen' : `${seat(move.target)} zum Leithammel wählen`;
    case 'endDebate':
      return 'Aussprache beenden';
    case 'vote':
      return move.target === null ? 'Enthalten' : `Für ${seat(move.target)} stimmen`;
    case 'shoot':
      return `${seat(move.target)} mitnehmen`;
    case 'passBell':
      return `Glocke an ${seat(move.target)}`;
    case 'leave':
      return 'Aufgeben';
  }
}
