import type { BoardProps, GameUi } from '@brett-und-blatt/ui';
import {
  CATEGORY_LABELS,
  LOWER_CATEGORIES,
  UPPER_CATEGORIES,
  calculateScore,
  type Category,
  type KniffelMove,
  type KniffelState,
} from '../rules';
import './styles.css';

const nameOf = (names: string[], seat: number) => names[seat] ?? `Platz ${seat + 1}`;

/** Augen eines Würfels als Punkte (Positionen im 3×3-Raster). */
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function Die({ value }: { value: number }) {
  return (
    <span className="kniffel-pips" aria-hidden="true">
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={PIPS[value]?.includes(i) ? 'kniffel-pip' : ''} />
      ))}
    </span>
  );
}

function Board({ view, legalMoves, onMove, viewer, seatNames }: BoardProps<KniffelState, KniffelMove>) {
  const myTurn = viewer !== 'spectator' && viewer === view.turn && !view.finished;
  const canRoll = myTurn && legalMoves.some((m) => m.type === 'roll');
  const canHold = myTurn && view.phase === 'roll' && view.rollsLeft > 0 && view.dice !== null;
  const scorable = new Set(myTurn ? legalMoves.flatMap((m) => (m.type === 'score' ? [m.category] : [])) : []);
  const seats = view.sheets.map((_, seat) => seat);

  const cell = (seat: number, category: Category) => {
    const filled = view.sheets[seat]!.scores[category];
    if (typeof filled === 'number') return <span>{filled}</span>;
    if (seat === view.turn && scorable.has(category) && view.dice) {
      const potential = calculateScore(category, view.dice.values);
      return (
        <button type="button" className="kniffel-fill" data-zero={potential === 0 ? 'true' : undefined} onClick={() => onMove({ type: 'score', category })} aria-label={`${CATEGORY_LABELS[category]} mit ${potential} Punkten eintragen`}>
          {potential}
        </button>
      );
    }
    return null;
  };

  const row = (category: Category) => (
    <tr key={category}>
      <th scope="row">{CATEGORY_LABELS[category]}</th>
      {seats.map((seat) => (
        <td key={seat} data-turn={seat === view.turn ? 'true' : undefined}>
          {cell(seat, category)}
        </td>
      ))}
    </tr>
  );

  const sumRow = (label: string, pick: (seat: number) => number, strong = false) => (
    <tr className={strong ? 'kniffel-total' : 'kniffel-sum'}>
      <th scope="row">{label}</th>
      {seats.map((seat) => (
        <td key={seat} data-turn={seat === view.turn ? 'true' : undefined}>
          {pick(seat)}
        </td>
      ))}
    </tr>
  );

  const status = view.finished
    ? 'Spiel beendet'
    : !view.dice
      ? `${nameOf(seatNames, view.turn)} würfelt`
      : view.rollsLeft > 0
        ? `${view.rollsLeft} ${view.rollsLeft === 1 ? 'Wurf' : 'Würfe'} übrig – Würfel antippen zum Halten`
        : 'Kategorie wählen';

  return (
    <div className="kniffel">
      <div className="kniffel-dice-area">
        <div className="kniffel-status">{status}</div>
        <div className="kniffel-dice">
          {(view.dice?.values ?? [1, 2, 3, 4, 5]).map((value, i) => (
            <button
              key={i}
              type="button"
              className="kniffel-die"
              data-held={view.dice?.held[i] ? 'true' : undefined}
              data-empty={view.dice ? undefined : 'true'}
              onClick={() => canHold && onMove({ type: 'toggleHold', index: i })}
              disabled={!canHold}
              aria-pressed={view.dice?.held[i] ?? false}
              aria-label={view.dice ? `Würfel ${i + 1}: ${value}${view.dice.held[i] ? ', gehalten' : ''}` : `Würfel ${i + 1}`}
            >
              {view.dice ? <Die value={value} /> : null}
            </button>
          ))}
        </div>
        {canRoll ? (
          <button type="button" className="kniffel-roll" onClick={() => onMove({ type: 'roll' })}>
            {view.rollsLeft === 3 ? 'Würfeln' : `Nochmal würfeln (${view.rollsLeft})`}
          </button>
        ) : null}
      </div>

      <div className="kniffel-sheet-wrap">
        <table className="kniffel-sheet">
          <thead>
            <tr>
              <th scope="col" />
              {seats.map((seat) => (
                <th key={seat} scope="col" data-turn={seat === view.turn ? 'true' : undefined}>
                  {nameOf(seatNames, seat)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {UPPER_CATEGORIES.map(row)}
            {sumRow('Summe oben', (s) => view.sheets[s]!.upperSum)}
            {sumRow('Bonus (ab 63)', (s) => view.sheets[s]!.upperBonus)}
            {LOWER_CATEGORIES.map(row)}
            {sumRow('Gesamt', (s) => view.sheets[s]!.total, true)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const gameUi: GameUi<KniffelState, KniffelMove> = {
  Board,
  SeatSymbol: ({ className = '' }) => <span className={className}>🎲</span>,
  seatLabel: (seat) => `Spieler ${seat + 1}`,
  sounds: { rolled: 'wuerfeln', scored: 'stein-setzen' },
};
