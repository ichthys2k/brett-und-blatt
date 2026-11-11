import { describe, expect, it } from 'vitest';
import {
  GAME_CARD_TEMPLATES,
  generateTemplateCollection,
  type GameCardTemplateId,
} from '../src/lib/gameCardTemplates';

describe('Spielkarten-Vorlagen für Anki (K4, #274)', () => {
  it('besitzt 11 vorkonfigurierte Vorlagensätze', () => {
    expect(GAME_CARD_TEMPLATES).toHaveLength(11);
    const ids = GAME_CARD_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(11);
  });

  const templateIds: GameCardTemplateId[] = [
    'spielblatt-alle',
    'spielblatt-franz',
    'spielblatt-bayer',
    'drachenspiel',
    'narrenhof',
    'quartett-tiere',
    'quartett-weltraum',
    'quartett-dinosaurier',
    'quartett-bibel',
    'quartett-geometrie',
    'woelfe',
  ];

  for (const id of templateIds) {
    it(`generiert eine valide AnkiCollection für Vorlage '${id}'`, async () => {
      const col = await generateTemplateCollection(id);
      expect(col.v).toBe(2);
      expect(col.notetypes.length).toBeGreaterThanOrEqual(1);
      expect(col.decks.length).toBeGreaterThanOrEqual(2);
      expect(col.notes.length).toBeGreaterThan(0);

      // Jede Notiz muss mindestens so viele Felder haben wie der Notiztyp vorgibt
      const notetype = col.notetypes[0]!;
      for (const note of col.notes) {
        expect(note.fields.length).toBeGreaterThanOrEqual(notetype.flds.length);
        expect(note.guid).toBeTruthy();
        expect(note.mid).toBe(notetype.id);
      }
    });
  }
});
