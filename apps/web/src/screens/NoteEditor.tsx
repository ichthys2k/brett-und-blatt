import { addNote, changeNotetype, deckTree, previewCards, removeNote, stripHtmlKeepMedia, updateNote, type AnkiCollection, type AnkiNote } from '@brett-und-blatt/engine';
import { useMemo, useState } from 'react';
import { CardPreview } from '../components/CardPreview';
import { Button } from '../components/controls';
import { RichField } from '../components/RichField';

const FIELD = 'min-h-11 w-full rounded-xl border border-line bg-surface px-3';

/** Neue oder vorhandene Notiz bearbeiten (#101, L4): Felder, Tags, Stapel, Notiztyp, dazu die Vorschau der Karten. */
export function NoteEditor({ collection, note, defaultDeckId, media, onSave, onClose }: { collection: AnkiCollection; note: AnkiNote | null; defaultDeckId: number; media: (name: string) => string | null; onSave: (next: AnkiCollection) => void; onClose: () => void }) {
  const firstType = collection.notetypes[0]!;
  const [mid, setMid] = useState(note?.mid ?? firstType.id);
  const [deckId, setDeckId] = useState(note?.did ?? defaultDeckId);
  const [fields, setFields] = useState<string[]>(note?.fields ?? firstType.flds.map(() => ''));
  const [tags, setTags] = useState((note?.tags ?? []).join(' '));
  const [error, setError] = useState<string | null>(null);
  const nt = collection.notetypes.find((t) => t.id === mid) ?? firstType;
  const decks = deckTree(collection);

  /** Beim Wechsel des Notiztyps: Felder gleichen Namens behalten ihren Inhalt, sonst nach Reihenfolge. */
  const switchType = (next: number) => {
    const target = collection.notetypes.find((t) => t.id === next);
    if (!target) return;
    const map = target.flds.map((f, i) => {
      const byName = nt.flds.findIndex((o) => o.name === f.name);
      return byName >= 0 ? byName : i < nt.flds.length ? i : -1;
    });
    setFields(map.map((from) => (from >= 0 ? (fields[from] ?? '') : '')));
    setMid(next);
  };

  const draft: AnkiNote = useMemo(() => ({ id: note?.id ?? 0, guid: note?.guid ?? 'neu', mid, did: deckId, mod: 0, tags: tags.split(/\s+/).filter(Boolean), fields }), [note, mid, deckId, tags, fields]);
  const cards = useMemo(() => (fields.length === nt.flds.length ? previewCards(collection, draft, { media }) : []), [collection, draft, media, fields.length, nt.flds.length]);
  const empty = !stripHtmlKeepMedia(fields[0] ?? '').trim();

  const save = (close: boolean) => {
    setError(null);
    try {
      let next: AnkiCollection;
      if (note) {
        next = note.mid === mid ? collection : changeNotetype(collection, note.id, mid, nt.flds.map((_, i) => i));
        next = updateNote(next, note.id, { fields, tags: draft.tags, did: deckId });
      } else {
        next = addNote(collection, { notetypeId: mid, deckId, fields, tags: draft.tags }).col;
      }
      onSave(next);
      if (close) onClose();
      else if (!note) setFields(nt.flds.map(() => ''));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Das Speichern hat nicht geklappt.');
    }
  };

  return (
    <section className="space-y-3" aria-labelledby="note-editor">
      <h2 id="note-editor" className="text-xl">
        {note ? 'Notiz bearbeiten' : 'Neue Notiz'}
      </h2>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block space-y-1 text-sm">
          <span>Notiztyp</span>
          <select className={FIELD} value={mid} onChange={(e) => switchType(Number(e.target.value))}>
            {collection.notetypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span>Stapel</span>
          <select className={FIELD} value={deckId} onChange={(e) => setDeckId(Number(e.target.value))}>
            {decks.map((d) => (
              <option key={d.id} value={d.id}>
                {'– '.repeat(d.depth)}
                {d.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {nt.flds.map((f, i) => (
        <RichField key={`${mid}-${f.name}`} id={`note-field-${i}`} label={f.name} value={fields[i] ?? ''} media={media} cloze={nt.type === 1 && i === 0} onChange={(html) => setFields((old) => old.map((v, j) => (j === i ? html : v)))} />
      ))}
      <label className="block space-y-1 text-sm">
        <span>Tags (mit Leerzeichen getrennt)</span>
        <input className={FIELD} value={tags} onChange={(e) => setTags(e.target.value)} />
      </label>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="space-y-3" aria-label="Vorschau der Karten">
        <h3 className="text-lg">Karten</h3>
        {cards.length === 0 ? <p className="text-sm text-muted">{empty ? 'Mit einer leeren Vorderseite entsteht keine Karte.' : 'Aus diesen Feldern entsteht keine Karte.'}</p> : cards.map((c) => <CardPreview key={c.ord} collection={collection} note={draft} ord={c.ord} media={media} label={c.name} />)}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={onClose}>{note ? 'Schließen' : 'Abbrechen'}</Button>
        <Button variant="primary" disabled={empty} onClick={() => save(true)}>
          Speichern
        </Button>
      </div>
      {!note && (
        <Button className="w-full" disabled={empty} onClick={() => save(false)}>
          Speichern und weitere Notiz
        </Button>
      )}
      {note && (
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => {
            if (window.confirm('Diese Notiz mit allen ihren Karten löschen?')) {
              onSave(removeNote(collection, note.id));
              onClose();
            }
          }}
        >
          🗑️ Notiz löschen
        </Button>
      )}
    </section>
  );
}
