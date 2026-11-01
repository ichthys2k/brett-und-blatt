/**
 * Oberfläche von „Wer bin ich?“: Begriffe der anderen (der eigene bleibt verdeckt), Fragen,
 * Raten und im freien Modus die Ja-Nein-Vielleicht-Knöpfe der Mitspieler.
 */
import type { SeatId } from '@brett-und-blatt/engine';
import { WordInput, type BoardProps, type GameUi } from '@brett-und-blatt/ui';
import { questionOf, termOf } from '../catalog';
import { MAX_ASKS_PER_TURN, MAYBE, NO, YES, packOf, type Answer, type HistoryEntry, type WhoMove, type WhoState } from '../rules';
import './styles.css';

const COLORS = ['#7c3aed', '#db2777', '#2563eb', '#16a34a', '#d97706', '#0891b2', '#dc2626', '#4d7c0f', '#9333ea', '#ea580c'];

function SeatSymbol({ seat, className }: { seat: SeatId; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill={COLORS[seat % COLORS.length]} />
      <text x="12" y="16.5" textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff">
        ?
      </text>
    </svg>
  );
}

const ANSWER_LABEL: Record<Answer, string> = { 0: '✅ Ja', 1: '❌ Nein', 2: '🤷 Vielleicht' };

function questionText(view: WhoState, id: string | null): string {
  if (id === null) return 'laut gefragt';
  return questionOf(packOf(view), id)?.text ?? id;
}

function History({ view, entries, title }: { view: WhoState; entries: HistoryEntry[]; title: string }) {
  const pack = packOf(view);
  return (
    <section className="wbi-history">
      <h3>{title}</h3>
      {entries.length === 0 ? (
        <p className="wbi-muted">Noch keine Fragen.</p>
      ) : (
        <ol>
          {entries.map((entry, i) => (
            <li key={i}>
              {entry.kind === 'ask' && (
                <>
                  <span>{questionText(view, entry.question)}</span>
                  <strong className={`wbi-answer is-${entry.answer}`}>{ANSWER_LABEL[entry.answer]}</strong>
                </>
              )}
              {entry.kind === 'guess' && (
                <span>
                  {entry.correct ? '🎉 Richtig geraten: ' : '🙈 Falsch geraten'}
                  {entry.term && `${entry.correct ? '' : ': '}${termOf(pack, entry.term)?.emoji ?? ''} ${termOf(pack, entry.term)?.name ?? ''}`}
                </span>
              )}
              {entry.kind === 'pass' && <span className="wbi-muted">Zug beendet</span>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Players({ view, viewer, names }: { view: WhoState; viewer: SeatId | 'spectator'; names: string[] }) {
  const pack = packOf(view);
  return (
    <ul className="wbi-players">
      {names.map((name, seat) => {
        const term = termOf(pack, view.terms[seat] ?? null);
        const isTurn = view.phase !== 'done' && view.turn === seat;
        return (
          <li key={seat} className={`wbi-player ${isTurn ? 'is-turn' : ''} ${view.solved[seat] ? 'is-solved' : ''}`}>
            <span className="wbi-forehead" aria-label={term ? term.name : 'Verdeckt'}>
              <span className="wbi-emoji" aria-hidden="true">
                {term ? term.emoji : '❓'}
              </span>
              <span className="wbi-term">{term ? term.name : seat === viewer ? 'Das bist du!' : 'verdeckt'}</span>
            </span>
            <span className="wbi-name">
              <SeatSymbol seat={seat} className="wbi-seat-icon" />
              {name}
            </span>
            <span className="wbi-meta">
              {view.solved[seat] ? `✓ ${view.scores[seat]} Pkt.` : `${view.maxTurns - view.turnsTaken[seat]!} Züge`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function AskPanel({ view, seat, legal, onMove }: { view: WhoState; seat: SeatId; legal: WhoMove[]; onMove: (move: WhoMove) => void }) {
  const pack = packOf(view);
  const open = new Set(legal.flatMap((m) => (m.type === 'ask' ? [m.question] : [])));
  const taken = new Set(view.terms.filter((t, s): t is string => t !== null && s !== seat));
  const wrong = new Set(view.history[seat]!.flatMap((h) => (h.kind === 'guess' && h.term && !h.correct ? [h.term] : [])));
  return (
    <div className="wbi-panel">
      <p className="wbi-call">
        Du bist dran{view.asksThisTurn > 0 ? ` – noch ${MAX_ASKS_PER_TURN - view.asksThisTurn} Frage${MAX_ASKS_PER_TURN - view.asksThisTurn === 1 ? '' : 'n'} in diesem Zug` : ''}. Frag nach dir selbst oder rate!
      </p>
      {view.mode === 'free' && (
        <button type="button" className="wbi-button wbi-primary" onClick={() => onMove({ type: 'askAloud' })}>
          🗣️ Ich stelle meine Frage laut
        </button>
      )}
      <details className="wbi-questions" open={view.mode === 'catalog'}>
        <summary>{view.mode === 'catalog' ? 'Frage wählen' : 'Oder eine Frage aus dem Katalog'}</summary>
        <div className="wbi-question-list">
          {pack.questions.map((q) => (
            <button key={q.id} type="button" className="wbi-question" disabled={!open.has(q.id)} onClick={() => onMove({ type: 'ask', question: q.id })}>
              {q.text}
            </button>
          ))}
        </div>
      </details>
      {view.mode === 'free' ? (
        <WordInput label="Raten: Wer bin ich?" placeholder="Ich bin …" submitLabel="Raten" onSubmit={(text) => onMove({ type: 'guessText', text })} />
      ) : (
        <details className="wbi-guess">
          <summary>Raten</summary>
          <div className="wbi-guess-grid">
            {pack.terms.map((term) => (
              <button
                key={term.id}
                type="button"
                className={`wbi-guess-term ${taken.has(term.id) ? 'is-taken' : ''} ${wrong.has(term.id) ? 'is-wrong' : ''}`}
                disabled={taken.has(term.id) || wrong.has(term.id)}
                title={taken.has(term.id) ? 'Diesen Begriff hat schon jemand anderes' : undefined}
                onClick={() => onMove({ type: 'guess', term: term.id })}
              >
                <span aria-hidden="true">{term.emoji}</span> {term.name}
              </button>
            ))}
          </div>
        </details>
      )}
      <button type="button" className="wbi-button" onClick={() => onMove({ type: 'pass' })}>
        {view.asksThisTurn > 0 ? 'Zug beenden' : 'Aussetzen'}
      </button>
    </div>
  );
}

function AnswerPanel({ view, names, legal, onMove }: { view: WhoState; names: string[]; legal: WhoMove[]; onMove: (move: WhoMove) => void }) {
  const pending = view.pending!;
  const term = termOf(packOf(view), view.terms[view.turn] ?? null);
  const waiting = pending.vote.voters.filter((s) => pending.vote.ballots[s] === null).length;
  return (
    <div className="wbi-panel">
      <p className="wbi-call">
        {pending.question === null ? `${names[view.turn]} stellt die Frage laut – hört gut zu!` : `${names[view.turn]} fragt: „${questionText(view, pending.question)}“`}
      </p>
      {term && (
        <p className="wbi-muted">
          {names[view.turn]} ist: {term.emoji} <strong>{term.name}</strong>
        </p>
      )}
      {legal.length > 0 ? (
        <div className="wbi-answers">
          {([YES, NO, MAYBE] as Answer[]).map((value) => (
            <button key={value} type="button" className="wbi-button" onClick={() => onMove({ type: 'answer', value })}>
              {ANSWER_LABEL[value]}
            </button>
          ))}
        </div>
      ) : (
        <p className="wbi-muted">Warte auf {waiting} Antwort{waiting === 1 ? '' : 'en'} …</p>
      )}
    </div>
  );
}

function Board({ view, viewer, legalMoves, onMove, seatNames }: BoardProps<WhoState, WhoMove>) {
  const names = seatNames.length === view.seats ? seatNames : Array.from({ length: view.seats }, (_, i) => `Platz ${i + 1}`);
  const myTurn = view.phase === 'ask' && viewer === view.turn && legalMoves.length > 0;
  return (
    <div className="wbi-root">
      <Players view={view} viewer={viewer} names={names} />
      {myTurn && typeof viewer === 'number' && <AskPanel view={view} seat={viewer} legal={legalMoves} onMove={onMove} />}
      {view.phase === 'answer' && view.pending && <AnswerPanel view={view} names={names} legal={legalMoves} onMove={onMove} />}
      {view.phase === 'ask' && !myTurn && <p className="wbi-call">{names[view.turn]} ist dran.</p>}
      {view.phase === 'done' && <p className="wbi-call">Alle Begriffe sind aufgedeckt.</p>}
      <div className="wbi-histories">
        {typeof viewer === 'number' && <History view={view} entries={view.history[viewer] ?? []} title="Deine Fragen" />}
        {view.phase !== 'done' && view.turn !== viewer && <History view={view} entries={view.history[view.turn] ?? []} title={`Fragen von ${names[view.turn]}`} />}
      </div>
    </div>
  );
}

export const gameUi: GameUi<WhoState, WhoMove> = {
  Board,
  SeatSymbol,
  seatLabel: (seat) => `Platz ${seat + 1}`,
  seatDetail: (view, seat) => (view.solved[seat] ? 'erraten' : `${view.maxTurns - view.turnsTaken[seat]!} Züge`),
  seatScore: (view, seat) => view.scores[seat] ?? 0,
  sounds: {
    answered: 'karte-umdrehen',
    voted: 'bingo-stempel',
    solved: 'quiz-richtig',
    wrongGuess: 'quiz-falsch',
    nextTurn: 'zug-hinweis',
  },
};

