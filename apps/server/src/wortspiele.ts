import { parseSprintCatalog, setSprintCatalog } from '@brett-und-blatt/game-category-sprint';
import { parseDuelCatalog, setDuelCatalog } from '@brett-und-blatt/game-describe-duel';
import { parseEstimateCatalog, setEstimateCatalog } from '@brett-und-blatt/game-estimate';
import { parseMajorityCatalog, setMajorityCatalog } from '@brett-und-blatt/game-majority';
import { parseTimelineCatalog, setTimelineCatalog } from '@brett-und-blatt/game-timeline';
import { parseWhoCatalog, setWhoCatalog } from '@brett-und-blatt/game-who-am-i';
import mehrheit from '../../../content/klassenspiele/mehrheit.json' with { type: 'json' };
import schaetzen from '../../../content/klassenspiele/schaetzen.json' with { type: 'json' };
import zeitstrahl from '../../../content/klassenspiele/zeitstrahl.json' with { type: 'json' };
import begriffe from '../../../content/wortspiele/begriffe.json' with { type: 'json' };
import kategorien from '../../../content/wortspiele/kategorien.json' with { type: 'json' };
import werBinIch from '../../../content/wortspiele/wer-bin-ich.json' with { type: 'json' };

/*
 * Die Kataloge der Wortspiele (Kategorien-Sprint, Wer bin ich?, Verboten!) sind hier zu
 * Hause wie die Bibel-Quiz-Fragen: Die Web-App holt sie über `GET /wortspiele/<name>` (Rückfall:
 * mitgelieferte Datei), die Online-Räume setzen sie beim Laden dieses Moduls direkt. Ausgeliefert
 * wird die Datei unverändert – die Spiele prüfen sie beim Einlesen selbst.
 */
setSprintCatalog(parseSprintCatalog(kategorien));
setWhoCatalog(parseWhoCatalog(werBinIch));
setDuelCatalog(parseDuelCatalog(begriffe));
setEstimateCatalog(parseEstimateCatalog(schaetzen));
setMajorityCatalog(parseMajorityCatalog(mehrheit));
setTimelineCatalog(parseTimelineCatalog(zeitstrahl));

/** Ausgelieferte Kataloge nach Pfad. */
export const wortspielKataloge: Record<string, unknown> = {
  '/wortspiele/kategorien': kategorien,
  '/wortspiele/wer-bin-ich': werBinIch,
  '/wortspiele/begriffe': begriffe,
  '/klassenspiele/schaetzen': schaetzen,
  '/klassenspiele/mehrheit': mehrheit,
  '/klassenspiele/zeitstrahl': zeitstrahl,
};
