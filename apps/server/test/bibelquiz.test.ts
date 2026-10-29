import { describe, expect, it } from 'vitest';
import { hasQuestionCatalog, questionCatalog } from '../../../packages/games/bible-quiz/src/questions';
import fragen from '../../../content/bibelquiz/fragen.json' with { type: 'json' };
import { bibelQuizKatalog } from '../src/bibelquiz';

/*
 * Der Fragenkatalog des Bibel-Quiz liegt auf dem Server, nicht im Browser-Bundle:
 * Die Web-App holt ihn über `GET /bibelquiz/fragen`, die Online-Räume nutzen ihn direkt.
 */
describe('Bibel-Quiz-Katalog auf dem Server', () => {
  it('liefert den vollständigen Katalog mit einer Inhaltsversion', () => {
    expect(bibelQuizKatalog.questions).toHaveLength(fragen.length);
    expect(bibelQuizKatalog.questions.length).toBeGreaterThanOrEqual(160);
    expect(bibelQuizKatalog.version).toMatch(/^[0-9a-f]{8}$/);
    expect(bibelQuizKatalog.questions[0]?.id).toBe(1);
  });

  it('setzt den Katalog für Online-Räume und Bots', () => {
    expect(hasQuestionCatalog()).toBe(true);
    expect(questionCatalog()).toHaveLength(bibelQuizKatalog.questions.length);
  });
});
