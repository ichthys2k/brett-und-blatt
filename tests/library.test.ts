import { describe, expect, it } from 'vitest';
import { emptyCollection, migrateLibrary, packsOf, rowsFromText, savePackRows, textFromRows, type UserPack } from '../packages/engine/src';


const old: UserPack = { id: 'p-12345678', name: 'Vokabeln', at: 1_700_000_000_000, rows: [{ id: 'r-000001', a: 'house', b: 'Haus' }, { id: 'r-000002', a: 'dog', b: 'Hund' }] };

describe('Bibliothek (#101, L1): Text bearbeiten, Notizen behalten', () => {
  it('eine unveränderte Zeile bleibt dieselbe Notiz, auch wenn eine andere neu dazukommt', () => {
    const col = migrateLibrary([old]);
    const [pack] = packsOf(col);
    const edited = `${textFromRows(pack!.rows)}\ncat;Katze`;
    const { rows } = rowsFromText(edited, pack!.rows);
    expect(rows.slice(0, 2).map((r) => r.id)).toEqual(pack!.rows.map((r) => r.id));
    const saved = savePackRows(col, pack!.id, pack!.name, rows, old.at + 60_000);
    const guids = new Set(col.notes.map((n) => n.guid));
    expect(saved.col.notes.filter((n) => guids.has(n.guid))).toHaveLength(2);
    expect(saved.col.notes).toHaveLength(3);
    expect(saved.col.graves).toEqual([]);
  });
  it('wer eine Zeile umschreibt, behält die Notiz (ähnliche Zeile)', () => {
    const col = migrateLibrary([old]);
    const [pack] = packsOf(col);
    const { rows } = rowsFromText('house;Haus am See\ndog;Hund', pack!.rows);
    const saved = savePackRows(col, pack!.id, pack!.name, rows, old.at + 60_000);
    expect(saved.col.notes).toHaveLength(2);
    expect(saved.col.notes.map((n) => n.guid).sort()).toEqual(col.notes.map((n) => n.guid).sort());
  });
  it('eine neue Sammlung hat keine Pakete', () => {
    expect(packsOf(emptyCollection())).toEqual([]);
  });
});
