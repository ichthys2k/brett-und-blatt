import { REPLAY_MAX_STEPS, replayFrames, type ReplayData, type SeatId } from '@brett-und-blatt/engine';
import { useEffect, useMemo, useRef, useState } from 'react';
import { t } from '../i18n';
import type { LoadedGame } from '../lib/registry';
import { Button } from './controls';

/** Kann diese Partie nachgespielt werden? */
export function canReplay(data: ReplayData | null | undefined): data is ReplayData {
  return Boolean(data) && data!.log.length > 0 && data!.log.length <= REPLAY_MAX_STEPS;
}

interface ReplayProps {
  game: LoadedGame;
  data: ReplayData;
  seatNames: string[];
  /** Sicht, mit der das Nachspielen beginnt (eigener Platz) – sonst Zuschauer. */
  startViewer: SeatId | 'spectator';
  onClose(): void;
}

/**
 * Partie nachspielen (#99): zeigt das Spielfeld des Spiels Zug für Zug, gesperrt und ohne Klang.
 * Die Zustände werden aus Seed und Zugliste neu gerechnet; gewählt wird, aus wessen Sicht man schaut
 * (bei Spielen mit Verdecktem also auch jede einzelne Hand).
 */
export function Replay({ game, data, seatNames, startViewer, onClose }: ReplayProps) {
  const { ui, info, module } = game;
  const frames = useMemo(() => replayFrames<unknown>(module, data), [module, data]);
  const last = frames.length - 1;
  const [step, setStep] = useState(last);
  const [playing, setPlaying] = useState(false);
  const [viewer, setViewer] = useState<SeatId | 'spectator'>(startViewer);
  /** Nur ein einzelner Schritt vorwärts darf animieren; Sprünge zeigen den Stand ohne Ereignisse. */
  const previous = useRef(step);
  const events = step === previous.current + 1 ? (frames[step]?.events ?? []) : [];
  useEffect(() => {
    previous.current = step;
  }, [step]);

  // Beginnt am Anfang der Partie, nicht am Ende.
  useEffect(() => {
    setStep(0);
    previous.current = 0;
  }, [frames]);

  useEffect(() => {
    if (!playing) return;
    if (step >= last) {
      setPlaying(false);
      return;
    }
    const id = window.setTimeout(() => setStep((n) => Math.min(last, n + 1)), 900);
    return () => window.clearTimeout(id);
  }, [playing, step, last]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowRight') setStep((n) => Math.min(last, n + 1));
      else if (event.key === 'ArrowLeft') setStep((n) => Math.max(0, n - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [last, onClose]);

  const frame = frames[step]!;
  const view = module.playerView(frame.state, viewer);
  const hidden = Boolean(info.privateViews ?? info.hiddenInformation);
  const jump = (to: number) => {
    setPlaying(false);
    setStep(Math.max(0, Math.min(last, to)));
  };

  return (
    <div className="absolute inset-0 z-30 flex min-h-0 flex-col bg-bg" role="region" aria-label={t('replay.title')}>
      <div className="flex-1 min-h-0 overflow-auto" aria-live="polite">
        <ui.Board
          view={view}
          legalMoves={[]}
          onMove={() => undefined}
          events={events}
          activeSeat={null}
          hint={null}
          viewer={viewer}
          seatNames={seatNames}
          audio={{ muted: true, music: 0, effects: 0 }}
        />
      </div>
      <div className="flex flex-none flex-wrap items-center gap-2 border-t border-line bg-surface px-3 py-2">
        <Button onClick={() => jump(0)} disabled={step === 0} aria-label={t('replay.first')}>
          ⏮
        </Button>
        <Button onClick={() => jump(step - 1)} disabled={step === 0} aria-label={t('replay.back')}>
          ◀
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            if (step >= last) setStep(0);
            setPlaying((p) => !p);
          }}
          aria-label={playing ? t('replay.pause') : t('replay.play')}
        >
          {playing ? '⏸' : '▶'}
        </Button>
        <Button onClick={() => jump(step + 1)} disabled={step === last} aria-label={t('replay.next')}>
          ▶|
        </Button>
        <Button onClick={() => jump(last)} disabled={step === last} aria-label={t('replay.last')}>
          ⏭
        </Button>
        <input type="range" min={0} max={last} value={step} onChange={(event) => jump(Number(event.target.value))} className="min-w-24 flex-1" aria-label={t('replay.slider')} />
        <span className="text-sm tabular-nums text-muted">{t('replay.step', { step, total: last })}</span>
        {hidden && (
          <select
            className="rounded-md border border-line bg-bg px-2 py-1 text-sm"
            value={String(viewer)}
            onChange={(event) => setViewer(event.target.value === 'spectator' ? 'spectator' : Number(event.target.value))}
            aria-label={t('replay.viewer')}
          >
            <option value="spectator">{t('replay.spectator')}</option>
            {seatNames.map((name, seat) => (
              <option key={seat} value={seat}>
                {name}
              </option>
            ))}
          </select>
        )}
        <Button variant="ghost" onClick={onClose}>
          {t('replay.close')}
        </Button>
      </div>
    </div>
  );
}
