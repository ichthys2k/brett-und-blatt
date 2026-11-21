import { useInputIntent } from '@brett-und-blatt/ui';
import type { BotLevel } from '@brett-und-blatt/engine';
import { useRef, useState } from 'react';
import { CardSetNote } from '../components/CardSetNote';
import { HowToList } from '../components/HowTo';
import { SetupForm } from '../components/SetupForm';
import { t } from '../i18n';
import { controllerGrade } from '../lib/controllerGrade';
import { crestUrl } from '../lib/crest';
import { useFavorites } from '../lib/favorites';
import { levelLabel } from '../lib/format';
import { useGameScene } from '../lib/gameScene';
import { useActiveLook } from '../lib/look';
import { humansMissing } from '../lib/setupDraftCore';
import { useSetupDraft, type ReadySetupState } from '../lib/useSetupDraft';
import { ConsoleFrame } from './ConsoleFrame';
import { GRADE_BADGE, playerCountText } from './GameTile';
import { seatSummary } from './setupSummary';
import { useInitialFocus } from './useInitialFocus';

type Panel = 'configure' | 'howto' | null;

/** Spielseite der Konsole (#607, K6): Spiel links, große Aktionen rechts; A auf „Spielen“ startet sofort. */
export function ConsoleGame({ gameId, params }: { gameId: string; params?: Record<string, string> }) {
  useGameScene(gameId);
  const state = useSetupDraft(gameId, params);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const configureRef = useRef<HTMLButtonElement>(null);
  const howtoRef = useRef<HTMLButtonElement>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const tavern = useActiveLook() === 'tavern';
  const { favorites, toggle } = useFavorites();
  useInitialFocus(ref, `spiel:${gameId}`, Boolean(state.game && state.draft), true);

  const close = () => {
    const trigger = panel === 'configure' ? configureRef.current : howtoRef.current;
    setPanel(null);
    requestAnimationFrame(() => trigger?.focus());
  };
  const open = (next: Panel) => {
    if (panel === next) {
      close();
      return;
    }
    setPanel(next);
    requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>('button:not([disabled]), input, select, summary, a[href], [tabindex="0"]')?.focus());
  };

  // B schließt ein offenes Feld; sonst geht B wie gewohnt zurück.
  useInputIntent((intent) => {
    if (intent === 'cancel' && panel !== null) {
      close();
      return true;
    }
    if (intent === 'secondary') {
      toggle(gameId);
      return true;
    }
    return false;
  }, 5);

  const prompts = [
    { key: 'A', label: t('console.prompt.select') },
    { key: 'B', label: t('console.prompt.back') },
    { key: 'Y', label: t('console.prompt.favorite') },
  ];

  if (state.failed) {
    return (
      <ConsoleFrame tab="library" prompts={prompts}>
        <p>{t('setup.failed')}</p>
      </ConsoleFrame>
    );
  }
  if (!state.game || !state.draft) {
    return (
      <ConsoleFrame tab="library" prompts={prompts}>
        <p>{t('setup.loading')}</p>
      </ConsoleFrame>
    );
  }

  const { game, draft } = state;
  const { info } = game;
  const crest = tavern ? crestUrl(info.id) : undefined;
  const grade = controllerGrade(info.id);
  const missing = humansMissing(game, draft);
  const favorite = favorites.includes(info.id);
  const summary = seatSummary(draft.seats, (level) => levelLabel(level as BotLevel), {
    duel: (level) => t('console.summary.duel', { level }),
    humans: (n) => (n === 1 ? t('console.summary.human') : t('console.summary.humans', { n })),
    bots: (n, levels) => t('console.summary.bots', { n, levels }),
  });

  return (
    <ConsoleFrame tab="library" prompts={prompts}>
      <div ref={ref} className="kns-game">
        <section className="kns-game-info">
          <span className="kns-game-art" aria-hidden="true">
            {crest ? <img src={crest} alt="" decoding="async" /> : info.emoji}
          </span>
          <h1 className="kns-title">{info.name}</h1>
          <p>{info.description}</p>
          <p className="kns-game-meta">{playerCountText(info)}</p>
          {grade && (
            <p className="kns-game-meta">
              <span aria-hidden="true">{GRADE_BADGE[grade]} </span>
              {t(`console.grade.${grade}` as Parameters<typeof t>[0])}
            </p>
          )}
        </section>

        <div className="kns-actions">
          <button type="button" className="kns-action kns-action-primary" data-kns-autofocus data-kns-id="play" disabled={missing > 0} onClick={() => void state.start()}>
            <span className="kns-action-label">{t('console.play')}</span>
            <span className="kns-action-sub">
              {summary} · {t('console.time')}: {t(`time.${draft.time}` as Parameters<typeof t>[0])}
            </span>
          </button>
          {missing > 0 && <p className="kns-game-meta">{t('setup.needHumans', { n: info.minHumans ?? 1 })}</p>}

          <button ref={configureRef} type="button" className="kns-action" data-kns-id="configure" aria-expanded={panel === 'configure'} onClick={() => open('configure')}>
            <span className="kns-action-label">{t('console.configure')}</span>
          </button>
          {panel === 'configure' && (
            <div ref={panelRef} className="kns-panel">
              <CardSetNote gameId={info.id} />
              <SetupForm state={state as ReadySetupState} gameId={gameId} />
            </div>
          )}

          <button ref={howtoRef} type="button" className="kns-action" data-kns-id="howto" aria-expanded={panel === 'howto'} onClick={() => open('howto')}>
            <span className="kns-action-label">{t('howto.title')}</span>
          </button>
          {panel === 'howto' && (
            <div ref={panelRef} className="kns-panel" tabIndex={-1}>
              <HowToList info={info} />
              <button type="button" className="kns-button" onClick={close}>
                {t('console.close')}
              </button>
            </div>
          )}

          <button type="button" className="kns-action" data-kns-id="favorite" aria-pressed={favorite} onClick={() => toggle(info.id)}>
            <span className="kns-action-label">{favorite ? t('console.favorite.on') : t('console.favorite.off')}</span>
          </button>
        </div>
      </div>
    </ConsoleFrame>
  );
}
