import type { OptionSpec, Options } from '@brett-und-blatt/engine';
import { BEST_OF_CHOICES, DISCIPLINES_MAX, DISCIPLINES_MIN, EVENING_MINUTE_CHOICES, GROUP_COUNT_CHOICES, TABLE_ROUND_CHOICES, TABLE_SIZE_MAX, TABLE_SIZE_MIN, BEST_THIRD_GROUPS, DYP_ROUND_CHOICES, LEAGUE_ONLINE_MAX_PLAYERS, parseFieldCount, parsePointRules, parseTournamentSettings, LEAGUE_DAY_CHOICES, LIVES_CHOICES, TEAM_SIZE_CHOICES, TOURNAMENT_MAX_FIELDS, isTableGame, isTeamGame, isTournamentGame, validTeamSize, type ResultKind, type TournamentFormat, type TournamentMode, type TournamentSettings } from '@brett-und-blatt/online';
import { useEffect, useState } from 'react';
import { t } from '../i18n';
import { passChanged } from '../lib/playerPass';
import { games, loadGame } from '../lib/registry';
import { navigate, paths } from '../lib/router';
import { storage, type KnownTournament, type Profile, type TournamentTemplate } from '../lib/storage';
import { seriesCsv, seriesStandings, type PointScheme, type SeriesRow } from '../lib/series';
import { createOfflineTournament, isOfflineCode } from '../lib/offlineTournament';
import { findGame as findGameInfo } from '../lib/registry';
import { createTournament, deleteTournament, fetchTournamentView, tournamentExists } from '../lib/tournament';
import { Button, Section } from './controls';

const tournamentGames = games.filter(isTournamentGame).sort((a, b) => a.name.localeCompare(b.name, 'de'));
/** Spiele für Tischrunden: drei und mehr Plätze (Stufe 3 Teil 3). */
const tableGames = games.filter(isTableGame).sort((a, b) => a.name.localeCompare(b.name, 'de'));
/** Spiele mit zwei festen Teams (Stufe 3 Teil 4): online als Turnier mit Teams. */
const teamGames = games.filter(isTeamGame).sort((a, b) => a.name.localeCompare(b.name, 'de'));
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
  const [, setListVersion] = useState(0);
  const [creating, setCreating] = useState(false);
  /** Assistent: 0 Was (Name, Spiel), 1 Wie (Form, Tempo, Regeln), 2 Wer (Sichtbarkeit). */
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<TournamentMode>('online');
  const [sportPreset, setSportPreset] = useState(SPORTS[0]!.name);
  const [sport, setSport] = useState(SPORTS[0]!.name);
  const [result, setResult] = useState<ResultKind>(SPORTS[0]!.result);
  const [draws, setDraws] = useState(SPORTS[0]!.draws);
  const [fieldLabel, setFieldLabel] = useState(SPORTS[0]!.fieldLabel);
  const [fields, setFields] = useState(2);
  const [groupCount, setGroupCount] = useState(0);
  /** Setzliste (Stufe 4, vor Ort): Die Reihenfolge der Teilnehmerliste ist die Setzung. */
  const [seeded, setSeeded] = useState(false);
  /** Ohne Netz leiten (Stufe 6): Das Turnier liegt nur auf diesem Gerät und wird später mit dem Server abgeglichen. */
  const [offline, setOffline] = useState(false);
  /** Anmeldung mit Freigabe und Check-in (Stufe 5). */
  const [approval, setApproval] = useState(false);
  const [checkin, setCheckin] = useState(false);
  /** Beste Dritte (Stufe 4, WM-Form vor Ort). */
  const [bestThirds, setBestThirds] = useState(false);
  /** Liga nach Kalender (Stufe 4): Beginn des ersten Spieltags und Abstand in Tagen. */
  const [leagueDate, setLeagueDate] = useState('');
  const [leagueDays, setLeagueDays] = useState(7);
  /** Last One Standing (Stufe 4): Leben je Teilnehmer. */
  const [lives, setLives] = useState(2);
  const [returnRound, setReturnRound] = useState(false);
  /** Spieleabend (Stufe 3 Teil 2): mehrere Disziplinen, je Spieltag eine. */
  const [multi, setMulti] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [localDisciplines, setLocalDisciplines] = useState('');
  const [wishes, setWishes] = useState(true);
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
  /** Platzierungsspiele für alle Plätze (Stufe 4). */
  const [placements, setPlacements] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [specs, setSpecs] = useState<OptionSpec[]>([]);
  const [options, setOptions] = useState<Options>({});
  const [busy, setBusy] = useState(false);
  /** Tischrunden: Wunschgröße der Tische, Rundenzahl, vor Ort ob wenig Punkte gewinnen. */
  const [tableSize, setTableSize] = useState(4);
  const [rounds, setRounds] = useState(4);
  const [lowWins, setLowWins] = useState(false);
  /** Best of N (Stufe 3 Teil 5): Partien je Begegnung, eigens für die K.-o.-Phase (0 = wie oben). */
  const [bestOf, setBestOf] = useState(1);
  const [bestOfKo, setBestOfKo] = useState(0);
  const tables = format === 'tables';
  // Zufallspartner gibt es nur vor Ort.
  useEffect(() => {
    if (mode !== 'local' && format === 'dyp') setFormat('world');
  }, [mode, format]);
  const gameList = tables ? tableGames : mode === 'local' ? tournamentGames : [...tournamentGames, ...teamGames].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  /** Teams: Spieler je Team beim gewählten Teamspiel (nur online). */
  const [teamSize, setTeamSize] = useState(2);
  const teamGame = mode !== 'local' && !tables && !(format === 'league' && multi) ? teamGames.find((g) => g.id === gameId) : undefined;
  const teamChoices: number[] = teamGame ? TEAM_SIZE_CHOICES.filter((n) => validTeamSize(teamGame, n)) : [];
  // Beim Wechsel der Form ein passendes Spiel wählen.
  useEffect(() => {
    if (gameList.some((g) => g.id === gameId)) return;
    setGameId((gameList.find((g) => g.id === (tables ? 'skat' : 'chess')) ?? gameList[0])?.id ?? '');
    if (sportPreset.startsWith('game:') && !gameList.some((g) => `game:${g.id}` === sportPreset)) pickSport(SPORTS[0]!.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables]);

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
  // Bei Teamspielen mit Bedingung (Kreuzbinokel) legt das Turnier die Option selbst fest.
  const forcedOption = teamGame?.teams?.when?.option;
  const visible = specs.filter((spec) => spec.id !== forcedOption && (!spec.when || Object.entries(spec.when).every(([id, values]) => values.includes(options[id] ?? specs.find((s) => s.id === id)?.default ?? ''))));
  const [error, setError] = useState<string | null>(null);

  const local = mode === 'local';
  const localDisciplineCount = new Set(localDisciplines.split('\n').map((line) => line.trim()).filter(Boolean)).size;
  /** Vor Ort gespieltes Brett-&-Blatt-Spiel (Stufe 3); leer bei einer Sportart. */
  const localGame = sportPreset.startsWith('game:') ? sportPreset.slice(5) : '';
  /** Mögliche Tischgrößen: die Plätze des Spiels, sonst 3 bis 8. */
  const sizeGame = local ? (localGame ? gameList.find((g) => g.id === localGame) : undefined) : gameList.find((g) => g.id === gameId);
  const sizeMin = Math.max(TABLE_SIZE_MIN, sizeGame?.players.min ?? TABLE_SIZE_MIN);
  const sizeMax = Math.min(TABLE_SIZE_MAX, sizeGame?.players.max ?? TABLE_SIZE_MAX);
  const sizeChoices = Array.from({ length: Math.max(0, sizeMax - sizeMin + 1) }, (_, i) => sizeMin + i);
  const size = Math.min(sizeMax, Math.max(sizeMin, tableSize));
  const pickSport = (preset: string) => {
    setSportPreset(preset);
    const game = preset.startsWith('game:') ? gameList.find((g) => g.id === preset.slice(5)) : undefined;
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
      const series = !tables && !teamGame && (!local || result === 'winner') ? { ...(bestOf > 1 ? { bestOf } : {}), ...(format === 'world' && bestOfKo ? { bestOfKo } : {}) } : {};
      const tableSettings = tables ? { tableSize: size, rounds, ...(local && lowWins ? { lowWins: true } : {}) } : {};
      const common = { name: name.trim(), format, ...(format === 'lives' ? { lives } : {}), ...(format === 'dyp' ? { rounds } : {}), ...(checkin ? { checkin: true } : {}), ...(approval && !local ? { approval: true } : {}), thirdPlace: thirdPlace && (format === 'world' || format === 'knockout'), ...(placements && (format === 'world' || format === 'knockout') ? { placements: true } : {}), ...(format === 'league' && returnRound ? { returnRound: true } : {}), ...(format === 'league' && leagueDate && !Number.isNaN(new Date(leagueDate).getTime()) ? { leagueStart: new Date(leagueDate).getTime(), leagueDays } : {}), ...tableSettings, ...series };
      const many = format === 'league' && multi;
      const localList = localDisciplines.split('\n').map((line) => line.trim()).filter(Boolean);
      const settings = local
        ? { ...common, gameId: many ? '' : localGame, time: 'normal' as const, days: 1, isPublic: false, mode, sport: many ? t('tournament.multiSport') : sport.trim(), ...(many ? { disciplines: localList } : {}), result, draws, fieldLabel: fieldLabel.trim() || 'Tisch', spectators, fields, points, ...(format === 'world' && groupCount ? { groupCount } : {}), ...(format === 'world' && bestThirds && (BEST_THIRD_GROUPS as readonly number[]).includes(groupCount) ? { bestThirds: true } : {}), ...(seeded && (format === 'knockout' || format === 'double' || format === 'world') ? { seeded: true } : {}) }
        : { ...common, ...(teamGame ? { teamSize: teamChoices.includes(teamSize) ? teamSize : teamChoices[0] } : {}), gameId: many ? picked[0]! : gameId, time, isPublic, options: many ? {} : chosen, ...(many ? { disciplines: picked, wishes } : {}), ...(pace.startsWith('m') ? { days: 1, minutes: Number(pace.slice(1)) } : { days: Number(pace.slice(1)) }) };
      let code: string;
      if (local && offline) {
        // Ohne Netz: derselbe Turnierkern im Browser, geprüft wie auf dem Server.
        const parsed = parseTournamentSettings(settings, (id) => {
          const info = findGameInfo(id);
          return info ? { info, options: [] } : undefined;
        });
        const created = parsed ? createOfflineTournament(parsed, profile, parseFieldCount(settings), parsePointRules(settings)) : null;
        if (!created) throw new Error('offline');
        code = created;
      } else code = await createTournament(settings, profile);
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
      <SeriesPanel profile={profile} known={known} />
      <TemplateList
        profile={profile}
        onChanged={() => {
          setListVersion((n) => n + 1);
          passChanged();
        }}
      />
      {known.length > 0 && (
        <TournamentList
          known={known}
          profile={profile}
          onChanged={() => {
            setListVersion((n) => n + 1);
            passChanged();
          }}
        />
      )}
      {!creating ? (
        <Button className="w-full" onClick={() => setCreating(true)}>
          ➕ {t('tournament.create')}
        </Button>
      ) : (
        <form
          className="space-y-3"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (step < 2) setStep(step + 1);
            else create();
          }}
        >
          <ol className="grid grid-cols-3 gap-2 text-center text-xs font-semibold" aria-label="Schritte">
            {['1 Was?', '2 Wie?', '3 Wer?'].map((label, i) => (
              <li key={label} aria-current={step === i ? 'step' : undefined} className={`rounded-lg px-2 py-1.5 ${step === i ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-muted'}`}>
                {label}
              </li>
            ))}
          </ol>
          <div className="space-y-3" hidden={step !== 0}>
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
                      {gameList.map((game) => (
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
          ) : format === 'league' && multi ? null : (
          <>
          <label className="block space-y-1 text-sm">
            <span>{t('tournament.game')}</span>
            <select className={FIELD} value={gameId} onChange={(e) => setGameId(e.target.value)}>
              {gameList.map((game) => (
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
          </div>
          <div className="space-y-3" hidden={step !== 1}>
          <label className="block space-y-1 text-sm">
            <span>{t('tournament.format')}</span>
            <select className={FIELD} value={format} onChange={(e) => setFormat(e.target.value as TournamentFormat)}>
              <option value="world">{t('tournament.format.world')}</option>
              <option value="knockout">{t('tournament.format.knockout')}</option>
              <option value="double">{t('tournament.format.double')}</option>
              <option value="swiss">{t('tournament.format.swiss')}</option>
              <option value="league">{t('tournament.format.league')}</option>
              <option value="tables">{t('tournament.format.tables')}</option>
              <option value="lives">{t('tournament.format.lives')}</option>
              {local && <option value="dyp">{t('tournament.format.dyp')}</option>}
            </select>
          </label>
          {tables && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1 text-sm">
                <span>{t('tournament.tableSize')}</span>
                <select className={FIELD} value={size} onChange={(e) => setTableSize(Number(e.target.value))}>
                  {sizeChoices.map((n) => (
                    <option key={n} value={n}>
                      {t('tournament.tableSizeN', { n })}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1 text-sm">
                <span>{t('tournament.tableRounds')}</span>
                <select className={FIELD} value={rounds} onChange={(e) => setRounds(Number(e.target.value))}>
                  {TABLE_ROUND_CHOICES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <p className="col-span-2 text-xs text-muted">{t('tournament.tablesHint')}</p>
              {local && (
                <label className="col-span-2 flex items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4 accent-accent" checked={lowWins} onChange={(e) => setLowWins(e.target.checked)} />
                  {t('tournament.lowWins')}
                </label>
              )}
            </div>
          )}
          {teamGame && (
            <label className="block space-y-1 text-sm">
              <span>{t('tournament.teamSize')}</span>
              <select className={FIELD} value={teamChoices.includes(teamSize) ? teamSize : teamChoices[0]} onChange={(e) => setTeamSize(Number(e.target.value))}>
                {teamChoices.map((n) => (
                  <option key={n} value={n}>
                    {t('tournament.teamSizeN', { n })}
                  </option>
                ))}
              </select>
              <span className="block text-xs text-muted">{t('tournament.teamHint')}</span>
            </label>
          )}
          {!tables && !teamGame && (!local || result === 'winner') && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1 text-sm">
                <span>{t('tournament.bestOf')}</span>
                <select className={FIELD} value={bestOf} onChange={(e) => setBestOf(Number(e.target.value))}>
                  {BEST_OF_CHOICES.map((n) => (
                    <option key={n} value={n}>
                      {n === 1 ? t('tournament.bestOfOne') : t('tournament.bestOfN', { n })}
                    </option>
                  ))}
                </select>
              </label>
              {format === 'world' && (
                <label className="block space-y-1 text-sm">
                  <span>{t('tournament.bestOfKo')}</span>
                  <select className={FIELD} value={bestOfKo} onChange={(e) => setBestOfKo(Number(e.target.value))}>
                    <option value={0}>{t('tournament.bestOfKoSame')}</option>
                    {BEST_OF_CHOICES.map((n) => (
                      <option key={n} value={n}>
                        {n === 1 ? t('tournament.bestOfOne') : t('tournament.bestOfN', { n })}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {(bestOf > 1 || bestOfKo > 1) && <p className="col-span-2 text-xs text-muted">{t('tournament.bestOfHint')}</p>}
            </div>
          )}
          {format === 'league' && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-accent" checked={returnRound} onChange={(e) => setReturnRound(e.target.checked)} />
              {t('tournament.returnRound')}
            </label>
          )}
          {format === 'league' && !local && <p className="text-xs text-muted">{t('tournament.leagueLimit', { n: LEAGUE_ONLINE_MAX_PLAYERS })}</p>}
          {format === 'league' && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1 text-sm">
                <span>{t('tournament.leagueStart')}</span>
                <input className={FIELD} type="datetime-local" value={leagueDate} onChange={(e) => setLeagueDate(e.target.value)} />
              </label>
              <label className="block space-y-1 text-sm">
                <span>{t('tournament.leagueDays')}</span>
                <select className={FIELD} value={leagueDays} onChange={(e) => setLeagueDays(Number(e.target.value))} disabled={!leagueDate}>
                  {LEAGUE_DAY_CHOICES.map((n) => (
                    <option key={n} value={n}>
                      {t('tournament.leagueDaysN', { n })}
                    </option>
                  ))}
                </select>
              </label>
              <p className="col-span-2 text-xs text-muted">{t('tournament.leagueHint')}</p>
            </div>
          )}
          {format === 'league' && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-accent" checked={multi} onChange={(e) => setMulti(e.target.checked)} />
              <span>
                {t('tournament.multi')}
                <span className="block text-xs text-muted">{t('tournament.multiHint')}</span>
              </span>
            </label>
          )}
          {format === 'league' && multi && !local && (
            <fieldset className="space-y-2 rounded-xl border border-line p-3">
              <legend className="px-1 text-sm">{t('tournament.disciplines', { n: picked.length })}</legend>
              <div className="grid max-h-64 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
                {tournamentGames.map((game) => (
                  <label key={game.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-accent"
                      checked={picked.includes(game.id)}
                      disabled={!picked.includes(game.id) && picked.length >= DISCIPLINES_MAX}
                      onChange={(e) => setPicked(e.target.checked ? [...picked, game.id] : picked.filter((id) => id !== game.id))}
                    />
                    {game.emoji} {game.name}
                  </label>
                ))}
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-accent" checked={wishes} onChange={(e) => setWishes(e.target.checked)} />
                <span>
                  {t('tournament.wishes')}
                  <span className="block text-xs text-muted">{t('tournament.wishesHint')}</span>
                </span>
              </label>
            </fieldset>
          )}
          {format === 'league' && multi && local && (
            <label className="block space-y-1 text-sm">
              <span>{t('tournament.disciplinesLocal')}</span>
              <textarea className="min-h-24 w-full rounded-xl border border-line bg-surface px-3 py-2" rows={4} value={localDisciplines} onChange={(e) => setLocalDisciplines(e.target.value)} />
            </label>
          )}
          {local && format === 'world' && (
            <label className="block space-y-1 text-sm">
              <span>{t('tournament.groupCount')}</span>
              <select className={FIELD} value={groupCount} onChange={(e) => setGroupCount(Number(e.target.value))}>
                <option value={0}>{t('tournament.groupCount.auto')}</option>
                {(bestThirds ? [...BEST_THIRD_GROUPS] : [...GROUP_COUNT_CHOICES]).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          )}
          {local && format === 'world' && (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-accent"
                checked={bestThirds}
                onChange={(e) => {
                  setBestThirds(e.target.checked);
                  setGroupCount(0);
                }}
              />
              <span>
                {t('tournament.bestThirds')}
                <span className="block text-xs text-muted">{t('tournament.bestThirdsHint')}</span>
              </span>
            </label>
          )}
          {format === 'dyp' && (
            <label className="block space-y-1 text-sm">
              <span>{t('tournament.rounds')}</span>
              <select className={FIELD} value={DYP_ROUND_CHOICES.includes(rounds as 4) ? rounds : 4} onChange={(e) => setRounds(Number(e.target.value))}>
                {DYP_ROUND_CHOICES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <span className="block text-xs text-muted">{t('tournament.dypHint')}</span>
            </label>
          )}
          {format === 'lives' && (
            <label className="block space-y-1 text-sm">
              <span>{t('tournament.lives')}</span>
              <select className={FIELD} value={lives} onChange={(e) => setLives(Number(e.target.value))}>
                {LIVES_CHOICES.map((n) => (
                  <option key={n} value={n}>
                    {t('tournament.livesN', { n })}
                  </option>
                ))}
              </select>
              <span className="block text-xs text-muted">{t('tournament.livesHint')}</span>
            </label>
          )}
          {local && (format === 'knockout' || format === 'double' || format === 'world') && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-accent" checked={seeded} onChange={(e) => setSeeded(e.target.checked)} />
              <span>
                {t('tournament.seeded')}
                <span className="block text-xs text-muted">{t('tournament.seededHint')}</span>
              </span>
            </label>
          )}
          {local && format !== 'knockout' && format !== 'double' && !tables && (
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
          {(format === 'world' || format === 'knockout') && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-accent" checked={placements} onChange={(e) => setPlacements(e.target.checked)} />
              <span>
                {t('tournament.placementsOption')}
                <span className="block text-xs text-muted">{t('tournament.placementsHint')}</span>
              </span>
            </label>
          )}
          </div>
          <div className="space-y-3" hidden={step !== 2}>
          {!local && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-accent" checked={approval} onChange={(e) => setApproval(e.target.checked)} />
              <span>
                {t('tournament.approval')}
                <span className="block text-xs text-muted">{t('tournament.approvalHint')}</span>
              </span>
            </label>
          )}
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-accent" checked={checkin} onChange={(e) => setCheckin(e.target.checked)} />
            <span>
              {t('tournament.checkin')}
              <span className="block text-xs text-muted">{t('tournament.checkinHint')}</span>
            </span>
          </label>
          {local ? (
            <>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-accent" checked={offline} onChange={(e) => setOffline(e.target.checked)} />
                <span>
                  📴 {t('tournament.offline')}
                  <span className="block text-xs text-muted">{t('tournament.offlineHint')}</span>
                </span>
              </label>
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
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" disabled={step === 0} onClick={() => setStep(step - 1)}>
              ‹ Zurück
            </Button>
            {step < 2 ? (
              <Button type="submit" variant="primary" disabled={step === 0 && (!name.trim() || (local ? !sport.trim() : !gameId && !(format === 'league' && multi)))}>
                Weiter ›
              </Button>
            ) : (
              <span />
            )}
          </div>
          {step === 2 && (
          <Button type="submit" variant="primary" className="w-full" disabled={busy || !name.trim() || (format === 'league' && multi ? (local ? localDisciplineCount : picked.length) < DISCIPLINES_MIN || (local && localDisciplineCount > DISCIPLINES_MAX) : false) || (local ? !sport.trim() || !pointsValid : !gameId)}>
            🏆 {t('tournament.create')}
          </Button>
          )}
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

/** Merkliste der Turniere: öffnen, einzeln entfernen, im Aufräum-Modus mehrere auf einmal entfernen oder löschen. */
function TournamentList({ known, profile, onChanged }: { known: KnownTournament[]; profile: Profile; onChanged: () => void }) {
  const [tidy, setTidy] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const toggle = (code: string) => setPicked((list) => (list.includes(code) ? list.filter((c) => c !== code) : [...list, code]));
  const leave = () => {
    setTidy(false);
    setPicked([]);
    setNote(null);
  };
  const archive = (code: string, on: boolean) => {
    storage.updateTournament(code, { archived: on });
    onChanged();
  };
  const archived = known.filter((item) => item.archived);
  const removeLocal = (codes: string[]) => {
    for (const code of codes) storage.forgetTournament(code);
    setPicked((list) => list.filter((c) => !codes.includes(c)));
    onChanged();
  };
  const removePicked = () => {
    if (picked.length === 0 || !window.confirm(t('tournament.tidyRemoveConfirm', { n: picked.length }))) return;
    removeLocal(picked);
  };
  const deletePicked = async () => {
    if (picked.length === 0 || !window.confirm(t('tournament.tidyDeleteConfirm', { n: picked.length }))) return;
    setBusy(true);
    const counts = { deleted: 0, denied: 0, failed: 0 };
    const done: string[] = [];
    for (const code of picked) {
      const outcome = await deleteTournament(code, profile);
      if (outcome === 'deleted' || outcome === 'gone') {
        counts.deleted++;
        done.push(code);
      } else counts[outcome]++;
    }
    removeLocal(done);
    setNote(t('tournament.tidyResult', counts));
    setBusy(false);
  };
  const removeMissing = async () => {
    setBusy(true);
    const missing: string[] = [];
    for (const item of known) if ((await tournamentExists(item.code)) === false) missing.push(item.code);
    removeLocal(missing);
    setNote(t('tournament.tidyMissingResult', { n: missing.length }));
    setBusy(false);
  };
  return (
    <div className="space-y-2">
      <ul className="space-y-1">
        {known.filter((item) => !item.archived || tidy).map((item) => (
          <li key={item.code} className="flex items-center gap-1">
            {tidy && <input type="checkbox" className="h-5 w-5 shrink-0 accent-accent" aria-label={item.name} checked={picked.includes(item.code)} onChange={() => toggle(item.code)} />}
            <Button className="min-w-0 flex-1 justify-start" onClick={() => (tidy ? toggle(item.code) : navigate(paths.tournament(item.code)))}>
              <span className="truncate">
                {isOfflineCode(item.code) ? '📴' : '🏆'} {item.name}
                {item.leader ? ' · 👑' : ''}
                {item.phase === 'finished' ? ' · ✔️' : ''}
              </span>
            </Button>
            {!tidy && (
              <>
                <Button variant="ghost" className="px-3" aria-label={`${t('tournament.archive')}: ${item.name}`} title={t('tournament.archive')} onClick={() => archive(item.code, true)}>
                  🗄️
                </Button>
                <Button variant="ghost" className="px-3" aria-label={`${t('tournament.removeFromList')}: ${item.name}`} title={t('tournament.removeFromList')} onClick={() => removeLocal([item.code])}>
                  ✕
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
      {!tidy && archived.length > 0 && (
        <details className="rounded-xl border border-line p-2">
          <summary className="cursor-pointer text-sm">🗄️ {t('tournament.archived', { n: archived.length })}</summary>
          <ul className="mt-2 space-y-1">
            {archived.map((item) => (
              <li key={item.code} className="flex items-center gap-1">
                <Button className="min-w-0 flex-1 justify-start" onClick={() => navigate(paths.tournament(item.code))}>
                  <span className="truncate">🏆 {item.name}</span>
                </Button>
                <Button variant="ghost" className="px-3" aria-label={`${t('tournament.unarchive')}: ${item.name}`} title={t('tournament.unarchive')} onClick={() => archive(item.code, false)}>
                  ↩
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}
      {tidy ? (
        <div className="space-y-2 rounded-xl border border-line p-2">
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" className="text-sm" disabled={busy} onClick={() => setPicked(known.map((k) => k.code))}>
              {t('tournament.tidyAll')}
            </Button>
            <Button type="button" className="text-sm" disabled={busy} onClick={() => setPicked(known.filter((k) => k.phase === 'finished').map((k) => k.code))}>
              {t('tournament.tidyFinished')}
            </Button>
          </div>
          <Button type="button" className="w-full text-sm" disabled={busy} onClick={removeMissing}>
            {t('tournament.tidyMissing')}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" className="text-sm" disabled={busy || picked.length === 0} onClick={removePicked}>
              {t('tournament.tidyRemove', { n: picked.length })}
            </Button>
            <Button type="button" variant="primary" className="text-sm" disabled={busy || picked.length === 0} onClick={deletePicked}>
              {t('tournament.tidyDelete', { n: picked.length })}
            </Button>
          </div>
          {busy && <p className="text-sm text-muted">{t('tournament.tidyBusy')}</p>}
          {note && <p role="status" className="text-sm text-muted">{note}</p>}
          <Button type="button" variant="ghost" className="w-full text-sm" onClick={leave}>
            {t('tournament.tidyDone')}
          </Button>
        </div>
      ) : (
        known.length > 1 && (
          <Button type="button" variant="ghost" className="w-full text-sm" onClick={() => setTidy(true)}>
            🧹 {t('tournament.tidy')}
          </Button>
        )
      )}
    </div>
  );
}

/** Gemerkte Vorlagen (Stufe 5): ein Tipp legt ein neues Turnier mit denselben Einstellungen an. */
function TemplateList({ profile, onChanged }: { profile: Profile; onChanged: () => void }) {
  const templates = storage.loadTemplates();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (templates.length === 0) return null;
  const create = async (template: TournamentTemplate) => {
    const name = window.prompt(t('tournament.templateName'), template.name)?.trim();
    if (!name) return;
    setBusy(template.name);
    setError(null);
    try {
      const code = await createTournament({ ...(template.settings as unknown as TournamentSettings), name: name.slice(0, 40) }, profile);
      storage.rememberTournament({ code, name: name.slice(0, 40) });
      onChanged();
      navigate(paths.tournament(code));
    } catch {
      setError(t('online.serverError'));
    } finally {
      setBusy(null);
    }
  };
  return (
    <details className="rounded-xl border border-line p-2">
      <summary className="cursor-pointer text-sm">📑 {t('tournament.templates', { n: templates.length })}</summary>
      <ul className="mt-2 space-y-1">
        {templates.map((template) => (
          <li key={template.name} className="flex items-center gap-1">
            <Button className="min-w-0 flex-1 justify-start" disabled={busy !== null} onClick={() => create(template)}>
              <span className="truncate">➕ {template.name}</span>
            </Button>
            <Button
              variant="ghost"
              className="px-3"
              aria-label={`${t('tournament.templateDelete')}: ${template.name}`}
              title={t('tournament.templateDelete')}
              onClick={() => {
                storage.deleteTemplate(template.name);
                onChanged();
              }}
            >
              ✕
            </Button>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </details>
  );
}

/**
 * Serie auswerten (Stufe 5): Mehrere abgeschlossene Turniere ergeben eine gemeinsame Rangliste mit Punkten nach Platz
 * und Elo. Die Auswertung läuft hier im Browser aus den Sichten der gewählten Turniere; nichts wird gespeichert.
 */
function SeriesPanel({ profile, known }: { profile: Profile; known: KnownTournament[] }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [scheme, setScheme] = useState<PointScheme>('linear');
  const [rows, setRows] = useState<SeriesRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  if (known.length < 2) return null;
  const run = async () => {
    setBusy(true);
    setNote(null);
    setRows(null);
    const views = [];
    let skipped = 0;
    // In der Reihenfolge der Auswahl; so lässt sich die zeitliche Folge bestimmen.
    for (const code of picked) {
      const view = await fetchTournamentView(code, profile);
      if (view && view.phase === 'finished' && view.ranking.length > 0) views.push(view);
      else skipped++;
    }
    setRows(
      seriesStandings(
        views.map((view) => ({ name: view.settings.name, players: view.players, matches: view.matches.map((m) => ({ stage: m.stage, id: m.id, slots: m.slots, outcome: m.outcome })), ranking: view.ranking })),
        scheme,
      ),
    );
    setNote(skipped > 0 ? t('tournament.seriesSkipped', { n: skipped }) : null);
    setBusy(false);
  };
  const toggle = (code: string) => setPicked((list) => (list.includes(code) ? list.filter((c) => c !== code) : [...list, code]));
  return (
    <details className="rounded-xl border border-line p-2">
      <summary className="cursor-pointer text-sm">📈 {t('tournament.series')}</summary>
      <div className="mt-2 space-y-2">
        <p className="text-xs text-muted">{t('tournament.seriesAbout')}</p>
        <ul className="space-y-1">
          {[...known].reverse().map((item) => (
            <li key={item.code}>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-accent" checked={picked.includes(item.code)} onChange={() => toggle(item.code)} />
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                {picked.includes(item.code) && <span className="text-xs text-muted">{picked.indexOf(item.code) + 1}.</span>}
              </label>
            </li>
          ))}
        </ul>
        <label className="block space-y-1 text-sm">
          <span>{t('tournament.seriesScheme')}</span>
          <select className={FIELD} value={scheme} onChange={(e) => setScheme(e.target.value as PointScheme)}>
            <option value="linear">{t('tournament.seriesLinear')}</option>
            <option value="f1">{t('tournament.seriesF1')}</option>
          </select>
        </label>
        <Button className="w-full" variant="primary" disabled={busy || picked.length === 0} onClick={run}>
          {busy ? t('tournament.tidyBusy') : t('tournament.seriesRun', { n: picked.length })}
        </Button>
        {note && <p role="status" className="text-sm text-muted">{note}</p>}
        {rows && rows.length > 0 && (
          <div className="space-y-2">
            <table className="w-full table-fixed text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="w-7 text-left">#</th>
                  <th className="text-left">{t('tournament.table.player')}</th>
                  <th className="w-10">{t('tournament.seriesCount')}</th>
                  <th className="w-12">{t('tournament.table.points')}</th>
                  <th className="w-12">Elo</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.name} className="border-t border-line">
                    <td className="py-1 tabular-nums">{i + 1}</td>
                    <td className="truncate py-1">{row.name}</td>
                    <td className="text-center tabular-nums">{row.tournaments}</td>
                    <td className="text-center font-bold tabular-nums">{row.points}</td>
                    <td className="text-center tabular-nums">{row.elo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Button className="w-full text-sm" onClick={() => navigator.clipboard?.writeText(seriesCsv(rows))}>
              {t('tournament.seriesCopy')}
            </Button>
          </div>
        )}
        {rows && rows.length === 0 && <p className="text-sm text-muted">{t('tournament.seriesEmpty')}</p>}
      </div>
    </details>
  );
}
