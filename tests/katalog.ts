/*
 * Der Fragenkatalog des Bibel-Quiz und die Wortspiel-Kataloge liegen bewusst nicht in den
 * Spielpaketen, sondern unter `content/` – im Betrieb holt sie die Plattform vom Spieleserver
 * (`GameModule.prepare`). Tests spielen diese Plattform: Hier werden die Kataloge einmal für
 * alle Testdateien gesetzt (siehe `vitest.config.ts`).
 */
import fragen from '../content/bibelquiz/fragen.json' with { type: 'json' };
import begriffe from '../content/wortspiele/begriffe.json' with { type: 'json' };
import kategorien from '../content/wortspiele/kategorien.json' with { type: 'json' };
import werBinIch from '../content/wortspiele/wer-bin-ich.json' with { type: 'json' };
import mehrheit from '../content/klassenspiele/mehrheit.json' with { type: 'json' };
import schaetzen from '../content/klassenspiele/schaetzen.json' with { type: 'json' };
import zeitstrahl from '../content/klassenspiele/zeitstrahl.json' with { type: 'json' };
import { parseEstimateCatalog, setEstimateCatalog } from '../packages/games/estimate/src';
import { parseMajorityCatalog, setMajorityCatalog } from '../packages/games/majority/src';
import { parseTimelineCatalog, setTimelineCatalog } from '../packages/games/timeline/src';
import { parseQuestionCatalog, setQuestionCatalog } from '../packages/games/bible-quiz/src/questions';
import { parseSprintCatalog, setSprintCatalog } from '../packages/games/category-sprint/src/catalog';
import { parseDuelCatalog, setDuelCatalog } from '../packages/games/describe-duel/src/catalog';
import { parseWhoCatalog, setWhoCatalog } from '../packages/games/who-am-i/src/catalog';

setQuestionCatalog(parseQuestionCatalog(fragen));
setSprintCatalog(parseSprintCatalog(kategorien));
setWhoCatalog(parseWhoCatalog(werBinIch));
setDuelCatalog(parseDuelCatalog(begriffe));
setEstimateCatalog(parseEstimateCatalog(schaetzen));
setMajorityCatalog(parseMajorityCatalog(mehrheit));
setTimelineCatalog(parseTimelineCatalog(zeitstrahl));
