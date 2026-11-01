/**
 * Oberfläche des Umschreibe-Duells. Was jemand sieht, hängt von der Rolle ab: Wer erklärt und
 * das andere Team sehen Begriff und Sperrwörter, das ratende Team und die Tafel nicht.
 */
import { teamMembers, type SeatId } from '@brett-und-blatt/engine';
import { WordInput, type BoardProps, type GameUi } from '@brett-und-blatt/ui';
import { useState } from 'react';
import { meta } from '../meta';
import { MAX_BLOCKED, MAX_CLUE_LENGTH, MAX_CLUES, blockers, clueProblem, guessers, termOf, type DuelMove, type DuelState } from '../rules';
import './styles.css';

const TEAM_NAMES = meta.teams!.names;
const TEAM_ICONS = ['☀️', '🌙'];

function SeatSymbol({ seat, className }: { seat: SeatId; className?: string }) {
  // Ohne Spielstand kennt das Zeichen das Team nicht – es zeigt die Sitzordnung im Wechsel.
  const team = seat % 2;
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill={team === 0 ? '#d97706' : '#0369a1'} />
      <path d="M7 9h10M7 13h7" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Kleiner Punkt in Teamfarbe vor jedem Namen. */
function TeamDot({ team }: { team: number }) {
  return (
    <svg viewBox="0 0 10 10" className="ud-dot" aria-hidden="true">
      <circle cx="5" cy="5" r="4" fill={team === 0 ? '#d97706' : '#0369a1'} />
    </svg>
  );
}

function Scoreboard({ view }: { view: DuelState }) {
  return (
    <div className="ud-score" aria-label="Punktestand">
      {TEAM_NAMES.map((name, team) => (
        <div key={team} className={`ud-team-score is-team-${team} ${view.phase !== 'done' && view.team === team ? 'ud-active' : ''}`}>
          <span>
            {TEAM_ICONS[team]} {name}
          </span>
          <strong>{view.scores[team]}</strong>
        </div>
      ))}
    </div>
  );
}

function Rosters({ view, names }: { view: DuelState; names: string[] }) {
  return (
    <div className="ud-rosters">
      {TEAM_NAMES.map((name, team) => (
        <p key={team} className={`ud-roster is-team-${team}`}>
          <strong>
            {TEAM_ICONS[team]} {name}:
          </strong>{' '}
          {teamMembers(view.teams, team).map((s, i) => (
            <span key={s} className="ud-member">
              {i > 0 && ', '}
              <TeamDot team={team} />
              {names[s]}
              {view.phase !== 'done' && s === view.explainer ? ' 🗣️' : ''}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}

function TermCard({ view }: { view: DuelState }) {
  const term = termOf(view, view.term);
  if (!term) return null;
  return (
    <div className="ud-term">
      <p className="ud-label">Begriff</p>
      <p className="ud-term-name">{term.name}</p>
      {view.phase === 'explain' && (
        <p className="ud-blocked">
          {view.blocked.length > 0 ? (
            <>
              Gesperrt:{' '}
              {view.blocked.map((w) => (
                <span key={w} className="ud-chip">
                  🚫 {w}
                </span>
              ))}
            </>
          ) : (
            'Keine Sperrwörter – nur der Begriff selbst ist tabu.'
          )}
        </p>
      )}
    </div>
  );
}

function BlockForm({ onMove }: { onMove: (move: DuelMove) => void }) {
  const [words, setWords] = useState<string[]>([]);
  return (
    <div className="ud-panel">
      <p className="ud-call">Welche Wörter darf die andere Seite nicht sagen? Bis zu {MAX_BLOCKED} Sperrwörter.</p>
      <WordInput
        label="Sperrwort"
        placeholder="ein Wort"
        submitLabel="+"
        disabled={words.length >= MAX_BLOCKED}
        check={(text) => (text.includes(' ') ? 'Bitte nur ein Wort.' : words.some((w) => w.toLowerCase() === text.toLowerCase()) ? 'Das hast du schon.' : null)}
        onSubmit={(text) => setWords([...words, text])}
      />
      <p>
        {words.map((w, i) => (
          <button key={w} type="button" className="ud-chip" aria-label={`${w} entfernen`} onClick={() => setWords(words.filter((_, j) => j !== i))}>
            🚫 {w} ✕
          </button>
        ))}
      </p>
      <button type="button" className="ud-button ud-primary" onClick={() => onMove({ type: 'block', words })}>
        {words.length === 0 ? 'Keine Sperrwörter' : `${words.length} Sperrwort${words.length === 1 ? '' : 'e'} abgeben`}
      </button>
    </div>
  );
}

function Clues({ view, names }: { view: DuelState; names: string[] }) {
  if (view.mode !== 'write' || view.phase !== 'explain') return null;
  return (
    <div className="ud-clues">
      <section>
        <h3>
          Hinweise ({view.clues.length}/{MAX_CLUES})
        </h3>
        {view.clues.length === 0 ? (
          <p className="ud-muted">Noch kein Hinweis.</p>
        ) : (
          <ol>
            {view.clues.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ol>
        )}
      </section>
      <section>
        <h3>Geraten</h3>
        {view.guesses.length === 0 ? (
          <p className="ud-muted">Noch nichts.</p>
        ) : (
          <ul>
            {view.guesses.map((g, i) => (
              <li key={i}>
                <span className="ud-muted">{names[g.seat]}:</span> {g.text}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Board({ view, viewer, legalMoves, onMove, seatNames }: BoardProps<DuelState, DuelMove>) {
  const names = seatNames.length === view.seats ? seatNames : Array.from({ length: view.seats }, (_, i) => `Platz ${i + 1}`);
  const can = (type: DuelMove['type']) => legalMoves.some((m) => m.type === type);
  const isExplainer = viewer === view.explainer;
  const isBlocker = typeof viewer === 'number' && blockers(view).includes(viewer);
  const isGuesser = typeof viewer === 'number' && guessers(view).includes(viewer);
  const explainTeam = TEAM_NAMES[view.team];
  const last = view.lastTurn;

  return (
    <div className="ud-root">
      <Scoreboard view={view} />
      {view.phase !== 'done' && (
        <p className="ud-status">
          Begriff {view.turnIndex + 1} von {view.totalTurns} · {TEAM_ICONS[view.team]} {explainTeam} ist dran, <strong>{names[view.explainer]}</strong> erklärt.
        </p>
      )}
      {last && (
        <p className={`ud-last is-${last.outcome}`}>
          Zuletzt: „{last.term}“ –{' '}
          {last.outcome === 'guessed'
            ? `erraten${last.guessedBy !== null ? ` von ${names[last.guessedBy]}` : ''} (+${last.points} für ${TEAM_NAMES[last.team]})`
            : last.outcome === 'buzzed'
              ? `Sperrwort gesagt (+1 für ${TEAM_NAMES[1 - last.team]})`
              : 'übersprungen'}
        </p>
      )}

      {view.phase === 'block' && (
        <>
          {(isExplainer || isBlocker) && <TermCard view={view} />}
          {isBlocker && can('block') ? (
            <BlockForm key={view.turnIndex} onMove={onMove} />
          ) : (
            <p className="ud-call">
              {isBlocker ? 'Deine Sperrwörter sind abgegeben.' : `${TEAM_NAMES[1 - view.team]} wählt gerade die Sperrwörter …`}
            </p>
          )}
        </>
      )}

      {view.phase === 'explain' && (
        <>
          {(isExplainer || isBlocker) && <TermCard view={view} />}
          {isExplainer && view.mode === 'write' && (
            <div className="ud-panel">
              <WordInput
                label="Hinweis für dein Team"
                placeholder="Umschreibe den Begriff …"
                submitLabel="Senden"
                maxLength={MAX_CLUE_LENGTH}
                disabled={!can('clue') && view.clues.length >= MAX_CLUES}
                check={(text) => clueProblem(view, text)}
                onSubmit={(text) => onMove({ type: 'clue', text })}
              />
              <button type="button" className="ud-button" disabled={!can('skip')} onClick={() => onMove({ type: 'skip' })}>
                ⏭️ Begriff überspringen
              </button>
            </div>
          )}
          {isExplainer && view.mode === 'speak' && (
            <div className="ud-panel">
              <p className="ud-call">Erkläre laut! Dein Team ruft seine Antworten.</p>
              <div className="ud-actions">
                <button type="button" className="ud-button ud-primary" disabled={!can('correct')} onClick={() => onMove({ type: 'correct' })}>
                  ✅ Erraten!
                </button>
                <button type="button" className="ud-button ud-danger" disabled={!can('buzz')} onClick={() => onMove({ type: 'buzz' })}>
                  🚫 Sperrwort gesagt
                </button>
                <button type="button" className="ud-button" disabled={!can('skip')} onClick={() => onMove({ type: 'skip' })}>
                  ⏭️ Überspringen
                </button>
              </div>
            </div>
          )}
          {isGuesser && view.mode === 'write' && (
            <div className="ud-panel">
              <WordInput label="Dein Tipp" placeholder="Was ist gemeint?" submitLabel="Raten" disabled={!can('guess')} onSubmit={(text) => onMove({ type: 'guess', text })} />
              <button type="button" className="ud-button" disabled={!can('pass')} onClick={() => onMove({ type: 'pass' })}>
                Ich komme nicht drauf
              </button>
              {!can('guess') && can('pass') && <p className="ud-muted">Warte auf den nächsten Hinweis …</p>}
            </div>
          )}
          {isGuesser && view.mode === 'speak' && <p className="ud-call">Hör gut zu und rate laut!</p>}
          {isBlocker && view.mode === 'speak' && (
            <button type="button" className="ud-buzz" onClick={() => onMove({ type: 'buzz' })}>
              🚫 Gesagt!
            </button>
          )}
          <Clues view={view} names={names} />
        </>
      )}

      {view.phase === 'done' && (
        <p className="ud-call">
          {view.scores[0] === view.scores[1]
            ? 'Unentschieden!'
            : `${TEAM_ICONS[view.scores[0]! > view.scores[1]! ? 0 : 1]} ${TEAM_NAMES[view.scores[0]! > view.scores[1]! ? 0 : 1]} gewinnt!`}
        </p>
      )}
      <Rosters view={view} names={names} />
    </div>
  );
}

export const gameUi: GameUi<DuelState, DuelMove> = {
  Board,
  SeatSymbol,
  seatLabel: (seat) => `Platz ${seat + 1}`,
  seatDetail: (view, seat) => `${TEAM_ICONS[view.teams[seat] ?? 0]} ${TEAM_NAMES[view.teams[seat] ?? 0]}${view.phase !== 'done' && seat === view.explainer ? ' · erklärt' : ''}`,
  seatScore: (view, seat) => view.scores[view.teams[seat] ?? 0] ?? 0,
  sounds: {
    proposed: 'bingo-stempel',
    blocked: 'ansage-glocke',
    clue: 'karte-legen',
    wrongGuess: 'quiz-falsch',
    guessed: 'quiz-richtig',
    buzzed: 'ruf-falsch',
    skipped: 'karte-ziehen',
  },
};
