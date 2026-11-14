import { AFTER_RANDOM } from '@brett-und-blatt/online';
import { useEffect, useState } from 'react';
import { t } from '../i18n';
import type { AfterState } from '../lib/online';
import { findGame, games } from '../lib/registry';
import { Button } from './controls';

export interface AfterGameBarProps {
  after: AfterState;
  /** Das Spiel, das gerade zu Ende ist (kommt nicht als Vorschlag in Frage). */
  gameId: string;
  /** Wie viele Plätze besetzt sind – Spiele mit anderer Spielerzahl werden nicht angeboten. */
  seatCount: number;
  onVote(choice: 'again' | 'other'): void;
  onPropose(gameId: string): void;
  onPick(gameId: string): void;
  onLeave(): void;
}

/**
 * „Wie geht’s weiter?“ am Rundenende (#298): Aussteigen, Nochmal oder anderes Spiel.
 * Die Mehrheit entscheidet (bei Gleichstand: Nochmal); wer zu „anderes Spiel“ ein Spiel vorschlägt oder
 * wählt, stimmt damit zugleich für den Wechsel. Wer was gewählt hat, steht erst nach der Entscheidung fest.
 */
export function AfterGameBar({ after, gameId, seatCount, onVote, onPropose, onPick, onLeave }: AfterGameBarProps) {
  const [seconds, setSeconds] = useState(() => Math.max(0, Math.ceil((after.endsAt - Date.now()) / 1000)));
  const [proposal, setProposal] = useState('');
  useEffect(() => {
    const tick = () => setSeconds(Math.max(0, Math.ceil((after.endsAt - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 500);
    return () => window.clearInterval(timer);
  }, [after.endsAt]);

  const choice = after.you?.choice;
  const proposable = games.filter((game) => game.id !== gameId && game.players.min >= 2 && game.players.min <= seatCount && seatCount <= game.players.max && !after.candidates.some((c) => c.gameId === game.id));
  const votesText = (n: number) => (n === 1 ? t('after.vote1') : t('after.votes', { n }));

  return (
    <section className="bub-plop w-full basis-full space-y-2 rounded-2xl border border-line bg-surface p-3 text-left shadow-sm" aria-label={t('after.title')}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">{t('after.title')}</h2>
        <p className="text-xs text-muted" aria-live="polite">
          {t('after.counts', { voted: after.voted, voters: after.voters })} · {t('after.seconds', { n: seconds })}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant={choice === 'again' ? 'primary' : 'secondary'} aria-pressed={choice === 'again'} onClick={() => onVote('again')}>
          🔁 {t('after.again')}
        </Button>
        <Button variant={choice === 'other' ? 'primary' : 'secondary'} aria-pressed={choice === 'other'} onClick={() => onVote('other')}>
          🎲 {t('after.other')}
        </Button>
        <Button variant="ghost" onClick={onLeave}>
          🚪 {t('after.leave')}
        </Button>
      </div>
      {choice === 'other' && (
        <div className="space-y-2 border-t border-line pt-2">
          <p className="text-sm font-medium">{t('after.candidates')}</p>
          <ul className="flex flex-wrap gap-2">
            {after.candidates.map((candidate) => {
              const info = candidate.gameId === AFTER_RANDOM ? null : findGame(candidate.gameId);
              const picked = after.you?.pick === candidate.gameId;
              return (
                <li key={candidate.gameId}>
                  <Button variant={picked ? 'primary' : 'secondary'} aria-pressed={picked} onClick={() => onPick(candidate.gameId)}>
                    <span aria-hidden="true">{info?.emoji ?? '🎲'}</span> {info?.name ?? t('after.random')}
                    <span className="text-xs opacity-80">({votesText(candidate.votes)})</span>
                  </Button>
                </li>
              );
            })}
          </ul>
          {proposable.length === 0 ? (
            <p className="text-xs text-muted">{t('after.noGames')}</p>
          ) : (
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (!proposal) return;
                onPropose(proposal);
                setProposal('');
              }}
            >
              <select className="min-h-11 rounded-xl border border-line bg-surface px-3" value={proposal} onChange={(event) => setProposal(event.target.value)} aria-label={t('after.propose')}>
                <option value="">{t('after.propose')}</option>
                {proposable.map((game) => (
                  <option key={game.id} value={game.id}>
                    {game.emoji} {game.name}
                  </option>
                ))}
              </select>
              <Button type="submit" disabled={!proposal}>
                {t('after.proposeButton')}
              </Button>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
