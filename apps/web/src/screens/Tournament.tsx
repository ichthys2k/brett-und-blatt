import { READY_WINDOW_MS, TOURNAMENT_MIN_PLAYERS, type StandingRow, type TournamentView } from '@brett-und-blatt/online';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Section } from '../components/controls';
import { ProfileForm, QrCode } from '../components/OnlineParts';
import { t } from '../i18n';
import { notifyTurn, requestNotificationPermission } from '../lib/notifications';
import { GAME_SERVER } from '../lib/online';
import { passChanged } from '../lib/playerPass';
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

export function TournamentScreen({ code, claim }: { code: string; claim?: string }) {
  const [profile, setProfile] = useState<Profile | null>(() => storage.loadProfile());
  const [state, send] = useTournament(code, profile);
  const [board, setBoard] = useState(false);
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

  // Wer hier eingeschrieben ist oder leitet, findet das Turnier auf „Online spielen“ wieder.
  useEffect(() => {
    if (!view || !(view.you || view.isLeader)) return;
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
  if (!profile) {
    return (
      <Page>
        <h1 className="text-2xl font-bold">🏆 {t('tournament.title')}</h1>
        <Section title={t('online.profile')}>
          <ProfileForm
            initial={null}
            submitLabel={t('online.enter')}
            onSave={(next) => {
              storage.saveProfile(next);
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
  const subtitle = (
    <p className="text-sm text-muted">
      {game?.emoji} {game?.name} · {t(`tournament.format.${view.settings.format}`)} · {t('tournament.leader', { name: view.leaderName })}
      {optionText.length > 0 && <span className="block">{optionText.join(' · ')}</span>}
      {view.rulesChanged && <span className="block text-warning">⚠️ {t('tournament.rulesChanged')}</span>}
    </p>
  );

  if (view.phase === 'signup') {
    return (
      <Page>
        {header}
        {subtitle}
        <SignupView view={view} code={code} send={send} />
        {banners}
      </Page>
    );
  }

  if (board) {
    return (
      <div className="fixed inset-0 z-40 overflow-auto bg-bg p-4 text-lg">
        <div className="mb-3 flex items-center gap-3">
          <h1 className="min-w-0 flex-1 truncate text-3xl font-bold">🏆 {view.settings.name}</h1>
          <Button onClick={() => setBoard(false)}>{t('tournament.boardClose')}</Button>
        </div>
        <Progress view={view} />
      </div>
    );
  }

  return (
    <Page>
      {header}
      {subtitle}
      {view.phase === 'finished' && <Podium view={view} />}
      <MyStand view={view} send={send} />
      <Progress view={view} />
      <History view={view} />
      {view.isLeader && <LeaderTools view={view} code={code} send={send} claim={state.claim} onBoard={() => setBoard(true)} />}
      {banners}
    </Page>
  );
}

// ---------------------------------------------------------------------------
// Einschreibung

function SignupView({ view, code, send }: { view: TournamentView; code: string; send: ReturnType<typeof useTournament>[1] }) {
  const min = TOURNAMENT_MIN_PLAYERS[view.settings.format];
  const link = `${window.location.origin}${window.location.pathname}${paths.tournament(code)}`;
  return (
    <>
      <Section title={t('tournament.signup')}>
        <p className="text-sm text-muted">{t('tournament.signupOpen', { n: view.players.length, min })}</p>
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
        {view.isLeader && (
          <Button
            variant="primary"
            className="w-full"
            disabled={view.players.length < min}
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

function MyStand({ view, send }: { view: TournamentView; send: ReturnType<typeof useTournament>[1] }) {
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
                  {matchTitle(view, m)} · {t('tournament.deadline', { date: formatDate(stage.deadline) })}
                  {m.replays > 0 && ` · ${t('tournament.replay')}`}
                </p>
              )}
              {m.status === 'running' ? (
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

function matchTitle(view: TournamentView, m: Match): string {
  if (m.group !== null) return t('tournament.group', { name: GROUP_LETTERS[m.group]! });
  if (view.stages[m.stage]?.kind === 'swiss') return t('tournament.round', { n: m.stage + 1 });
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
                {t('tournament.group', { name: GROUP_LETTERS[index]! })} <span className="text-xs font-normal text-muted">({group.settled ? t('tournament.final') : `${t('tournament.provisional')}, ${t('tournament.deadline', { date: formatDate(view.stages[0]!.deadline) })}`})</span>
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
      <Section title={t('tournament.table')}>
        <p className="text-xs text-muted">
          {t('tournament.round', { n: Math.min(view.currentStage + 1, view.stages.length) })} / {view.stages.length} · {t('tournament.deadline', { date: formatDate(view.stages[view.currentStage]?.deadline ?? 0) })} · {view.phase === 'finished' ? t('tournament.final') : t('tournament.provisional')}
        </p>
        <Table view={view} rows={view.swissTable} highlight={view.phase === 'finished' ? 1 : 0} buchholz />
      </Section>
      <SwissRounds view={view} />
    </>
  );
}

function Table({ view, rows, highlight, buchholz = false }: { view: TournamentView; rows: StandingRow[]; highlight: number; buchholz?: boolean }) {
  const { players, label } = useLookup(view);
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
          <p key={side} className={`truncate ${won ? 'font-bold' : ''} ${lost ? 'text-muted' : ''} ${slot.player ? '' : 'text-xs text-muted italic'}`}>
            {won && '🏅 '}
            {m.outcome?.bye && !slot.player ? t('tournament.bye') : slotLabel(slot)}
          </p>
        );
      })}
      {m.status === 'running' && (
        <p className="mt-1 flex items-center justify-between gap-2 text-xs font-semibold text-accent">
          <span>🔴 {t('tournament.live')}</span>
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
  const rounds = [...new Set(view.matches.map((m) => m.stage))].sort((a, b) => b - a);
  return (
    <>
      {rounds.map((stage) => (
        <Section key={stage} title={t('tournament.round', { n: stage + 1 })}>
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
        <p className="mb-1 text-xs text-muted">{t('tournament.deadline', { date: formatDate(shown.deadline) })}</p>
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
            <p className="mb-2 truncate text-center text-[11px] text-muted">{formatDate(column.deadline)}</p>
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
                {note && <span className="text-muted"> ({note})</span>}
              </li>
            );
          })}
        </ul>
      </Section>
      {view.phase === 'running' && (
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

function LeaderTools({ view, code, send, claim, onBoard }: { view: TournamentView; code: string; send: ReturnType<typeof useTournament>[1]; claim: { player: string; code: string } | null; onBoard: () => void }) {
  const { label, players } = useLookup(view);
  const [matchId, setMatchId] = useState('');
  const match = view.matches.find((m) => m.id === matchId);
  const candidates = view.matches.filter((m) => m.status !== 'waiting' && m.slots[0].player && m.slots[1].player);
  const claimLink = claim && `${window.location.origin}${window.location.pathname}${paths.tournament(code)}?neu=${claim.code}`;
  const FIELD = 'min-h-11 w-full rounded-xl border border-line bg-surface px-3';
  return (
    <Section title={t('tournament.tools')}>
      <Button className="w-full" onClick={onBoard}>
        📺 {t('tournament.board')}
      </Button>
      {view.phase === 'running' && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {[1, 3, 7].map((n) => (
              <Button key={n} className="text-xs" onClick={() => send({ type: 'extend', days: n })}>
                {t('tournament.extend', { n })}
              </Button>
            ))}
          </div>
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
          <ul className="space-y-1">
            {view.players.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-sm">
                <span className={`min-w-0 flex-1 truncate ${p.withdrawn ? 'text-muted line-through' : ''}`}>{label(p.id)}</span>
                <Button className="text-xs" onClick={() => send({ type: 'reissue', player: p.id })}>
                  🔑 {t('tournament.reissue')}
                </Button>
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
