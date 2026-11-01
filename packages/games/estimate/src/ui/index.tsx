import { RoundFrame, type BoardProps, type GameUi } from '@brett-und-blatt/ui';
import { useEffect, useState } from 'react';
import type { EstimateMove, EstimateQuestion, EstimateState } from '../rules';
import './styles.css';

/** Zahlenleiste der Auflösung: alle Tipps und die richtige Zahl. Die Skala wächst, wenn Zahlen sehr verschieden groß sind. */
function Scale({ question, answers, me }: { question: EstimateQuestion; answers: (number | null)[]; me: number | null }) {
  const truth = question.answer!;
  const given = answers.filter((a): a is number => a !== null);
  const low = Math.min(truth, ...given);
  const high = Math.max(truth, ...given);
  const span = Math.max(1, high - low);
  const left = (value: number) => `${4 + ((value - low) / span) * 92}%`;
  return (
    <div className="est-scale" role="img" aria-label={`Richtig: ${truth}`}>
      <div className="est-line" />
      {answers.map((answer, seat) => (answer === null ? null : <span key={seat} className="est-tip" data-me={seat === me || undefined} style={{ left: left(answer) }} />))}
      <span className="est-truth" style={{ left: left(truth) }}>
        {truth}
      </span>
      <span className="est-end est-end-low">{low}</span>
      <span className="est-end est-end-high">{high}</span>
    </div>
  );
}

function Reveal({ question, answers, me, gained }: { question: EstimateQuestion; answers: (number | null)[]; me: number | null; gained?: number }) {
  const mine = me === null ? null : answers[me];
  return (
    <>
      <p className="est-solution">
        Richtig: <strong>{question.answer}</strong> {question.unit}
      </p>
      <Scale question={question} answers={answers} me={me} />
      {me !== null && <p className="est-mine">{mine === null || mine === undefined ? 'Du hast nichts abgegeben.' : `Dein Tipp: ${mine} · +${gained ?? 0} Punkte`}</p>}
    </>
  );
}

function Board({ view, legalMoves, onMove, viewer, seatNames, invite }: BoardProps<EstimateState, EstimateMove>) {
  const me = typeof viewer === 'number' ? viewer : null;
  const question = view.questions[view.round]!;
  const [text, setText] = useState('');
  useEffect(() => setText(''), [view.round]);
  const value = Number(text);
  const valid = text !== '' && Number.isInteger(value) && value >= question.min && value <= question.max;
  const canAnswer = view.phase === 'answer' && me !== null && !view.answered[me] && legalMoves.length > 0;
  const submit = () => valid && onMove({ type: 'answer', answer: value });
  return (
    <RoundFrame
      view={view}
      seatNames={seatNames}
      viewer={viewer}
      title="🎯 Schätzmeister"
      invite={invite}
      canNext={view.phase === 'reveal' && legalMoves.some((m) => m.type === 'next')}
      onNext={() => onMove({ type: 'next' })}
      wall={
        <>
          <p className="est-question">{question.text}</p>
          {view.phase !== 'answer' && <Reveal question={question} answers={view.answers} me={null} />}
        </>
      }
    >
      <p className="est-question">{question.text}</p>
      {view.phase === 'answer' && canAnswer && (
        <form
          className="est-form"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <input
            className="est-input"
            type="number"
            inputMode="numeric"
            aria-label="Deine Schätzung"
            min={question.min}
            max={question.max}
            step={1}
            value={text}
            placeholder={`${question.min} bis ${question.max}`}
            onChange={(event) => setText(event.target.value)}
          />
          {question.unit && <span>{question.unit}</span>}
          <button type="submit" className="est-send" disabled={!valid}>
            Abgeben
          </button>
        </form>
      )}
      {view.phase === 'answer' && !canAnswer && <p className="est-wait">Warte auf die anderen …</p>}
      {view.phase !== 'answer' && <Reveal question={question} answers={view.answers} me={me} gained={me === null ? undefined : view.gained[me]} />}
    </RoundFrame>
  );
}

export const gameUi: GameUi<EstimateState, EstimateMove> = {
  Board,
  SeatSymbol: ({ className = '' }) => <span className={className}>🎯</span>,
  seatLabel: (seat) => `Platz ${seat + 1}`,
  seatScore: (view, seat) => view.scores[seat] ?? 0,
  seatDetail: (view, seat) => (view.phase === 'answer' && view.answered[seat] ? 'fertig' : null),
  sounds: { answered: 'quiz-seite', revealed: 'quiz-aufloesung' },
};
