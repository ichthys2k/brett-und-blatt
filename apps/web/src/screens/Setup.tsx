import { BOT_LEVELS, randomSeed, resolveOptions, type BotLevel, type Options, type SeatConfig, type SeatKind, type TimePresetId } from '@brett-und-blatt/engine';
import { useEffect, useState } from 'react';
import { Button, Section, Segmented } from '../components/controls';
import { HowToList } from '../components/HowTo';
import { t } from '../i18n';
import { startGame } from '../lib/activeGame';
import { describeTime, levelLabel } from '../lib/format';
import { loadGame, type LoadedGame } from '../lib/registry';
import { navigate, paths } from '../lib/router';
import { storage } from '../lib/storage';

interface SeatDraft {
  kind: SeatKind;
  name: string;
  level: BotLevel;
}

interface SetupDraft {
  seats: SeatDraft[];
  options: Options;
  time: TimePresetId;
}

const TIME_PRESETS: TimePresetId[] = ['relaxed', 'normal', 'fast'];

function defaultDraft(game: LoadedGame): SetupDraft {
  return {
    seats: Array.from({ length: game.info.players.min }, (_, i) =>
      i === 0 ? { kind: 'human', name: '', level: 'medium' } : { kind: 'bot', name: '', level: 'medium' },
    ),
    options: resolveOptions(game.module),
    time: 'relaxed',
  };
}

/** Gespeicherte Einstellungen nur übernehmen, wenn sie zum aktuellen Spiel passen. */
function restoreDraft(game: LoadedGame): SetupDraft {
  const saved = storage.loadSetup<SetupDraft>(game.info.id);
  const fallback = defaultDraft(game);
  if (!saved || !Array.isArray(saved.seats)) return fallback;
  const { min, max } = game.info.players;
  const seats = saved.seats.filter((s) => s && (s.kind === 'human' || s.kind === 'bot')).slice(0, max);
  return {
    seats: seats.length >= min ? seats.map((s) => ({ kind: s.kind, name: String(s.name ?? ''), level: BOT_LEVELS.includes(s.level) ? s.level : 'medium' })) : fallback.seats,
    options: resolveOptions(game.module, saved.options),
    time: TIME_PRESETS.includes(saved.time) ? saved.time : fallback.time,
  };
}

function toSeatConfigs(seats: SeatDraft[]): SeatConfig[] {
  const botCount = seats.filter((s) => s.kind === 'bot').length;
  let botNumber = 0;
  return seats.map((seat, i) => {
    if (seat.kind === 'human') return { kind: 'human', name: seat.name.trim() || t('setup.defaultName', { n: i + 1 }) };
    botNumber++;
    return { kind: 'bot', name: botCount > 1 ? `${t('setup.botName')} ${botNumber}` : t('setup.botName'), level: seat.level };
  });
}

export function Setup({ gameId }: { gameId: string }) {
  const [game, setGame] = useState<LoadedGame | null>(null);
  const [draft, setDraft] = useState<SetupDraft | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadGame(gameId).then(
      (loaded) => {
        if (cancelled) return;
        setGame(loaded);
        setDraft(restoreDraft(loaded));
      },
      () => !cancelled && navigate(paths.home),
    );
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  if (!game || !draft) return <p className="p-6 text-center text-muted">{t('setup.loading')}</p>;

  const { info, module, ui } = game;
  const update = (change: Partial<SetupDraft>) => setDraft({ ...draft, ...change });
  const updateSeat = (index: number, change: Partial<SeatDraft>) => update({ seats: draft.seats.map((s, i) => (i === index ? { ...s, ...change } : s)) });
  const setCount = (count: number) =>
    update({ seats: Array.from({ length: count }, (_, i) => draft.seats[i] ?? { kind: 'bot', name: '', level: 'medium' }) });

  const start = async () => {
    storage.saveSetup(info.id, draft);
    await startGame({
      gameId: info.id,
      seats: toSeatConfigs(draft.seats),
      options: draft.options,
      seed: randomSeed(),
      time: module.timePresets[draft.time],
    });
    navigate(paths.play);
  };

  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-col gap-6 px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)]">
      <header className="flex items-center gap-2">
        <Button variant="ghost" className="px-3" aria-label={t('play.back')} onClick={() => navigate(paths.home)}>
          ←
        </Button>
        <div>
          <p className="text-sm text-muted">{t('setup.title')}</p>
          <h1 className="text-2xl font-bold">
            <span aria-hidden="true">{info.emoji} </span>
            {info.name}
          </h1>
        </div>
      </header>

      <details className="rounded-2xl border border-line bg-surface p-3 shadow-sm">
        <summary className="cursor-pointer font-semibold">📖 {t('howto.title')}</summary>
        <div className="pt-3">
          <HowToList info={info} />
        </div>
      </details>

      <Section title={t('setup.players')}>
        {info.players.min < info.players.max && (
          <Segmented
            label={t('setup.playerCount')}
            value={String(draft.seats.length)}
            choices={Array.from({ length: info.players.max - info.players.min + 1 }, (_, i) => {
              const n = String(info.players.min + i);
              return { value: n, label: n };
            })}
            onChange={(value) => setCount(Number(value))}
          />
        )}
        <ol className="space-y-2">
          {draft.seats.map((seat, index) => (
            <li key={index} className="space-y-2 rounded-2xl border border-line bg-surface p-3 shadow-sm">
              <div className="flex items-center gap-3">
                <ui.SeatSymbol seat={index} className="block size-8 flex-none" />
                <span className="text-sm text-muted">{ui.seatLabel(index)}</span>
                <div className="ml-auto w-48">
                  <Segmented
                    label={`${ui.seatLabel(index)}: ${t('setup.human')} oder ${t('setup.bot')}`}
                    value={seat.kind}
                    choices={[
                      { value: 'human', label: t('setup.human') },
                      { value: 'bot', label: t('setup.bot') },
                    ]}
                    onChange={(kind) => updateSeat(index, { kind })}
                  />
                </div>
              </div>
              {seat.kind === 'human' ? (
                <input
                  className="min-h-11 w-full rounded-xl border border-line bg-bg px-3"
                  aria-label={`${t('setup.name')} (${ui.seatLabel(index)})`}
                  placeholder={t('setup.defaultName', { n: index + 1 })}
                  maxLength={24}
                  value={seat.name}
                  onChange={(event) => updateSeat(index, { name: event.target.value })}
                />
              ) : (
                <Segmented
                  label={`Stärke (${ui.seatLabel(index)})`}
                  value={seat.level}
                  choices={BOT_LEVELS.map((level) => ({ value: level, label: levelLabel(level) }))}
                  onChange={(level) => updateSeat(index, { level })}
                />
              )}
            </li>
          ))}
        </ol>
        {draft.seats.length === 2 && (
          <Button className="w-full" onClick={() => update({ seats: [...draft.seats].reverse() })}>
            ⇅ {t('setup.swap')}
          </Button>
        )}
      </Section>

      {module.options.length > 0 && (
        <Section title={t('setup.rules')}>
          {module.options.map((spec) => (
            <div key={spec.id} className="space-y-1">
              <p className="font-medium">{spec.label}</p>
              {spec.description && <p className="text-sm text-muted">{spec.description}</p>}
              <Segmented
                label={spec.label}
                value={draft.options[spec.id] ?? spec.default}
                choices={spec.choices.map((choice) => ({ value: choice.value, label: choice.label }))}
                onChange={(value) => update({ options: { ...draft.options, [spec.id]: value } })}
              />
            </div>
          ))}
        </Section>
      )}

      <Section title={t('setup.time')}>
        <Segmented
          label={t('setup.time')}
          value={draft.time}
          choices={TIME_PRESETS.map((preset) => ({ value: preset, label: t(`time.${preset}`), hint: describeTime(module.timePresets[preset]) }))}
          onChange={(time) => update({ time })}
        />
      </Section>

      <Button variant="primary" className="mt-auto w-full text-lg" onClick={start}>
        {t('setup.start')}
      </Button>
    </div>
  );
}
