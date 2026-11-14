import { BOT_LEVELS, randomSeed, resolveOptions, teamsFor, timePresetsOf, type BotLevel, type Options, type SeatConfig, type SeatKind, type TimePresetId } from '@brett-und-blatt/engine';
import { CardSetNote } from '../components/CardSetNote';
import { useEffect, useState } from 'react';
import { Button, PlayerCount, Section, Segmented } from '../components/controls';
import { HowToList } from '../components/HowTo';
import { QrCode } from '../components/OnlineParts';
import { TeamChip } from '../components/Teams';
import { t } from '../i18n';
import { startGame } from '../lib/activeGame';
import { describeTime, levelLabel } from '../lib/format';
import { LEVELS, levelStats, suggest } from '../lib/botRating';
import { loadBook } from '../lib/chronikStore';
import { passBook } from '../lib/passes';
import { loadGame, type LoadedGame } from '../lib/registry';
import { navigate, paths } from '../lib/router';
import { storage } from '../lib/storage';

interface SeatDraft {
  kind: SeatKind;
  name: string;
  level: BotLevel;
  botId?: string;
  /** Pass dieses Geräts (#139); fehlt bei freiem Namen. */
  passId?: string;
}

interface SetupDraft {
  seats: SeatDraft[];
  options: Options;
  time: TimePresetId;
}

const TIME_PRESETS: TimePresetId[] = ['relaxed', 'normal', 'fast'];

function selectableBotsOf(module: LoadedGame['module']) {
  const extras = module.bots.filter((b) => b.selectable);
  if (extras.length === 0) return [module.bots[0]!];
  return [module.bots[0]!, ...extras.filter((b) => b !== module.bots[0])];
}

function defaultDraft(game: LoadedGame): SetupDraft {
  return {
    seats: Array.from({ length: game.info.players.min }, (_, i) =>
      i < (game.info.minHumans ?? 1) ? { kind: 'human', name: '', level: 'medium' } : { kind: 'bot', name: '', level: 'medium' },
    ),
    options: resolveOptions(game.module),
    time: 'relaxed',
  };
}

/** Verborgene Optionen (z. B. eine eingefügte Partie) gelten nur für diese eine Partie und werden nicht gespeichert. */
function withoutHidden(module: LoadedGame['module'], draft: SetupDraft): SetupDraft {
  const hidden = new Set(module.options.filter((spec) => spec.hidden).map((spec) => spec.id));
  return { ...draft, options: Object.fromEntries(Object.entries(draft.options).filter(([id]) => !hidden.has(id))) };
}

/** Gespeicherte Einstellungen nur übernehmen, wenn sie zum aktuellen Spiel passen. URL-Parameter überschreiben gezielt einzelne Optionen. */
function restoreDraft(game: LoadedGame, params?: Record<string, string>): SetupDraft {
  const saved = storage.loadSetup<SetupDraft>(game.info.id);
  const fallback = defaultDraft(game);
  const mergedOptions = resolveOptions(game.module, { ...(saved?.options ?? {}), ...(params ?? {}) });
  if (!saved || !Array.isArray(saved.seats)) {
    return { ...fallback, options: mergedOptions };
  }
  const { min, max } = game.info.players;
  const selectableBots = selectableBotsOf(game.module);
  const seats = saved.seats.filter((s) => s && (s.kind === 'human' || s.kind === 'bot')).slice(0, max);
  return {
    seats:
      seats.length >= min
        ? seats.map((s) => {
            const matchedBot = s.botId ? selectableBots.find((b) => b.id === s.botId) : undefined;
            const level = BOT_LEVELS.includes(s.level) ? s.level : 'medium';
            const validLevel = matchedBot && !matchedBot.levels.includes(level) ? matchedBot.levels[0]! : level;
            return {
              kind: s.kind,
              name: String(s.name ?? ''),
              level: validLevel,
              ...(matchedBot ? { botId: matchedBot.id } : {}),
              ...(s.kind === 'human' && s.passId && passBook.list().some((p) => p.id === s.passId) ? { passId: s.passId } : {}),
            };
          })
        : fallback.seats,
    options: mergedOptions,
    time: TIME_PRESETS.includes(saved.time) ? saved.time : fallback.time,
  };
}

function toSeatConfigs(seats: SeatDraft[]): SeatConfig[] {
  const profile = storage.loadProfile();
  const botCount = seats.filter((s) => s.kind === 'bot').length;
  let botNumber = 0;
  return seats.map((seat, i) => {
    if (seat.kind === 'human') {
      const entry = seat.passId ? passBook.list().find((p) => p.id === seat.passId) : undefined;
      if (entry) return { kind: 'human', name: entry.name || seat.name.trim() || t('setup.defaultName', { n: i + 1 }), avatar: entry.avatar || undefined, passId: entry.id };
      return { kind: 'human', name: seat.name.trim() || t('setup.defaultName', { n: i + 1 }), avatar: profile?.avatar };
    }
    botNumber++;
    return { kind: 'bot', name: botCount > 1 ? `${t('setup.botName')} ${botNumber}` : t('setup.botName'), level: seat.level, ...(seat.botId ? { botId: seat.botId } : {}) };
  });
}

export function Setup({ gameId, params }: { gameId: string; params?: Record<string, string> }) {
  const [game, setGame] = useState<LoadedGame | null>(null);
  const [draft, setDraft] = useState<SetupDraft | null>(null);
  const [failed, setFailed] = useState(false);
  const [copiedKind, setCopiedKind] = useState<'setup' | 'autostart' | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadGame(gameId).then(
      async (loaded) => {
        if (cancelled) return;
        const restored = restoreDraft(loaded, params);
        setGame(loaded);
        setDraft(restored);
        if (params?.autostart === '1') {
          // Ein vorgegebener Solo-Kampf ändert nicht, was hier fürs nächste Mal gespeichert ist.
          if (params.gegner === 'bot') restored.seats = [{ kind: 'human', name: restored.seats[0]?.name ?? '', level: 'medium' }, { kind: 'bot', name: '', level: 'medium' }];
          else storage.saveSetup(loaded.info.id, withoutHidden(loaded.module, restored));
          await startGame({
            gameId: loaded.info.id,
            seats: toSeatConfigs(restored.seats),
            options: loaded.ui.prepareOptions ? loaded.ui.prepareOptions(restored.options) : restored.options,
            seed: randomSeed(),
            time: timePresetsOf(loaded.module, restored.options)[restored.time],
          });
          if (!cancelled) navigate(paths.play);
        }
      },
      () => !cancelled && setFailed(true),
    );
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  if (failed) return <p className="p-6 text-center text-muted">{t('setup.failed')}</p>;
  if (!game || !draft) return <p className="p-6 text-center text-muted">{t('setup.loading')}</p>;

  const { info, module, ui } = game;
  const teamsInfo = teamsFor(info, draft.options, draft.seats.length);
  const visibleOptions = module.options.filter(
    (spec) => !spec.hidden && (!spec.when || Object.entries(spec.when).every(([id, values]) => values.includes(draft.options[id] ?? module.options.find((o) => o.id === id)?.default ?? ''))),
  );
  // Bot-Wertung (#144): Vorschlag zur Stufe, wenn der Pass genug Partien gegen die gewählte Stufe hat (abschaltbar auf „Mein Pass“).
  const botLevels = draft.seats.filter((seat) => seat.kind === 'bot').map((seat) => seat.level);
  const strongest = botLevels.length > 0 ? LEVELS[Math.max(...botLevels.map((level) => LEVELS.indexOf(level)))] : undefined;
  const hintsOn = (() => {
    try {
      return window.localStorage.getItem('brett-und-blatt:botvorschlag') !== 'aus';
    } catch {
      return true;
    }
  })();
  const botHint = hintsOn && strongest ? suggest(levelStats(loadBook(), info.id), strongest, info.players.max === 2) : null;
  const humansMissing = (info.minHumans ?? 1) - draft.seats.filter((seat) => seat.kind === 'human').length;
  const update = (change: Partial<SetupDraft>) => setDraft({ ...draft, ...change });
  // Funktional, damit mehrere Werte nacheinander (z. B. SGF, Brettgröße, Komi) alle ankommen.
  const setOption = (id: string, value: string) => setDraft((d) => (d ? { ...d, options: { ...d.options, [id]: value } } : d));
  const updateSeat = (index: number, change: Partial<SeatDraft>) => update({ seats: draft.seats.map((s, i) => (i === index ? { ...s, ...change } : s)) });
  const setCount = (count: number) =>
    update({ seats: Array.from({ length: count }, (_, i) => draft.seats[i] ?? { kind: 'bot', name: '', level: 'medium' }) });

  const start = async () => {
    storage.saveSetup(info.id, withoutHidden(module, draft));
    await startGame({
      gameId: info.id,
      seats: toSeatConfigs(draft.seats),
      options: ui.prepareOptions ? ui.prepareOptions(draft.options) : draft.options,
      seed: randomSeed(),
      time: timePresetsOf(module, draft.options)[draft.time],
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

      {botHint && (
        <div className="space-y-2 rounded-2xl border border-line bg-surface p-3 shadow-sm" role="note">
          <p className="text-sm">{t(botHint.kind === 'up' ? 'botrating.up' : 'botrating.down', { p: Math.round(botHint.rate * 100), n: botHint.games, from: levelLabel(botHint.from), to: levelLabel(botHint.to) })}</p>
          <Button onClick={() => update({ seats: draft.seats.map((seat) => (seat.kind === 'bot' ? { ...seat, level: botHint.to } : seat)) })}>{t('botrating.apply', { to: levelLabel(botHint.to) })}</Button>
        </div>
      )}

      <CardSetNote gameId={info.id} />
      <Button variant="primary" className="w-full text-lg" disabled={humansMissing > 0} onClick={start}>
        {t('setup.start')}
      </Button>
      {humansMissing > 0 && <p className="-mt-3 text-center text-sm text-muted">{t('setup.needHumans', { n: info.minHumans ?? 1 })}</p>}

      <details className="rounded-2xl border border-line bg-surface p-3 shadow-sm">
        <summary className="cursor-pointer font-semibold">📖 {t('howto.title')}</summary>
        <div className="pt-3">
          <HowToList info={info} />
        </div>
      </details>

      <Section title={t('setup.players')}>
        {info.players.min < info.players.max && (
          <PlayerCount label={t('setup.playerCount')} value={draft.seats.length} min={info.players.min} max={info.players.max} onChange={setCount} />
        )}
        {teamsInfo && <p className="text-sm text-muted">{t('setup.teamsAlternate')}</p>}
        <ol className="space-y-2">
          {draft.seats.map((seat, index) => (
            <li key={index} className="space-y-2 rounded-2xl border border-line bg-surface p-3 shadow-sm">
              <div className="flex items-center gap-3">
                <ui.SeatSymbol seat={index} seats={draft.seats.length} className="block size-8 flex-none" />
                <span className="text-sm text-muted">{ui.seatLabel(index, draft.seats.length)}</span>
                {teamsInfo && <TeamChip names={teamsInfo.names} team={index % teamsInfo.count} />}
                <div className="ml-auto w-48">
                  <Segmented
                    label={`${ui.seatLabel(index, draft.seats.length)}: ${t('setup.human')} oder ${t('setup.bot')}`}
                    value={seat.kind}
                    choices={[
                      { value: 'human', label: t('setup.human') },
                      { value: 'bot', label: t('setup.bot') },
                    ]}
                    onChange={(kind) => updateSeat(index, { kind })}
                  />
                </div>
              </div>
              {seat.kind === 'human' && passBook.list().length > 1 && (
                <select
                  className="min-h-11 w-full rounded-xl border border-line bg-bg px-3"
                  aria-label={`${t('passes.seatPass')} (${ui.seatLabel(index, draft.seats.length)})`}
                  value={seat.passId ?? ''}
                  onChange={(event) => {
                    const entry = passBook.list().find((p) => p.id === event.target.value);
                    updateSeat(index, { passId: entry?.id, name: entry ? entry.name : seat.name });
                  }}
                >
                  <option value="">{t('passes.seatOwn')}</option>
                  {passBook.list().map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {`${entry.avatar} ${entry.name || t('passes.noName')}`.trim()}
                    </option>
                  ))}
                </select>
              )}
              {seat.kind === 'human' && !seat.passId ? (
                <input
                  className="min-h-11 w-full rounded-xl border border-line bg-bg px-3"
                  aria-label={`${t('setup.name')} (${ui.seatLabel(index, draft.seats.length)})`}
                  placeholder={t('setup.defaultName', { n: index + 1 })}
                  maxLength={24}
                  value={seat.name}
                  onChange={(event) => updateSeat(index, { name: event.target.value })}
                />
              ) : seat.kind === 'human' ? null : (
                (() => {
                  const selectableBots = selectableBotsOf(module);
                  const activeBot = selectableBots.find((b) => b.id === seat.botId) ?? selectableBots[0]!;
                  const levels = activeBot?.levels ?? BOT_LEVELS;
                  return (
                    <div className="space-y-2">
                      {selectableBots.length > 1 && (
                        <Segmented
                          label={`Bot (${ui.seatLabel(index, draft.seats.length)})`}
                          value={activeBot.id}
                          choices={selectableBots.map((b) => ({ value: b.id, label: b.name }))}
                          onChange={(botId) => {
                            const nextBot = selectableBots.find((b) => b.id === botId);
                            const nextLevel = nextBot && !nextBot.levels.includes(seat.level) ? nextBot.levels[0]! : seat.level;
                            updateSeat(index, { botId, level: nextLevel });
                          }}
                        />
                      )}
                      {levels.length > 1 ? (
                        <Segmented
                          label={`Stärke (${ui.seatLabel(index, draft.seats.length)})`}
                          value={seat.level}
                          choices={levels.map((level) => ({ value: level, label: levelLabel(level) }))}
                          onChange={(level) => updateSeat(index, { level })}
                        />
                      ) : (
                        <p className="text-xs text-muted">Stärke: {levelLabel(levels[0] ?? 'hard')} (Großmeister)</p>
                      )}
                    </div>
                  );
                })()
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

      {visibleOptions.length > 0 && (
        <Section title={t('setup.rules')}>
          {visibleOptions.map((spec) => (
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

      {ui.SetupExtra && <ui.SetupExtra options={resolveOptions(module, draft.options)} seats={draft.seats.length} setOption={setOption} />}

      <Section title={t('setup.time')}>
        <Segmented
          label={t('setup.time')}
          value={draft.time}
          choices={TIME_PRESETS.map((preset) => ({ value: preset, label: t(`time.${preset}`), hint: describeTime(timePresetsOf(module, draft.options)[preset]) }))}
          onChange={(time) => update({ time })}
        />
      </Section>

      {/* Übungslink & QR-Code für Unterricht / Tafel / Arbeitsblatt */}
      {(() => {
        const publicOpts: Record<string, string> = {};
        for (const spec of visibleOptions) {
          const val = draft.options[spec.id] ?? spec.default;
          if (val) publicOpts[spec.id] = val;
        }
        const baseOrigin = `${window.location.origin}${window.location.pathname}`;
        const setupUrl = `${baseOrigin}${paths.setup(info.id, publicOpts)}`;
        const autostartUrl = `${baseOrigin}${paths.setup(info.id, { ...publicOpts, autostart: '1' })}`;

        const copyLink = async (url: string, kind: 'setup' | 'autostart') => {
          try {
            await navigator.clipboard.writeText(url);
            setCopiedKind(kind);
            window.setTimeout(() => setCopiedKind(null), 2000);
          } catch {
            // Fallback ignorieren
          }
        };

        return (
          <details className="rounded-2xl border border-line bg-surface p-3 shadow-sm">
            <summary className="cursor-pointer font-semibold">
              🔗 Übungslink & QR-Code (für Tafel / Arbeitsblatt)
            </summary>
            <div className="space-y-3 pt-3 text-center">
              <p className="text-xs text-muted">
                Teile genau diese Spieleinstellung per QR-Code am Beamer oder als Direktlink (z. B. in WebUntis oder auf einem Arbeitsblatt):
              </p>
              <QrCode text={setupUrl} label={`QR-Code für ${info.name}`} />
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => copyLink(setupUrl, 'setup')}>
                  {copiedKind === 'setup' ? '✓ Link kopiert!' : '🔗 Link zur Einrichtung kopieren'}
                </Button>
                <Button onClick={() => copyLink(autostartUrl, 'autostart')}>
                  {copiedKind === 'autostart' ? '✓ Direktstart kopiert!' : '🚀 Direktstart-Link kopieren'}
                </Button>
              </div>
            </div>
          </details>
        );
      })()}

      <Button variant="primary" className="mt-auto w-full text-lg" disabled={humansMissing > 0} onClick={start}>
        {t('setup.start')}
      </Button>
    </div>
  );
}
