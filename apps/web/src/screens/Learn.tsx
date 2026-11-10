import { ANSWER_LABELS, CARD_SCOPE, DEFAULT_LEARN_OPTIONS, deckTree, outcomes, renderCard, searchNotes, unsupportedHints, type Answer, type ApkgCard, type LearnOptions } from '@brett-und-blatt/engine';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CARD_BASE_CSS } from '../components/CardPreview';
import { CardHtml } from '../components/CardHtml';
import { Button } from '../components/controls';
import { TavernPage } from '../components/TavernPage';
import { listPacks, type PackSummary } from '../lib/ankiStore';
import { OWN, useMediaResolver } from '../lib/collectionSource';
import { dueInfo, useLearner, type Learner } from '../lib/learner';
import { paths } from '../lib/router';

const FIELD = 'min-h-11 w-full rounded-xl border border-line bg-surface px-3';

/** Ein Takt pro Minute, damit fällige Lernkarten und der Tageswechsel nachziehen. */
function useNow(): [number, () => void] {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return [now, () => setNow(Date.now())];
}

const total = (c: { new: number; learning: number; review: number }): number => c.new + c.learning + c.review;

/** Übersicht (#/lernen): die eigenen Notizen und die importierten Pakete mit ihren heute fälligen Karten. */
export function LearnHome() {
  const own = useLearner(OWN);
  const [now] = useNow();
  const [packs, setPacks] = useState<PackSummary[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    listPacks().then(
      (list) => !cancelled && setPacks(list),
      () => !cancelled && setPacks([]),
    );
    return () => {
      cancelled = true;
    };
  }, []);
  const ownDue = own.status === 'ready' ? dueInfo(own, now) : null;
  return (
    <TavernPage title="Lernen" subtitle="Karteikasten mit Wiederholung nach FSRS." back={paths.menu}>
      <div className="space-y-3">
        <p className="text-sm text-muted">Hier wiederholst du Karten aus deinen Notizen und aus importierten Anki-Paketen. Die Termine plant FSRS; der Lernstand bleibt auf deinem Gerät und geht über den Pass auf deine anderen Geräte.</p>
        <ul className="space-y-2" aria-label="Lernquellen">
          <li>
            <SourceCard href={paths.learning(OWN)} title="📝 Meine Notizen" counts={ownDue?.counts ?? null} cards={own.cards.length} streak={ownDue?.streak ?? 0} />
          </li>
          {packs?.map((p) => (
            <li key={p.id}>
              <SourceCard href={paths.learning(p.id)} title={`📦 ${p.name}`} counts={p.due} cards={p.cards} streak={0} />
            </li>
          ))}
        </ul>
        {packs?.length === 0 && (
          <p className="text-sm text-muted">
            Noch kein Anki-Paket importiert. Unter <a className="underline" href={paths.library}>Meine Pakete</a> kannst du <code>.apkg</code>-Dateien einlesen.
          </p>
        )}
      </div>
    </TavernPage>
  );
}

function SourceCard({ href, title, counts, cards, streak }: { href: string; title: string; counts: { new: number; learning: number; review: number } | null; cards: number; streak: number }) {
  const due = counts ? total(counts) : null;
  return (
    <a className="flex min-h-14 items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-sm hover:bg-surface-2" href={href}>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{title}</span>
        <span className="block text-sm text-muted">
          {cards} {cards === 1 ? 'Karte' : 'Karten'}
          {counts ? ` · neu ${counts.new} · lernen ${counts.learning} · fällig ${counts.review}` : ''}
          {streak > 0 ? ` · 🔥 ${streak} ${streak === 1 ? 'Tag' : 'Tage'} in Folge` : ''}
        </span>
      </span>
      <span className="flex-none rounded-full bg-accent px-3 py-1 text-sm font-semibold text-accent-ink" aria-label={due === null ? undefined : `${due} Karten heute`}>
        {due === null ? '…' : due}
      </span>
    </a>
  );
}

/** Lernen mit einer Quelle (#/lernen/<meine | Paketkennung>). */
export function LearnScreen({ source }: { source: string }) {
  const learner = useLearner(source);
  const media = useMediaResolver(learner.media);
  const [now, refreshNow] = useNow();
  const [deck, setDeck] = useState<number | 'all'>('all');
  const [running, setRunning] = useState(false);
  const [practice, setPractice] = useState<ApkgCard[] | null>(null);
  const title = learner.name || 'Lernen';
  if (learner.status === 'loading') return <TavernPage title={title} back={paths.learn}><p role="status">Einen Moment …</p></TavernPage>;
  if (learner.status === 'missing')
    return (
      <TavernPage title="Lernen" back={paths.learn}>
        <p>Dieses Paket gibt es auf diesem Gerät nicht (mehr).</p>
      </TavernPage>
    );
  const info = dueInfo(learner, now, deck);
  return (
    <TavernPage title={title} subtitle="Karteikasten" back={running ? paths.learning(source) : paths.learn}>
      {learner.notice && <p role="note" className="mb-3 rounded-xl border border-line bg-surface-2 p-3 text-sm">{learner.notice}</p>}
      {running ? <Session learner={learner} media={media} deck={deck} now={now} refreshNow={refreshNow} practice={practice} onStop={() => (setRunning(false), setPractice(null))} /> : <Overview learner={learner} deck={deck} setDeck={setDeck} info={info} onStart={() => (refreshNow(), setRunning(true))} onPractice={(cards) => (setPractice(cards), setRunning(true))} />}
    </TavernPage>
  );
}

function Overview({ learner, deck, setDeck, info, onStart, onPractice }: { learner: Learner; deck: number | 'all'; setDeck: (d: number | 'all') => void; info: ReturnType<typeof dueInfo>; onStart: () => void; onPractice: (cards: ApkgCard[]) => void }) {
  const tree = useMemo(() => deckTree(learner.collection), [learner.collection]);
  const open = total(info.counts);
  return (
    <div className="space-y-4">
      <label className="block space-y-1 text-sm">
        <span>Stapel</span>
        <select className={FIELD} value={deck} onChange={(e) => setDeck(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
          <option value="all">Alle Karten ({learner.cards.length})</option>
          {tree.map((d) => (
            <option key={d.id} value={d.id}>
              {'– '.repeat(d.depth)}
              {d.label}
            </option>
          ))}
        </select>
      </label>
      <dl className="grid grid-cols-3 gap-2 text-center" aria-label="Heute zu lernen">
        {([['Neu', info.counts.new], ['Lernen', info.counts.learning], ['Fällig', info.counts.review]] as const).map(([label, n]) => (
          <div key={label} className="rounded-xl border border-line bg-surface p-3">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="text-2xl font-bold">{n}</dd>
          </div>
        ))}
      </dl>
      <p role="status" className="text-sm text-muted">
        Heute schon {info.today.answered} {info.today.answered === 1 ? 'Antwort' : 'Antworten'}
        {info.streak > 0 ? ` · 🔥 ${info.streak} ${info.streak === 1 ? 'Lerntag' : 'Lerntage'} in Folge` : ''}
      </p>
      <Button variant="primary" className="w-full" disabled={open === 0} onClick={onStart}>
        {open === 0 ? 'Für heute ist alles geschafft 🎉' : `Lernen starten (${open})`}
      </Button>
      <PracticePanel learner={learner} onPractice={onPractice} />
      <OptionsEditor options={learner.options} onChange={learner.setOptions} />
    </div>
  );
}

function OptionsEditor({ options, onChange }: { options: LearnOptions; onChange: (o: LearnOptions) => void }) {
  const [steps, setSteps] = useState(options.learningSteps.join(' '));
  const [resteps, setResteps] = useState(options.relearningSteps.join(' '));
  const num = (label: string, value: number, key: keyof LearnOptions, min: number, max: number, step = 1, suffix = '') => (
    <label className="block space-y-1 text-sm">
      <span>{label}</span>
      <input className={FIELD} type="number" inputMode="decimal" min={min} max={max} step={step} value={value} onChange={(e) => e.target.value !== '' && onChange({ ...options, [key]: Number(e.target.value) })} aria-describedby={suffix ? undefined : undefined} />
    </label>
  );
  return (
    <details className="rounded-xl border border-line p-3">
      <summary className="min-h-11 cursor-pointer py-2 font-medium">Einstellungen</summary>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {num('Neue Karten pro Tag', options.newPerDay, 'newPerDay', 0, 9999)}
        {num('Wiederholungen pro Tag', options.reviewsPerDay, 'reviewsPerDay', 0, 9999)}
        {num('Gewünschte Behaltensquote (0,7 bis 0,99)', options.retention, 'retention', 0.7, 0.99, 0.01)}
        {num('Längstes Intervall (Tage)', options.maxInterval, 'maxInterval', 1, 36500)}
        <label className="block space-y-1 text-sm">
          <span>Lernschritte (z. B. „1m 10m“)</span>
          <input className={FIELD} value={steps} onChange={(e) => setSteps(e.target.value)} onBlur={() => onChange({ ...options, learningSteps: steps.split(/\s+/).filter(Boolean) })} />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Schritte nach Vergessen</span>
          <input className={FIELD} value={resteps} onChange={(e) => setResteps(e.target.value)} onBlur={() => onChange({ ...options, relearningSteps: resteps.split(/\s+/).filter(Boolean) })} />
        </label>
      </div>
      <div className="mt-3 space-y-2 text-sm">
        <label className="block space-y-1">
          <span>Planer</span>
          <select className={FIELD} value={options.scheduler} onChange={(e) => onChange({ ...options, scheduler: e.target.value === 'sm2' ? 'sm2' : 'fsrs' })}>
            <option value="fsrs">FSRS (empfohlen, Behaltensquote)</option>
            <option value="sm2">SM-2 (klassisch: Faktor und Intervalle)</option>
          </select>
        </label>
        {options.scheduler === 'fsrs' && (
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" className="size-5 accent-accent" checked={options.fuzz} onChange={(e) => onChange({ ...options, fuzz: e.target.checked })} />
            <span>Intervalle leicht streuen (Fuzz)</span>
          </label>
        )}
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" className="size-5 accent-accent" checked={options.burySiblings} onChange={(e) => onChange({ ...options, burySiblings: e.target.checked })} />
          <span>Geschwisterkarten am selben Tag zurückhalten</span>
        </label>
        <label className="block space-y-1">
          <span>Egel: Karte nach so vielen Malen Vergessen zurückstellen (0 = nie)</span>
          <input className={FIELD} type="number" inputMode="numeric" min={0} max={99} value={options.leech} onChange={(e) => e.target.value !== '' && onChange({ ...options, leech: Number(e.target.value) })} />
        </label>
        <p className="text-xs text-muted">Nicht unterstützt: „Easy Days“ (Lernlast auf Wochentage verteilen) und der Anki-Planer v3 mit Tageslernen; die Einstellungen aus Anki bleiben im Paket erhalten.</p>
      </div>
      <p className="mt-2 text-xs text-muted">Minuten (m), Stunden (h) oder Tage (d). Ungültige Eingaben werden durch die Vorgabe ({DEFAULT_LEARN_OPTIONS.learningSteps.join(' ')}) ersetzt.</p>
    </details>
  );
}

function Session({ learner, media, deck, now, refreshNow, practice, onStop }: { learner: Learner; media: (name: string) => string | null; deck: number | 'all'; now: number; refreshNow: () => void; practice: ApkgCard[] | null; onStop: () => void }) {
  const info = dueInfo(learner, now, deck);
  const [done, setDone] = useState(0);
  const [leechNote, setLeechNote] = useState(false);
  // Üben einer Auswahl: feste Reihenfolge, nichts am Plan ändern; sonst die Warteschlange von heute.
  const current: ApkgCard | undefined = practice ? practice[done] : info.queue[0];
  const [shown, setShown] = useState(false);
  const [typed, setTyped] = useState('');
  const since = useRef(Date.now());
  const noteOf = useMemo(() => new Map(learner.collection.notes.map((n) => [n.id, n])), [learner.collection]);
  const note = current ? noteOf.get(current.nid) : undefined;

  useEffect(() => {
    since.current = Date.now();
    setShown(false);
    setTyped('');
  }, [current?.id, current?.reps]);

  const rendered = useMemo(() => (current && note ? renderCard(learner.collection, note, current.ord, { media, typed: shown ? typed : undefined }) : null), [current, note, learner.collection, media, shown, typed]);
  const hints = useMemo(() => {
    const nt = note ? learner.collection.notetypes.find((t) => t.id === note.mid) : undefined;
    return note ? unsupportedHints([...note.fields, ...(nt?.tmpls.flatMap((t) => [t.qfmt, t.afmt]) ?? [])]) : [];
  }, [note, learner.collection]);
  const preview = useMemo(() => (current && !practice ? outcomes(current, learner.crt, now, learner.options, learner.revlog.filter((r) => r.cid === current.id)) : null), [current, practice, learner.crt, now, learner.options, learner.revlog]);

  const give = useCallback(
    (answer: Answer) => {
      if (!current) return;
      if (practice) {
        learner.practice(current, answer, Date.now() - since.current);
        setDone((n) => n + 1);
      } else {
        setLeechNote(learner.answer(current, answer, Date.now() - since.current).leech);
        refreshNow();
      }
    },
    [current, learner, refreshNow, practice],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (!shown && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        setShown(true);
      } else if (shown && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        give(Number(e.key) as Answer);
      } else if (shown && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        give(3);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shown, give]);

  if (!current || !note) {
    const next = learner.cards.filter((c) => c.queue === 1 || c.queue === 2).length;
    return (
      <div className="space-y-4 text-center">
        <p className="text-4xl" aria-hidden="true">🎉</p>
        <p role="status" className="text-lg font-semibold">
          Für jetzt ist alles geschafft.
        </p>
        <p className="text-sm text-muted">
          {info.streak > 0 ? `🔥 ${info.streak} ${info.streak === 1 ? 'Lerntag' : 'Lerntage'} in Folge. ` : ''}
          {practice ? 'Die Auswahl ist durch; dein Plan hat sich nicht geändert.' : next > 0 ? `Die nächsten Karten werden nach dem Plan von ${learner.options.scheduler === 'sm2' ? 'SM-2' : 'FSRS'} fällig.` : 'Alle Karten sind gelernt oder zurückgestellt.'}
        </p>
        <Button variant="primary" className="w-full" onClick={onStop}>
          Zur Übersicht
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p role="status" aria-live="polite" className="text-sm text-muted">
        {practice ? `Üben: Karte ${Math.min(done + 1, practice.length)} von ${practice.length} (ohne Änderung am Plan)` : `Neu ${info.counts.new} · Lernen ${info.counts.learning} · Fällig ${info.counts.review}`}
      </p>
      {leechNote && (
        <p role="alert" className="rounded-xl border border-line bg-surface-2 p-2 text-sm">
          🐛 Egel: Diese Karte wurde zu oft vergessen. Sie ist zurückgestellt und die Notiz hat die Markierung „leech“. Überarbeite die Karte unter „Notizen bearbeiten“.
        </p>
      )}
      {rendered && (
        <figure className="space-y-2" aria-label={shown ? 'Rückseite' : 'Vorderseite'}>
          <style>{`${CARD_BASE_CSS}\n${rendered.css}`}</style>
          <div className={CARD_SCOPE.slice(1)} data-side={shown ? 'answer' : 'question'}>
            <CardHtml
              html={shown ? rendered.answer : rendered.question}
              onInput={(e) => {
                const t = e.target as HTMLInputElement;
                if (t.classList?.contains('bub-typeans')) setTyped(t.value);
              }}
            />
          </div>
          {rendered.errors.length > 0 && <p className="text-sm text-danger">{rendered.errors.join(' ')}</p>}
          {hints.length > 0 && (
            <ul className="list-disc pl-5 text-xs text-muted" aria-label="Hinweise zur Karte">
              {hints.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          )}
        </figure>
      )}
      {!shown ? (
        <Button variant="primary" className="w-full" onClick={() => setShown(true)}>
          Antwort zeigen <span className="text-xs opacity-70">(Leertaste)</span>
        </Button>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Wie gut hast du die Karte gewusst?">
          {([1, 2, 3, 4] as const).map((a) => (
            <Button key={a} variant={a === 3 ? 'primary' : 'secondary'} className="flex-col" onClick={() => give(a)} aria-label={preview ? `${ANSWER_LABELS[a]}, nächster Termin in ${preview[a].label}` : ANSWER_LABELS[a]}>
              <span>{ANSWER_LABELS[a]}</span>
              <span className="text-xs opacity-80">{preview ? `${preview[a].label} · ` : ''}Taste {a}</span>
            </Button>
          ))}
        </div>
      )}
      <Button variant="ghost" className="w-full" onClick={onStop}>
        Aufhören
      </Button>
    </div>
  );
}

/** Üben einer Auswahl (wie ein gefilterter Stapel in Anki, aber ohne den Plan zu ändern): Suche mit Wort, tag:, deck:, note:, -nicht. */
function PracticePanel({ learner, onPractice }: { learner: Learner; onPractice: (cards: ApkgCard[]) => void }) {
  const [query, setQuery] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <details className="rounded-xl border border-line p-3">
      <summary className="min-h-11 cursor-pointer py-2 font-medium">Auswahl üben (ohne Plan)</summary>
      <form
        className="mt-2 space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          const ids = new Set(searchNotes(learner.collection, query).map((n) => n.id));
          const cards = learner.cards.filter((c) => ids.has(c.nid) && c.queue !== -1 && c.type !== 0).sort(() => Math.random() - 0.5);
          // Neue Karten kann man auch üben: sie zählen mit, ändern aber nichts.
          const fresh = learner.cards.filter((c) => ids.has(c.nid) && c.type === 0).sort(() => Math.random() - 0.5);
          const all = [...cards, ...fresh].slice(0, 200);
          if (all.length === 0) return setProblem('Dazu gibt es keine Karten.');
          setProblem(null);
          onPractice(all);
        }}
      >
        <p className="text-sm text-muted">Übe Karten, die du suchst, auch wenn sie nicht fällig sind, zum Beispiel vor einer Prüfung. Dein Plan (Termine, Faktor) bleibt dabei unverändert; die Antworten stehen nur im Protokoll. Beispiele: <code>tag:nomen</code>, <code>deck:Latein</code>, <code>tag:leech</code>.</p>
        <input className={FIELD} aria-label="Suche für die Auswahl" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Suche, leer = alle Karten" />
        <Button type="submit" className="w-full">
          Auswahl üben (höchstens 200 Karten)
        </Button>
        {problem && (
          <p role="alert" className="text-sm text-danger">
            {problem}
          </p>
        )}
      </form>
    </details>
  );
}
