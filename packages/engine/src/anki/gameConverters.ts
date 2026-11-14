import { idFromSeed } from './ids';
import { defaultDeck } from './stock';
import type { AnkiCollection, AnkiDeck, AnkiNote } from './types';
import {
  BUB_COMBAT_CARD_FIELDS,
  BUB_COMBAT_CARD_NOTETYPE,
  BUB_COMBAT_CARD_NOTETYPE_ID,
  BUB_COURT_CARD_FIELDS,
  BUB_COURT_CARD_NOTETYPE,
  BUB_COURT_CARD_NOTETYPE_ID,
  BUB_QUARTETT_CARD_FIELDS,
  BUB_QUARTETT_CARD_NOTETYPE,
  BUB_QUARTETT_CARD_NOTETYPE_ID,
} from './gameNotetypes';

/*
 * Bidirektionale Konverter für Spielkarten ↔ AnkiCollection (#274, K4).
 * Unterstützt Drachenspiel (Kampfkarten), Narrenhof (Hofnarren/Mods),
 * Quartett (Wissens- und Vergleichskarten) und Wölfe im Schafspelz (Rollenkarten).
 */

// ---------------------------------------------------------------- Drachenspiel (Kampfkarten)

export interface CombatCardLike {
  id: string;
  name: string;
  cost: number;
  attack?: number;
  health?: number;
  emoji?: string;
  /** Gemaltes Kartenbild (Medienname, z. B. `bub-ds-fuchs.webp`, #309); im Feld „Bild“ als `<img>`. */
  image?: string;
  quote?: string;
  isSpell?: boolean;
  house?: string;
  families?: string[] | readonly string[];
  school?: string;
  rarity?: string;
  keywords?: string[] | readonly string[];
  text?: string;
  building?: unknown;
  triggers?: unknown;
  effects?: unknown;
  targeting?: unknown;
  trap?: unknown;
  quest?: unknown;
  customEngineData?: unknown;
}

export interface CardCollectionOptions {
  deckName?: string;
  deckId?: number;
  now?: number;
}

export function drachenspielCardsToAnki<T extends CombatCardLike>(cards: readonly T[], options: CardCollectionOptions = {}): AnkiCollection {
  const now = options.now ?? 1_700_000_000_000;
  const sec = Math.floor(now / 1000);
  const deckName = options.deckName ?? 'Brett & Blatt::Drachenspiel::Grundset';
  const deckId = options.deckId ?? idFromSeed(`deck:drachenspiel:${deckName}`);

  const deck: AnkiDeck = {
    id: deckId,
    name: deckName,
    mod: sec,
    desc: 'Offizielle Kampfkarten für das Drachenspiel von Brett & Blatt',
  };

  // Jede Karte nur einmal: doppelte Kennungen ergäben doppelte Notiz-IDs, und SQLite lehnt das Paket ab.
  const unique = cards.filter((card, i) => cards.findIndex((other) => other.id === card.id) === i);
  const notes: AnkiNote[] = unique.map((card) => {
    const guid = `bub-combat-${card.id}`;
    const kartenart = card.isSpell ? 'Kniff' : card.building ? 'Gebäude' : 'Begleiter';
    const klasse = card.house ?? 'neutral';
    const seltenheit = card.rarity ?? 'common';
    const kosten = String(card.cost ?? 0);
    const angriff = card.isSpell ? '' : String(card.attack ?? 0);
    const leben = card.isSpell ? '' : String(card.health ?? 0);
    const stamm = (card.families && card.families.length > 0) ? card.families.join(', ') : (card.school ?? '');
    const schluesselwoerter = (card.keywords && card.keywords.length > 0) ? card.keywords.join(', ') : '';
    const regeltext = card.text ?? '';
    const spruch = card.quote ?? '';
    // Mit Bild steht das Medium im Feld „Bild“; das Emoji reist in EffektDatenJSON mit (#309).
    const bild = card.image ? `<img src="${card.image}">` : (card.emoji ?? '');
    const rahmen = '';
    const effektDatenJSON = JSON.stringify(card);

    const fields = [
      card.id,
      card.name,
      kartenart,
      klasse,
      seltenheit,
      kosten,
      angriff,
      leben,
      stamm,
      schluesselwoerter,
      regeltext,
      spruch,
      bild,
      rahmen,
      effektDatenJSON,
    ];

    const tags = ['drachenspiel', klasse, seltenheit, kartenart.toLowerCase()];

    return {
      id: idFromSeed(guid),
      guid,
      mid: BUB_COMBAT_CARD_NOTETYPE_ID,
      did: deckId,
      mod: sec,
      tags,
      fields,
    };
  });

  return {
    v: 2,
    notetypes: [BUB_COMBAT_CARD_NOTETYPE],
    decks: [defaultDeck(), deck],
    notes,
    graves: [],
  };
}

export function ankiToDrachenspielCards<T extends CombatCardLike = CombatCardLike>(col: AnkiCollection): T[] {
  const cards: T[] = [];
  const fieldIndex = Object.fromEntries(BUB_COMBAT_CARD_FIELDS.map((f, i) => [f, i]));

  for (const note of col.notes) {
    if (note.mid !== BUB_COMBAT_CARD_NOTETYPE_ID && !note.tags.includes('drachenspiel')) {
      continue;
    }

    const get = (name: (typeof BUB_COMBAT_CARD_FIELDS)[number]): string => {
      const idx = fieldIndex[name];
      return (idx !== undefined && note.fields[idx] !== undefined) ? note.fields[idx] : '';
    };

    const id = get('Kennung') || note.guid;
    const name = get('Name');
    const kartenart = get('Kartenart');
    const klasse = get('Klasse');
    const seltenheit = get('Seltenheit');
    const kostenRaw = get('Kosten');
    const angriffRaw = get('Angriff');
    const lebenRaw = get('Leben');
    const stamm = get('Stamm');
    const schluesselwoerter = get('Schluesselwoerter');
    const regeltext = get('Regeltext');
    const spruch = get('Spruch');
    const bild = get('Bild');
    const jsonStr = get('EffektDatenJSON');

    let base: Record<string, unknown> = {};
    if (jsonStr) {
      try {
        base = JSON.parse(jsonStr) as Record<string, unknown>;
      } catch {
        base = {};
      }
    }

    const card: Record<string, unknown> = {
      ...base,
      id,
      name: name || (base.name as string) || id,
      cost: kostenRaw !== '' ? Number.parseInt(kostenRaw, 10) : ((base.cost as number) ?? 0),
      isSpell: (kartenart === 'Zauber' || kartenart === 'Kniff') ? true : (base.isSpell as boolean | undefined),
      quote: spruch || (base.quote as string) || '',
      text: regeltext || (base.text as string) || '',
    };

    const imageMatch = /<img[^>]*\bsrc\s*=\s*["']([^"']+)["']/i.exec(bild);
    if (imageMatch) card.image = imageMatch[1]!;
    else if (bild) card.emoji = bild;
    if (seltenheit) card.rarity = seltenheit;
    if (klasse) card.house = klasse;
    if (angriffRaw !== '') card.attack = Number.parseInt(angriffRaw, 10);
    if (lebenRaw !== '') card.health = Number.parseInt(lebenRaw, 10);
    if (stamm) {
      card.families = stamm.split(',').map((s) => s.trim()).filter(Boolean);
    }
    if (schluesselwoerter) {
      card.keywords = schluesselwoerter.split(',').map((s) => s.trim()).filter(Boolean);
    }

    cards.push(card as T);
  }

  return cards;
}

// ---------------------------------------------------------------- Narrenhof (Hof- & Rollenkarte)

export interface CourtCardLike {
  key?: string;
  id?: string;
  name: string;
  emoji?: string;
  rarity?: string;
  price?: number;
  text?: string;
  game?: string;
  category?: string;
  baseChips?: number;
  multiplier?: number;
  trigger?: string;
  quote?: string;
  customEngineData?: unknown;
}

export function narrenhofCardsToAnki<T extends CourtCardLike>(mods: readonly T[], options: CardCollectionOptions = {}): AnkiCollection {
  const now = options.now ?? 1_700_000_000_000;
  const sec = Math.floor(now / 1000);
  const deckName = options.deckName ?? 'Brett & Blatt::Narrenhof::Hofnarren';
  const deckId = options.deckId ?? idFromSeed(`deck:narrenhof:${deckName}`);

  const deck: AnkiDeck = {
    id: deckId,
    name: deckName,
    mod: sec,
    desc: 'Hofnarren und Modifikatoren für den Narrenhof von Brett & Blatt',
  };

  const notes: AnkiNote[] = mods.map((mod) => {
    const key = mod.key ?? mod.id ?? mod.name;
    const guid = `bub-court-narrenhof-${key}`;
    const spiel = mod.game ?? 'narrenhof';
    const kategorie = mod.category ?? 'Narr';
    const name = mod.name;
    const seltenheit = mod.rarity ?? 'common';
    const kaufpreis = mod.price !== undefined ? String(mod.price) : '';
    const basiswert = mod.baseChips !== undefined ? String(mod.baseChips) : '';
    const multiplikator = mod.multiplier !== undefined ? String(mod.multiplier) : '';
    const ausloeser = mod.trigger ?? '';
    const regeltext = mod.text ?? '';
    const spruch = mod.quote ?? '';
    const bild = mod.emoji ?? '';
    const rahmen = '';
    const effektDatenJSON = JSON.stringify(mod);

    const fields = [
      key,
      spiel,
      kategorie,
      name,
      seltenheit,
      kaufpreis,
      basiswert,
      multiplikator,
      ausloeser,
      regeltext,
      spruch,
      bild,
      rahmen,
      effektDatenJSON,
    ];

    const tags = ['narrenhof', kategorie.toLowerCase(), seltenheit];

    return {
      id: idFromSeed(guid),
      guid,
      mid: BUB_COURT_CARD_NOTETYPE_ID,
      did: deckId,
      mod: sec,
      tags,
      fields,
    };
  });

  return {
    v: 2,
    notetypes: [BUB_COURT_CARD_NOTETYPE],
    decks: [defaultDeck(), deck],
    notes,
    graves: [],
  };
}

export function ankiToNarrenhofCards<T extends CourtCardLike = CourtCardLike>(col: AnkiCollection): T[] {
  const cards: T[] = [];
  const fieldIndex = Object.fromEntries(BUB_COURT_CARD_FIELDS.map((f, i) => [f, i]));

  for (const note of col.notes) {
    if (note.mid !== BUB_COURT_CARD_NOTETYPE_ID && !note.tags.includes('narrenhof')) {
      continue;
    }

    const get = (name: (typeof BUB_COURT_CARD_FIELDS)[number]): string => {
      const idx = fieldIndex[name];
      return (idx !== undefined && note.fields[idx] !== undefined) ? note.fields[idx] : '';
    };

    const key = get('Kennung') || note.guid;
    const spiel = get('Spiel');
    if (spiel && spiel !== 'narrenhof' && !note.tags.includes('narrenhof')) {
      continue;
    }

    const kategorie = get('Kategorie');
    const name = get('Name');
    const seltenheit = get('Seltenheit');
    const kaufpreisRaw = get('Kaufpreis');
    const basiswertRaw = get('Basiswert');
    const multiplikatorRaw = get('Multiplikator');
    const ausloeser = get('Ausloeser');
    const regeltext = get('Regeltext');
    const spruch = get('Spruch');
    const bild = get('Bild');
    const jsonStr = get('EffektDatenJSON');

    let base: Record<string, unknown> = {};
    if (jsonStr) {
      try {
        base = JSON.parse(jsonStr) as Record<string, unknown>;
      } catch {
        base = {};
      }
    }

    const mod: Record<string, unknown> = {
      ...base,
      key,
      name: name || (base.name as string) || key,
      text: regeltext || (base.text as string) || '',
      game: spiel || (base.game as string) || 'narrenhof',
      category: kategorie || (base.category as string) || 'Narr',
    };

    if (seltenheit) mod.rarity = seltenheit;
    if (kaufpreisRaw !== '') mod.price = Number.parseInt(kaufpreisRaw, 10);
    if (basiswertRaw !== '') mod.baseChips = Number.parseInt(basiswertRaw, 10);
    if (multiplikatorRaw !== '') mod.multiplier = Number.parseFloat(multiplikatorRaw);
    if (ausloeser) mod.trigger = ausloeser;
    if (spruch) mod.quote = spruch;
    if (bild) mod.emoji = bild;

    cards.push(mod as T);
  }

  return cards;
}

// ---------------------------------------------------------------- Quartett (Vergleichskarten)

export interface QuartettPropertyLike {
  id: string;
  label: string;
  unit: string;
  higherWins: boolean;
  format?: 'plain' | 'year' | string;
  valueLabels?: Record<string, string>;
}

export interface QuartettCardLike {
  id: string;
  name: string;
  emoji?: string;
  /** Bild der Karte (Medienname, z. B. `bub-quartett-tiere-a1.webp`, #319); im Feld „Bild“ als `<img>`. */
  image?: string;
  values: Record<string, number>;
  source?: string;
  sources?: Record<string, string>;
}

export interface QuartettSetLike {
  id: string;
  name: string;
  emoji?: string;
  license?: string;
  status?: string;
  description?: string;
  note?: string;
  properties: QuartettPropertyLike[] | readonly QuartettPropertyLike[];
  groups: Array<{ id: string; name: string }> | ReadonlyArray<{ id: string; name: string }>;
  cards: QuartettCardLike[] | readonly QuartettCardLike[];
}

export function quartettSetToAnki<T extends QuartettSetLike>(set: T, options: CardCollectionOptions = {}): AnkiCollection {
  const now = options.now ?? 1_700_000_000_000;
  const sec = Math.floor(now / 1000);
  const deckName = options.deckName ?? `Brett & Blatt::Quartett::${set.name}`;
  const deckId = options.deckId ?? idFromSeed(`deck:quartett:${set.id}`);

  const deck: AnkiDeck = {
    id: deckId,
    name: deckName,
    mod: sec,
    desc: `${set.description || set.name} (Quartett von Brett & Blatt)`,
  };

  const groupMap = new Map(set.groups.map((g) => [g.id, g.name]));

  const notes: AnkiNote[] = set.cards.map((card) => {
    const guid = `bub-quartett-${set.id}-${card.id}`;
    const groupCode = card.id.length >= 2 ? card.id.slice(0, 1) : card.id;
    const groupName = groupMap.get(groupCode) ?? groupCode;
    const bild = card.image ? `<img src="${card.image}">` : (card.emoji ?? '');
    const infoText = card.source ? `Quelle: ${card.source}` : '';

    const fields: string[] = [
      `${set.id}:${card.id}`,
      set.name,
      groupCode,
      groupName,
      card.name,
      bild,
    ];

    // Bis zu 6 Wertefelder auffüllen
    for (let i = 0; i < 6; i++) {
      const prop = set.properties[i];
      if (prop) {
        const val = card.values[prop.id];
        fields.push(prop.label);
        fields.push(val !== undefined ? String(val) : '');
        fields.push(prop.unit ?? '');
        fields.push(prop.higherWins ? 'true' : 'false');
      } else {
        fields.push('', '', '', '');
      }
    }

    const effektDatenJSON = JSON.stringify({
      setId: set.id,
      cardId: card.id,
      cardEmoji: card.emoji,
      cardValues: card.values,
      cardSource: card.source,
      cardSources: card.sources,
      setMetadata: {
        id: set.id,
        name: set.name,
        emoji: set.emoji,
        license: set.license,
        status: set.status,
        description: set.description,
        note: set.note,
        properties: set.properties,
        groups: set.groups,
      },
    });

    fields.push(infoText);
    fields.push(''); // Rahmen
    fields.push(effektDatenJSON);

    const tags = ['quartett', set.id, groupCode.toLowerCase()];

    return {
      id: idFromSeed(guid),
      guid,
      mid: BUB_QUARTETT_CARD_NOTETYPE_ID,
      did: deckId,
      mod: sec,
      tags,
      fields,
    };
  });

  return {
    v: 2,
    notetypes: [BUB_QUARTETT_CARD_NOTETYPE],
    decks: [defaultDeck(), deck],
    notes,
    graves: [],
  };
}

export function ankiToQuartettSet<T extends QuartettSetLike = QuartettSetLike>(col: AnkiCollection): T {
  const fieldIndex = Object.fromEntries(BUB_QUARTETT_CARD_FIELDS.map((f, i) => [f, i]));
  let meta: Partial<QuartettSetLike> = {};
  const cards: QuartettCardLike[] = [];
  const groupsFound = new Map<string, string>();
  const propertiesFound: QuartettPropertyLike[] = [];

  for (const note of col.notes) {
    if (note.mid !== BUB_QUARTETT_CARD_NOTETYPE_ID && !note.tags.includes('quartett')) {
      continue;
    }

    const get = (name: (typeof BUB_QUARTETT_CARD_FIELDS)[number]): string => {
      const idx = fieldIndex[name];
      return (idx !== undefined && note.fields[idx] !== undefined) ? note.fields[idx] : '';
    };

    const kennung = get('Kennung') || note.guid;
    const setName = get('SetName');
    const groupCode = get('GruppeCode');
    const groupName = get('GruppeName');
    const cardName = get('Name');
    const bild = get('Bild');
    const infoText = get('InfoText');
    const jsonStr = get('EffektDatenJSON');

    let baseJson: Record<string, unknown> = {};
    if (jsonStr) {
      try {
        baseJson = JSON.parse(jsonStr) as Record<string, unknown>;
      } catch {
        baseJson = {};
      }
    }

    if (!meta.id && baseJson.setMetadata) {
      meta = { ...(baseJson.setMetadata as Partial<QuartettSetLike>) };
    }

    if (groupCode) {
      groupsFound.set(groupCode, groupName || groupCode);
    }

    // Eigenschaften rekonstruieren
    const values: Record<string, number> = {};
    for (let i = 1; i <= 6; i++) {
      const pName = get(`Wert${i}_Name` as (typeof BUB_QUARTETT_CARD_FIELDS)[number]);
      const pZahl = get(`Wert${i}_Zahl` as (typeof BUB_QUARTETT_CARD_FIELDS)[number]);
      const pEinheit = get(`Wert${i}_Einheit` as (typeof BUB_QUARTETT_CARD_FIELDS)[number]);
      const pHoeher = get(`Wert${i}_HoeherGewinnt` as (typeof BUB_QUARTETT_CARD_FIELDS)[number]);

      if (pName) {
        let prop = propertiesFound.find((p) => p.label === pName);
        if (!prop) {
          const propId = pName.toLowerCase().replace(/[^a-z0-9]/g, '');
          prop = {
            id: propId,
            label: pName,
            unit: pEinheit,
            higherWins: pHoeher !== 'false',
          };
          propertiesFound.push(prop);
        }
        if (pZahl !== '') {
          values[prop.id] = Number.parseFloat(pZahl) || 0;
        }
      }
    }

    // Reine Karten-ID aus Kennung (z. B. "tiere:A1" -> "A1")
    let cardId = (baseJson.cardId as string) || kennung;
    if (cardId.includes(':')) {
      cardId = cardId.split(':')[1]!;
    }

    // „Bild“ ist ein Emoji oder ein Medium (`<img src="…">`, #319); das Emoji reist dann in EffektDatenJSON mit.
    const imageMatch = /<img[^>]*\bsrc\s*=\s*["']([^"']+)["']/i.exec(bild);
    const card: QuartettCardLike = {
      id: cardId,
      name: cardName,
      emoji: imageMatch ? ((baseJson.cardEmoji as string | undefined) ?? '') : bild,
      ...(imageMatch ? { image: imageMatch[1]! } : {}),
      values,
      source: infoText.startsWith('Quelle: ') ? infoText.replace('Quelle: ', '') : infoText,
      sources: baseJson.cardSources as Record<string, string> | undefined,
    };

    cards.push(card);
  }

  // Set-Eigenschaften und Gruppen mit den aus Metadaten oder Notizen gefundenen ergänzen
  const finalProperties: QuartettPropertyLike[] = meta.properties && meta.properties.length > 0
    ? meta.properties.map((p) => {
        // Falls in Notizen geändert
        const found = propertiesFound.find((pf) => pf.label === p.label || pf.id === p.id);
        return found ? { ...p, ...found } : p;
      })
    : propertiesFound;

  const finalGroups = meta.groups && meta.groups.length > 0
    ? meta.groups
    : Array.from(groupsFound.entries()).map(([id, name]) => ({ id, name }));

  // Falls meta.properties existieren, die values der Karten mit den echten prop.ids mappen
  if (meta.properties && meta.properties.length > 0) {
    for (const card of cards) {
      const mappedValues: Record<string, number> = { ...card.values };
      for (let i = 0; i < meta.properties.length; i++) {
        const prop = meta.properties[i]!;
        // Wenn in card.values bereits ein Wert mit p.id vorliegt, belassen; sonst aus Property-Label
        if (mappedValues[prop.id] === undefined) {
          const matchingProp = propertiesFound.find((pf) => pf.label === prop.label);
          if (matchingProp && card.values[matchingProp.id] !== undefined) {
            mappedValues[prop.id] = card.values[matchingProp.id]!;
          }
        }
      }
      card.values = mappedValues;
    }
  }

  const result: QuartettSetLike = {
    id: meta.id ?? 'custom-quartett',
    name: meta.name ?? (col.decks[1]?.name || 'Quartett'),
    emoji: meta.emoji ?? '🎴',
    license: meta.license ?? 'CC0',
    description: meta.description ?? '',
    note: meta.note ?? '',
    properties: finalProperties,
    groups: finalGroups,
    cards,
  };

  return result as T;
}

// ---------------------------------------------------------------- Wölfe im Schafspelz (Rollenkarten)

export interface WoelfeRoleLike {
  role: string;
  label: string;
  hint: string;
  emoji?: string;
}

export const STANDARD_WOELFE_ROLES: readonly WoelfeRoleLike[] = [
  {
    role: 'wolf',
    label: 'Wolf',
    hint: 'Du wählst nachts mit dem Rudel ein Schaf, das versprengt wird. Tags gibst du dich als Schaf aus.',
    emoji: '🐺',
  },
  {
    role: 'examiner',
    label: 'Prüfer',
    hint: 'Du siehst jede Nacht die Rolle einer Person. Verrate dich nicht zu früh, sonst holen dich die Wölfe.',
    emoji: '🔍',
  },
  {
    role: 'sheep',
    label: 'Schaf',
    hint: 'Du hörst zu, beobachtest und stimmst ab. Nachts tippst du an, wer verdächtig wirkt; das bleibt deine Notiz.',
    emoji: '🐑',
  },
  {
    role: 'shepherd',
    label: 'Hirte',
    hint: 'Du siehst das Opfer der Nacht. Einmal in der Partie holst du es mit dem Hirtenruf zurück, einmal weist du jemanden mit dem Stab aus.',
    emoji: '🧑‍🌾',
  },
  {
    role: 'hound',
    label: 'Hütehund',
    hint: 'Wenn du ausscheidest, packst du noch eine Person, die mit dir die Herde verlässt.',
    emoji: '🐕',
  },
  {
    role: 'binder',
    label: 'Bandstifter',
    hint: 'Du hast in der ersten Nacht zwei Personen verbunden. Geht eine, geht auch die andere.',
    emoji: '🎀',
  },
  {
    role: 'lamb',
    label: 'Neugieriges Lamm',
    hint: 'Du darfst einmal je Nacht linsen und siehst dann einen Wolf. Wirst du erwischt, trifft es dich statt des Opfers.',
    emoji: '🐥',
  },
  {
    role: 'stray',
    label: 'Zugelaufenes Schaf',
    hint: 'Du durftest zu Beginn gegen eine der übrigen Karten tauschen. Du bist geblieben, was du warst: ein Schaf.',
    emoji: '🐐',
  },
  {
    role: 'narrator',
    label: 'Erzähler',
    hint: 'Du leitest das Spiel, spielst nicht mit und siehst alles. Verrate nichts.',
    emoji: '🎙️',
  },
];

export function woelfeRolesToAnki<T extends WoelfeRoleLike>(roles: readonly T[] = STANDARD_WOELFE_ROLES as readonly T[], options: CardCollectionOptions = {}): AnkiCollection {
  const now = options.now ?? 1_700_000_000_000;
  const sec = Math.floor(now / 1000);
  const deckName = options.deckName ?? 'Brett & Blatt::Wölfe im Schafspelz::Rollenkarten';
  const deckId = options.deckId ?? idFromSeed(`deck:woelfe:${deckName}`);

  const deck: AnkiDeck = {
    id: deckId,
    name: deckName,
    mod: sec,
    desc: 'Offizielle Rollenkarten für Wölfe im Schafspelz von Brett & Blatt',
  };

  const notes: AnkiNote[] = roles.map((r) => {
    const guid = `bub-court-woelfe-${r.role}`;
    const kennung = `woelfe:${r.role}`;
    const spiel = 'woelfe';
    const kategorie = 'Rolle';
    const name = r.label;
    const seltenheit = '';
    const kaufpreis = '';
    const basiswert = '';
    const multiplikator = '';
    const ausloeser = '';
    const regeltext = r.hint;
    const spruch = '';
    const bild = r.emoji ?? '';
    const rahmen = '';
    const effektDatenJSON = JSON.stringify(r);

    const fields = [
      kennung,
      spiel,
      kategorie,
      name,
      seltenheit,
      kaufpreis,
      basiswert,
      multiplikator,
      ausloeser,
      regeltext,
      spruch,
      bild,
      rahmen,
      effektDatenJSON,
    ];

    const tags = ['woelfe', 'rolle', r.role];

    return {
      id: idFromSeed(guid),
      guid,
      mid: BUB_COURT_CARD_NOTETYPE_ID,
      did: deckId,
      mod: sec,
      tags,
      fields,
    };
  });

  return {
    v: 2,
    notetypes: [BUB_COURT_CARD_NOTETYPE],
    decks: [defaultDeck(), deck],
    notes,
    graves: [],
  };
}

export function ankiToWoelfeRoles<T extends WoelfeRoleLike = WoelfeRoleLike>(col: AnkiCollection): T[] {
  const roles: T[] = [];
  const fieldIndex = Object.fromEntries(BUB_COURT_CARD_FIELDS.map((f, i) => [f, i]));

  for (const note of col.notes) {
    if (note.mid !== BUB_COURT_CARD_NOTETYPE_ID && !note.tags.includes('woelfe')) {
      continue;
    }

    const get = (name: (typeof BUB_COURT_CARD_FIELDS)[number]): string => {
      const idx = fieldIndex[name];
      return (idx !== undefined && note.fields[idx] !== undefined) ? note.fields[idx] : '';
    };

    const kennung = get('Kennung') || note.guid;
    const spiel = get('Spiel');
    if (spiel && spiel !== 'woelfe' && !note.tags.includes('woelfe')) {
      continue;
    }

    const name = get('Name');
    const regeltext = get('Regeltext');
    const bild = get('Bild');
    const jsonStr = get('EffektDatenJSON');

    let base: Record<string, unknown> = {};
    if (jsonStr) {
      try {
        base = JSON.parse(jsonStr) as Record<string, unknown>;
      } catch {
        base = {};
      }
    }

    let roleName = (base.role as string) || kennung;
    if (roleName.startsWith('woelfe:')) {
      roleName = roleName.slice('woelfe:'.length);
    }

    const r: Record<string, unknown> = {
      ...base,
      role: roleName,
      label: name || (base.label as string) || roleName,
      hint: regeltext || (base.hint as string) || '',
      emoji: bild || (base.emoji as string) || '',
    };

    roles.push(r as T);
  }

  return roles;
}
