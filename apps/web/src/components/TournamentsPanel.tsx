import type { OptionSpec, Options } from '@brett-und-blatt/engine';
import { EVENING_MINUTE_CHOICES, GROUP_COUNT_CHOICES, TOURNAMENT_MAX_FIELDS, isTournamentGame, type ResultKind, type TournamentFormat, type TournamentMode, type TournamentSettings } from '@brett-und-blatt/online';
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

/** Vorlagen vor Ort: Was gezählt wird, ob Remis geht und wie die Spielstätten heißen. */
const SPORTS: { name: string; result: ResultKind; draws: boolean; fieldLabel: string }[] = [
  { name: 'Tischkicker', result: 'goals', draws: false, fieldLabel: 'Tisch' },
  { name: 'Fußball', result: 'goals', draws: true, fieldLabel: 'Feld' },
  { name: 'Volleyball', result: 'sets', draws: false, fieldLabel: 'Feld' },
  { name: 'Tischtennis', result: 'sets', draws: false, fieldLabel: 'Platte' },
  { name: 'Badminton', result: 'sets', draws: false, fieldLabel: 'Feld' },
  { name: 'Darts', result: 'winner', draws: false, fieldLabel: 'Board' },
  { name: 'Brettspiel', result: 'winner', draws: true, fieldLabel: 'Tisch' },
];

/** Die eigenen Turniere und das Formular zum Anlegen, auf der Seite „Online spielen“. */
export function TournamentsPanel({ profile }: { profile: Profile }) {
  // Bei jedem Zeichnen frisch: Ein übernommener Ausweis kann neue Turniere mitbringen.
  const known = storage.loadTournaments();
  const [creating, setCreating] = useState(false);
  const [mode, setMode] = useState<TournamentMode>('online');
  const [sportPreset, setSportPreset] = useState(SPORTS[0]!.name);
  const [sport, setSport] = useState(SPORTS[0]!.name);
  const [result, setResult] = useState<ResultKind>(SPORTS[0]!.result);
  const [draws, setDraws] = useState(SPORTS[0]!.draws);
  const [fieldLabel, setFieldLabel] = useState(SPORTS[0]!.fieldLabel);
  const [fields, setFields] = useState(2);
  const [groupCount, setGroupCount] = useState(0);
  const [returnRound, setReturnRound] = useState(false);
  const [spectators, setSpectators] = useState(true);
  const [points, setPoints] = useState({ win: 3, draw: 1, loss: 0 });
  const pointsValid = points.win > points.draw && points.draw >= points.loss;
  const [name, setName] = useState('');
  const [gameId, setGameId] = useState(tournamentGames.find((g) => g.id === 'chess')?.id ?? tournamentGames[0]?.id ?? '');
  const [format, setFormat] = useState<TournamentFormat>('world');
  const [time, setTime] = useState<TournamentSettings['time']>('normal');
  /** Tempo: „d7“ = 7 Tage je Phase, „m20“ = Turnierabend mit 20 Minuten je Partie. */
  const [pace, setPace] = useState('d7');
  const [thirdPlace, setThirdPlace] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
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

  const local = mode === 'local';
  /** Vor Ort gespieltes Brett-&-Blatt-Spiel (Stufe 3); leer bei einer Sportart. */
  const localGame = sportPreset.startsWith('game:') ? sportPreset.slice(5) : '';
  const pickSport = (preset: string) => {
    setSportPreset(preset);
    const game = preset.startsWith('game:') ? tournamentGames.find((g) => g.id === preset.slice(5)) : undefined;
    if (game) {
      setSport(game.name);
      setResult('winner');
      setDraws(true);
      setFieldLabel('Tisch');
      return;
    }
    const found = SPORTS.find((item) => item.name === preset);
    if (!found) return setSport('');
    setSport(found.name);
    setResult(found.result);
    setDraws(found.draws);
    setFieldLabel(found.fieldLabel);
  };

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const chosen = Object.fromEntries(visible.filter((spec) => valueOf(spec) !== spec.default).map((spec) => [spec.id, valueOf(spec)]));
      const common = { name: name.trim(), format, thirdPlace: thirdPlace && (format === 'world' || format === 'knockout'), ...(format === 'league' && returnRound ? { returnRound: true } : {}) };
      const settings = local
        ? { ...common, gameId: localGame, time: 'normal' as const, days: 1, isPublic: false, mode, sport: sport.trim(), result, draws, fieldLabel: fieldLabel.trim() || 'Tisch', spectators, fields, points, ...(format === 'world' && groupCount ? { groupCount } : {}) }
        : { ...common, gameId, time, isPublic, options: chosen, ...(pace.startsWith('m') ? { days: 1, minutes: Number(pace.slice(1)) } : { days: Number(pace.slice(1)) }) };
      const code = await createTournament(settings, profile);
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
          <fieldset className="space-y-1 text-sm">
            <legend className="mb-1">{t('tournament.mode')}</legend>
            <div className="grid grid-cols-2 gap-2">
              {(['online', 'local'] as const).map((m) => (
                <Button key={m} type="button" aria-pressed={mode === m} variant={mode === m ? 'primary' : 'secondary'} className="text-sm" onClick={() => setMode(m)}>
                  {t(`tournament.mode.${m}`)}
                </Button>
              ))}
            </div>
          </fieldset>
          {local ? (
            <>
              <p className="text-sm text-muted">{t('tournament.localHint')}</p>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1 text-sm">
                  <span>{t('tournament.sportPreset')}</span>
                  <select className={FIELD} value={sportPreset} onChange={(e) => pickSport(e.target.value)}>
                    {SPORTS.map((item) => (
                      <option key={item.name} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                    <option value="">{t('tournament.sportOwn')}</option>
                    <optgroup label={t('tournament.sportGames')}>
                      {tournamentGames.map((game) => (
                        <option key={game.id} value={`game:${game.id}`}>
                          {game.emoji} {game.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </label>
                <label className="block space-y-1 text-sm">
                  <span>{t('tournament.sport')}</span>
                  <input className={FIELD} required maxLength={30} value={sport} disabled={localGame !== ''} onChange={(e) => setSport(e.target.value)} />
                </label>
                <label className="block space-y-1 text-sm">
                  <span>{t('tournament.result')}</span>
                  <select className={FIELD} value={result} onChange={(e) => setResult(e.target.value as ResultKind)}>
                    {(['winner', 'goals', 'sets', 'points'] as const).map((kind) => (
                      <option key={kind} value={kind}>
                        {t(`tournament.result.${kind}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1 text-sm">
                  <span>{t('tournament.fieldLabel')}</span>
                  <input className={FIELD} maxLength={12} value={fieldLabel} onChange={(e) => setFieldLabel(e.target.value)} />
                </label>
              </div>
              <label className="block space-y-1 text-sm">
                <span>{t('tournament.fieldCount')}</span>
                <input className={FIELD} type="number" inputMode="numeric" min={0} max={TOURNAMENT_MAX_FIELDS} value={fields} onChange={(e) => setFields(Math.max(0, Math.min(TOURNAMENT_MAX_FIELDS, Math.floor(Number(e.target.value) || 0))))} />
                <span className="text-xs text-muted">{t('tournament.fieldCountHint')}</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-accent" checked={draws} onChange={(e) => setDraws(e.target.checked)} />
                {t('tournament.draws')}
              </label>
            </>
          ) : (
          <>
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
          </>
          )}
          <label className="block space-y-1 text-sm">
            <span>{t('tournament.format')}</span>
            <select className={FIELD} value={format} onChange={(e) => setFormat(e.target.value as TournamentFormat)}>
              <option value="world">{t('tournament.format.world')}</option>
              <option value="knockout">{t('tournament.format.knockout')}</option>
              <option value="double">{t('tournament.format.double')}</option>
              <option value="swiss">{t('tournament.format.swiss')}</option>
              <option value="league">{t('tournament.format.league')}</option>
            </select>
          </label>
          {format === 'league' && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-accent" checked={returnRound} onChange={(e) => setReturnRound(e.target.checked)} />
              {t('tournament.returnRound')}
            </label>
          )}
          {local && format === 'world' && (
            <label className="block space-y-1 text-sm">
              <span>{t('tournament.groupCount')}</span>
              <select className={FIELD} value={groupCount} onChange={(e) => setGroupCount(Number(e.target.value))}>
                <option value={0}>{t('tournament.groupCount.auto')}</option>
                {GROUP_COUNT_CHOICES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          )}
          {local && format !== 'knockout' && format !== 'double' && (
            <fieldset className="space-y-1 text-sm">
              <legend className="mb-1">{t('tournament.points')}</legend>
              <div className="grid grid-cols-3 gap-2">
                {(['win', 'draw', 'loss'] as const).map((kind) => (
                  <label key={kind} className="block space-y-1 text-xs">
                    <span>{t(`tournament.points.${kind}`)}</span>
                    <input
                      className={FIELD}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={10}
                      value={points[kind]}
                      onChange={(e) => setPoints({ ...points, [kind]: Math.max(0, Math.min(10, Math.floor(Number(e.target.value) || 0))) })}
                    />
                  </label>
                ))}
              </div>
              {!pointsValid && <span className="text-xs text-danger">{t('tournament.pointsInvalid')}</span>}
            </fieldset>
          )}
          {!local && (
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
              <span>{t('tournament.pace')}</span>
              <select className={FIELD} value={pace} onChange={(e) => setPace(e.target.value)}>
                <optgroup label={t('tournament.paceDays')}>
                  {[1, 3, 7, 14].map((n) => (
                    <option key={n} value={`d${n}`}>
                      {t(n === 1 ? 'tournament.paceDay' : 'tournament.paceDaysN', { n })}
                    </option>
                  ))}
                </optgroup>
                <optgroup label={t('tournament.paceEvening')}>
                  {EVENING_MINUTE_CHOICES.map((n) => (
                    <option key={n} value={`m${n}`}>
                      {t('tournament.paceMinutes', { n })}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
          </div>
          )}
          {(format === 'world' || format === 'knockout') && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-accent" checked={thirdPlace} onChange={(e) => setThirdPlace(e.target.checked)} />
              {t('tournament.third')}
            </label>
          )}
          {local ? (
            <>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-accent" checked={spectators} onChange={(e) => setSpectators(e.target.checked)} />
                {t('tournament.spectators')}
              </label>
              <p className="text-xs text-muted">{t('tournament.namesHint')}</p>
            </>
          ) : (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-accent" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
              {t('tournament.public')}
            </label>
          )}
          <Button type="submit" variant="primary" className="w-full" disabled={busy || !name.trim() || (local ? !sport.trim() || !pointsValid : !gameId)}>
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
