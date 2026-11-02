import type { OptionSpec, Options } from '@brett-und-blatt/engine';
import { isTournamentGame, type TournamentFormat, type TournamentSettings } from '@brett-und-blatt/online';
import { useEffect, useState } from 'react';
import { t } from '../i18n';
import { passChanged } from '../lib/playerPass';
import { games, loadGame } from '../lib/registry';
import { navigate, paths } from '../lib/router';
import { storage, type Profile } from '../lib/storage';
import { createTournament } from '../lib/tournament';
import { Button, Section } from './controls';

const tournamentGames = games.filter(isTournamentGame).sort((a, b) => a.name.localeCompare(b.name, 'de'));
const FIELD = 'min-h-11 w-full rounded-xl border border-line bg-surface px-3';

/** Die eigenen Turniere und das Formular zum Anlegen, auf der Seite „Online spielen“. */
export function TournamentsPanel({ profile }: { profile: Profile }) {
  // Bei jedem Zeichnen frisch: Ein übernommener Ausweis kann neue Turniere mitbringen.
  const known = storage.loadTournaments();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [gameId, setGameId] = useState(tournamentGames.find((g) => g.id === 'chess')?.id ?? tournamentGames[0]?.id ?? '');
  const [format, setFormat] = useState<TournamentFormat>('world');
  const [time, setTime] = useState<TournamentSettings['time']>('normal');
  const [days, setDays] = useState(7);
  const [thirdPlace, setThirdPlace] = useState(false);
  const [specs, setSpecs] = useState<OptionSpec[]>([]);
  const [options, setOptions] = useState<Options>({});
  const [busy, setBusy] = useState(false);

  // Die Optionen stehen in den Regeln des Spiels, die erst bei Bedarf geladen werden.
  useEffect(() => {
    if (!creating || !gameId) return;
    let live = true;
    setSpecs([]);
    setOptions({});
    loadGame(gameId).then(({ module }) => {
      if (live) setSpecs(module.options.filter((spec) => !spec.hidden && !spec.pattern && spec.choices.length > 1));
    });
    return () => {
      live = false;
    };
  }, [creating, gameId]);

  const valueOf = (spec: OptionSpec) => options[spec.id] ?? spec.default;
  const visible = specs.filter((spec) => !spec.when || Object.entries(spec.when).every(([id, values]) => values.includes(options[id] ?? specs.find((s) => s.id === id)?.default ?? '')));
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const chosen = Object.fromEntries(visible.filter((spec) => valueOf(spec) !== spec.default).map((spec) => [spec.id, valueOf(spec)]));
      const code = await createTournament({ name: name.trim(), gameId, format, time, days, thirdPlace, options: chosen }, profile);
      storage.rememberTournament({ code, name: name.trim() });
      passChanged();
      navigate(paths.tournament(code));
    } catch {
      setError(t('online.serverError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title={`🏆 ${t('tournament.title')}`}>
      <p className="text-sm text-muted">{t('tournament.hint')}</p>
      {known.length > 0 && (
        <ul className="space-y-1">
          {known.map((item) => (
            <li key={item.code}>
              <Button className="w-full justify-start" onClick={() => navigate(paths.tournament(item.code))}>
                🏆 {item.name}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {!creating ? (
        <Button className="w-full" onClick={() => setCreating(true)}>
          ➕ {t('tournament.create')}
        </Button>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            create();
          }}
        >
          <label className="block space-y-1 text-sm">
            <span>{t('tournament.name')}</span>
            <input className={FIELD} required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block space-y-1 text-sm">
            <span>{t('tournament.game')}</span>
            <select className={FIELD} value={gameId} onChange={(e) => setGameId(e.target.value)}>
              {tournamentGames.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.emoji} {game.name}
                </option>
              ))}
            </select>
          </label>
          {visible.length > 0 && (
            <fieldset className="space-y-2 rounded-xl border border-line p-3">
              <legend className="px-1 text-sm">{t('tournament.options')}</legend>
              {visible.map((spec) => (
                <label key={spec.id} className="block space-y-1 text-sm">
                  <span>{spec.label}</span>
                  <select className={FIELD} value={valueOf(spec)} onChange={(e) => setOptions({ ...options, [spec.id]: e.target.value })}>
                    {spec.choices.map((choice) => (
                      <option key={choice.value} value={choice.value}>
                        {choice.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </fieldset>
          )}
          <label className="block space-y-1 text-sm">
            <span>{t('tournament.format')}</span>
            <select className={FIELD} value={format} onChange={(e) => setFormat(e.target.value as TournamentFormat)}>
              <option value="world">{t('tournament.format.world')}</option>
              <option value="swiss">{t('tournament.format.swiss')}</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1 text-sm">
              <span>{t('tournament.time')}</span>
              <select className={FIELD} value={time} onChange={(e) => setTime(e.target.value as TournamentSettings['time'])}>
                <option value="relaxed">{t('time.relaxed')}</option>
                <option value="normal">{t('time.normal')}</option>
                <option value="fast">{t('time.fast')}</option>
              </select>
            </label>
            <label className="block space-y-1 text-sm">
              <span>{t('tournament.days')}</span>
              <select className={FIELD} value={days} onChange={(e) => setDays(Number(e.target.value))}>
                {[1, 3, 7, 14].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {format === 'world' && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-accent" checked={thirdPlace} onChange={(e) => setThirdPlace(e.target.checked)} />
              {t('tournament.third')}
            </label>
          )}
          <Button type="submit" variant="primary" className="w-full" disabled={busy || !name.trim() || !gameId}>
            🏆 {t('tournament.create')}
          </Button>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
        </form>
      )}
    </Section>
  );
}
