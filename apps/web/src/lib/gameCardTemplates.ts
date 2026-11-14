import {
  createPlayingCardCollection,
  drachenspielCardsToAnki,
  narrenhofCardsToAnki,
  quartettSetToAnki,
  woelfeRolesToAnki,
  type AnkiCollection,
} from '@brett-und-blatt/engine';
import { exportApkg } from './ankiPackage';

export type GameCardTemplateId =
  | 'spielblatt-alle'
  | 'spielblatt-franz'
  | 'spielblatt-bayer'
  | 'drachenspiel'
  | 'narrenhof'
  | 'quartett-tiere'
  | 'quartett-weltraum'
  | 'quartett-dinosaurier'
  | 'quartett-bibel'
  | 'quartett-geometrie'
  | 'woelfe';

export interface GameCardTemplateInfo {
  id: GameCardTemplateId;
  title: string;
  category: string;
  emoji: string;
  description: string;
  fileName: string;
}

export const GAME_CARD_TEMPLATES: readonly GameCardTemplateInfo[] = [
  {
    id: 'spielblatt-alle',
    title: 'Klassisches Spielblatt (Komplett)',
    category: 'Spielblatt',
    emoji: '🃏',
    description: 'Französisches (52 Karten) & Bayerisches Blatt (32 Karten) mit standardisierten Farbsymbolen und Augen.',
    fileName: 'Brett-und-Blatt_Spielblatt_Komplett.apkg',
  },
  {
    id: 'spielblatt-franz',
    title: 'Französisches Blatt (52 Karten)',
    category: 'Spielblatt',
    emoji: '♠️',
    description: 'Herz, Karo, Pik, Kreuz von der 2 bis zum Ass.',
    fileName: 'Brett-und-Blatt_Franzoesisches_Blatt.apkg',
  },
  {
    id: 'spielblatt-bayer',
    title: 'Bayerisches Blatt (32 Karten)',
    category: 'Spielblatt',
    emoji: '🌰',
    description: 'Eichel, Gras, Herz, Schellen von der 7 bis zur Sau.',
    fileName: 'Brett-und-Blatt_Bayerisches_Blatt.apkg',
  },
  {
    id: 'drachenspiel',
    title: 'Drachenspiel (Grundset & Zauber)',
    category: 'Kampfkarten',
    emoji: '🐉',
    description: 'Begleiter, Zauber und Gebäude aus den Tierhäusern mit Manakristall, Werten und Regeltext.',
    fileName: 'Brett-und-Blatt_Drachenspiel.apkg',
  },
  {
    id: 'narrenhof',
    title: 'Narrenhof (Hofnarren)',
    category: 'Hofkarten',
    emoji: '🤹',
    description: 'Hofnarren mit Kaufpreisen in Brezeln, Effekten und Punktemultiplikatoren.',
    fileName: 'Brett-und-Blatt_Narrenhof.apkg',
  },
  {
    id: 'quartett-tiere',
    title: 'Quartett: Tiere der Welt',
    category: 'Quartett',
    emoji: '🦁',
    description: 'Vergleichskarten mit Gewicht, Geschwindigkeit, Lebenserwartung und Wurfgröße.',
    fileName: 'Brett-und-Blatt_Quartett_Tiere.apkg',
  },
  {
    id: 'quartett-weltraum',
    title: 'Quartett: Weltraum',
    category: 'Quartett',
    emoji: '🚀',
    description: 'Himmelskörper mit Durchmesser, Masse, Abstand und Monden.',
    fileName: 'Brett-und-Blatt_Quartett_Weltraum.apkg',
  },
  {
    id: 'quartett-dinosaurier',
    title: 'Quartett: Dinosaurier',
    category: 'Quartett',
    emoji: '🦖',
    description: 'Urzeit-Giganten mit Länge, Gewicht, Zeit und Nahrung.',
    fileName: 'Brett-und-Blatt_Quartett_Dinosaurier.apkg',
  },
  {
    id: 'quartett-bibel',
    title: 'Quartett: Bibel',
    category: 'Quartett',
    emoji: '📖',
    description: 'Bücher der Bibel mit Kapiteln, Versen, Wörtern und Einteilung.',
    fileName: 'Brett-und-Blatt_Quartett_Bibel.apkg',
  },
  {
    id: 'quartett-geometrie',
    title: 'Quartett: Geometrie',
    category: 'Quartett',
    emoji: '📐',
    description: 'Geometrische Körper mit Ecken, Kanten, Flächen und Symmetrie.',
    fileName: 'Brett-und-Blatt_Quartett_Geometrie.apkg',
  },
  {
    id: 'woelfe',
    title: 'Wölfe im Schafspelz (Rollenkarten)',
    category: 'Rollenkarten',
    emoji: '🐺',
    description: 'Alle 9 Rollen (Wolf, Schaf, Prüfer, Hirte, Hütehund etc.) mit Spielhinweisen.',
    fileName: 'Brett-und-Blatt_Woelfe_im_Schafspelz.apkg',
  },
];

export async function generateTemplateCollection(id: GameCardTemplateId): Promise<AnkiCollection> {
  switch (id) {
    case 'spielblatt-alle':
      return createPlayingCardCollection({ deck: 'all' });
    case 'spielblatt-franz':
      return createPlayingCardCollection({ deck: 'french-52' });
    case 'spielblatt-bayer':
      return createPlayingCardCollection({ deck: 'bavarian-32' });
    case 'drachenspiel': {
      // CARDS_DB enthält die Zauber schon; doppelte Karten ließen den Export scheitern (#270).
      const { CARDS_DB } = await import('../../../../packages/games/drachenspiel/src/cards');
      return drachenspielCardsToAnki(Object.values(CARDS_DB));
    }
    case 'narrenhof': {
      const { MODS } = await import('../../../../packages/games/color-sorter/src/mods');
      return narrenhofCardsToAnki(Object.values(MODS));
    }
    case 'quartett-tiere':
    case 'quartett-weltraum':
    case 'quartett-dinosaurier':
    case 'quartett-bibel':
    case 'quartett-geometrie': {
      const setId = id.replace('quartett-', '');
      const { cardSet } = await import('../../../../packages/games/quartett/src/sets');
      const set = cardSet(setId);
      return quartettSetToAnki(set);
    }
    case 'woelfe':
      return woelfeRolesToAnki();
    default:
      throw new Error(`Unbekannte Kartenvorlage: ${id}`);
  }
}

export async function exportGameCardTemplateApkg(id: GameCardTemplateId): Promise<{ fileName: string; bytes: Uint8Array }> {
  const template = GAME_CARD_TEMPLATES.find((t) => t.id === id);
  if (!template) throw new Error(`Vorlage ${id} nicht gefunden.`);

  const collection = await generateTemplateCollection(id);
  const media = await templateMedia(id);
  const bytes = await exportApkg({ collection, ...(media.size ? { media } : {}) }, { scheduling: false, media: media.size > 0, format: 'legacy2' });
  return { fileName: template.fileName, bytes };
}

/**
 * Bilder eines Quartett-Sets als Anki-Medien (#319): Das Feld „Bild“ nennt sie mit `<img src="…">`, die Dateien
 * kommen von `quartett/bilder/<set>/`. Fehlt ein Bild (noch nicht erzeugt), bleibt es weg.
 */
async function templateMedia(id: GameCardTemplateId): Promise<Map<string, Uint8Array>> {
  const media = new Map<string, Uint8Array>();
  if (!id.startsWith('quartett-')) return media;
  const setId = id.replace('quartett-', '');
  const { cardSet } = await import('../../../../packages/games/quartett/src/sets');
  for (const card of cardSet(setId).cards) {
    if (!card.image) continue;
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}quartett/bilder/${setId}/${card.image}`);
      if (response.ok) media.set(card.image, new Uint8Array(await response.arrayBuffer()));
    } catch {
      // ohne Netz: Paket ohne dieses Bild
    }
  }
  return media;
}
