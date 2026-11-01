import { RoundFrame, type BoardProps, type GameUi } from '@brett-und-blatt/ui';
import { useEffect, useState } from 'react';
import type { TimelineMove, TimelineQuestion, TimelineState } from '../rules';
import './styles.css';

function Solution({ question, mine }: { question: TimelineQuestion; mine: number[] | null }) {
  return (
    <ol className="tl-list">
      {question.order!.map((item, place) => (
        <li key={item} className="tl-row" data-state={mine === null ? undefined : mine[place] === item ? 'right' : 'wrong'}>
          <span className="tl-name">{question.items[item]}</span>
          {question.years![item] && <span className="tl-year">{question.years![item]}</span>}
          {mine !== null && <span aria-label={mine[place] === item ? 'richtig' : 'falsch'}>{mine[place] === item ? '✓' : '✗'}</span>}
        </li>
      ))}
    </ol>
  );
}

function Board({ view, legalMoves, onMove, viewer, seatNames, invite }: BoardProps<TimelineState, TimelineMove>) {
  const me = typeof viewer === 'number' ? viewer : null;
  const question = view.questions[view.round]!;
  const [order, setOrder] = useState<number[]>(() => question.items.map((_, i) => i));
  useEffect(() => setOrder(question.items.map((_, i) => i)), [view.round, question.id]);
  const canAnswer = view.phase === 'answer' && me !== null && !view.answered[me] && legalMoves.length > 0;
  const swap = (place: number, to: number) => {
    const next = [...order];
    [next[place], next[to]] = [next[to]!, next[place]!];
    setOrder(next);
  };
  return (
    <RoundFrame
      view={view}
      seatNames={seatNames}
      viewer={viewer}
      title="⏳ Zeitstrahl"
      invite={invite}
      canNext={view.phase === 'reveal' && legalMoves.some((m) => m.type === 'next')}
      onNext={() => onMove({ type: 'next' })}
      wall={
        <>
          <p className="tl-title">{question.title}</p>
          {view.phase === 'answer' ? (
            <ul className="tl-list">
              {question.items.map((item) => (
                <li key={item} className="tl-row">
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <Solution question={question} mine={null} />
          )}
        </>
      }
    >
      <p className="tl-title">{question.title}</p>
      {canAnswer && (
        <>
          <p className="tl-hint">Das Früheste nach oben</p>
          <ol className="tl-list">
            {order.map((item, place) => (
              <li key={item} className="tl-row">
                <span className="tl-name">{question.items[item]}</span>
                <button type="button" className="tl-arrow" aria-label={`${question.items[item]} nach oben`} disabled={place === 0} onClick={() => swap(place, place - 1)}>
                  ▲
                </button>
                <button type="button" className="tl-arrow" aria-label={`${question.items[item]} nach unten`} disabled={place === order.length - 1} onClick={() => swap(place, place + 1)}>
                  ▼
                </button>
              </li>
            ))}
          </ol>
          <button type="button" className="tl-send" onClick={() => onMove({ type: 'answer', answer: order })}>
            Abgeben
          </button>
        </>
      )}
      {view.phase === 'answer' && !canAnswer && <p className="tl-hint">Warte auf die anderen …</p>}
      {view.phase !== 'answer' && (
        <>
          <Solution question={question} mine={me === null ? null : (view.answers[me] ?? null)} />
          {me !== null && <p className="tl-hint">+{view.gained[me] ?? 0} Punkte</p>}
        </>
      )}
    </RoundFrame>
  );
}

export const gameUi: GameUi<TimelineState, TimelineMove> = {
  Board,
  SeatSymbol: ({ className = '' }) => <span className={className}>⏳</span>,
  seatLabel: (seat) => `Platz ${seat + 1}`,
  seatScore: (view, seat) => view.scores[seat] ?? 0,
  seatDetail: (view, seat) => (view.phase === 'answer' && view.answered[seat] ? 'fertig' : null),
  sounds: { answered: 'quiz-seite', revealed: 'quiz-aufloesung' },
};
