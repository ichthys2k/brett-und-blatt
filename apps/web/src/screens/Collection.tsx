import { addDeck, deckTree, findDuplicates, notesWithoutCards, removeDeck, removeNote, renameDeck, searchNotes, stripHtmlKeepMedia, type AnkiCollection, type AnkiNote } from '@brett-und-blatt/engine';
import { useMemo, useState } from 'react';
import { Button } from '../components/controls';
import { TavernPage } from '../components/TavernPage';
import { OWN, useMediaResolver, useSource } from '../lib/collectionSource';
import { paths } from '../lib/router';
import { NoteEditor } from './NoteEditor';
import { NotetypeEditor } from './NotetypeEditor';

const FIELD = 'min-h-11 w-full rounded-xl border border-line bg-surface px-3';
const PAGE = 50;
type Mode = 'list' | 'note' | 'types' | 'decks' | 'clean';

const plain = (html: string, max = 70): string => {
  // Bilder und Ton als Zeichen statt als Dateiname.
  const t = stripHtmlKeepMedia(html.replace(/<img\b[^>]*>/gi, ' 🖼 ').replace(/\[sound:[^\]]*\]|<audio\b[^>]*>(?:<\/audio>)?/gi, ' 🔊 ')).replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

/** Notizen, Stapel und Notiztypen bearbeiten (#101, L4): die eigene Sammlung oder ein importiertes Anki-Paket. */
export function CollectionScreen({ source }: { source: string }) {
  const src = useSource(source);
  const media = useMediaResolver(src.media);
  const [mode, setMode] = useState<Mode>('list');
  const [query, setQuery] = useState('');
  const [deckId, setDeckId] = useState<number | 'all'>('all');
  const [selected, setSelected] = useState<AnkiNote | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const col = src.collection;
  const tree = useMemo(() => deckTree(col), [col]);

  const notes = useMemo(() => {
    const found = searchNotes(col, query);
    if (deckId === 'all') return found;
    const deck = col.decks.find((d) => d.id === deckId);
    if (!deck) return found;
    const ids = new Set(col.decks.filter((d) => d.id === deck.id || d.name.startsWith(`${deck.name}::`)).map((d) => d.id));
    return found.filter((n) => ids.has(n.did));
  }, [col, query, deckId]);

  const title = src.name || 'Sammlung';
  if (src.status === 'loading') return <TavernPage title={title} back={paths.library}><p role="status">Einen Moment …</p></TavernPage>;
  if (src.status === 'missing')
    return (
      <TavernPage title="Sammlung" back={paths.library}>
        <p>Dieses Paket gibt es auf diesem Gerät nicht (mehr).</p>
      </TavernPage>
    );

  return (
    <TavernPage title={title} subtitle={source === OWN ? 'Notizen, Stapel und Notiztypen bearbeiten.' : 'Importiertes Anki-Paket bearbeiten.'} back={paths.library} wide>
      {mode === 'note' ? (
        <NoteEditor
          key={selected?.id ?? 'neu'}
          collection={col}
          note={selected}
          defaultDeckId={deckId === 'all' ? (tree.find((d) => d.id !== 1)?.id ?? 1) : deckId}
          media={media}
          onSave={src.update}
          onClose={() => (setMode('list'), setSelected(null))}
        />
      ) : mode === 'types' ? (
        <NotetypeEditor collection={col} media={media} onChange={src.update} onClose={() => setMode('list')} />
      ) : mode === 'decks' ? (
        <DeckManager collection={col} onChange={src.update} onClose={() => setMode('list')} />
      ) : mode === 'clean' ? (
        <Cleanup collection={col} onChange={src.update} onClose={() => setMode('list')} />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => (setSelected(null), setMode('note'))}>
              ➕ Notiz
            </Button>
            <Button onClick={() => setMode('decks')}>🗂️ Stapel</Button>
            <Button onClick={() => setMode('types')}>🧩 Notiztypen</Button>
            <Button onClick={() => setMode('clean')}>🧹 Aufräumen</Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
            <label className="block space-y-1 text-sm">
              <span>Suchen</span>
              <input type="search" className={FIELD} value={query} onChange={(e) => (setQuery(e.target.value), setLimit(PAGE))} placeholder={'Wort, "Satz", tag:nomen, deck:Latein, -nicht'} />
            </label>
            <label className="block space-y-1 text-sm">
              <span>Stapel</span>
              <select className={FIELD} value={deckId} onChange={(e) => (setDeckId(e.target.value === 'all' ? 'all' : Number(e.target.value)), setLimit(PAGE))}>
                <option value="all">Alle ({col.notes.length})</option>
                {tree.map((d) => (
                  <option key={d.id} value={d.id}>
                    {'– '.repeat(d.depth)}
                    {d.label} ({d.total})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p role="status" className="text-sm text-muted">
            {notes.length} {notes.length === 1 ? 'Notiz' : 'Notizen'}
            {query ? ' gefunden' : ''}
          </p>
          {notes.length === 0 ? (
            <p className="text-muted">{col.notes.length === 0 ? 'Noch keine Notizen. Lege mit „➕ Notiz“ die erste an.' : 'Nichts gefunden.'}</p>
          ) : (
            <ul className="space-y-1" aria-label="Notizen">
              {notes.slice(0, limit).map((n) => (
                <li key={n.id}>
                  <button type="button" className="flex w-full min-h-11 items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2 text-left hover:bg-surface-2" onClick={() => (setSelected(n), setMode('note'))}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{plain(n.fields[0] ?? '') || '(leer)'}</span>
                      <span className="block truncate text-xs text-muted">{plain(n.fields.slice(1).join(' · '))}</span>
                    </span>
                    <span className="flex-none text-xs text-muted">{col.notetypes.find((t) => t.id === n.mid)?.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {notes.length > limit && <Button className="w-full" onClick={() => setLimit(limit + PAGE)}>Mehr anzeigen ({notes.length - limit} weitere)</Button>}
        </div>
      )}
    </TavernPage>
  );
}

function DeckManager({ collection, onChange, onClose }: { collection: AnkiCollection; onChange: (c: AnkiCollection) => void; onClose: () => void }) {
  const [name, setName] = useState('');
  const tree = deckTree(collection);
  return (
    <section className="space-y-3" aria-labelledby="deck-mgr">
      <h2 id="deck-mgr" className="text-xl">
        Stapel
      </h2>
      <p className="text-sm text-muted">Unterstapel schreibst du mit zwei Doppelpunkten: <code>Latein::Nomen</code>.</p>
      <ul className="space-y-2">
        {tree.map((d) => (
          <li key={d.id} className="flex items-center gap-2" style={{ paddingLeft: `${d.depth * 1.25}rem` }}>
            <input key={d.name} className={FIELD} defaultValue={d.name} aria-label={`Name des Stapels ${d.name}`} disabled={d.id === 1} onBlur={(e) => onChange(renameDeck(collection, d.id, e.target.value))} />
            <span className="flex-none text-xs text-muted">{d.total}</span>
            <Button
              variant="ghost"
              aria-label={`${d.name} löschen`}
              disabled={d.id === 1}
              onClick={() => {
                if (window.confirm(`Den Stapel „${d.name}“ mit seinen ${d.own} Notizen löschen?`)) onChange(removeDeck(collection, d.id));
              }}
            >
              🗑️
            </Button>
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onChange(addDeck(collection, name).col);
          setName('');
        }}
      >
        <input className={FIELD} value={name} onChange={(e) => setName(e.target.value)} placeholder="Neuer Stapel" aria-label="Name des neuen Stapels" maxLength={120} />
        <Button type="submit" disabled={!name.trim()}>
          ➕
        </Button>
      </form>
      <Button variant="primary" className="w-full" onClick={onClose}>
        Fertig
      </Button>
    </section>
  );
}

function Cleanup({ collection, onChange, onClose }: { collection: AnkiCollection; onChange: (c: AnkiCollection) => void; onClose: () => void }) {
  const duplicates = findDuplicates(collection);
  const empty = notesWithoutCards(collection);
  return (
    <section className="space-y-4" aria-labelledby="cleanup">
      <h2 id="cleanup" className="text-xl">
        Aufräumen
      </h2>
      <div className="space-y-2">
        <h3 className="text-lg">Doppelte Notizen ({duplicates.length})</h3>
        {duplicates.length === 0 && <p className="text-sm text-muted">Keine Notizen mit gleichem ersten Feld.</p>}
        {duplicates.map((group) => (
          <ul key={group[0]!.id} className="space-y-1 rounded-xl border border-line p-2">
            {group.map((n) => (
              <li key={n.id} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {plain(n.fields[0] ?? '')} · {plain(n.fields.slice(1).join(' · '), 40)}
                </span>
                <Button variant="ghost" aria-label="Diese Notiz löschen" onClick={() => onChange(removeNote(collection, n.id))}>
                  🗑️
                </Button>
              </li>
            ))}
          </ul>
        ))}
      </div>
      <div className="space-y-2">
        <h3 className="text-lg">Notizen ohne Karte ({empty.length})</h3>
        <p className="text-sm text-muted">Bei diesen Notizen wäre jede Vorderseite leer. Sie lassen sich löschen oder durch Ausfüllen eines Feldes retten.</p>
        {empty.length > 0 && (
          <Button
            onClick={() => {
              if (window.confirm(`${empty.length} Notizen ohne Karte löschen?`)) onChange(empty.reduce((c, n) => removeNote(c, n.id), collection));
            }}
          >
            Alle {empty.length} löschen
          </Button>
        )}
      </div>
      <Button variant="primary" className="w-full" onClick={onClose}>
        Fertig
      </Button>
    </section>
  );
}
