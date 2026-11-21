import { describe, expect, it } from 'vitest';
import { isCloseLabel, pickModalEntry } from '../src/input/modalFocus';

describe('Fenster mit Controller (#619)', () => {
  it('erkennt Schließen-Knöpfe', () => {
    for (const label of ['✕', 'Schließen', 'Abbrechen', 'Zurück', 'Fenster schließen', 'Tafel schließen']) expect(isCloseLabel(label)).toBe(true);
    for (const label of ['Rot', 'Partie laden', 'Dame', 'Mit Herz weiter', 'Weiter']) expect(isCloseLabel(label)).toBe(false);
  });
  it('Anfangsfokus: markiert vor erstem, Hintergrund-Knöpfe nie', () => {
    expect(pickModalEntry([{ autofocus: false, backdrop: true }, { autofocus: false, backdrop: false }, { autofocus: true, backdrop: false }])).toBe(2);
    expect(pickModalEntry([{ autofocus: false, backdrop: true }, { autofocus: false, backdrop: false }])).toBe(1);
    expect(pickModalEntry([{ autofocus: false, backdrop: true }])).toBe(-1);
  });
});
