import { SEEK_ANY, SEEK_MAX_GAMES, SEEK_MOODS, SEEK_SEATS, type SeekMood, type SeekNoteView, type SeekSeats } from '@brett-und-blatt/online';
import { useEffect, useRef, useState } from 'react';
import { Button, Section, Segmented } from '../components/controls';
import { ProfileForm } from '../components/OnlineParts';
import { TavernPage } from '../components/TavernPage';
import { useBoard, type BoardState } from '../lib/board';
import { setBoardHidden, useBoardHidden } from '../lib/boardPrefs';
import { loadChoice, saveChoice, startingChoice } from '../lib/boardChoice';
import { useFavorites } from '../lib/favorites';
import { requestNotificationPermission } from '../lib/notifications';
import { saveOwnProfile } from '../lib/playerPass';
import { findGame, games } from '../lib/registry';
import { navigate, paths } from '../lib/router';
import { storage, type Profile } from '../lib/storage';

const MOODS: Record<SeekMood, { emoji: string; label: string }> = {
  relaxed: { emoji: '😌', label: 'Locker' },
  serious: { emoji: '🎯', label: 'Ernst' },
  kids: { emoji: '🧒', label: 'Mit Kindern' },
  learning: { emoji: '📚', label: 'Lernen' },
};

const SEATS: Record<SeekSeats, string> = { any: 'egal', '2': 'zu zweit', '3-4': '3 bis 4', '5+': '5 oder mehr' };

const ERRORS: Record<string, string> = {
  rate: 'Bitte einen Moment warten, bevor du es noch einmal versuchst.',
  name: 'Dein Name passt nicht – bitte ändere ihn in deinem Profil.',
  games: 'Dieses Spiel ist hier nicht möglich.',
  gone: 'Der Zettel hängt nicht mehr.',
  own: 'Auf deinem eigenen Zettel kannst du nicht zustimmen.',
  unknown: 'Das hat nicht geklappt.',
  hello: 'Die Verbindung steht noch nicht.',
  message: 'Das hat nicht geklappt.',
};

/** Spiele, die man zu mehreren online spielen kann (nur sie stehen auf dem Brett zur Wahl). */
const BOARD_GAMES = games.filter((game) => game.players.max >= 2).sort((a, b) => a.name.localeCompare(b.name, 'de'));

const gameLabel = (id: string): string => {
  if (id === SEEK_ANY) return 'Egal, überrascht mich';
  const info = findGame(id);
  return info ? `${info.emoji} ${info.name}` : id;
};

function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/**
 * Schwarzes Brett „Wer hat Lust?“ (#65): Zettel anheften, bei anderen „Bin dabei“ sagen, und sobald genug zusammenkommen,
 * entsteht der Raum. Es gibt keinen Chat – alles läuft über Auswahl.
 */
export function BoardScreen() {
  const hidden = useBoardHidden();
  if (hidden) {
    return (
      <TavernPage title="Schwarzes Brett" subtitle="Ausgeblendet." back={paths.menu}>
        <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
          <p>Du hast die Spielersuche auf diesem Gerät ausgeblendet.</p>
          <Button variant="primary" onClick={() => setBoardHidden(false)}>
            Wieder einblenden
          </Button>
        </div>
      </TavernPage>
    );
  }
  return <Board />;
}

/** Zettel passen zur Wahl der Spielerzahl, wenn sie „egal“ sagen oder dieselbe Größe nennen. */
const matchesSeats = (note: SeekNoteView, wanted: SeekSeats): boolean => wanted === 'any' || note.seats === 'any' || note.seats === wanted;

function Board() {
  const [state, actions] = useBoard();
  const now = useNow();
  const mine = state.notes.find((note) => note.mine) ?? null;
  const [filter, setFilter] = useState('');
  const [seatsFilter, setSeatsFilter] = useState<SeekSeats>('any');
  const [moodFilter, setMoodFilter] = useState<SeekMood | ''>('');
  const others = state.notes.filter(
    (note) =>
      !note.mine &&
      (filter === '' || note.games.includes(filter) || note.games.includes(SEEK_ANY)) &&
      matchesSeats(note, seatsFilter) &&
      (moodFilter === '' || note.mood === moodFilter),
  );

  return (
    <TavernPage title="Schwarzes Brett" subtitle="Wer hat Lust? Zettel anheften, „Bin dabei“ sagen – ohne Chat." back={paths.menu}>
      <div className="space-y-5">
        {state.status !== 'open' && (
          <p role="status" className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted">
            {state.status === 'offline' ? 'Ohne Spieleserver gibt es kein Schwarzes Brett.' : 'Verbinde mit dem Schwarzen Brett …'}
          </p>
        )}
        {state.error && (
          <p role="alert" className="rounded-xl bg-danger px-3 py-2 text-sm text-white">
            {ERRORS[state.error] ?? ERRORS.unknown}
          </p>
        )}

        {state.proposal && <ProposalCard state={state} now={now} onConfirm={actions.confirm} />}

        <Section title="Dein Zettel">
          {mine ? <MyNote note={mine} now={now} onExtend={actions.extend} onWithdraw={actions.withdraw} /> : <NewNote disabled={state.status !== 'open'} onPost={actions.post} />}
        </Section>

        <Section title={`Zettel (${others.length})`}>
          <label className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">Zeig mir Zettel für</span>
            <select className="min-h-11 rounded-xl border border-line bg-surface px-3" value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="">alle Spiele</option>
              {BOARD_GAMES.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.emoji} {game.name}
                </option>
              ))}
            </select>
          </label>
          <Segmented<SeekSeats> label="Wie viele?" value={seatsFilter} choices={SEEK_SEATS.map((value) => ({ value, label: value === 'any' ? 'alle' : SEATS[value] }))} onChange={setSeatsFilter} />
          <Segmented<SeekMood | 'all'>
            label="Stimmung"
            value={moodFilter === '' ? 'all' : moodFilter}
            choices={[{ value: 'all', label: 'alle' }, ...SEEK_MOODS.map((value) => ({ value, label: `${MOODS[value].emoji} ${MOODS[value].label}` }))]}
            onChange={(value) => setMoodFilter(value === 'all' ? '' : value)}
          />
          {others.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">
              {state.notes.some((note) => !note.mine) ? 'Kein Zettel passt zu deiner Auswahl.' : `Gerade hängt kein Zettel${filter ? ' für dieses Spiel' : ''}. Hänge deinen auf – wer Lust hat, sagt „Bin dabei“.`}
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {others.map((note) => (
                <NoteCard key={note.id} note={note} now={now} onJoin={actions.join} onUnjoin={actions.unjoin} />
              ))}
            </ul>
          )}
        </Section>
      </div>
    </TavernPage>
  );
}

function minutesLeft(note: SeekNoteView, now: number): string {
  const minutes = Math.max(0, Math.ceil((note.expiresAt - now) / 60_000));
  return minutes <= 1 ? 'noch eine Minute' : `noch ${minutes} Min.`;
}

function NoteMeta({ note }: { note: SeekNoteView }) {
  const mood = MOODS[note.mood];
  return (
    <p className="text-xs text-muted">
      <span aria-hidden="true">{mood.emoji} </span>
      {mood.label} · {SEATS[note.seats]}
    </p>
  );
}

function NoteCard({ note, now, onJoin, onUnjoin }: { note: SeekNoteView; now: number; onJoin(noteId: string, gameId: string): void; onUnjoin(noteId: string): void }) {
  return (
    <li className="bub-plop space-y-2 rounded-2xl border border-line bg-surface p-3 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="text-3xl" aria-hidden="true">
          {note.avatar}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{note.name}</p>
          <NoteMeta note={note} />
          <p className="text-[11px] text-muted">{minutesLeft(note, now)}</p>
        </div>
      </div>
      {note.room !== undefined ? (
        <div className="space-y-1">
          <p className="text-sm">{gameLabel(note.games[0]!)} – Mitspieler gesucht</p>
          <Button variant="primary" className="min-h-10 text-sm" onClick={() => navigate(paths.room(note.room!))}>
            🚪 Mitspielen
          </Button>
        </div>
      ) : (
      <div className="flex flex-wrap gap-2">
        {note.games.map((gameId) => {
          const joined = note.joined === gameId;
          const votes = note.votes[gameId] ?? 0;
          return (
            <Button key={gameId} variant={joined ? 'primary' : 'secondary'} className="min-h-10 text-sm" aria-pressed={joined} onClick={() => (joined ? onUnjoin(note.id) : onJoin(note.id, gameId))}>
              👍 {gameId === SEEK_ANY ? 'Bin dabei' : gameLabel(gameId)}
              {votes > 0 && <span className="text-xs opacity-80">({votes})</span>}
            </Button>
          );
        })}
      </div>
      )}
    </li>
  );
}

function MyNote({ note, now, onExtend, onWithdraw }: { note: SeekNoteView; now: number; onExtend(): void; onWithdraw(): void }) {
  const votes = Object.values(note.votes).reduce((sum, n) => sum + n, 0);
  return (
    <div className="space-y-2 rounded-2xl border border-accent/40 bg-accent/5 p-3">
      <p className="font-semibold">📌 Dein Zettel hängt – {minutesLeft(note, now)}</p>
      <p className="text-sm">
        {note.room !== undefined ? 'Deine offene Runde: ' : ''}
        {note.games.map(gameLabel).join(' · ')}
        <span className="text-muted"> · {MOODS[note.mood].label} · {SEATS[note.seats]}</span>
      </p>
      <p className="text-sm text-muted">{note.room !== undefined ? 'Wer Lust hat, kommt mit „Mitspielen“ direkt in deinen Raum. Der Zettel verschwindet, sobald die Runde voll ist oder startet.' : votes === 0 ? 'Noch hat niemand „Bin dabei“ gesagt. Lass diese Seite offen – sobald genug Leute zusagen, fragt das Brett dich.' : `${votes} ${votes === 1 ? 'Person ist' : 'Personen sind'} dabei.`}</p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onExtend}>⏳ Verlängern</Button>
        <Button variant="ghost" onClick={onWithdraw}>
          Zurückziehen
        </Button>
      </div>
    </div>
  );
}

function NewNote({ disabled, onPost }: { disabled: boolean; onPost(input: { name: string; avatar: string; games: string[]; seats: string; mood: string }): void }) {
  const [profile, setProfile] = useState<Profile | null>(() => storage.loadProfile());
  const { favorites } = useFavorites();
  const [start] = useState(() => {
    const known = BOARD_GAMES.map((game) => game.id);
    return startingChoice(loadChoice(known), favorites, known);
  });
  const [picked, setPicked] = useState<string[]>(start.games);
  const [seats, setSeats] = useState<SeekSeats>(start.seats);
  const [mood, setMood] = useState<SeekMood>(start.mood);

  if (!profile) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted">Wie sollen dich die anderen nennen? Dein Name und dein Bild stehen auf dem Zettel.</p>
        <ProfileForm
          initial={null}
          submitLabel="Weiter"
          onSave={(next) => {
            saveOwnProfile(next);
            setProfile(next);
          }}
        />
      </div>
    );
  }

  const addable = BOARD_GAMES.filter((game) => !picked.includes(game.id));
  return (
    <div className="space-y-3 rounded-2xl border border-line bg-surface p-3">
      <p className="text-sm">
        <span aria-hidden="true">{profile.avatar} </span>
        <strong>{profile.name}</strong> <span className="text-muted">– so stehst du auf dem Zettel.</span>
      </p>
      <div className="space-y-2">
        <p className="text-sm font-medium">Worauf hast du Lust? (bis zu {SEEK_MAX_GAMES} Spiele)</p>
        <div className="flex flex-wrap gap-2">
          {picked.map((id) => (
            <Button key={id} variant="primary" className="min-h-9 text-sm" aria-label={`${gameLabel(id)} entfernen`} onClick={() => setPicked(picked.filter((p) => p !== id))}>
              {gameLabel(id)} ✕
            </Button>
          ))}
          {picked.length === 0 && <span className="text-sm text-muted">Egal, überrascht mich</span>}
        </div>
        {picked.length < SEEK_MAX_GAMES && (
          <select className="min-h-11 w-full rounded-xl border border-line bg-surface px-3" value="" aria-label="Spiel hinzufügen" onChange={(event) => event.target.value && setPicked([...picked, event.target.value])}>
            <option value="">Spiel hinzufügen …</option>
            {addable.map((game) => (
              <option key={game.id} value={game.id}>
                {game.emoji} {game.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <Segmented<SeekSeats> label="Wie viele?" value={seats} choices={SEEK_SEATS.map((value) => ({ value, label: SEATS[value] }))} onChange={setSeats} />
      <Segmented<SeekMood> label="Stimmung" value={mood} choices={SEEK_MOODS.map((value) => ({ value, label: `${MOODS[value].emoji} ${MOODS[value].label}` }))} onChange={setMood} />
      <Button
        variant="primary"
        className="w-full"
        disabled={disabled}
        onClick={() => {
          saveChoice({ games: picked, seats, mood });
          // Wer anheftet, will wissen, wenn jemand zusagt – auch wenn die Seite im Hintergrund liegt.
          void requestNotificationPermission();
          onPost({ name: profile.name, avatar: profile.avatar, games: picked, seats, mood });
        }}
      >
        📌 Zettel anheften
      </Button>
      <p className="text-xs text-muted">
        Der Zettel hängt 30 Minuten (du kannst ihn verlängern) und verschwindet, wenn du die Seite schließt. Dein nächster Zettel ist so vorbelegt{favorites.length > 0 ? ' (sonst mit deinen Lieblingsspielen)' : ''}. Lass die Seite offen, auch im Hintergrund – dann meldet sich dein Gerät, wenn jemand zusagt.
      </p>
    </div>
  );
}

function ProposalCard({ state, now, onConfirm }: { state: BoardState; now: number; onConfirm(noteId: string, ok: boolean): void }) {
  const proposal = state.proposal!;
  const seconds = Math.max(0, Math.ceil((proposal.deadline - now) / 1000));
  // Der Vorschlag soll nie unter der Falz verschwinden (Handy: die Liste ist lang).
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [proposal.noteId, proposal.gameId]);
  return (
    <section ref={ref} role="alert" className="bub-plop space-y-2 rounded-2xl border-2 border-accent bg-surface p-4 shadow-md" aria-label="Vorschlag">
      <p className="text-lg font-semibold">🎲 {gameLabel(proposal.gameId)} mit {proposal.names.join(', ')} – Los geht’s?</p>
      <p className="text-sm text-muted">
        {proposal.confirmed} von {proposal.total} haben zugesagt · noch {seconds} s
      </p>
      {proposal.youConfirmed ? (
        <p className="text-sm font-medium">✅ Du bist dabei – wir warten auf die anderen.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => onConfirm(proposal.noteId, true)}>
            ✅ Ja, los!
          </Button>
          <Button variant="ghost" onClick={() => onConfirm(proposal.noteId, false)}>
            Lieber nicht
          </Button>
        </div>
      )}
    </section>
  );
}
