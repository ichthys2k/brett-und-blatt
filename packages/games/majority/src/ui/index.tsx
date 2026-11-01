import { RoundFrame, type BoardProps, type GameUi } from '@brett-und-blatt/ui';
import type { MajorityMove, MajorityQuestion, MajorityState } from '../rules';
import './styles.css';

function Bars({ question, answers, me }: { question: MajorityQuestion; answers: (number | null)[]; me: number | null }) {
  const given = answers.filter((a) => a !== null).length;
  return (
    <ul className="maj-bars">
      {question.options.map((option, i) => {
        const count = answers.filter((a) => a === i).length;
        return (
          <li key={option} data-mine={(me !== null && answers[me] === i) || undefined}>
            <span className="maj-fill" style={{ width: `${given ? (count / given) * 100 : 0}%` }} />
            <span className="maj-label">{option}</span>
            <strong>{count}</strong>
          </li>
        );
      })}
    </ul>
  );
}

function Board({ view, legalMoves, onMove, viewer, seatNames, invite }: BoardProps<MajorityState, MajorityMove>) {
  const me = typeof viewer === 'number' ? viewer : null;
  const question = view.questions[view.round]!;
  const canAnswer = view.phase === 'answer' && me !== null && !view.answered[me] && legalMoves.length > 0;
  return (
    <RoundFrame
      view={view}
      seatNames={seatNames}
      viewer={viewer}
      title="🙋 Mehrheitsfrage"
      invite={invite}
      canNext={view.phase === 'reveal' && legalMoves.some((m) => m.type === 'next')}
      onNext={() => onMove({ type: 'next' })}
      wall={
        <>
          <p className="maj-question">{question.text}</p>
          {view.phase === 'answer' ? (
            <ul className="maj-list">
              {question.options.map((option) => (
                <li key={option}>{option}</li>
              ))}
            </ul>
          ) : (
            <Bars question={question} answers={view.answers} me={null} />
          )}
        </>
      }
    >
      <p className="maj-question">{question.text}</p>
      {view.phase === 'answer' && canAnswer && (
        <div className="maj-options" role="group" aria-label="Antworten">
          {question.options.map((option, i) => (
            <button key={option} type="button" className="maj-option" onClick={() => onMove({ type: 'answer', answer: i })}>
              {option}
            </button>
          ))}
        </div>
      )}
      {view.phase === 'answer' && !canAnswer && <p className="maj-wait">Warte auf die anderen …</p>}
      {view.phase !== 'answer' && (
        <>
          <Bars question={question} answers={view.answers} me={me} />
          {me !== null && <p className="maj-wait">+{view.gained[me] ?? 0} Punkte</p>}
        </>
      )}
    </RoundFrame>
  );
}

export const gameUi: GameUi<MajorityState, MajorityMove> = {
  Board,
  SeatSymbol: ({ className = '' }) => <span className={className}>🙋</span>,
  seatLabel: (seat) => `Platz ${seat + 1}`,
  seatScore: (view, seat) => view.scores[seat] ?? 0,
  seatDetail: (view, seat) => (view.phase === 'answer' && view.answered[seat] ? 'fertig' : null),
  sounds: { answered: 'quiz-seite', revealed: 'quiz-aufloesung' },
};
