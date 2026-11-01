import { parseSprintCatalog, setSprintCatalog } from '@brett-und-blatt/game-category-sprint';
import { parseDuelCatalog, setDuelCatalog } from '@brett-und-blatt/game-describe-duel';
import { parseWhoCatalog, setWhoCatalog } from '@brett-und-blatt/game-who-am-i';
import begriffe from '../../../content/wortspiele/begriffe.json' with { type: 'json' };
import kategorien from '../../../content/wortspiele/kategorien.json' with { type: 'json' };
import werBinIch from '../../../content/wortspiele/wer-bin-ich.json' with { type: 'json' };

/*
 * Die Kataloge der Wortspiele (Kategorien-Sprint, Wer bin ich?, Umschreibe-Duell) sind hier zu
 * Hause wie die Bibel-Quiz-Fragen: Die Web-App holt sie über `GET /wortspiele/<name>` (Rückfall:
 * mitgelieferte Datei), die Online-Räume setzen sie beim Laden dieses Moduls direkt. Ausgeliefert
 * wird die Datei unverändert – die Spiele prüfen sie beim Einlesen selbst.
 */
setSprintCatalog(parseSprintCatalog(kategorien));
setWhoCatalog(parseWhoCatalog(werBinIch));
setDuelCatalog(parseDuelCatalog(begriffe));

/** Ausgelieferte Kataloge nach Pfad. */
export const wortspielKataloge: Record<string, unknown> = {
  '/wortspiele/kategorien': kategorien,
  '/wortspiele/wer-bin-ich': werBinIch,
  '/wortspiele/begriffe': begriffe,
};
