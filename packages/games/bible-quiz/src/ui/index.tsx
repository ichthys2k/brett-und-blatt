import type { BoardProps, GameUi } from '@brett-und-blatt/ui';
import { useEffect, useState } from 'react';
import {
  PRAISES,
  type BibleQuizMove,
  type BibleQuizState,
  type QuestionCategory,
} from '../rules';
import './styles.css';

const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

function BibleSymbol({ className }: { className?: string }) {
  return (
    <span className={className} aria-hidden="true">
      ✝️
    </span>
  );
}

function getCategoryClass(cat: QuestionCategory): string {
  switch (cat) {
    case 'Altes Testament':
      return 'bq-category-at';
    case 'Neues Testament':
      return 'bq-category-nt';
    case 'Gleichnisse':
      return 'bq-category-parables';
    case 'Personen':
      return 'bq-category-people';
    case 'Verse':
      return 'bq-category-verses';
    default:
      return 'bq-category-at';
  }
}

function Board({
  view,
  viewer,
  legalMoves,
  onMove,
  seatNames,
}: BoardProps<BibleQuizState, BibleQuizMove>) {
  const mySeat = typeof viewer === 'number' ? viewer : 0;
  const myAnswer = view.answers[mySeat] ?? null;
  const myScore = view.scores[mySeat] ?? 0;
  const myStreak = view.streaks[mySeat] ?? 0;
  const myCorrect = view.correctCounts[mySeat] ?? 0;

  const [localChosen, setLocalChosen] = useState<number | null>(null);

  // Lokale Auswahl bei neuer Runde zurücksetzen
  useEffect(() => {
    setLocalChosen(null);
  }, [view.currentRound]);

  const canAnswer =
    view.phase === 'question' &&
    legalMoves.some((m) => m.type === 'answer') &&
    (myAnswer === null || !myAnswer.submitted);

  const canAdvance =
    view.phase === 'reveal' && legalMoves.some((m) => m.type === 'next');

  const handleSelectOption = (idx: number) => {
    if (!canAnswer) return;
    setLocalChosen(idx);
    onMove({ type: 'answer', optionIndex: idx });
  };

  const handleAdvance = () => {
    if (!canAdvance) return;
    onMove({ type: 'next' });
  };

  const starsString = '⭐'.repeat(view.currentQuestion.difficulty);

  // Praise deterministisch anhand der Frage auswählen
  const praise = PRAISES[view.currentQuestion.questionId % PRAISES.length];

  // ==========================================
  // ABSCHLUSSBILDSCHIRM (PHASE 'DONE')
  // ==========================================
  if (view.phase === 'done') {
    // Sortierte Rangliste
    const rankedSeats = Array.from({ length: view.seats }, (_, idx) => ({
      seat: idx,
      name: seatNames[idx] ?? `Platz ${idx + 1}`,
      score: view.scores[idx] ?? 0,
      correct: view.correctCounts[idx] ?? 0,
    })).sort((a, b) => b.score - a.score);

    const maxScore = rankedSeats[0]?.score ?? 0;

    return (
      <div className="bq-layout">
        <div className="bq-victory-card">
          <div className="bq-victory-icon" aria-hidden="true">
            🕊️
          </div>
          <h2 className="bq-victory-title">Göttlicher Segen! 🎉</h2>
          <p className="bq-victory-subtitle">
            Du hast <strong>{myCorrect} von {view.totalRounds}</strong> Fragen gemeistert!
          </p>

          <div className="bq-standings-table" role="table" aria-label="Endstand">
            {rankedSeats.map((entry, rIdx) => {
              const isWinner = entry.score === maxScore && entry.score > 0;
              return (
                <div key={entry.seat} className="bq-standings-row" role="row">
                  <span className="bq-standings-rank">
                    {isWinner ? '👑' : `${rIdx + 1}.`}
                  </span>
                  <span className="bq-standings-name">{entry.name}</span>
                  <span className="bq-standings-score">
                    {entry.score} Pkt. ({entry.correct}/{view.totalRounds})
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // LAUFENDE PARTIE (FRAGE ODER AUFLÖSUNG)
  // ==========================================
  return (
    <div className="bq-layout">
      {/* Kopfzeile mit Runden- und Punktestand */}
      <div className="bq-header">
        <div className="bq-meta-left">
          <span className="bq-round-pill">
            Frage {view.currentRound} von {view.totalRounds}
          </span>
          <span
            className={`bq-category-badge ${getCategoryClass(
              view.currentQuestion.category,
            )}`}
          >
            {view.currentQuestion.category}
          </span>
        </div>

        <div className="bq-meta-right">
          <span className="bq-stars" title={`Schwierigkeit ${view.currentQuestion.difficulty} von 3`}>
            {starsString}
          </span>
          {myStreak >= 2 && (
            <span className="bq-streak-chip" title="Richtige Antworten in Folge">
              🔥 {myStreak}er-Serie
            </span>
          )}
          <span className="bq-score-chip" title="Erzielte Punkte">
            {myScore} Pkt.
          </span>
        </div>
      </div>

      {/* Große Emoji-Rätselbox */}
      <div className="bq-emoji-card" aria-label="Emoji-Rätsel">
        <span className="bq-emoji-text">{view.currentQuestion.emojis}</span>
      </div>

      {/* Mehrspieler-Fortschrittsleiste (falls > 1 Mitspieler) */}
      {view.seats > 1 && view.phase === 'question' && (
        <div className="bq-multi-status" aria-label="Status der Mitspieler">
          {Array.from({ length: view.seats }, (_, sIdx) => {
            const hasSubmitted = view.answers[sIdx]?.submitted ?? false;
            const name = seatNames[sIdx] ?? `Platz ${sIdx + 1}`;
            return (
              <span
                key={sIdx}
                className="bq-player-pill"
                data-done={hasSubmitted || undefined}
              >
                {hasSubmitted ? '✓' : '⏳'} {name}
              </span>
            );
          })}
        </div>
      )}

      {/* 4 Antwortmöglichkeiten */}
      <div className="bq-options-grid" role="group" aria-label="Antwortmöglichkeiten">
        {view.currentQuestion.shuffledOptions.map((optionText, idx) => {
          let stateAttr: 'selected' | 'correct' | 'wrong' | undefined;

          if (view.phase === 'reveal') {
            if (idx === view.currentQuestion.correctOptionIndex) {
              stateAttr = 'correct';
            } else if (myAnswer && myAnswer.chosenIndex === idx && !myAnswer.correct) {
              stateAttr = 'wrong';
            }
          } else if (view.phase === 'question') {
            const chosen = myAnswer?.chosenIndex ?? localChosen;
            if (chosen === idx) {
              stateAttr = 'selected';
            }
          }

          const isButtonDisabled = !canAnswer;

          return (
            <button
              key={`${view.currentRound}-${idx}`}
              type="button"
              className="bq-option-btn"
              data-state={stateAttr}
              disabled={isButtonDisabled}
              onClick={() => handleSelectOption(idx)}
            >
              <span className="bq-option-letter">{OPTION_LETTERS[idx]}</span>
              <span className="bq-option-text">{optionText}</span>
            </button>
          );
        })}
      </div>

      {/* Feedback & Biblischer Hintergrund nach dem Antworten */}
      {view.phase === 'reveal' && (
        <div
          className="bq-feedback-card"
          data-correct={myAnswer?.correct ? 'true' : 'false'}
          role="region"
          aria-label="Auflösung"
        >
          <div className="bq-feedback-header">
            <h3
              className="bq-feedback-title"
              data-correct={myAnswer?.correct ? 'true' : 'false'}
            >
              {myAnswer?.correct ? (
                <>
                  Korrekt! ✅ <span className="bq-feedback-praise">{praise}</span>
                </>
              ) : (
                'Leider falsch ❌'
              )}
            </h3>

            {myAnswer?.correct && (
              <span className="bq-points-badge">
                +{myAnswer.pointsEarned} Punkte
                {myStreak >= 3 ? ' (inkl. Streak-Bonus)' : ''}
              </span>
            )}
          </div>

          <p className="bq-info-text">
            📖 {view.currentQuestion.info}
          </p>

          <div className="bq-feedback-actions">
            {view.currentQuestion.bibleLink ? (
              <a
                href={view.currentQuestion.bibleLink}
                target="_blank"
                rel="noopener noreferrer"
                className="bq-bible-link"
              >
                In der Bibel lesen (HFA) ↗
              </a>
            ) : (
              <div />
            )}

            {canAdvance ? (
              <button
                type="button"
                className="bq-next-btn"
                onClick={handleAdvance}
              >
                {view.currentRound >= view.totalRounds
                  ? '🏁 Auswertung ansehen'
                  : 'Nächste Frage ➔'}
              </button>
            ) : (
              <span className="bq-player-pill">
                ⏳ Die Spielleitung schaltet weiter...
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export const gameUi: GameUi<BibleQuizState, BibleQuizMove> = {
  Board,
  SeatSymbol: BibleSymbol,
  seatLabel: (seat) => `Platz ${seat + 1}`,
  seatDetail: (view, seat) => {
    const score = view.scores[seat] ?? 0;
    const correct = view.correctCounts[seat] ?? 0;
    if (view.phase === 'done') {
      return `${score} Pkt. (${correct}/${view.totalRounds})`;
    }
    const ans = view.answers[seat];
    return `${score} Pkt.${ans?.submitted ? ' · ✓' : ''}`;
  },
  sounds: {
    answered: (e) => (e.correct ? 'quiz-richtig' : 'quiz-falsch'),
    reveal: 'quiz-aufloesung',
    nextQuestion: 'quiz-seite',
    quizDone: 'sieg',
  },
};
