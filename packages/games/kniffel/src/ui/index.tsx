import type { BoardProps, GameUi } from '@brett-und-blatt/ui';
import {
  ALL_CATEGORIES,
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

function Board({ view, legalMoves, onMove, viewer, seatNames }: BoardProps<KniffelState, KniffelMove>) {
  const seat = viewer === 'spectator' ? view.turn : viewer;
  const sheet = view.sheets[seat];
  const canRoll = legalMoves.some((m) => m.type === 'roll');
  const rollCount = legalMoves.filter((m) => m.type === 'roll').length > 0 ? 1 : 0;

  const handleDieClick = (index: number) => {
    if (view.phase === 'score') return;
    if (!view.dice) return;
    onMove({ type: 'toggleHold', index });
  };

  const handleScoreClick = (category: Category) => {
    if (viewer !== 'spectator' && viewer === view.turn) {
      const canScore = legalMoves.some((m) => m.type === 'score' && m.category === category);
      if (canScore && view.dice) {
        onMove({ type: 'score', category });
      }
    }
  };

  const getPotentialScore = (category: Category) => {
    if (!view.dice) return null;
    return calculateScore(category, view.dice.values);
  };

  return (
    <div className="kniffel">
      <div className="kniffel-header">
        <div>
          <strong>{nameOf(seatNames, view.turn)}</strong> ist am Zug
        </div>
        <div className="kniffel-phase">
          {view.finished
            ? 'Spiel beendet'
            : view.phase === 'roll'
              ? view.rollsLeft === 3
                ? 'Erstwurf'
                : `${view.rollsLeft} Wurf${view.rollsLeft === 1 ? '' : 'e'} übrig`
              : 'Kategorie wählen'}
        </div>
      </div>

      <div className="kniffel-dice-area">
        {view.dice ? (
          <div className="kniffel-dice">
            {view.dice.values.map((v, i) => (
              <button
                key={i}
                className={`kniffel-die ${view.dice!.held[i] ? 'kniffel-die-held' : ''}`}
                onClick={() => handleDieClick(i)}
                disabled={view.phase === 'score' || (viewer as any) !== view.turn || viewer === 'spectator'}
                title={view.dice!.held[i] ? 'Freigeben' : 'Beiseitelegen'}
              >
                {v}
              </button>
            ))}
          </div>
        ) : (
          <div className="kniffel-dice">Noch nicht gewürfelt</div>
        )}
        {canRoll && viewer === view.turn && !view.finished ? (
          <button className="kniffel-roll-btn" onClick={() => onMove({ type: 'roll' })}>
            {view.rollsLeft === 3 ? 'Würfeln' : `Nochmal würfeln (${view.rollsLeft})`}
          </button>
        ) : null}
        {view.phase === 'score' && viewer === view.turn && !view.finished ? (
          <div>Wähle eine Kategorie zum Eintragen</div>
        ) : null}
      </div>

      <div className="kniffel-score-grid">
        <div className="kniffel-section">
          <div className="kniffel-section-title">Obere Sektion</div>
          {UPPER_CATEGORIES.map((cat) => {
            const filled = typeof sheet.scores[cat] === 'number';
            const isMyTurn = viewer === view.turn && !view.finished;
            const canScore = legalMoves.some((m) => m.type === 'score' && m.category === cat);
            const potential = !filled && isMyTurn && canScore && view.dice ? getPotentialScore(cat) : null;
            return (
              <div
                key={cat}
                className={`kniffel-row ${!filled && isMyTurn && canScore ? 'kniffel-row-fillable' : ''} ${!filled && !canScore && isMyTurn ? 'kniffel-row-disabled' : ''}`}
                onClick={() => handleScoreClick(cat)}
              >
                <div className="kniffel-row-label">{CATEGORY_LABELS[cat]}</div>
                <div className="kniffel-row-value">{filled ? sheet.scores[cat] : potential !== null ? (potential as any) : ''}</div>
                <div className="kniffel-row-score">{filled ? sheet.scores[cat] : potential !== null ? (potential as any) : ''}</div>
              </div>
            );
          })}
          <div className="kniffel-total">
            <span>Zwischensumme</span>
            <span>{sheet.upperSum}</span>
          </div>
          <div className="kniffel-total">
            <span>Bonus (≥63)</span>
            <span>{sheet.upperBonus}</span>
          </div>
        </div>

        <div className="kniffel-section">
          <div className="kniffel-section-title">Untere Sektion</div>
          {LOWER_CATEGORIES.map((cat) => {
            const filled = typeof sheet.scores[cat] === 'number';
            const isMyTurn = viewer === view.turn && !view.finished;
            const canScore = legalMoves.some((m) => m.type === 'score' && m.category === cat);
            const potential = !filled && isMyTurn && canScore && view.dice ? getPotentialScore(cat) : null;
            return (
              <div
                key={cat}
                className={`kniffel-row ${!filled && isMyTurn && canScore ? 'kniffel-row-fillable' : ''} ${!filled && !canScore && isMyTurn ? 'kniffel-row-disabled' : ''}`}
                onClick={() => handleScoreClick(cat)}
              >
                <div className="kniffel-row-label">{CATEGORY_LABELS[cat]}</div>
                <div className="kniffel-row-value">{filled ? sheet.scores[cat] : ''}</div>
                <div className="kniffel-row-score">{filled ? sheet.scores[cat] : potential !== null ? potential : ''}</div>
              </div>
            );
          })}
          <div className="kniffel-total">
            <span>Obere Summe inkl. Bonus</span>
            <span>{sheet.upperSum + sheet.upperBonus}</span>
          </div>
          <div className="kniffel-total">
            <span>Untere Summe</span>
            <span>{sheet.lowerSum}</span>
          </div>
          <div className="kniffel-total">
            <span>Gesamt</span>
            <span>{sheet.total}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export const gameUi: GameUi<KniffelState, KniffelMove> = {
  Board,
  SeatSymbol: () => <span>🎲</span>,
  seatLabel: (seat) => `Spieler ${seat + 1}`,
};
