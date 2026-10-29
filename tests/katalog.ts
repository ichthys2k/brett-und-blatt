/*
 * Der Fragenkatalog des Bibel-Quiz liegt bewusst nicht in den Spielpaketen, sondern in
 * `content/bibelquiz/fragen.json` – im Betrieb holt ihn die Plattform vom Spieleserver
 * (`GameModule.prepare`). Tests spielen diese Plattform: Hier wird der Katalog einmal für
 * alle Testdateien gesetzt (siehe `vitest.config.ts`).
 */
import fragen from '../content/bibelquiz/fragen.json' with { type: 'json' };
import { parseQuestionCatalog, setQuestionCatalog } from '../packages/games/bible-quiz/src/questions';

setQuestionCatalog(parseQuestionCatalog(fragen));
