import { AVATARS, EVENING_EXTEND_CHOICES, MAX_SCORE, bestOfStage, checkSeriesScore, seriesTarget, READY_WINDOW_MS, TOURNAMENT_MIN_PLAYERS, type StandingRow, type TournamentView } from '@brett-und-blatt/online';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, Section } from '../components/controls';
import { ProfileForm, QrCode } from '../components/OnlineParts';
import { t } from '../i18n';
import { notifyTurn, requestNotificationPermission } from '../lib/notifications';
import { GAME_SERVER } from '../lib/online';
import { passChanged, saveOwnProfile } from '../lib/playerPass';
import { findGame, loadGame } from '../lib/registry';
import { navigate, paths } from '../lib/router';
import { storage, type Profile } from '../lib/storage';
import { useTournament } from '../lib/tournament';

type Match = TournamentView['matches'][number];
type Slot = Match['slots'][number];

const GROUP_LETTERS = 'ABCDEFGHIJKLMNOP';

function Page({ children }: { children: React.ReactNode }) {
  return <div className="bub-lobby mx-auto flex min-h-full max-w-5xl flex-col gap-5 px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)]">{children}</div>;
}

function roundName(round: number): string {
  const names = ['tournament.final.name', 'tournament.semi', 'tournament.quarter', 'tournament.eighth', 'tournament.sixteenth'] as const;
  return t(names[round - 1] ?? 'tournament.sixteenth');
}

/** „Halbfinale 2“ aus der Kennung `k2-1`. */
function koMatchName(id: string): string {
  if (id === 'k-3') return t('tournament.thirdPlace');
  if (id === 'gf') return t('tournament.grandFinal');
  if (id === 'gf2') return t('tournament.decider');
  if (id.startsWith('w') || id.startsWith('l')) {
    const [round, index] = id.slice(1).split('-').map(Number) as [number, number];
    return `${t(id.startsWith('w') ? 'tournament.upper' : 'tournament.lower')} ${round}.${index + 1}`;
  }
  const [round, index] = id.slice(1).split('-').map(Number) as [number, number];
  return round === 1 ? roundName(1) : `${roundName(round)} ${index + 1}`;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
}

/** Vor Ort (W-058 Stufe 1): Die Leitung trägt ein, es gibt keine Stichtage. */
const isLocalView = (view: TournamentView) => view.settings.mode === 'local';
/** Wird ein Spielstand gezählt (Tore, Sätze, Punkte)? */
const withScore = (view: TournamentView) => isLocalView(view) && view.settings.result !== undefined && view.settings.result !== 'winner';
/** Best of N (Stufe 3 Teil 5): Begegnungen über mehrere Partien, Stand in gewonnenen Partien. */
const hasSeries = (view: TournamentView) => (view.settings.bestOf ?? 1) > 1 || (view.settings.bestOfKo ?? 1) > 1;

/** Turnierabend (Stufe 3): Minuten je Partie, die Leitung startet jede Runde. */
const isEveningView = (view: TournamentView) => !isLocalView(view) && (view.settings.minutes ?? 0) > 0;

function deadlineNote(view: TournamentView, ms: number): string {
  if (isLocalView(view)) return '';
  if (isEveningView(view)) return ms > 0 ? t('tournament.until', { time: clock(ms) }) : t('tournament.waitingStart');
  return t('tournament.deadline', { date: formatDate(ms) });
}

/** Kurz für Spalten im Baum: Datum oder am Turnierabend die Uhrzeit. */
function deadlineShort(view: TournamentView, ms: number): string {
  if (isEveningView(view)) return ms > 0 ? clock(ms) : '–';
  return formatDate(ms);
}

/** Spieleabend (Stufe 3 Teil 2): Name einer Disziplin – online ein Spiel, vor Ort ein freier Name. */
function disciplineName(view: TournamentView, id: string): string {
  if (isLocalView(view)) return id;
  const game = findGame(id);
  return game ? `${game.emoji} ${game.name}` : id;
}

/** Die Disziplin eines Spieltags; null ohne Spieleabend. */
function disciplineOfStage(view: TournamentView, stage: number): string | null {
  return view.disciplines.length > 0 ? view.disciplines[stage % view.disciplines.length]!.id : null;
}

function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function fieldName(view: TournamentView, field: number): string {
  return t('tournament.field', { label: view.settings.fieldLabel ?? 'Tisch', n: field + 1 });
}

/** Remis nur, wenn die Leitung es erlaubt und die Form an dieser Stelle keinen Sieger braucht. */
function drawAllowed(view: TournamentView, m: Match): boolean {
  return view.settings.draws === true && (m.group !== null || view.settings.format === 'swiss' || view.settings.format === 'league');
}

/** Zuschauer vor Ort brauchen kein Profil; der Name zählt nur für Eingeschriebene. */
const GUEST: Profile = { name: 'Gast', avatar: AVATARS[0] };

type Send = ReturnType<typeof useTournament>[1];

/** Alles, was die Teile der Seite gemeinsam brauchen. */
function useLookup(view: TournamentView) {
  return useMemo(() => {
    const players = new Map(view.players.map((p) => [p.id, p]));
    const label = (id: string | null) => {
      const p = id ? players.get(id) : undefined;
      return p ? `${p.avatar} ${p.name}` : t('tournament.nobody');
    };
    const slotLabel = (slot: Slot) => {
      if (slot.player) return label(slot.player);
      const from = slot.from;
      if (!from) return t('tournament.nobody');
      if (from.kind === 'groupPlace') return t('tournament.from.group', { place: from.place + 1, group: GROUP_LETTERS[from.group]! });
      const source = view.matches.find((m) => m.id === from.match);
      if (source?.outcome) return t('tournament.nobody');
      return t(from.kind === 'winner' ? 'tournament.from.winner' : 'tournament.from.loser', { match: koMatchName(from.match) });
    };
    return { players, label, slotLabel };
  }, [view]);
}

export function TournamentScreen({ code, claim, helper }: { code: string; claim?: string; helper?: string }) {
  const [profile, setProfile] = useState<Profile | null>(() => storage.loadProfile());
  const [state, send] = useTournament(code, profile ?? GUEST);
  const [board, setBoard] = useState(false);
  const [printing, setPrinting] = useState<PrintKind | null>(null);
  const [claimInput, setClaimInput] = useState('');
  const view = state.view;
  const claimed = useRef(false);

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Der Einmal-Link der Leitung: einlösen und sofort aus der Adresszeile nehmen.
  useEffect(() => {
    if (claim && state.status === 'open' && !claimed.current) {
      claimed.current = true;
      send({ type: 'claim', code: claim });
      window.history.replaceState(null, '', paths.tournament(code));
    }
  }, [claim, state.status, code, send]);

  // Der Helferlink: einlösen und aus der Adresszeile nehmen, damit er nicht im Verlauf herumliegt.
  const helped = useRef(false);
  useEffect(() => {
    if (helper && state.status === 'open' && !helped.current) {
      helped.current = true;
      send({ type: 'helper', code: helper });
      window.history.replaceState(null, '', paths.tournament(code));
    }
  }, [helper, state.status, code, send]);

  // Wer hier eingeschrieben ist oder leitet, findet das Turnier auf „Online spielen“ wieder.
  useEffect(() => {
    if (!view || !(view.you || view.isLeader || view.helperRole)) return;
    if (storage.loadTournaments().some((item) => item.code === code)) return;
    storage.rememberTournament({ code, name: view.settings.name });
    // Der Ausweis nimmt die Liste auf andere Geräte mit.
    passChanged();
  }, [view, code]);

  // Gelöschte Turniere verschwinden auch aus der eigenen Liste.
  useEffect(() => {
    if (state.status === 'gone') storage.forgetTournament(code);
  }, [state.status, code]);

  // Gewählte Spieloptionen in lesbarer Form.
  const [optionText, setOptionText] = useState<string[]>([]);
  const gameId = view?.settings.gameId;
  const chosen = view?.settings.options;
  useEffect(() => {
    if (!gameId || !chosen) return setOptionText([]);
    let live = true;
    loadGame(gameId).then(({ module }) => {
      if (!live) return;
      setOptionText(
        Object.entries(chosen).flatMap(([id, value]) => {
          const spec = module.options.find((o) => o.id === id);
          const choice = spec?.choices.find((c) => c.value === value);
          return spec && choice && value !== spec.default ? [`${spec.label}: ${choice.label}`] : [];
        }),
      );
    });
    return () => {
      live = false;
    };
  }, [gameId, chosen]);

  // Partie geht los: direkt hinein, aber nur beim Wechsel, damit „Zurück“ nicht wieder hineinführt.
  const seenRunning = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!view?.you) return;
    const mine = view.matches.filter((m) => m.status === 'running' && m.roomCode && m.slots.some((s) => s.player === view.you));
    const known = seenRunning.current;
    seenRunning.current = new Set(mine.map((m) => m.roomCode!));
    const fresh = known && mine.find((m) => !known.has(m.roomCode!));
    if (fresh) navigate(paths.room(fresh.roomCode!));
  }, [view]);

  // Der Gegner ist bereit und die Seite liegt im Hintergrund: Bescheid geben.
  const notified = useRef(new Set<string>());
  useEffect(() => {
    if (!view?.you) return;
    for (const m of view.matches) {
      const side = m.slots.findIndex((s) => s.player === view.you);
      if (side < 0 || m.status !== 'open') continue;
      const at = m.readyAt[1 - side];
      const key = `${m.id}/${at}`;
      if (at && !notified.current.has(key) && view.serverNow - at < READY_WINDOW_MS) {
        notified.current.add(key);
        const other = view.players.find((p) => p.id === m.slots[1 - side]!.player);
        notifyTurn(view.settings.name, t('tournament.notifyReady', { name: other?.name ?? '' }));
      }
    }
  }, [view]);

  if (!GAME_SERVER) return <Page><p className="text-muted">{t('online.unavailable')}</p></Page>;
  // Ohne Profil erst nachsehen, ob es ein Turnier vor Ort ist: Dort genügt das Zuschauen.
  if (!profile && !view && state.closed === null && state.status !== 'gone') {
    return (
      <Page>
        <p className="text-muted">{t('online.connecting')}</p>
      </Page>
    );
  }
  if (!profile && !(view && isLocalView(view))) {
    return (
      <Page>
        <h1 className="text-2xl font-bold">🏆 {t('tournament.title')}</h1>
        <Section title={t('online.profile')}>
          <ProfileForm
            initial={null}
            submitLabel={t('online.enter')}
            onSave={(next) => {
              saveOwnProfile(next);
              setProfile(next);
            }}
          />
        </Section>
      </Page>
    );
  }

  const header = (
    <header className="flex items-center gap-2">
      <Button variant="ghost" className="px-3" aria-label={t('play.back')} onClick={() => navigate(paths.online)}>
        ←
      </Button>
      <h1 className="min-w-0 flex-1 truncate text-2xl font-bold">🏆 {view?.settings.name ?? state.closed ?? t('tournament.title')}</h1>
    </header>
  );
  const banners = (
    <>
      {state.error && (
        <p role="alert" className="fixed inset-x-3 top-3 z-30 mx-auto max-w-md rounded-xl bg-danger px-3 py-2 text-center text-sm text-white shadow-md">
          {state.error}
        </p>
      )}
      {state.status === 'reconnecting' && <p className="fixed inset-x-0 bottom-0 z-30 bg-warning px-3 py-2 text-center text-sm font-medium text-white">{t('online.reconnecting')}</p>}
    </>
  );

  if (state.status === 'gone') {
    return (
      <Page>
        {header}
        <p className="text-muted">{t('tournament.notFound')}</p>
      </Page>
    );
  }
  if (state.closed !== null) {
    return (
      <Page>
        {header}
        <p>{t('tournament.closed', { name: state.closed })}</p>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            send({ type: 'claim', code: claimInput });
          }}
        >
          <input className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3" aria-label={t('tournament.claim')} placeholder={t('tournament.claim')} value={claimInput} onChange={(e) => setClaimInput(e.target.value)} />
          <Button type="submit">{t('tournament.claimSend')}</Button>
        </form>
        {banners}
      </Page>
    );
  }
  if (!view) {
    return (
      <Page>
        {header}
        <p className="text-muted">{t('online.connecting')}</p>
      </Page>
    );
  }

  const game = findGame(view.settings.gameId);
  const local = isLocalView(view);
  const subtitle = (
    <p className="text-sm text-muted">
      {view.disciplines.length > 0 ? `🎲 ${view.settings.sport ?? t('tournament.multiSport')}` : local ? `${game?.emoji ?? '🏟️'} ${view.settings.sport ?? ''}` : `${game?.emoji ?? ''} ${game?.name ?? ''}`} · {t(`tournament.format.${view.settings.format}`)} · {t('tournament.leader', { name: view.leaderName })}
      {view.disciplines.length > 0 && <span className="block">{view.disciplines.map((d) => disciplineName(view, d.id)).join(' · ')}</span>}
      {isEveningView(view) && <span className="block">🌙 {t('tournament.evening', { n: view.settings.minutes ?? 0 })}</span>}
      {hasSeries(view) && <span className="block">🔁 {seriesNote(view)}</span>}
      {optionText.length > 0 && <span className="block">{optionText.join(' · ')}</span>}
      {view.rulesChanged && <span className="block text-warning">⚠️ {t('tournament.rulesChanged')}</span>}
    </p>
  );

  if (view.phase === 'signup') {
    return (
      <Page>
        {header}
        {subtitle}
        {local ? <LocalSignup view={view} code={code} send={send} /> : <SignupView view={view} code={code} send={send} />}
        {banners}
      </Page>
    );
  }

  if (printing) return <PrintView view={view} kind={printing} onClose={() => setPrinting(null)} />;

  if (board) {
    return (
      <div className="fixed inset-0 z-40 overflow-auto bg-bg p-4 text-lg">
        <div className="mb-3 flex items-center gap-3">
          <h1 className="min-w-0 flex-1 truncate text-3xl font-bold">🏆 {view.settings.name}</h1>
          <Button onClick={() => setBoard(false)}>{t('tournament.boardClose')}</Button>
        </div>
        {view.settings.format === 'tables' ? (
          <TableRounds view={view} send={null} />
        ) : (
          <>
            {local && <FieldBoard view={view} send={null} />}
            <Progress view={view} />
          </>
        )}
      </div>
    );
  }

  return (
    <Page>
      {header}
      {subtitle}
      {view.phase === 'finished' && <Podium view={view} />}
      <RoundStart view={view} send={send} />
      {view.helperRole === 'helper' && <p className="text-sm text-muted">🤝 {t('tournament.youHelp')}</p>}
      {view.settings.format === 'tables' ? (
        <TableRounds view={view} send={send} />
      ) : (
        <>
          {local ? <FieldBoard view={view} send={view.isLeader || view.helperRole ? send : null} /> : <MyStand view={view} send={send} />}
          <Progress view={view} />
          <History view={view} />
        </>
      )}
      {view.isLeader && <LeaderTools view={view} code={code} send={send} claim={state.claim} onBoard={() => setBoard(true)} />}
      {(view.isLeader || view.helperRole) && <PrintTools view={view} onPrint={setPrinting} />}
      {banners}
    </Page>
  );
}

// ---------------------------------------------------------------------------
// Einschreibung

/** Namen eintragen, einer je Zeile; der Text bleibt stehen, bis die Namen angekommen sind. */
function EntrantForm({ view, send, label }: { view: TournamentView; send: Send; label: string }) {
  const [text, setText] = useState('');
  const count = view.players.length;
  useEffect(() => setText(''), [count]);
  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        const names = text.split('\n').map((line) => line.trim()).filter(Boolean);
        if (names.length > 0) send({ type: 'addEntrants', names });
      }}
    >
      <label className="block space-y-1 text-sm">
        <span>{label}</span>
        <textarea className="min-h-24 w-full rounded-xl border border-line bg-surface px-3 py-2" rows={4} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <Button type="submit" className="w-full" disabled={!text.trim()}>
        ➕ {t('tournament.add')}
      </Button>
    </form>
  );
}

/** Einschreibung vor Ort: Die Leitung trägt die Namen ein, Zuschauer sehen die Liste. */
function LocalSignup({ view, code, send }: { view: TournamentView; code: string; send: Send }) {
  const min = TOURNAMENT_MIN_PLAYERS[view.settings.format];
  const count = view.players.length;
  return (
    <>
      <Section title={t('tournament.entrants')}>
        <p className="text-sm text-muted">{t('tournament.entrantsCount', { n: count, min })}</p>
        <Wishes view={view} send={send} />
        <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2 md:grid-cols-3">
          {view.players.map((p) => (
            <li key={p.id} className="flex min-w-0 items-center gap-1 rounded-xl border border-line bg-surface py-1 pr-1 pl-2 text-sm">
              <span className="min-w-0 flex-1 truncate">
                {p.avatar} {p.name}
              </span>
              {view.isLeader && (
                <button type="button" className="min-h-8 rounded-lg px-2 text-muted hover:bg-line/40" aria-label={`${t('tournament.remove')}: ${p.name}`} onClick={() => send({ type: 'removeEntrant', player: p.id })}>
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
        {view.isLeader && (
          <>
            <EntrantForm view={view} send={send} label={t('tournament.addEntrants')} />
            <p className="text-xs text-muted">{t('tournament.namesHint')}</p>
            <Button
              variant="primary"
              className="w-full"
              disabled={count < min}
              onClick={() => {
                if (window.confirm(t('tournament.startConfirm'))) send({ type: 'start' });
              }}
            >
              🏁 {t('tournament.start')}
            </Button>
          </>
        )}
      </Section>
      {view.isLeader && (
        <Section title={t('tournament.tools')}>
          <SpectatorLink view={view} code={code} />
          <Helpers view={view} code={code} send={send} />
          <SchedulePanel view={view} send={send} />
        </Section>
      )}
    </>
  );
}

/** Helferlinks: Wer einen öffnet, trägt Ergebnisse ein (Mitleitung: darf alles). */
function Helpers({ view, code, send }: { view: TournamentView; code: string; send: Send }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<'helper' | 'coleader'>('helper');
  const [shown, setShown] = useState<string | null>(null);
  const count = view.helpers.length;
  useEffect(() => setName(''), [count]);
  const link = (helperCode: string) => `${window.location.origin}${window.location.pathname}${paths.tournament(code)}?helfer=${helperCode}`;
  return (
    <div className="space-y-2 rounded-xl border border-line p-3">
      <p className="text-sm font-semibold">🤝 {t('tournament.helpers')}</p>
      <p className="text-xs text-muted">{t('tournament.helpersHint')}</p>
      <ul className="space-y-1">
        {view.helpers.map((h) => (
          <li key={h.id} className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">
                {h.name} <span className="text-xs text-muted">· {t(h.role === 'coleader' ? 'tournament.role.coleader' : 'tournament.role.helper')} · {t('tournament.devices', { n: h.devices })}</span>
              </span>
              <Button className="text-xs" onClick={() => setShown(shown === h.id ? null : h.id)}>
                🔗
              </Button>
              <Button
                className="text-xs"
                aria-label={`${t('tournament.remove')}: ${h.name}`}
                onClick={() => {
                  if (window.confirm(t('tournament.removeHelperConfirm', { name: h.name }))) send({ type: 'removeHelper', helper: h.id });
                }}
              >
                ✕
              </Button>
            </div>
            {shown === h.id && (
              <div className="space-y-2">
                <div className="mx-auto w-40">
                  <QrCode text={link(h.code)} label={h.name} />
                </div>
                <Button className="w-full text-sm" onClick={() => navigator.clipboard?.writeText(link(h.code))}>
                  🔗 {t('tournament.copy')}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) send({ type: 'addHelper', name: name.trim(), role });
        }}
      >
        <input className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3" aria-label={t('tournament.helperName')} placeholder={t('tournament.helperName')} maxLength={30} value={name} onChange={(e) => setName(e.target.value)} />
        <select className="min-h-11 rounded-xl border border-line bg-surface px-2" aria-label={t('tournament.role')} value={role} onChange={(e) => setRole(e.target.value as 'helper' | 'coleader')}>
          <option value="helper">{t('tournament.role.helper')}</option>
          <option value="coleader">{t('tournament.role.coleader')}</option>
        </select>
        <Button type="submit" disabled={!name.trim()}>
          ➕
        </Button>
      </form>
    </div>
  );
}

/** Zeitplan und Schiedsrichter vor Ort. */
function SchedulePanel({ view, send }: { view: TournamentView; send: Send }) {
  const current = view.schedule;
  const toTime = (ms: number) => clock(ms);
  const [start, setStart] = useState(() => toTime(current?.start ?? Math.ceil(Date.now() / 900_000) * 900_000));
  const [matchMinutes, setMatchMinutes] = useState(current?.matchMinutes ?? 10);
  const [breakMinutes, setBreakMinutes] = useState(current?.breakMinutes ?? 2);
  const FIELD = 'min-h-11 w-full rounded-xl border border-line bg-surface px-2';
  const save = () => {
    const [h, m] = start.split(':').map(Number) as [number, number];
    const base = new Date(current?.start ?? Date.now());
    base.setHours(h, m, 0, 0);
    send({ type: 'setSchedule', schedule: { start: base.getTime(), matchMinutes, breakMinutes } });
  };
  return (
    <div className="space-y-2 rounded-xl border border-line p-3">
      <p className="text-sm font-semibold">🕑 {t('tournament.schedule')}</p>
      <div className="grid grid-cols-3 gap-2">
        <label className="block space-y-1 text-xs">
          <span>{t('tournament.schedule.start')}</span>
          <input className={FIELD} type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="block space-y-1 text-xs">
          <span>{t('tournament.schedule.match')}</span>
          <input className={FIELD} type="number" inputMode="numeric" min={1} max={240} value={matchMinutes} onChange={(e) => setMatchMinutes(Math.max(1, Math.min(240, Math.floor(Number(e.target.value) || 1))))} />
        </label>
        <label className="block space-y-1 text-xs">
          <span>{t('tournament.schedule.break')}</span>
          <input className={FIELD} type="number" inputMode="numeric" min={0} max={240} value={breakMinutes} onChange={(e) => setBreakMinutes(Math.max(0, Math.min(240, Math.floor(Number(e.target.value) || 0))))} />
        </label>
      </div>
      <div className="flex gap-2">
        <Button className="flex-1 text-sm" disabled={!/^\d{2}:\d{2}$/.test(start)} onClick={save}>
          {current ? t('tournament.schedule.update') : t('tournament.schedule.set')}
        </Button>
        {current && (
          <Button className="text-sm" onClick={() => send({ type: 'setSchedule', schedule: null })}>
            {t('tournament.remove')}
          </Button>
        )}
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-accent" checked={view.referees} onChange={(e) => send({ type: 'setReferees', on: e.target.checked })} />
        {t('tournament.referees')}
      </label>
    </div>
  );
}

function SpectatorLink({ view, code }: { view: TournamentView; code: string }) {
  const link = `${window.location.origin}${window.location.pathname}${paths.tournament(code)}`;
  if (!view.settings.spectators) return <p className="text-sm text-muted">{t('tournament.noSpectators')}</p>;
  return (
    <div className="space-y-2 rounded-xl border border-line p-3">
      <p className="text-sm font-semibold">👀 {t('tournament.spectatorLink')}</p>
      <p className="text-xs text-muted">{t('tournament.spectatorHint')}</p>
      <div className="mx-auto w-44">
        <QrCode text={link} label={t('tournament.spectatorLink')} />
      </div>
      <Button className="w-full" onClick={() => navigator.clipboard?.writeText(link)}>
        🔗 {t('tournament.copy')}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vor Ort: Tische und Ergebnisse

/** Was gerade an den Tischen läuft und was als Nächstes dran ist; die Leitung trägt hier ein. */
function FieldBoard({ view, send }: { view: TournamentView; send: Send | null }) {
  const { label } = useLookup(view);
  if (view.phase !== 'running') return null;
  const running = view.matches.filter((m) => m.status === 'running').sort((a, b) => (a.field ?? 0) - (b.field ?? 0));
  const next = view.matches.filter((m) => m.status === 'open' && m.slots.every((s) => s.player)).sort((a, b) => a.stage - b.stage);
  const shown = view.fields > 0 ? next.slice(0, 8) : next;
  // Verzug: Die früheste noch nicht aufgerufene Partie hätte schon beginnen sollen.
  const waitingSince = Math.min(...next.flatMap((m) => (m.plannedAt !== undefined ? [m.plannedAt] : [])));
  const delay = Number.isFinite(waitingSince) ? Math.floor((view.serverNow - waitingSince) / 60_000) : 0;
  const extra = (m: Match) => (
    <>
      {m.plannedAt !== undefined && <span>🕑 {t('tournament.about', { time: clock(m.plannedAt) })}</span>}
      {m.referee && <span> · 🟨 {t('tournament.referee', { name: label(m.referee) })}</span>}
    </>
  );
  const names = (m: Match) => (
    <p className="min-w-0 truncate font-semibold">
      {label(m.slots[0].player)} <span className="font-normal text-muted">–</span> {label(m.slots[1].player)}
    </p>
  );
  return (
    <>
      {delay >= 3 && <p className="rounded-xl bg-warning/15 px-3 py-2 text-sm font-semibold text-warning">⏱️ {t('tournament.delay', { n: delay })}</p>}
      {running.length > 0 && (
        <Section title={t('tournament.atFields')}>
          <ul className="grid gap-2 md:grid-cols-2">
            {running.map((m) => (
              <li key={m.id} className="space-y-2 rounded-2xl border-2 border-accent bg-accent/5 p-3">
                <p className="flex items-center justify-between gap-2 text-xs text-muted">
                  <span className="rounded-full bg-accent px-2 py-0.5 font-semibold text-white">📍 {fieldName(view, m.field ?? 0)}</span>
                  <span className="truncate">{matchTitle(view, m)}</span>
                </p>
                {names(m)}
                {(m.referee || m.plannedAt !== undefined) && <p className="text-xs text-muted">{extra(m)}</p>}
                {send && view.settings.gameId && (
                  <a className="block text-sm font-semibold text-accent underline" href={paths.setup(view.settings.gameId)} target="_blank" rel="noopener">
                    🎲 {t('tournament.playHere')}
                  </a>
                )}
                {send && <ResultForm key={m.id} view={view} m={m} send={send} />}
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section title={`${t('tournament.upNext')} (${next.length})`}>
        {next.length === 0 && <p className="text-sm text-muted">{t('tournament.noneOpen')}</p>}
        <ul className="space-y-2">
          {shown.map((m) => (
            <li key={m.id} className="space-y-1 rounded-xl border border-line bg-surface p-2 text-sm">
              <p className="truncate text-xs text-muted">
                {matchTitle(view, m)}
                {m.plannedAt !== undefined && ` · ${t('tournament.about', { time: clock(m.plannedAt) })}`}
              </p>
              {names(m)}
              {send &&
                (view.fields > 0 ? (
                  <details>
                    <summary className="cursor-pointer text-xs text-muted">{t('tournament.enter')}</summary>
                    <ResultForm key={m.id} view={view} m={m} send={send} />
                  </details>
                ) : (
                  <ResultForm key={m.id} view={view} m={m} send={send} />
                ))}
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

/** Spielstand oder Sieger eintragen; auch zum Berichtigen eines Ergebnisses. */
function ResultForm({ view, m, send, onDone }: { view: TournamentView; m: Match; send: Send; onDone?: () => void }) {
  const { label } = useLookup(view);
  const [a, setA] = useState(m.outcome?.score?.[0]?.toString() ?? '');
  const [b, setB] = useState(m.outcome?.score?.[1]?.toString() ?? '');
  const enter = (message: { score: [number, number] } | { winner: 0 | 1 | 'draw' }) => {
    send({ type: 'enterResult', match: m.id, ...message });
    onDone?.();
  };
  const bestOf = bestOfStage(view, m.stage);
  if (!withScore(view) && bestOf > 1) return <SeriesForm view={view} m={m} bestOf={bestOf} enter={enter} />;
  if (!withScore(view)) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {([0, 1] as const).map((side) => (
          <Button key={side} className="text-xs" onClick={() => enter({ winner: side })}>
            🏅 {t('tournament.winner', { name: label(m.slots[side].player) })}
          </Button>
        ))}
        {drawAllowed(view, m) && (
          <Button className="col-span-2 text-xs" onClick={() => enter({ winner: 'draw' })}>
            {t('tournament.draw')}
          </Button>
        )}
      </div>
    );
  }
  const unit = t(`tournament.result.${view.settings.result ?? 'goals'}`);
  const valid = [a, b].every((v) => /^\d{1,3}$/.test(v) && Number(v) <= MAX_SCORE) && (a !== b || drawAllowed(view, m));
  const input = (value: string, set: (v: string) => void, side: 0 | 1) => (
    <input
      className="min-h-11 w-16 rounded-xl border border-line bg-surface px-2 text-center text-lg tabular-nums"
      type="number"
      inputMode="numeric"
      min={0}
      max={MAX_SCORE}
      aria-label={`${unit} ${label(m.slots[side].player)}`}
      value={value}
      onChange={(e) => set(e.target.value)}
    />
  );
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) enter({ score: [Number(a), Number(b)] });
      }}
    >
      {input(a, setA, 0)}
      <span className="text-lg font-bold">:</span>
      {input(b, setB, 1)}
      <Button type="submit" variant="primary" className="flex-1 text-sm" disabled={!valid}>
        {t('tournament.enter')}
      </Button>
    </form>
  );
}

/** „Best of 3“, mit eigenem Wert für die K.-o.-Phase. */
function seriesNote(view: TournamentView): string {
  const all = view.settings.bestOf ?? 1;
  const ko = view.settings.bestOfKo;
  return ko && ko !== all ? t('tournament.seriesSplit', { all, ko }) : t('tournament.seriesAll', { n: all });
}

/** Best of N vor Ort: gewonnene Partien je Seite; das Formular prüft den Stand. */
function SeriesForm({ view, m, bestOf, enter }: { view: TournamentView; m: Match; bestOf: number; enter: (message: { score: [number, number] }) => void }) {
  const { label } = useLookup(view);
  const [a, setA] = useState(m.outcome?.score?.[0]?.toString() ?? '');
  const [b, setB] = useState(m.outcome?.score?.[1]?.toString() ?? '');
  const filled = [a, b].every((v) => /^\d$/.test(v));
  const problem = filled ? checkSeriesScore([Number(a), Number(b)], bestOf) : null;
  const input = (value: string, set: (v: string) => void, side: 0 | 1) => (
    <input
      className="min-h-11 w-16 rounded-xl border border-line bg-surface px-2 text-center text-lg tabular-nums"
      type="number"
      inputMode="numeric"
      min={0}
      max={seriesTarget(bestOf)}
      aria-label={`${t('tournament.seriesGames')} ${label(m.slots[side].player)}`}
      value={value}
      onChange={(e) => set(e.target.value)}
    />
  );
  return (
    <form
      className="space-y-1"
      onSubmit={(event) => {
        event.preventDefault();
        if (filled && !problem) enter({ score: [Number(a), Number(b)] });
      }}
    >
      <p className="text-xs text-muted">{t('tournament.seriesHint', { n: bestOf, need: seriesTarget(bestOf) })}</p>
      <div className="flex items-center gap-2">
        {input(a, setA, 0)}
        <span className="text-lg font-bold">:</span>
        {input(b, setB, 1)}
        <Button type="submit" variant="primary" className="flex-1 text-sm" disabled={!filled || problem !== null}>
          {t('tournament.enter')}
        </Button>
      </div>
      {problem && <p className="text-xs text-warning">{problem}</p>}
    </form>
  );
}

/** Spieleabend: Disziplinen mit Stimmen; Eingeschriebene kreuzen ihre Wünsche an. */
function Wishes({ view, send }: { view: TournamentView; send: Send }) {
  if (view.disciplines.length === 0) return null;
  const canWish = view.settings.wishes === true && view.you !== null && view.phase === 'signup';
  return (
    <fieldset className="space-y-1 rounded-xl border border-line p-3">
      <legend className="px-1 text-sm">{canWish ? t('tournament.wishTitle') : t('tournament.disciplineList')}</legend>
      {canWish && <p className="text-xs text-muted">{t('tournament.wishesHint')}</p>}
      <ul className="space-y-1">
        {view.disciplines.map((d) => (
          <li key={d.id}>
            <label className="flex items-center gap-2 text-sm">
              {canWish && (
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-accent"
                  checked={view.yourWishes.includes(d.id)}
                  onChange={(e) => send({ type: 'wish', disciplines: e.target.checked ? [...view.yourWishes, d.id] : view.yourWishes.filter((id) => id !== d.id) })}
                />
              )}
              <span className="min-w-0 flex-1 truncate">{disciplineName(view, d.id)}</span>
              {view.settings.wishes && <span className="text-xs text-muted">{d.wishes === 1 ? t('tournament.wishCountOne') : t('tournament.wishCount', { n: d.wishes })}</span>}
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

function SignupView({ view, code, send }: { view: TournamentView; code: string; send: Send }) {
  const teamSize = view.settings.teamSize ?? 1;
  const min = TOURNAMENT_MIN_PLAYERS[view.settings.format] * teamSize;
  const uneven = view.players.length % teamSize !== 0;
  const link = `${window.location.origin}${window.location.pathname}${paths.tournament(code)}`;
  return (
    <>
      <Section title={t('tournament.signup')}>
        <p className="text-sm text-muted">{t('tournament.signupOpen', { n: view.players.length, min })}</p>
        {teamSize > 1 && <p className="text-sm text-muted">{uneven ? t('tournament.teamUneven', { n: teamSize }) : t('tournament.teamsDrawn', { n: teamSize })}</p>}
        <ul className="grid grid-cols-2 gap-1 sm:grid-cols-4">
          {view.players.map((p) => (
            <li key={p.id} className={`truncate rounded-xl border px-2 py-1 text-sm ${p.id === view.you ? 'border-accent bg-accent/10 font-semibold' : 'border-line bg-surface'}`}>
              {p.avatar} {p.name}
            </li>
          ))}
        </ul>
        {view.you ? (
          <Button className="w-full" onClick={() => send({ type: 'leave' })}>
            {t('tournament.leave')}
          </Button>
        ) : (
          <Button variant="primary" className="w-full" onClick={() => send({ type: 'join' })}>
            ✍️ {t('tournament.join')}
          </Button>
        )}
        <Wishes view={view} send={send} />
        {view.isLeader && (
          <Button
            variant="primary"
            className="w-full"
            disabled={view.players.length < min || uneven}
            onClick={() => {
              if (window.confirm(t('tournament.startConfirm'))) send({ type: 'start' });
            }}
          >
            🏁 {t('tournament.start')}
          </Button>
        )}
      </Section>
      <Section title={t('tournament.invite')}>
        <div className="mx-auto w-44">
          <QrCode text={link} label={t('tournament.invite')} />
        </div>
        <Button className="w-full" onClick={() => navigator.clipboard?.writeText(link)}>
          🔗 {t('tournament.copy')}
        </Button>
      </Section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Mein Stand

function MyStand({ view, send }: { view: TournamentView; send: Send }) {
  const { label } = useLookup(view);
  // Die Serverzeit als Bezug; alle 15 Sekunden neu, damit „Bereit“ sichtbar verfällt.
  const [offset] = useState(() => view.serverNow - Date.now());
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now() + offset), 15_000);
    return () => window.clearInterval(timer);
  }, [offset]);
  const current = Math.max(now, view.serverNow);

  if (!view.you) return view.isLeader ? <p className="text-sm text-muted">{t('tournament.spectating')}</p> : null;
  const mine = view.matches.filter((m) => m.slots.some((s) => s.player === view.you));
  const active = mine.filter((m) => m.status === 'open' || m.status === 'running');
  if (view.phase === 'finished') return null;
  return (
    <Section title={t('tournament.mine')}>
      {active.length === 0 && <p className="text-sm text-muted">{t('tournament.allDone')}</p>}
      <ul className="space-y-2">
        {active.map((m) => {
          const side = m.slots.findIndex((s) => s.player === view.you);
          const other = m.slots[1 - side]!.player;
          const iAmReady = m.readyAt[side] !== null && current - m.readyAt[side]! < READY_WINDOW_MS;
          const otherReady = m.readyAt[1 - side] !== null && current - m.readyAt[1 - side]! < READY_WINDOW_MS;
          const stage = view.stages[m.stage];
          return (
            <li key={m.id} className="space-y-2 rounded-2xl border-2 border-accent bg-accent/5 p-3">
              <p className="font-semibold">{t('tournament.yourTurn', { name: label(other) })}</p>
              {stage && (
                <p className="text-xs text-muted">
                  {matchTitle(view, m)} · {deadlineNote(view, stage.deadline)}
                  {m.replays > 0 && ` · ${t('tournament.replay')}`}
                </p>
              )}
              {isEveningView(view) && stage?.startedAt === undefined ? (
                <p className="text-sm">🌙 {t('tournament.heldHint')}</p>
              ) : m.status === 'running' ? (
                m.roomCode && (
                  <Button variant="primary" className="w-full" onClick={() => navigate(paths.room(m.roomCode!))}>
                    ▶️ {t('tournament.toGame')}
                  </Button>
                )
              ) : iAmReady ? (
                <>
                  <p className="text-sm">{t('tournament.waitingFor', { name: label(other) })}</p>
                  <Button className="w-full" onClick={() => send({ type: 'ready', match: m.id, ready: false })}>
                    {t('tournament.notReady')}
                  </Button>
                </>
              ) : (
                <>
                  {otherReady && <p className="text-sm font-semibold text-accent">{t('tournament.opponentReady', { name: label(other) })}</p>}
                  <Button variant="primary" className="w-full" onClick={() => send({ type: 'ready', match: m.id, ready: true })}>
                    ✅ {t('tournament.ready')}
                  </Button>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/** Turnierabend: Die Leitung startet die Runde; alle anderen sehen, dass es gleich losgeht. */
function RoundStart({ view, send }: { view: TournamentView; send: Send }) {
  if (!isEveningView(view) || view.phase !== 'running') return null;
  const stage = view.stages[view.currentStage];
  const name = stage?.kind === 'ko' ? roundName(stage.round) : t('tournament.round', { n: view.currentStage + 1 });
  if (view.startableStage !== null) {
    return view.isLeader ? (
      <Button variant="primary" className="w-full text-lg" onClick={() => send({ type: 'startRound' })}>
        ▶️ {t('tournament.startRound', { name })}
      </Button>
    ) : (
      <p className="rounded-xl bg-accent/10 px-3 py-2 text-sm font-semibold">🌙 {t('tournament.roundSoon', { name })}</p>
    );
  }
  if (!stage?.startedAt) return null;
  return <p className="rounded-xl bg-accent/10 px-3 py-2 text-sm">⏱️ {t('tournament.roundRunning', { name, time: clock(stage.deadline) })}</p>;
}

type TableGameView = TournamentView['tableGames'][number];

/** Tischrunden (Stufe 3 Teil 3): Tabelle, die Tische je Runde, Bereit und Eintragen. */
function TableRounds({ view, send }: { view: TournamentView; send: Send | null }) {
  const rounds = [...new Set(view.tableGames.map((g) => g.stage))].sort((a, b) => b - a);
  return (
    <>
      <Section title={t('tournament.table')}>
        <p className="text-xs text-muted">
          {[`${t('tournament.round', { n: Math.min(view.currentStage + 1, view.stages.length) })} / ${view.stages.length}`, deadlineNote(view, view.stages[view.currentStage]?.deadline ?? 0), view.phase === 'finished' ? t('tournament.final') : t('tournament.provisional')].filter(Boolean).join(' · ')}
        </p>
        <Table view={view} rows={view.table} highlight={view.phase === 'finished' ? 1 : 0} />
        <p className="text-xs text-muted">{t('tournament.tablesPoints')}</p>
      </Section>
      {rounds.map((stage) => (
        <Section key={stage} title={t('tournament.round', { n: stage + 1 })}>
          <ul className="grid gap-2 md:grid-cols-2">
            {view.tableGames
              .filter((g) => g.stage === stage)
              .map((g) => (
                <TableCard key={g.id} view={view} game={g} send={send} />
              ))}
          </ul>
        </Section>
      ))}
    </>
  );
}

function TableCard({ view, game, send }: { view: TournamentView; game: TableGameView; send: Send | null }) {
  const { label } = useLookup(view);
  const [editing, setEditing] = useState(false);
  const mine = send !== null && view.you !== null && game.seats.includes(view.you);
  const seat = view.you ? game.seats.indexOf(view.you) : -1;
  const iAmReady = seat >= 0 && game.readyAt[seat] !== null && view.serverNow - game.readyAt[seat]! < READY_WINDOW_MS;
  const held = isEveningView(view) && view.stages[game.stage]?.startedAt === undefined;
  const mayEnter = send !== null && (isLocalView(view) ? view.isLeader || view.helperRole !== null : view.isLeader);
  const order = game.seats.map((_, i) => i).sort((a, b) => (game.places ? game.places[a]! - game.places[b]! : 0));
  return (
    <li className={`space-y-2 rounded-2xl border-2 p-3 ${mine && game.status !== 'done' ? 'border-accent bg-accent/5' : 'border-line bg-surface'}`}>
      <p className="flex items-center justify-between gap-2 text-xs text-muted">
        <span className="rounded-full bg-accent px-2 py-0.5 font-semibold text-white">📍 {fieldName(view, game.index)}</span>
        <span>{game.status === 'done' ? (game.walkover ? t('tournament.walkover') : t('tournament.final')) : game.status === 'running' ? `🔴 ${t('tournament.live')}` : held ? t('tournament.waitingStart') : ''}</span>
      </p>
      <ol className="space-y-0.5 text-sm">
        {order.map((i) => (
          <li key={i} className={`flex gap-2 ${game.seats[i] === view.you ? 'font-semibold' : ''}`}>
            <span className="w-6 text-right tabular-nums text-muted">{game.places ? `${game.places[i]! + 1}.` : ''}</span>
            <span className="min-w-0 flex-1 truncate">{label(game.seats[i]!)}</span>
            {game.scores && <span className="tabular-nums text-muted">{game.scores[i]}</span>}
          </li>
        ))}
      </ol>
      {!isLocalView(view) && mine && game.status === 'open' && !held && (
        <Button variant={iAmReady ? 'secondary' : 'primary'} className="w-full" onClick={() => send?.({ type: 'ready', match: game.id, ready: !iAmReady })}>
          {iAmReady ? t('tournament.notReady') : `✅ ${t('tournament.ready')}`}
        </Button>
      )}
      {mine && game.status === 'running' && game.roomCode && (
        <Button variant="primary" className="w-full" onClick={() => navigate(paths.room(game.roomCode!))}>
          ▶️ {t('tournament.toGame')}
        </Button>
      )}
      {isLocalView(view) && game.status !== 'done' && mayEnter && view.settings.gameId && (
        <a className="block text-sm font-semibold text-accent underline" href={paths.setup(view.settings.gameId)} target="_blank" rel="noopener">
          🎲 {t('tournament.playHere')}
        </a>
      )}
      {mayEnter && send && (game.status !== 'done' || editing) && <TableResultForm view={view} game={game} send={send} onDone={() => setEditing(false)} />}
      {mayEnter && game.status === 'done' && !editing && (
        <button type="button" className="text-xs text-muted underline" onClick={() => setEditing(true)}>
          {t('tournament.correct')}
        </button>
      )}
    </li>
  );
}

/** Ergebnis eines Tisches: Punkte im Spiel (Plätze ergeben sich) oder direkt die Plätze. */
function TableResultForm({ view, game, send, onDone }: { view: TournamentView; game: TableGameView; send: Send; onDone: () => void }) {
  const { label } = useLookup(view);
  const [byScore, setByScore] = useState(isLocalView(view) && (view.settings.result === 'points' || view.settings.lowWins === true));
  const [values, setValues] = useState<string[]>(() => game.seats.map((_, i) => (byScore ? String(game.scores?.[i] ?? '') : String((game.places?.[i] ?? i) + 1))));
  const numbers = values.map((v) => Number(v));
  const valid = values.every((v) => v.trim() !== '' && Number.isInteger(Number(v)));
  const FIELD = 'min-h-10 w-20 rounded-lg border border-line bg-surface px-2 text-right tabular-nums';
  return (
    <form
      className="space-y-2 border-t border-line pt-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid) return;
        send(byScore ? { type: 'enterTable', table: game.id, scores: numbers } : { type: 'enterTable', table: game.id, places: numbers.map((n) => n - 1) });
        onDone();
      }}
    >
      <div className="flex gap-2 text-xs">
        {[false, true].map((score) => (
          <button
            key={String(score)}
            type="button"
            className={`rounded-full border px-2 py-0.5 ${byScore === score ? 'border-accent bg-accent/10 font-semibold' : 'border-line'}`}
            onClick={() => {
              setByScore(score);
              setValues(game.seats.map((_, i) => (score ? '' : String(i + 1))));
            }}
          >
            {score ? t('tournament.enterScores') : t('tournament.enterPlaces')}
          </button>
        ))}
      </div>
      {game.seats.map((id, i) => (
        <label key={id} className="flex items-center gap-2 text-sm">
          <span className="min-w-0 flex-1 truncate">{label(id)}</span>
          <input className={FIELD} type="number" inputMode="numeric" min={byScore ? undefined : 1} max={byScore ? undefined : game.seats.length} value={values[i]} onChange={(e) => setValues(values.map((v, j) => (j === i ? e.target.value : v)))} aria-label={`${label(id)}: ${byScore ? t('tournament.enterScores') : t('tournament.enterPlaces')}`} />
        </label>
      ))}
      <Button type="submit" className="w-full" disabled={!valid}>
        ✔️ {t('tournament.save')}
      </Button>
    </form>
  );
}

function matchTitle(view: TournamentView, m: Match): string {
  if (m.group !== null) return t('tournament.group', { name: GROUP_LETTERS[m.group]! });
  if (view.stages[m.stage]?.kind === 'swiss') return t('tournament.round', { n: m.stage + 1 });
  if (view.stages[m.stage]?.kind === 'league') {
    const discipline = disciplineOfStage(view, m.stage);
    return `${t('tournament.matchday', { n: m.stage + 1 })}${discipline ? ` · ${disciplineName(view, discipline)}` : ''}`;
  }
  return koMatchName(m.id);
}

// ---------------------------------------------------------------------------
// Tabellen und Baum

function Progress({ view }: { view: TournamentView }) {
  if (view.settings.format === 'knockout') return <KnockoutBracket view={view} />;
  if (view.settings.format === 'double') return <DoubleBracket view={view} />;
  return view.settings.format === 'world' ? (
    <>
      <KnockoutBracket view={view} />
      <Section title={t('tournament.groups')}>
        <p className="text-sm text-muted">{t('tournament.advances')}</p>
        <div className="grid gap-3 md:grid-cols-2">
          {view.groups.map((group, index) => (
            <div key={index} className="min-w-0 space-y-1">
              <h3 className="font-semibold">
                {t('tournament.group', { name: GROUP_LETTERS[index]! })} <span className="text-xs font-normal text-muted">({group.settled ? t('tournament.final') : [t('tournament.provisional'), deadlineNote(view, view.stages[0]!.deadline)].filter(Boolean).join(', ')})</span>
              </h3>
              <Table view={view} rows={group.table} highlight={2} />
              <GroupMatches view={view} group={index} />
            </div>
          ))}
        </div>
      </Section>
    </>
  ) : (
    <>
      <Section title={view.disciplines.length > 0 ? t('tournament.overall') : t('tournament.table')}>
        <p className="text-xs text-muted">
          {[
            `${t(view.settings.format === 'league' ? 'tournament.matchday' : 'tournament.round', { n: Math.min(view.currentStage + 1, view.stages.length) })} / ${view.stages.length}`,
            deadlineNote(view, view.stages[view.currentStage]?.deadline ?? 0),
            view.phase === 'finished' ? t('tournament.final') : t('tournament.provisional'),
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <Table view={view} rows={view.table.length > 0 ? view.table : view.swissTable} highlight={view.phase === 'finished' ? 1 : 0} buchholz={view.settings.format === 'swiss'} />
      </Section>
      {view.disciplineTables.length > 0 && (
        <Section title={t('tournament.disciplineList')}>
          {view.disciplineTables.map(({ id, table }) => (
            <details key={id} className="rounded-xl border border-line p-2">
              <summary className="cursor-pointer font-semibold">{t('tournament.disciplineTable', { name: disciplineName(view, id) })}</summary>
              <Table view={view} rows={table} highlight={0} />
            </details>
          ))}
        </Section>
      )}
      <SwissRounds view={view} />
    </>
  );
}

function Table({ view, rows, highlight, buchholz = false }: { view: TournamentView; rows: StandingRow[]; highlight: number; buchholz?: boolean }) {
  const { players, label } = useLookup(view);
  const series = !withScore(view) && hasSeries(view);
  const score = withScore(view) || series;
  const cell = 'px-1 py-1 text-center tabular-nums';
  return (
    <table className="w-full table-fixed text-sm">
      <thead className="text-xs text-muted">
        <tr>
          <th className="w-7 px-1 text-left">{t('tournament.table.place')}</th>
          <th className="px-1 text-left">{t('tournament.table.player')}</th>
          <th className="w-7">{t('tournament.table.played')}</th>
          <th className="w-7">{t('tournament.table.wins')}</th>
          <th className="w-7">{t('tournament.table.draws')}</th>
          <th className="w-7">{t('tournament.table.losses')}</th>
          {buchholz && <th className="w-8">{t('tournament.table.buchholz')}</th>}
          {score && <th className="w-12">{series ? t('tournament.table.games') : t('tournament.table.score')}</th>}
          {score && <th className="w-9">{t('tournament.table.diff')}</th>}
          <th className="w-8">{t('tournament.table.points')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => {
          const withdrawn = players.get(row.player)?.withdrawn;
          return (
            <tr key={row.player} className={`border-t border-line ${row.player === view.you ? 'bg-accent/10 font-semibold' : ''} ${withdrawn ? 'text-muted line-through' : ''}`}>
              <td className={`px-1 py-1 tabular-nums ${index < highlight ? 'font-bold text-accent' : ''}`}>{index + 1}</td>
              <td className="truncate px-1 py-1">{label(row.player)}</td>
              <td className={cell}>{row.played}</td>
              <td className={cell}>{row.wins}</td>
              <td className={cell}>{row.draws}</td>
              <td className={cell}>{row.losses}</td>
              {buchholz && <td className={cell}>{row.buchholz}</td>}
              {score && (
                <td className={cell}>
                  {row.scored}:{row.conceded}
                </td>
              )}
              {score && <td className={cell}>{row.scored - row.conceded > 0 ? `+${row.scored - row.conceded}` : row.scored - row.conceded}</td>}
              <td className={`${cell} font-bold`}>{row.points}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function outcomeNote(m: Match): string | null {
  const o = m.outcome;
  if (!o) return null;
  if (o.bye) return t('tournament.bye');
  if (o.byLeader) return t('tournament.byLeader');
  if (o.draw) return t('tournament.draw');
  if (o.walkover) return o.winner === null ? t('tournament.bothLost') : t('tournament.walkover');
  return null;
}

/** Eine Partie als Kärtchen: zwei Zeilen, Sieger fett, der eigene Weg hervorgehoben. */
function MatchCard({ view, m, title }: { view: TournamentView; m: Match; title?: string }) {
  const { slotLabel } = useLookup(view);
  const mine = m.slots.some((s) => s.player && s.player === view.you);
  const note = outcomeNote(m);
  return (
    <div className={`min-w-0 rounded-xl border bg-surface p-2 text-sm shadow-sm ${mine ? 'border-2 border-accent' : 'border-line'}`}>
      {title && <p className="truncate text-[11px] text-muted">{title}</p>}
      {m.slots.map((slot, side) => {
        const won = m.outcome?.winner === side;
        const lost = m.outcome && m.outcome.winner !== null && !won;
        return (
          <p key={side} className={`flex gap-2 ${won ? 'font-bold' : ''} ${lost ? 'text-muted' : ''} ${slot.player ? '' : 'text-xs text-muted italic'}`}>
            <span className="min-w-0 flex-1 truncate">
              {won && '🏅 '}
              {m.outcome?.bye && !slot.player ? t('tournament.bye') : slotLabel(slot)}
            </span>
            {m.outcome?.score && <span className="tabular-nums">{m.outcome.score[side]}</span>}
          </p>
        );
      })}
      {m.status === 'running' && (
        <p className="mt-1 flex items-center justify-between gap-2 text-xs font-semibold text-accent">
          <span>{m.field !== undefined ? `📍 ${fieldName(view, m.field)}` : `🔴 ${t('tournament.live')}`}</span>
          {m.roomCode && !mine && (
            <button type="button" className="underline" onClick={() => navigate(paths.room(m.roomCode!))}>
              {t('tournament.watch')}
            </button>
          )}
        </p>
      )}
      {note && !m.outcome?.bye && <p className="text-[11px] text-muted">{note}</p>}
      {m.replays > 0 && !m.outcome && <p className="text-[11px] text-muted">{t('tournament.replay')}</p>}
    </div>
  );
}

function GroupMatches({ view, group }: { view: TournamentView; group: number }) {
  const matches = view.matches.filter((m) => m.group === group);
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-muted">
        {t('tournament.matchesDone', { done: matches.filter((m) => m.outcome).length, all: matches.length })}
      </summary>
      <div className="mt-1 grid grid-cols-2 gap-1">
        {matches.map((m) => (
          <MatchCard key={m.id} view={view} m={m} />
        ))}
      </div>
    </details>
  );
}

function SwissRounds({ view }: { view: TournamentView }) {
  // Eine Liga steht von Anfang an fest und liest sich vorwärts; im Schweizer System zuerst die neueste Runde.
  const league = view.settings.format === 'league';
  const rounds = [...new Set(view.matches.map((m) => m.stage))].sort((a, b) => (league ? a - b : b - a));
  return (
    <>
      {rounds.map((stage) => (
        <Section key={stage} title={`${t(league ? 'tournament.matchday' : 'tournament.round', { n: stage + 1 })}${disciplineOfStage(view, stage) ? ` · ${disciplineName(view, disciplineOfStage(view, stage)!)}` : ''}`}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
            {view.matches
              .filter((m) => m.stage === stage)
              .map((m) => (
                <MatchCard key={m.id} view={view} m={m} />
              ))}
          </div>
        </Section>
      ))}
    </>
  );
}

interface BracketColumn {
  key: string;
  label: string;
  deadline: number;
  matches: Match[];
}

/**
 * Ein Baum. Breit: alle Runden nebeneinander. Handy: je Runde eine Ansicht mit Reitern,
 * damit die Seite nie waagerecht rollt; die Reiter zeigen zugleich, wo man im Baum steht.
 */
function Bracket({ view, title, hint, columns }: { view: TournamentView; title: string; hint?: string; columns: BracketColumn[] }) {
  const own = [...columns].reverse().find((column) => column.matches.some((m) => m.slots.some((s) => s.player && s.player === view.you)))?.key;
  const [picked, setPicked] = useState<string | null>(null);
  const live = columns.find((column) => column.matches.some((m) => !m.outcome))?.key;
  const shown = columns.find((column) => column.key === (picked ?? own ?? live)) ?? columns[0];
  if (!shown) return null;
  return (
    <Section title={title}>
      {hint && <p className="text-sm text-muted">{hint}</p>}
      <div className="md:hidden">
        <div role="tablist" className="mb-2 flex flex-wrap gap-1">
          {columns.map((column) => (
            <button
              key={column.key}
              type="button"
              role="tab"
              aria-selected={column.key === shown.key}
              className={`min-h-9 rounded-full border px-3 text-xs ${column.key === shown.key ? 'border-accent bg-accent/10 font-semibold' : 'border-line bg-surface'}`}
              onClick={() => setPicked(column.key)}
            >
              {column.key === own && '📍 '}
              {column.label}
            </button>
          ))}
        </div>
        {!isLocalView(view) && <p className="mb-1 text-xs text-muted">{deadlineNote(view, shown.deadline)}</p>}
        <div className="space-y-2">
          {shown.matches.map((m) => (
            <MatchCard key={m.id} view={view} m={m} title={koMatchName(m.id)} />
          ))}
        </div>
      </div>
      <div className="hidden gap-3 md:flex">
        {columns.map((column) => (
          <div key={column.key} className="flex min-w-0 flex-1 flex-col">
            <p className="truncate text-center text-xs font-semibold">{column.label}</p>
            {!isLocalView(view) && <p className="mb-2 truncate text-center text-[11px] text-muted">{deadlineShort(view, column.deadline)}</p>}
            <div className="flex flex-1 flex-col justify-around gap-2">
              {column.matches.map((m) => (
                <MatchCard key={m.id} view={view} m={m} title={m.thirdPlace ? t('tournament.thirdPlace') : undefined} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

/** Der Baum von WM-Form und K.-o. */
function KnockoutBracket({ view }: { view: TournamentView }) {
  const columns = view.stages.flatMap((stage, index) => (stage.kind === 'ko' ? [{ key: String(index), label: roundName(stage.round), deadline: stage.deadline, matches: view.matches.filter((m) => m.stage === index) }] : []));
  return <Bracket view={view} title={t('tournament.bracket')} columns={columns} />;
}

/** Runden einer Seite des Doppel-K.-o., Partien ohne jeden Spieler fallen weg. */
function doubleColumns(view: TournamentView, prefix: 'w' | 'l'): BracketColumn[] {
  const rounds = new Map<number, Match[]>();
  for (const m of view.matches) {
    if (!m.id.startsWith(prefix)) continue;
    if (m.outcome?.bye && !m.slots[0].player && !m.slots[1].player) continue;
    const round = Number(m.id.slice(1).split('-')[0]);
    rounds.set(round, [...(rounds.get(round) ?? []), m]);
  }
  return [...rounds.entries()]
    .sort(([a], [b]) => a - b)
    .map(([round, matches]) => ({ key: String(round), label: t('tournament.round', { n: round }), deadline: view.stages[matches[0]!.stage]?.deadline ?? 0, matches }));
}

function DoubleBracket({ view }: { view: TournamentView }) {
  const finals = view.matches
    .filter((m) => m.id === 'gf' || m.id === 'gf2')
    .map((m) => ({ key: m.id, label: koMatchName(m.id), deadline: view.stages[m.stage]?.deadline ?? 0, matches: [m] }));
  return (
    <>
      <Bracket view={view} title={t('tournament.upper')} hint={t('tournament.doubleHint')} columns={doubleColumns(view, 'w')} />
      <Bracket view={view} title={t('tournament.lower')} columns={doubleColumns(view, 'l')} />
      <Bracket view={view} title={t('tournament.finals')} columns={finals} />
    </>
  );
}

function Podium({ view }: { view: TournamentView }) {
  const { label } = useLookup(view);
  const medals = ['🥇', '🥈', '🥉'];
  return (
    <Section title={t('tournament.ended')}>
      {view.podium.length === 0 && <p className="text-muted">{t('tournament.bothLost')}</p>}
      <ol className="space-y-1 text-lg">
        {view.podium.map((id, index) => (
          <li key={id} className={index === 0 ? 'font-bold' : ''}>
            {medals[index]} {label(id)}
          </li>
        ))}
      </ol>
    </Section>
  );
}

function History({ view }: { view: TournamentView }) {
  const { label } = useLookup(view);
  const recent = view.matches
    .filter((m) => m.outcome && !m.outcome.bye)
    .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0))
    .slice(0, 6);
  const open = view.matches.filter((m) => m.status === 'open');
  // Vor Ort zeigt die Tischübersicht schon, was noch offen ist.
  const showOpen = view.phase === 'running' && !isLocalView(view);
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Section title={t('tournament.recent')}>
        {recent.length === 0 && <p className="text-sm text-muted">–</p>}
        <ul className="space-y-1 text-sm">
          {recent.map((m) => {
            const { winner } = m.outcome!;
            const note = outcomeNote(m);
            return (
              <li key={m.id} className="truncate">
                {winner === null ? `${label(m.slots[0].player)} – ${label(m.slots[1].player)}` : t('tournament.beat', { a: label(m.slots[winner].player), b: label(m.slots[1 - winner]!.player) })}
                {m.outcome!.score && <span className="tabular-nums"> {(winner === 1 ? [...m.outcome!.score].reverse() : m.outcome!.score).join(':')}</span>}
                {note && <span className="text-muted"> ({note})</span>}
              </li>
            );
          })}
        </ul>
      </Section>
      {showOpen && (
        <Section title={`${t('tournament.open')} (${open.length})`}>
          <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
            {open.map((m) => (
              <li key={m.id} className="truncate">
                {label(m.slots[0].player)} – {label(m.slots[1].player)}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Leitung

function LeaderTools({ view, code, send, claim, onBoard }: { view: TournamentView; code: string; send: Send; claim: { player: string; code: string } | null; onBoard: () => void }) {
  const { label, players } = useLookup(view);
  const [matchId, setMatchId] = useState('');
  const match = view.matches.find((m) => m.id === matchId);
  const candidates = view.matches.filter((m) => m.status !== 'waiting' && m.slots[0].player && m.slots[1].player);
  const claimLink = claim && `${window.location.origin}${window.location.pathname}${paths.tournament(code)}?neu=${claim.code}`;
  const FIELD = 'min-h-11 w-full rounded-xl border border-line bg-surface px-3';
  const local = isLocalView(view);
  return (
    <Section title={t('tournament.tools')}>
      <Button className="w-full" onClick={onBoard}>
        📺 {t('tournament.board')}
      </Button>
      {local && <SpectatorLink view={view} code={code} />}
      {local && view.phase !== 'finished' && <Helpers view={view} code={code} send={send} />}
      {local && view.phase === 'running' && view.settings.format === 'swiss' && <EntrantForm view={view} send={send} label={t('tournament.lateEntry')} />}
      {local && view.phase === 'running' && view.settings.format !== 'tables' && (
        <label className="block space-y-1 text-sm">
          <span>{t('tournament.fieldCount')}</span>
          <select className={FIELD} value={view.fields} onChange={(e) => send({ type: 'setFields', count: Number(e.target.value) })}>
            {Array.from({ length: 33 }, (_, n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      )}
      {local && view.phase !== 'finished' && view.settings.format !== 'tables' && <SchedulePanel view={view} send={send} />}
      {view.phase !== 'signup' && local && view.settings.format !== 'tables' && (
        <div className="space-y-2">
          <label className="block space-y-1 text-sm">
            <span>{t('tournament.correct')}</span>
            <select className={FIELD} value={matchId} onChange={(e) => setMatchId(e.target.value)}>
              <option value="">{t('tournament.pickMatch')}</option>
              {view.matches
                .filter((m) => m.outcome && !m.outcome.bye && m.slots[0].player && m.slots[1].player)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {matchTitle(view, m)}: {players.get(m.slots[0].player!)?.name} – {players.get(m.slots[1].player!)?.name}
                    {m.outcome?.score ? ` (${m.outcome.score.join(':')})` : ''}
                  </option>
                ))}
            </select>
          </label>
          {match && <ResultForm key={match.id} view={view} m={match} send={send} onDone={() => setMatchId('')} />}
        </div>
      )}
      {view.phase === 'running' && (
        <>
          {!local && !isEveningView(view) && (
          <div className="grid grid-cols-3 gap-2">
            {[1, 3, 7].map((n) => (
              <Button key={n} className="text-xs" onClick={() => send({ type: 'extend', days: n })}>
                {t('tournament.extend', { n })}
              </Button>
            ))}
          </div>
          )}
          {isEveningView(view) && view.stages[view.currentStage]?.startedAt !== undefined && (
          <div className="grid grid-cols-3 gap-2">
            {EVENING_EXTEND_CHOICES.map((n) => (
              <Button key={n} className="text-xs" onClick={() => send({ type: 'extend', days: 0, minutes: n })}>
                {t('tournament.extendMinutes', { n })}
              </Button>
            ))}
          </div>
          )}
          {!local && view.settings.format !== 'tables' && (
          <div className="space-y-2">
            <label className="block space-y-1 text-sm">
              <span>{t('tournament.setResult')}</span>
              <select className={FIELD} value={matchId} onChange={(e) => setMatchId(e.target.value)}>
                <option value="">{t('tournament.pickMatch')}</option>
                {candidates.map((m) => (
                  <option key={m.id} value={m.id}>
                    {matchTitle(view, m)}: {players.get(m.slots[0].player!)?.name} – {players.get(m.slots[1].player!)?.name}
                  </option>
                ))}
              </select>
            </label>
            {match && (
              <div className="grid grid-cols-2 gap-2">
                <Button className="text-xs" onClick={() => send({ type: 'setResult', match: match.id, winner: 0 })}>
                  {t('tournament.winner', { name: label(match.slots[0].player) })}
                </Button>
                <Button className="text-xs" onClick={() => send({ type: 'setResult', match: match.id, winner: 1 })}>
                  {t('tournament.winner', { name: label(match.slots[1].player) })}
                </Button>
                {(match.group !== null || view.settings.format === 'swiss') && (
                  <Button className="text-xs" onClick={() => send({ type: 'setResult', match: match.id, winner: 'draw' })}>
                    {t('tournament.draw')}
                  </Button>
                )}
                <Button className="text-xs" onClick={() => send({ type: 'setResult', match: match.id, winner: 'none' })}>
                  {t('tournament.noWinner')}
                </Button>
              </div>
            )}
          </div>
          )}
          <ul className="space-y-1">
            {view.players.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-sm">
                <span className={`min-w-0 flex-1 truncate ${p.withdrawn ? 'text-muted line-through' : ''}`}>{label(p.id)}</span>
                {!local && (
                  <Button className="text-xs" onClick={() => send({ type: 'reissue', player: p.id })}>
                    🔑 {t('tournament.reissue')}
                  </Button>
                )}
                {!p.withdrawn && (
                  <Button
                    className="text-xs"
                    onClick={() => {
                      if (window.confirm(t('tournament.withdrawConfirm', { name: p.name }))) send({ type: 'withdraw', player: p.id });
                    }}
                  >
                    {t('tournament.withdraw')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {claim && claimLink && (
            <div className="space-y-2 rounded-xl border border-line p-3">
              <p className="text-sm">{t('tournament.reissued', { name: players.get(claim.player)?.name ?? '' })}</p>
              <div className="mx-auto w-40">
                <QrCode text={claimLink} label={t('tournament.reissue')} />
              </div>
              <p className="text-center font-mono">{claim.code}</p>
            </div>
          )}
        </>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Druck und Export (W-058 Stufe 2): über den Browser, „Als PDF speichern“ inklusive.

type PrintKind = 'plan' | 'sheets' | 'tables' | 'certificates';

/** Partien in Spielreihenfolge, ohne Freilose und ohne Partien, die nie zustande kommen. */
function printableMatches(view: TournamentView): Match[] {
  return view.matches.filter((m) => !m.outcome?.bye && !(m.status === 'done' && (!m.slots[0].player || !m.slots[1].player))).sort((a, b) => a.stage - b.stage);
}

function stageTitle(view: TournamentView, index: number): string {
  const stage = view.stages[index];
  if (!stage) return '';
  if (stage.kind === 'group') return t('tournament.groups');
  if (stage.kind === 'league') return t('tournament.matchday', { n: stage.round });
  if (stage.kind === 'ko') return roundName(stage.round);
  return t('tournament.round', { n: stage.round });
}

function resultText(m: Match): string {
  const o = m.outcome;
  if (!o) return '';
  if (o.score) return o.score.join(':');
  if (o.draw) return t('tournament.draw');
  return o.winner === null ? '–' : o.winner === 0 ? '1:0' : '0:1';
}

function PrintTools({ view, onPrint }: { view: TournamentView; onPrint: (kind: PrintKind) => void }) {
  const download = (name: string, type: string, text: string) => {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };
  const base = view.settings.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'turnier';
  const names = new Map(view.players.map((p) => [p.id, p.name]));
  const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = (rows: (string | number)[][]) => '\ufeff' + rows.map((row) => row.map(csvCell).join(';')).join('\r\n');
  const exportMatches = () =>
    download(
      `${base}-partien.csv`,
      'text/csv;charset=utf-8',
      csv([
        [t('tournament.csv.round'), t('tournament.csv.match'), t('tournament.csv.a'), t('tournament.csv.b'), t('tournament.csv.result'), t('tournament.csv.field')],
        ...printableMatches(view).map((m) => [matchTitle(view, m), m.id, names.get(m.slots[0].player ?? '') ?? '', names.get(m.slots[1].player ?? '') ?? '', resultText(m), m.field !== undefined ? m.field + 1 : '']),
      ]),
    );
  const exportTable = () => {
    const rows = view.table.length > 0 ? view.table : view.groups.flatMap((g) => g.table);
    download(
      `${base}-tabelle.csv`,
      'text/csv;charset=utf-8',
      csv([
        [t('tournament.table.place'), t('tournament.table.player'), t('tournament.table.played'), t('tournament.table.wins'), t('tournament.table.draws'), t('tournament.table.losses'), t('tournament.csv.scored'), t('tournament.csv.conceded'), t('tournament.table.points')],
        ...rows.map((r, i) => [i + 1, names.get(r.player) ?? '', r.played, r.wins, r.draws, r.losses, r.scored, r.conceded, r.points]),
      ]),
    );
  };
  const kinds: [PrintKind, string][] = [
    ['plan', `📋 ${t('tournament.print.plan')}`],
    ['sheets', `📝 ${t('tournament.print.sheets')}`],
    ['tables', `📊 ${t('tournament.print.tables')}`],
    ...(view.phase === 'finished' ? ([['certificates', `🏅 ${t('tournament.print.certificates')}`]] as [PrintKind, string][]) : []),
  ];
  if (view.phase === 'signup') return null;
  return (
    <Section title={t('tournament.print')}>
      <div className="grid grid-cols-2 gap-2">
        {kinds.map(([kind, label]) => (
          <Button key={kind} className="text-sm" onClick={() => onPrint(kind)}>
            {label}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Button className="text-xs" onClick={exportMatches}>
          ⬇️ {t('tournament.csv.matches')}
        </Button>
        <Button className="text-xs" onClick={exportTable} disabled={view.table.length === 0 && view.groups.length === 0}>
          ⬇️ {t('tournament.csv.table')}
        </Button>
        <Button className="text-xs" onClick={() => download(`${base}.json`, 'application/json', JSON.stringify({ ...view, helpers: [] }, null, 2))}>
          ⬇️ JSON
        </Button>
      </div>
    </Section>
  );
}

/** Druckansicht: weiß, ohne Bedienelemente im Druck; der Druckdialog öffnet sich gleich. */
/** Tischrunden zum Drucken: Sitzplan je Runde oder ein Zettel je offenem Tisch. */
function PrintTables({ view, sheets, heading }: { view: TournamentView; sheets: boolean; heading: ReactNode }) {
  const { label } = useLookup(view);
  const games = view.tableGames.filter((g) => !sheets || g.status !== 'done');
  if (sheets) {
    return (
      <div className="grid grid-cols-2 gap-4">
        {games.map((g) => (
          <div key={g.id} className="break-inside-avoid rounded border-2 border-black p-3 text-sm">
            <p className="text-xs">
              {view.settings.name} · {t('tournament.round', { n: g.stage + 1 })} · {fieldName(view, g.index)}
            </p>
            {g.seats.map((id) => (
              <div key={id} className="mt-2 flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-base font-bold">{label(id)}</span>
                <span className="h-9 w-14 border-2 border-black" />
              </div>
            ))}
            <p className="mt-2 text-xs">{t('tournament.print.tableSheet')}</p>
            <p className="mt-4 border-t border-black pt-1 text-xs">{t('tournament.print.signature')}</p>
          </div>
        ))}
      </div>
    );
  }
  const stages = [...new Set(games.map((g) => g.stage))];
  return (
    <>
      {heading}
      {stages.map((stage) => (
        <section key={stage} className="mb-4 break-inside-avoid">
          <h2 className="mb-1 font-bold">{t('tournament.round', { n: stage + 1 })}</h2>
          <table className="w-full border-collapse text-sm">
            <tbody>
              {games
                .filter((g) => g.stage === stage)
                .map((g) => (
                  <tr key={g.id} className="border-b border-gray-300">
                    <td className="w-24 py-1 pr-2 text-xs">{fieldName(view, g.index)}</td>
                    <td className="py-1">{g.seats.map((id, i) => `${label(id)}${g.places ? ` (${g.places[i]! + 1}.)` : ''}`).join(' · ')}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      ))}
    </>
  );
}

function PrintView({ view, kind, onClose }: { view: TournamentView; kind: PrintKind; onClose: () => void }) {
  const { label } = useLookup(view);
  useEffect(() => {
    const timer = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(timer);
  }, []);
  const local = isLocalView(view);
  const unit = local && view.settings.result && view.settings.result !== 'winner' ? t(`tournament.result.${view.settings.result}`) : '';
  const heading = (
    <header className="mb-3">
      <h1 className="text-2xl font-bold">🏆 {view.settings.name}</h1>
      <p className="text-sm">
        {view.disciplines.length > 0 ? (view.settings.sport ?? t('tournament.multiSport')) : local ? view.settings.sport : findGame(view.settings.gameId)?.name} · {t(`tournament.format.${view.settings.format}`)} · {new Date(view.serverNow).toLocaleDateString('de-DE')}
      </p>
    </header>
  );
  const stages = [...new Set(printableMatches(view).map((m) => m.stage))];
  return (
    <div className="bub-print min-h-full bg-white p-6 text-black">
      <div className="mb-4 flex gap-2 print:hidden">
        <Button onClick={() => window.print()}>🖨️ {t('tournament.print.now')}</Button>
        <Button onClick={onClose}>{t('tournament.boardClose')}</Button>
      </div>
      {view.settings.format === 'tables' && (kind === 'plan' || kind === 'sheets') && <PrintTables view={view} sheets={kind === 'sheets'} heading={heading} />}
      {kind === 'plan' && view.settings.format !== 'tables' && (
        <>
          {heading}
          {stages.map((stage) => (
            <section key={stage} className="mb-4 break-inside-avoid">
              <h2 className="mb-1 font-bold">{stageTitle(view, stage)}</h2>
              <table className="w-full border-collapse text-sm">
                <tbody>
                  {printableMatches(view)
                    .filter((m) => m.stage === stage)
                    .map((m) => (
                      <tr key={m.id} className="border-b border-gray-300">
                        {view.schedule && <td className="w-14 py-1 text-xs tabular-nums">{m.plannedAt !== undefined ? clock(m.plannedAt) : ''}</td>}
                        {/* In Liga und Schweizer System steht die Runde schon in der Überschrift. */}
                        {view.settings.format !== 'league' && view.settings.format !== 'swiss' && <td className="w-40 py-1 pr-2 text-xs">{matchTitle(view, m)}</td>}
                        <td className="py-1">{m.slots[0].player ? label(m.slots[0].player) : '…'}</td>
                        <td className="w-6 text-center">–</td>
                        <td className="py-1">{m.slots[1].player ? label(m.slots[1].player) : '…'}</td>
                        <td className="w-20 text-right font-bold tabular-nums">{resultText(m) || '___ : ___'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </section>
          ))}
        </>
      )}
      {kind === 'sheets' && view.settings.format !== 'tables' && (
        <div className="grid grid-cols-2 gap-4">
          {printableMatches(view)
            .filter((m) => !m.outcome && m.slots[0].player && m.slots[1].player)
            .map((m) => (
              <div key={m.id} className="break-inside-avoid rounded border-2 border-black p-3 text-sm">
                <p className="text-xs">
                  {view.settings.name} · {matchTitle(view, m)}
                  {m.field !== undefined && ` · ${fieldName(view, m.field)}`}
                  {m.plannedAt !== undefined && ` · ${clock(m.plannedAt)}`}
                  {m.referee && ` · ${t('tournament.referee', { name: label(m.referee) })}`}
                </p>
                {[0, 1].map((side) => (
                  <div key={side} className="mt-2 flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-base font-bold">{label(m.slots[side]!.player)}</span>
                    <span className="h-9 w-14 border-2 border-black" />
                  </div>
                ))}
                <p className="mt-2 text-xs">{unit ? `${unit} eintragen` : t('tournament.print.markWinner')}</p>
                <p className="mt-4 border-t border-black pt-1 text-xs">{t('tournament.print.signature')}</p>
              </div>
            ))}
        </div>
      )}
      {kind === 'tables' && (
        <>
          {heading}
          {view.groups.map((g, index) => (
            <section key={index} className="mb-4 break-inside-avoid">
              <h2 className="font-bold">{t('tournament.group', { name: GROUP_LETTERS[index] ?? String(index + 1) })}</h2>
              <Table view={view} rows={g.table} highlight={2} />
            </section>
          ))}
          {view.table.length > 0 && <Table view={view} rows={view.table} highlight={view.phase === 'finished' ? 3 : 0} buchholz={view.settings.format === 'swiss'} />}
          {view.matches.some((m) => m.group === null && view.stages[m.stage]?.kind !== 'swiss' && view.stages[m.stage]?.kind !== 'league') && (
            <section className="mt-4">
              <h2 className="font-bold">{t('tournament.bracket')}</h2>
              <ul className="text-sm">
                {printableMatches(view)
                  .filter((m) => m.group === null)
                  .map((m) => (
                    <li key={m.id}>
                      {matchTitle(view, m)}: {label(m.slots[0].player)} – {label(m.slots[1].player)} {resultText(m)}
                    </li>
                  ))}
              </ul>
            </section>
          )}
        </>
      )}
      {kind === 'certificates' &&
        view.podium.map((id, index) => (
          <section key={id} className="flex min-h-[90vh] break-after-page flex-col items-center justify-center gap-6 border-8 border-double border-black p-10 text-center">
            <p className="text-5xl">{['🥇', '🥈', '🥉'][index]}</p>
            <h1 className="text-4xl font-bold">{t('tournament.print.certificate')}</h1>
            <p className="text-xl">{view.settings.name}</p>
            <p className="text-4xl font-bold">{view.players.find((p) => p.id === id)?.name}</p>
            <p className="text-2xl">{t('tournament.print.place', { n: index + 1 })}</p>
            <p className="text-sm">
              {view.disciplines.length > 0 ? (view.settings.sport ?? t('tournament.multiSport')) : local ? view.settings.sport : findGame(view.settings.gameId)?.name} · {new Date(view.serverNow).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <p className="mt-10 w-64 border-t border-black pt-1 text-sm">{view.leaderName}</p>
          </section>
        ))}
    </div>
  );
}
