import {
  parseQuestionCatalog,
  setQuestionCatalog,
  type BibleQuestion,
} from '@brett-und-blatt/game-bible-quiz';
import fragen from '../../../content/bibelquiz/fragen.json' with { type: 'json' };

/*
 * Der Fragenkatalog des Bibel-Quiz ist hier zu Hause – nicht im Browser-Bundle. Die Web-App
 * holt ihn über `GET /bibelquiz/fragen`; die Online-Räume setzen ihn beim Laden dieses Moduls
 * direkt, damit `setup` und der Bibelkenner-Bot auf dem Server dieselben Fragen kennen.
 */
const questions: BibleQuestion[] = parseQuestionCatalog(fragen);

setQuestionCatalog(questions);

/** FNV-1a über den Inhalt: ändern sich die Fragen, ändert sich die Version (zum Zwischenspeichern). */
function version(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Was `GET /bibelquiz/fragen` ausliefert. */
export const bibelQuizKatalog = {
  version: version(JSON.stringify(fragen)),
  questions,
};
