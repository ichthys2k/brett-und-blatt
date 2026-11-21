import { BOT_LEVELS, resolveOptions, teamsFor, timePresetsOf } from '@brett-und-blatt/engine';
import { t } from '../i18n';
import { describeTime, levelLabel } from '../lib/format';
import { PIECE_GAMES } from '../lib/pieceGames';
import { passBook } from '../lib/passes';
import { botAvatar, botName } from '../lib/botPortraits';
import { TIME_PRESETS, selectableBotsOf, visibleOptionsOf } from '../lib/setupDraftCore';
import type { ReadySetupState } from '../lib/useSetupDraft';
import { Avatar } from './Avatar';
import { Button, PlayerCount, Section, Segmented } from './controls';
import { PieceSetPicker } from './PieceSetPicker';
import { TeamChip } from './Teams';

export { humansMissing, visibleOptionsOf } from '../lib/setupDraftCore';

/**
 * Formular der Partie-Vorbereitung (#607, K2b): Plätze, Regeln, Zusatzfelder des Spiels, Figurensatz, Zeit.
 * Herausgelöst aus `screens/Setup.tsx`; benutzt dort und auf der Spielseite der Konsole.
 */
export function SetupForm({ state, gameId }: { state: ReadySetupState; gameId: string }) {
  const { game, draft, update, setOption, updateSeat, setCount } = state;
  const { info, module, ui } = game;
  const pieceGame = PIECE_GAMES.find((g) => g.id === info.id);
  const teamsInfo = teamsFor(info, draft.options, draft.seats.length);
  const visibleOptions = visibleOptionsOf(game, draft);
  return (
    <>
      <Section title={t('setup.players')}>
        {info.players.min < info.players.max && (
          <PlayerCount label={t('setup.playerCount')} value={draft.seats.length} min={info.players.min} max={info.players.max} onChange={setCount} />
        )}
        {teamsInfo && <p className="text-sm text-muted">{t('setup.teamsAlternate')}</p>}
        <ol className="space-y-2">
          {draft.seats.map((seat, index) => (
            <li key={index} className="space-y-2 rounded-2xl border border-line bg-surface p-3 shadow-sm">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <ui.SeatSymbol seat={index} seats={draft.seats.length} className="block size-8 flex-none" />
                <span className="text-sm text-muted">{ui.seatLabel(index, draft.seats.length)}</span>
                {teamsInfo && <TeamChip names={teamsInfo.names} team={index % teamsInfo.count} />}
                <div className="ml-auto w-48 max-w-full">
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
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <span className="text-2xl" aria-hidden="true">
                          <Avatar value={botAvatar(gameId)} />
                        </span>
                        {botName(gameId)}
                      </div>
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

      {visibleOptions.some((spec) => !spec.customUi) && (
        <Section title={t('setup.rules')}>
          {visibleOptions
            .filter((spec) => !spec.customUi)
            .map((spec) => (
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

      {pieceGame && <PieceSetPicker game={pieceGame} />}

      <Section title={t('setup.time')}>
        <Segmented
          label={t('setup.time')}
          value={draft.time}
          choices={TIME_PRESETS.map((preset) => ({ value: preset, label: t(`time.${preset}`), hint: describeTime(timePresetsOf(module, draft.options)[preset]) }))}
          onChange={(time) => update({ time })}
        />
      </Section>

    </>
  );
}
