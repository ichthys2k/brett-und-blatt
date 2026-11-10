import {
  addField,
  addTemplate,
  cloneNotetype,
  moveField,
  removeField,
  removeNotetype,
  removeTemplate,
  renameField,
  renameNotetype,
  updateNotetypeCss,
  updateTemplate,
  type AnkiCollection,
  type AnkiNote,
} from '@brett-und-blatt/engine';
import { useMemo, useState } from 'react';
import { CardPreview } from '../components/CardPreview';
import { Button } from '../components/controls';

const FIELD = 'min-h-11 w-full rounded-xl border border-line bg-surface px-3';
const AREA = 'min-h-28 w-full rounded-xl border border-line bg-surface px-3 py-2 font-mono text-sm';

/** Notiztypen bearbeiten (#101, L4): Felder, Vorlagen (Vorderseite, Rückseite), Aussehen (CSS), mit Vorschau. */
export function NotetypeEditor({ collection, media, onChange, onClose }: { collection: AnkiCollection; media: (name: string) => string | null; onChange: (next: AnkiCollection) => void; onClose: () => void }) {
  const [typeId, setTypeId] = useState(collection.notetypes[0]!.id);
  const [tmplOrd, setTmplOrd] = useState(0);
  const [newField, setNewField] = useState('');
  const nt = collection.notetypes.find((t) => t.id === typeId) ?? collection.notetypes[0]!;
  const ord = Math.min(tmplOrd, nt.tmpls.length - 1);
  const used = collection.notes.filter((n) => n.mid === nt.id).length;
  // Ändert sich ein Feldname, schreiben wir die Vorlagen neu; die Textfelder müssen dann den neuen Text zeigen (beim Tippen nicht).
  const fieldsKey = nt.flds.map((f) => f.name).join('\u0000');

  const sample: AnkiNote = useMemo(() => {
    const existing = collection.notes.find((n) => n.mid === nt.id);
    if (existing) return existing;
    return { id: 1, guid: 'vorschau', mid: nt.id, did: 1, mod: 0, tags: [], fields: nt.flds.map((f, i) => (nt.type === 1 && i === 0 ? '{{c1::Beispiel}} mit {{c2::Lücken}}' : `Beispiel ${f.name}`)) };
  }, [collection.notes, nt]);

  return (
    <section className="space-y-4" aria-labelledby="nt-editor">
      <h2 id="nt-editor" className="text-xl">
        Notiztypen
      </h2>
      <label className="block space-y-1 text-sm">
        <span>Notiztyp</span>
        <select className={FIELD} value={nt.id} onChange={(e) => (setTypeId(Number(e.target.value)), setTmplOrd(0))}>
          {collection.notetypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({collection.notes.filter((n) => n.mid === t.id).length} Notizen)
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1 text-sm">
        <span>Name</span>
        <input key={nt.id} className={FIELD} defaultValue={nt.name} maxLength={100} onBlur={(e) => onChange(renameNotetype(collection, nt.id, e.target.value))} />
      </label>

      <fieldset className="space-y-2">
        <legend className="font-semibold">Felder</legend>
        <ul className="space-y-2">
          {nt.flds.map((f, i) => (
            <li key={`${nt.id}-${i}-${f.name}`} className="flex items-center gap-1">
              <input className={FIELD} defaultValue={f.name} aria-label={`Name von Feld ${i + 1}`} maxLength={100} onBlur={(e) => onChange(renameField(collection, nt.id, i, e.target.value))} />
              <Button variant="ghost" aria-label={`${f.name} nach oben`} disabled={i === 0} onClick={() => onChange(moveField(collection, nt.id, i, i - 1))}>
                ↑
              </Button>
              <Button variant="ghost" aria-label={`${f.name} nach unten`} disabled={i === nt.flds.length - 1} onClick={() => onChange(moveField(collection, nt.id, i, i + 1))}>
                ↓
              </Button>
              <Button
                variant="ghost"
                aria-label={`${f.name} löschen`}
                disabled={nt.flds.length <= 1}
                onClick={() => {
                  if (used === 0 || window.confirm(`Das Feld „${f.name}“ samt seinem Inhalt in ${used} Notizen löschen?`)) onChange(removeField(collection, nt.id, i));
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
            onChange(addField(collection, nt.id, newField));
            setNewField('');
          }}
        >
          <input className={FIELD} value={newField} onChange={(e) => setNewField(e.target.value)} placeholder="Neues Feld" aria-label="Name des neuen Feldes" maxLength={100} />
          <Button type="submit" disabled={!newField.trim()}>
            ➕
          </Button>
        </form>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="font-semibold">{nt.type === 1 ? 'Vorlage (Lückentext)' : 'Karten (Vorlagen)'}</legend>
        {nt.type !== 1 && (
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Vorlagen">
            {nt.tmpls.map((t, i) => (
              <button key={i} type="button" role="tab" aria-selected={i === ord} className="min-h-11 rounded-xl border border-line px-3 text-sm aria-selected:border-[3px] aria-selected:font-semibold" onClick={() => setTmplOrd(i)}>
                {t.name}
              </button>
            ))}
            <Button variant="ghost" onClick={() => (onChange(addTemplate(collection, nt.id, '')), setTmplOrd(nt.tmpls.length))}>
              ➕ Karte
            </Button>
          </div>
        )}
        <label className="block space-y-1 text-sm">
          <span>Name der Karte</span>
          <input key={`${nt.id}-${ord}-name`} className={FIELD} defaultValue={nt.tmpls[ord]!.name} onBlur={(e) => onChange(updateTemplate(collection, nt.id, ord, { name: e.target.value }))} />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Vorderseite</span>
          <textarea key={`${nt.id}-${ord}-q-${fieldsKey}`} className={AREA} defaultValue={nt.tmpls[ord]!.qfmt} onChange={(e) => onChange(updateTemplate(collection, nt.id, ord, { qfmt: e.target.value }))} />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Rückseite</span>
          <textarea key={`${nt.id}-${ord}-a-${fieldsKey}`} className={AREA} defaultValue={nt.tmpls[ord]!.afmt} onChange={(e) => onChange(updateTemplate(collection, nt.id, ord, { afmt: e.target.value }))} />
        </label>
        <p className="text-xs text-muted">Felder stehen in doppelten geschweiften Klammern, z. B. {'{{Vorderseite}}'}. Mit {'{{#Feld}}…{{/Feld}}'} erscheint ein Teil nur, wenn das Feld Inhalt hat. Skripte in Vorlagen werden hier nicht ausgeführt.</p>
        {nt.type !== 1 && nt.tmpls.length > 1 && (
          <Button
            variant="ghost"
            onClick={() => {
              if (window.confirm(`Die Karte „${nt.tmpls[ord]!.name}“ mit allen ihren Karten löschen?`)) onChange(removeTemplate(collection, nt.id, ord));
            }}
          >
            🗑️ Diese Karte löschen
          </Button>
        )}
      </fieldset>

      <label className="block space-y-1 text-sm">
        <span>Aussehen (CSS)</span>
        <textarea key={`${nt.id}-css`} className={AREA} defaultValue={nt.css} onChange={(e) => onChange(updateNotetypeCss(collection, nt.id, e.target.value))} />
      </label>

      <div className="space-y-2" aria-label="Vorschau">
        <h3 className="text-lg">Vorschau</h3>
        <CardPreview collection={collection} note={sample} ord={nt.type === 1 ? 0 : ord} media={media} label={sample.id === 1 && sample.guid === 'vorschau' ? 'mit Beispielwerten' : 'mit der ersten Notiz dieses Typs'} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={() => {
            const copy = cloneNotetype(collection, nt.id, `${nt.name} (Kopie)`);
            if (copy) (onChange(copy.col), setTypeId(copy.id), setTmplOrd(0));
          }}
        >
          Kopieren
        </Button>
        <Button
          disabled={used > 0 || collection.notetypes.length <= 1}
          title={used > 0 ? 'Wird noch von Notizen benutzt' : undefined}
          onClick={() => {
            if (window.confirm(`Den Notiztyp „${nt.name}“ löschen?`)) {
              onChange(removeNotetype(collection, nt.id));
              setTypeId(collection.notetypes.find((t) => t.id !== nt.id)!.id);
            }
          }}
        >
          Löschen
        </Button>
      </div>
      <Button variant="primary" className="w-full" onClick={onClose}>
        Fertig
      </Button>
    </section>
  );
}
