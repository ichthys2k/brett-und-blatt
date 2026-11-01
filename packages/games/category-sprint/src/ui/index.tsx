/**
 * Oberfläche des Kategorien-Sprints: Schreibbogen, Fortschritt der anderen, Auflösung mit
 * Abstimmung und eine Tafelansicht für Zuschauer (Beamer im Klassenzimmer).
 */
import { initialLetter, type SeatId } from '@brett-und-blatt/engine';
import { WordInput, type BoardProps, type GameUi } from '@brett-und-blatt/ui';
import { useEffect, useState } from 'react';
import { currentLetter, type AnswerStatus, type RoundSummary, type SprintMove, type SprintState } from '../rules';
import './styles.css';

const COLORS = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#4d7c0f', '#9333ea', '#ea580c'];

function SeatSymbol({ seat, className }: { seat: SeatId; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="3" y="2" width="18" height="20" rx="3" fill={COLORS[seat % COLORS.length]} />
      <path d="M7 8h10M7 12h10M7 16h6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const STATUS_ICON: Record<AnswerStatus, string> = {
  empty: '–',
  wrongLetter: '✗',
  known: '✓',
  disputed: '?',
  unknown: '✗',
  accepted: '✓',
  rejected: '✗',
  trusted: '✓',
};

const STATUS_TEXT: Record<AnswerStatus, string> = {
  empty: 'leer',
  wrongLetter: 'falscher Anfangsbuchstabe',
  known: 'steht in der Liste',
  disputed: 'wird abgestimmt',
  unknown: 'nicht in der Liste',
  accepted: 'von der Runde angenommen',
  rejected: 'von der Runde abgelehnt',
  trusted: 'gilt',
};

function LetterTile({ letter, big = false }: { letter: string; big?: boolean }) {
  return (
    <div className={`ks-letter ${big ? 'ks-letter-big' : ''}`} aria-label={`Buchstabe ${letter}`}>
      {letter}
    </div>
  );
}

function Progress({ view, names }: { view: SprintState; names: string[] }) {
  const total = view.categoryIds.length;
  return (
    <ul className="ks-progress" aria-label="Fortschritt">
      {names.map((name, seat) => (
        <li key={seat} className={`ks-progress-item ${view.finished[seat] ? 'ks-done' : ''}`}>
          <SeatSymbol seat={seat} className="ks-progress-icon" />
          <span className="ks-progress-name">{name}</span>
          <span className="ks-progress-count">
            {view.finished[seat] ? '✓' : `${view.filled[seat]}/${total}`}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Sheet({ view, seat, legal, onMove }: { view: SprintState; seat: SeatId; legal: SprintMove[]; onMove: (move: SprintMove) => void }) {
  const letter = currentLetter(view);
  const sheet = view.answers[seat] ?? [];
  const canAct = legal.length > 0;
  const complete = (view.filled[seat] ?? 0) === view.categoryIds.length;
  const check = (text: string) => (initialLetter(text) === letter ? null : `Das Wort muss mit ${letter} anfangen.`);

  return (
    <div className="ks-sheet">
      {view.categoryNames.map((name, category) => (
        <label key={view.categoryIds[category]} className="ks-field">
          <span className="ks-field-name">
            {name}
            {sheet[category] ? <span className="ks-field-ok"> ✓</span> : null}
          </span>
          <WordInput
            label={`${name} mit ${letter}`}
            placeholder={`${letter} …`}
            initial={sheet[category] ?? ''}
            disabled={!canAct}
            clearOnSubmit={false}
            submitOnBlur
            hideButton
            check={check}
            onSubmit={(text) => text !== sheet[category] && onMove({ type: 'answer', category, text })}
          />
        </label>
      ))}
      <div className="ks-actions">
        {view.stopRule === 'first' && (
          <button type="button" className="ks-button ks-stop" disabled={!canAct || !complete} onClick={() => onMove({ type: 'finish' })}>
            ✋ Stopp!
          </button>
        )}
        <button
          type="button"
          className="ks-button"
          disabled={!canAct}
          onClick={() => onMove({ type: 'finish' })}
        >
          {view.stopRule === 'first' ? (complete ? 'Fertig' : 'Aufgeben und warten') : '📨 Abgeben'}
        </button>
      </div>
      {!canAct && view.phase === 'write' && <p className="ks-hint">Abgegeben – gleich geht es weiter.</p>}
      {view.stopRule === 'first' && canAct && <p className="ks-hint">Wer alle Felder gefüllt hat, kann „Stopp!“ rufen – dann endet die Runde für alle.</p>}
    </div>
  );
}

function Review({ view, viewer, names, legal, onMove }: { view: SprintState; viewer: SeatId | 'spectator'; names: string[]; legal: SprintMove[]; onMove: (move: SprintMove) => void }) {
  const [verdicts, setVerdicts] = useState<(number | null)[]>(() => view.disputed.map(() => null));
  useEffect(() => setVerdicts(view.disputed.map(() => null)), [view.round, view.disputed.length]);
  const canVote = legal.length > 0;
  const pending = view.vote ? view.vote.voters.filter((s) => view.vote!.ballots[s] === null).length : 0;
  const disputedIndex = (seat: number, category: number) => view.disputed.findIndex((d) => d.seat === seat && d.category === category);

  return (
    <div className="ks-review">
      <p className="ks-hint">
        {view.stoppedBy !== null ? `${names[view.stoppedBy] ?? ''} hat „Stopp!“ gerufen. ` : ''}
        {view.disputed.length > 0 ? 'Gelten diese Wörter? Stimmt über die Fragezeichen ab.' : 'Alle Antworten liegen offen.'}
      </p>
      {view.categoryNames.map((name, category) => (
        <section key={view.categoryIds[category]} className="ks-review-cat">
          <h3>{name}</h3>
          <ul>
            {names.map((player, seat) => {
              const text = view.answers[seat]?.[category] ?? '';
              const status = view.status[seat]?.[category] ?? 'empty';
              const item = disputedIndex(seat, category);
              return (
                <li key={seat} className={`ks-answer is-${status}`}>
                  <span className="ks-answer-who">{player}</span>
                  <span className="ks-answer-text">{text || '–'}</span>
                  <span className="ks-answer-status" title={STATUS_TEXT[status]}>
                    {STATUS_ICON[status]}
                    <span className="sr-only"> {STATUS_TEXT[status]}</span>
                  </span>
                  {item >= 0 && canVote && seat !== viewer && (
                    <span className="ks-vote" role="group" aria-label={`Gilt „${text}“?`}>
                      <button type="button" aria-pressed={verdicts[item] === 1} onClick={() => setVerdicts(verdicts.map((v, i) => (i === item ? (v === 1 ? null : 1) : v)))}>
                        👍
                      </button>
                      <button type="button" aria-pressed={verdicts[item] === 0} onClick={() => setVerdicts(verdicts.map((v, i) => (i === item ? (v === 0 ? null : 0) : v)))}>
                        👎
                      </button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {canVote ? (
        <button type="button" className="ks-button ks-primary" onClick={() => onMove({ type: 'review', verdicts })}>
          {view.disputed.length > 0 ? '🗳️ Abstimmen und weiter' : 'Weiter'}
        </button>
      ) : (
        viewer !== 'spectator' && <p className="ks-hint">Warte auf {pending} {pending === 1 ? 'Stimme' : 'Stimmen'} …</p>
      )}
    </div>
  );
}

function Summary({ summary, view, names }: { summary: RoundSummary; view: SprintState; names: string[] }) {
  const order = names.map((_, seat) => seat).sort((a, b) => (summary.points[b] ?? 0) - (summary.points[a] ?? 0));
  return (
    <details className="ks-summary" open={view.phase === 'done'}>
      <summary>
        Runde {summary.round} mit {summary.letter}: {order.slice(0, 3).map((s) => `${names[s]} +${summary.points[s]}`).join(' · ')}
      </summary>
      <div className="ks-table-wrap">
        <table className="ks-table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              {view.categoryNames.map((name) => (
                <th key={name} scope="col">
                  {name}
                </th>
              ))}
              <th scope="col">Punkte</th>
            </tr>
          </thead>
          <tbody>
            {order.map((seat) => (
              <tr key={seat}>
                <th scope="row">{names[seat]}</th>
                {summary.answers[seat]!.map((a, c) => (
                  <td key={c} className={`is-${a.status}`}>
                    {a.text || '–'} {a.points > 0 && <span className="ks-points">+{a.points}</span>}
                  </td>
                ))}
                <td>
                  <strong>{summary.points[seat]}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function Board({ view, viewer, legalMoves, onMove, seatNames }: BoardProps<SprintState, SprintMove>) {
  const names = seatNames.length === view.seats ? seatNames : Array.from({ length: view.seats }, (_, i) => `Platz ${i + 1}`);
  const letter = currentLetter(view);
  const isBoard = viewer === 'spectator';

  return (
    <div className={`ks-root ${isBoard ? 'ks-board' : ''}`}>
      <header className="ks-header">
        <LetterTile letter={letter} big={isBoard} />
        <div>
          <p className="ks-round">
            Runde {view.round + 1} von {view.totalRounds}
          </p>
          <p className="ks-title">
            {view.phase === 'write' ? `Alles mit ${letter}!` : view.phase === 'review' ? 'Auflösung' : 'Spielende'}
          </p>
        </div>
      </header>

      {view.phase === 'write' && (
        <>
          {typeof viewer === 'number' ? (
            <Sheet view={view} seat={viewer} legal={legalMoves} onMove={onMove} />
          ) : (
            <ul className="ks-board-cats">
              {view.categoryNames.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          )}
          <Progress view={view} names={names} />
        </>
      )}

      {view.phase === 'review' && <Review view={view} viewer={viewer} names={names} legal={legalMoves} onMove={onMove} />}

      {view.lastRound && <Summary summary={view.lastRound} view={view} names={names} />}
    </div>
  );
}

export const gameUi: GameUi<SprintState, SprintMove> = {
  Board,
  SeatSymbol,
  seatLabel: (seat) => `Bogen ${seat + 1}`,
  seatDetail: (view, seat) => (view.phase === 'write' ? (view.finished[seat] ? 'abgegeben' : `${view.filled[seat]}/${view.categoryIds.length}`) : null),
  seatScore: (view, seat) => view.scores[seat] ?? 0,
  sounds: {
    answered: 'wort-kurz',
    stop: 'ruf-fertig',
    roundStopped: 'ansage-glocke',
    voted: 'bingo-stempel',
    roundScored: 'punkte-sammeln',
    newLetter: 'los-pfiff',
  },
};
