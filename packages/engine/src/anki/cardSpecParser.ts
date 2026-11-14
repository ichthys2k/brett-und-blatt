import { sha1Hex } from './sha1';
import type { AnkiCollection, AnkiNote } from './types';
import {
  BUB_COMBAT_CARD_FIELDS,
  BUB_COMBAT_CARD_NOTETYPE_ID,
  BUB_COURT_CARD_FIELDS,
  BUB_COURT_CARD_NOTETYPE_ID,
  BUB_QUARTETT_CARD_FIELDS,
  BUB_QUARTETT_CARD_NOTETYPE_ID,
} from './gameNotetypes';
import type { CombatCardLike, CourtCardLike } from './gameConverters';

/**
 * Bekannte Fähigkeiten und Schlüsselwörter für das Drachenspiel (#277, K7).
 * Unterstützt deutsche Begriffe aus Anki und englische Bezeichner der Engine.
 */
export const DRACHENSPIEL_KEYWORD_MAP: Record<string, string> = {
  // Deutsch
  spott: 'taunt',
  ansturm: 'rush',
  schild: 'bubble',
  gottesschild: 'bubble',
  giftig: 'poisonous',
  gift: 'poisonous',
  tarnung: 'stealth',
  versteckt: 'stealth',
  sprinter: 'sprinter',
  doppelschlag: 'doubleStrike',
  lebensentzug: 'lifesteal',
  frostbiss: 'frostbite',
  wiedergeburt: 'reborn',
  immun: 'immune',
  flüchtig: 'elusive',
  fluechtig: 'elusive',
  tauschbar: 'tradeable',
  // Englisch
  taunt: 'taunt',
  rush: 'rush',
  bubble: 'bubble',
  poisonous: 'poisonous',
  stealth: 'stealth',
  doublestrike: 'doubleStrike',
  lifesteal: 'lifesteal',
  frostbite: 'frostbite',
  reborn: 'reborn',
  immune: 'immune',
  elusive: 'elusive',
  tradeable: 'tradeable',
};

export interface ParsedCombatCard extends CombatCardLike {
  id: string;
  name: string;
  cost: number;
  attack?: number;
  health?: number;
  keywords?: string[] | readonly string[];
}

export interface ParsedCourtCard extends CourtCardLike {
  key: string;
  name: string;
  price?: number;
  baseChips?: number;
  multiplier?: number;
}

export interface ParsedQuartettCard {
  id: string;
  name: string;
  emoji?: string;
  values: Record<string, number>;
  source?: string;
  sources?: Record<string, string>;
}

/** Ein ganz eigenes Quartett-Set aus Anki (#270): Gruppen A, B, … mit je vier Karten A1–A4. */
export interface CustomQuartettSet {
  name: string;
  emoji: string;
  properties: { id: string; label: string; unit: string; higherWins: boolean; format?: 'plain' | 'year' }[];
  groups: { id: string; name: string }[];
  cards: { id: string; name: string; emoji: string; image?: string; values: Record<string, number>; source?: string }[];
}

export interface CustomCardCatalog {
  checksum: string;
  notices: string[];
  combatCards: Record<string, ParsedCombatCard>;
  courtCards: Record<string, ParsedCourtCard>;
  quartettCards: Record<string, ParsedQuartettCard>;
  /** Statt einzelner geänderter Karten ein ganzes eigenes Quartett-Set. */
  quartettSet?: CustomQuartettSet;
}

/**
 * Sichere Zahlenprüfung mit Begrenzung (Clamping) und deutscher Fehlermeldung.
 */
function parseClampedInt(
  raw: string | undefined,
  min: number,
  max: number,
  fallback: number,
  context: { cardName: string; fieldName: string },
  notices: string[],
): number {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const clean = raw.trim();
  const num = Number(clean);
  if (!Number.isFinite(num) || Number.isNaN(num)) {
    notices.push(
      `Karte „${context.cardName}“: Feld ‚${context.fieldName}‘ („${clean}“) ist keine Zahl – Standardwert ${fallback} wird verwendet.`,
    );
    return fallback;
  }
  const intVal = Math.round(num);
  if (intVal < min) {
    notices.push(
      `Karte „${context.cardName}“: Feld ‚${context.fieldName}‘ (${intVal}) liegt unter dem Minimum ${min} – auf ${min} begrenzt.`,
    );
    return min;
  }
  if (intVal > max) {
    notices.push(
      `Karte „${context.cardName}“: Feld ‚${context.fieldName}‘ (${intVal}) überschreitet das Maximum ${max} – auf ${max} begrenzt.`,
    );
    return max;
  }
  return intVal;
}

function parseClampedFloat(
  raw: string | undefined,
  min: number,
  max: number,
  fallback: number,
  context: { cardName: string; fieldName: string },
  notices: string[],
): number {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const clean = raw.trim().replace(',', '.');
  const num = Number(clean);
  if (!Number.isFinite(num) || Number.isNaN(num)) {
    notices.push(
      `Karte „${context.cardName}“: Feld ‚${context.fieldName}‘ („${clean}“) ist keine gültige Zahl – Standardwert ${fallback} wird verwendet.`,
    );
    return fallback;
  }
  if (num < min) {
    notices.push(
      `Karte „${context.cardName}“: Feld ‚${context.fieldName}‘ (${num}) liegt unter dem Minimum ${min} – auf ${min} begrenzt.`,
    );
    return min;
  }
  if (num > max) {
    notices.push(
      `Karte „${context.cardName}“: Feld ‚${context.fieldName}‘ (${num}) überschreitet das Maximum ${max} – auf ${max} begrenzt.`,
    );
    return max;
  }
  return num;
}

/**
 * Liest und validiert eine Kampfkarte (Drachenspiel) aus einer Anki-Notiz.
 */
export function parseCombatCardSpec(
  note: AnkiNote,
  base?: CombatCardLike,
): { card: ParsedCombatCard; notices: string[] } {
  const notices: string[] = [];
  const fieldIndex = Object.fromEntries(BUB_COMBAT_CARD_FIELDS.map((f, i) => [f, i]));

  const get = (name: (typeof BUB_COMBAT_CARD_FIELDS)[number]): string => {
    const idx = fieldIndex[name];
    return idx !== undefined && note.fields[idx] !== undefined ? note.fields[idx] : '';
  };

  const idRaw = get('Kennung') || note.guid;
  const id = idRaw.startsWith('drachenspiel:') ? idRaw.slice('drachenspiel:'.length) : idRaw;
  const name = get('Name') || base?.name || id;
  const kartenart = get('Kartenart');
  const isSpell = kartenart === 'Zauber' ? true : (base?.isSpell ?? false);

  // Basis-JSON falls vorhanden
  let baseJson: Record<string, unknown> = {};
  const jsonStr = get('EffektDatenJSON');
  if (jsonStr) {
    try {
      baseJson = JSON.parse(jsonStr) as Record<string, unknown>;
    } catch {
      baseJson = {};
    }
  }

  // Kosten (0–20)
  const defaultCost = typeof base?.cost === 'number' ? base.cost : 0;
  const cost = parseClampedInt(
    get('Kosten'),
    0,
    20,
    defaultCost,
    { cardName: name, fieldName: 'Kosten' },
    notices,
  );

  // Angriff (0–99)
  let attack: number | undefined;
  if (!isSpell) {
    const defaultAttack = typeof base?.attack === 'number' ? base.attack : 0;
    attack = parseClampedInt(
      get('Angriff'),
      0,
      99,
      defaultAttack,
      { cardName: name, fieldName: 'Angriff' },
      notices,
    );
  }

  // Leben (1–99)
  let health: number | undefined;
  if (!isSpell) {
    const defaultHealth = typeof base?.health === 'number' ? base.health : 1;
    health = parseClampedInt(
      get('Leben'),
      1,
      99,
      defaultHealth,
      { cardName: name, fieldName: 'Leben' },
      notices,
    );
  }

  // Schlüsselwörter
  const keywordsRaw = get('Schluesselwoerter');
  let keywords: string[] | undefined;
  if (keywordsRaw) {
    const words = keywordsRaw
      .split(',')
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean);
    const validKeywords: string[] = [];
    for (const w of words) {
      const mapped = DRACHENSPIEL_KEYWORD_MAP[w];
      if (mapped) {
        if (!validKeywords.includes(mapped)) validKeywords.push(mapped);
      } else {
        notices.push(
          `Karte „${name}“: Unbekanntes Schlüsselwort ‚${w}‘ ignoriert.`,
        );
      }
    }
    keywords = validKeywords;
  } else if (base?.keywords) {
    keywords = [...base.keywords];
  }

  const card: ParsedCombatCard = {
    ...base,
    ...baseJson,
    id,
    name,
    cost,
    isSpell,
    ...(attack !== undefined ? { attack } : {}),
    ...(health !== undefined ? { health } : {}),
    ...(keywords !== undefined ? { keywords } : {}),
  };

  const klasse = get('Klasse');
  if (klasse) (card as { house?: string }).house = klasse;
  const bild = get('Bild');
  // Ein Medium (`<img src="…">`, #309) ist Darstellung; das Emoji bleibt dann das bisherige.
  if (bild && !/<img\b/i.test(bild)) card.emoji = bild;
  const spruch = get('Spruch');
  if (spruch) card.quote = spruch;
  const regeltext = get('Regeltext');
  if (regeltext) card.text = regeltext;

  return { card, notices };
}

/**
 * Liest und validiert eine Hofkarte (Narrenhof) aus einer Anki-Notiz.
 */
export function parseCourtCardSpec(
  note: AnkiNote,
  base?: CourtCardLike,
): { card: ParsedCourtCard; notices: string[] } {
  const notices: string[] = [];
  const fieldIndex = Object.fromEntries(BUB_COURT_CARD_FIELDS.map((f, i) => [f, i]));

  const get = (name: (typeof BUB_COURT_CARD_FIELDS)[number]): string => {
    const idx = fieldIndex[name];
    return idx !== undefined && note.fields[idx] !== undefined ? note.fields[idx] : '';
  };

  const keyRaw = get('Kennung') || note.guid;
  const key = keyRaw.startsWith('narrenhof:') ? keyRaw.slice('narrenhof:'.length) : keyRaw;
  const name = get('Name') || base?.name || key;

  let baseJson: Record<string, unknown> = {};
  const jsonStr = get('EffektDatenJSON');
  if (jsonStr) {
    try {
      baseJson = JSON.parse(jsonStr) as Record<string, unknown>;
    } catch {
      baseJson = {};
    }
  }

  // Kaufpreis (0–99 Brezeln)
  const defaultPrice = typeof base?.price === 'number' ? base.price : 5;
  const price = parseClampedInt(
    get('Kaufpreis'),
    0,
    99,
    defaultPrice,
    { cardName: name, fieldName: 'Kaufpreis' },
    notices,
  );

  // Basiswert (0–999 Chips)
  const baseChipsRaw = get('Basiswert');
  let baseChips: number | undefined;
  if (baseChipsRaw !== '') {
    baseChips = parseClampedInt(
      baseChipsRaw,
      0,
      999,
      base?.baseChips ?? 0,
      { cardName: name, fieldName: 'Basiswert' },
      notices,
    );
  } else if (base?.baseChips !== undefined) {
    baseChips = base.baseChips;
  }

  // Multiplikator (1–99)
  const multRaw = get('Multiplikator').replace(/^[xX+]/, '').trim();
  let multiplier: number | undefined;
  if (multRaw !== '') {
    multiplier = parseClampedInt(
      multRaw,
      1,
      99,
      base?.multiplier ?? 1,
      { cardName: name, fieldName: 'Multiplikator' },
      notices,
    );
  } else if (base?.multiplier !== undefined) {
    multiplier = base.multiplier;
  }

  const card: ParsedCourtCard = {
    ...base,
    ...baseJson,
    key,
    id: key,
    name,
    price,
    ...(baseChips !== undefined ? { baseChips } : {}),
    ...(multiplier !== undefined ? { multiplier } : {}),
  };

  const bild = get('Bild');
  if (bild) card.emoji = bild;
  const regeltext = get('Regeltext');
  if (regeltext) card.text = regeltext;

  return { card, notices };
}

/**
 * Liest und validiert eine Quartettkarte aus einer Anki-Notiz.
 */
export function parseQuartettCardSpec(
  note: AnkiNote,
  knownPropertyKeys: string[] = [],
  baseValues: Record<string, number> = {},
): { card: ParsedQuartettCard; notices: string[] } {
  const notices: string[] = [];
  const fieldIndex = Object.fromEntries(BUB_QUARTETT_CARD_FIELDS.map((f, i) => [f, i]));

  const get = (name: (typeof BUB_QUARTETT_CARD_FIELDS)[number]): string => {
    const idx = fieldIndex[name];
    return idx !== undefined && note.fields[idx] !== undefined ? note.fields[idx] : '';
  };

  const kennungRaw = get('Kennung') || note.guid;
  // Format setId:cardId (z. B. "bibel:A1" oder "tiere:B2") oder "A1"
  const cardId = kennungRaw.includes(':') ? kennungRaw.split(':')[1]! : kennungRaw;
  const cardName = get('Name') || cardId;
  const emoji = get('Bild');

  const values: Record<string, number> = { ...baseValues };

  // 6 Eigenschafts-Slots
  for (let i = 1; i <= 6; i++) {
    const propName = get(`Wert${i}_Name` as (typeof BUB_QUARTETT_CARD_FIELDS)[number]).trim();
    const propVal = get(`Wert${i}_Zahl` as (typeof BUB_QUARTETT_CARD_FIELDS)[number]).trim();
    if (!propVal) continue;

    // Finde passenden Eigenschafts-Schlüssel
    const propKey = knownPropertyKeys[i - 1] ?? propName.toLowerCase().replace(/\s+/g, '_');
    const fallback = baseValues[propKey] ?? 0;
    const val = parseClampedFloat(
      propVal,
      -1_000_000_000_000,
      1_000_000_000_000,
      fallback,
      { cardName: cardName, fieldName: propName || `Eigenschaft ${i}` },
      notices,
    );
    values[propKey] = val;
  }

  const card: ParsedQuartettCard = {
    id: cardId,
    name: cardName,
    emoji: emoji || undefined,
    values,
  };

  return { card, notices };
}

/**
 * Parst eine vollständige Anki-Sammlung und liefert das CustomCardCatalog-Snapshot
 * inklusive Prüfsumme und deutscher Validierungsmeldungen.
 */
export function parseCustomCardCatalog(
  col: AnkiCollection | { notes: readonly AnkiNote[] },
): CustomCardCatalog {
  const notices: string[] = [];
  const combatCards: Record<string, ParsedCombatCard> = {};
  const courtCards: Record<string, ParsedCourtCard> = {};
  const quartettCards: Record<string, ParsedQuartettCard> = {};

  for (const note of col.notes) {
    if (note.mid === BUB_COMBAT_CARD_NOTETYPE_ID || note.tags.includes('combat') || note.tags.includes('drachenspiel')) {
      const res = parseCombatCardSpec(note);
      combatCards[res.card.id] = res.card;
      notices.push(...res.notices);
    } else if (note.mid === BUB_COURT_CARD_NOTETYPE_ID || note.tags.includes('court') || note.tags.includes('narrenhof')) {
      const res = parseCourtCardSpec(note);
      courtCards[res.card.key] = res.card;
      notices.push(...res.notices);
    } else if (note.mid === BUB_QUARTETT_CARD_NOTETYPE_ID || note.tags.includes('quartett')) {
      const res = parseQuartettCardSpec(note);
      quartettCards[res.card.id] = res.card;
      notices.push(...res.notices);
    }
  }

  // Deterministische Prüfsumme (8 Zeichen Hex) über die sortierten Kennungen und Werte
  const canonicalSummary = JSON.stringify({
    combat: Object.keys(combatCards).sort().map((k) => [k, combatCards[k]?.cost, combatCards[k]?.attack, combatCards[k]?.health, combatCards[k]?.keywords]),
    court: Object.keys(courtCards).sort().map((k) => [k, courtCards[k]?.price, courtCards[k]?.baseChips, courtCards[k]?.multiplier]),
    quartett: Object.keys(quartettCards).sort().map((k) => [k, quartettCards[k]?.values]),
  });

  const fullHash = sha1Hex(canonicalSummary);
  const checksum = fullHash.slice(0, 8);

  return {
    checksum,
    notices,
    combatCards,
    courtCards,
    quartettCards,
  };
}

// ---------------------------------------------------------------------------
// Prüfung beim Spielstart (#270, #277): Ein Kartenset kommt im Online-Raum von der Raumleitung
// oder über das offene Protokoll von einem fremden Client. Die Spiele übernehmen daraus nur
// Werte und Darstellung – in denselben Grenzen wie beim Einlesen aus Anki –, nie Effekte,
// Kartenart oder unbekannte Felder. So rechnen Server, Bots und alle Mitspieler mit sicheren Zahlen.

const MAX_CATALOG_CARDS = 400;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const KNOWN_KEYWORDS = new Set(Object.values(DRACHENSPIEL_KEYWORD_MAP));

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown, max: number): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.slice(0, max) : undefined;
}

function cleanInt(value: unknown, min: number, max: number): number | undefined {
  const num = typeof value === 'string' ? Number(value) : value;
  if (typeof num !== 'number' || !Number.isFinite(num)) return undefined;
  return Math.min(max, Math.max(min, Math.round(num)));
}

/** Einträge eines Kartenverzeichnisses: höchstens 400, gültige Kennungen, nur Objekte. */
function entriesOf(map: unknown): [string, Record<string, unknown>][] {
  if (!isPlainRecord(map)) return [];
  return Object.entries(map)
    .filter((entry): entry is [string, Record<string, unknown>] => entry[0].length > 0 && entry[0].length <= 80 && !FORBIDDEN_KEYS.has(entry[0]) && isPlainRecord(entry[1]))
    .slice(0, MAX_CATALOG_CARDS);
}

function withOptional<T extends object>(target: T, extra: Record<string, unknown>): T {
  for (const [key, value] of Object.entries(extra)) if (value !== undefined) (target as Record<string, unknown>)[key] = value;
  return target;
}

/**
 * Prüft ein Kartenset, wie es im Spielstart-Option `customCardCatalog` steht (als Objekt oder
 * JSON-Text). Liefert null, wenn es kein Objekt ist. `legacy` deutet ein Objekt ohne die drei
 * Verzeichnisse als Verzeichnis dieser Kartenart (ältere Optionen `customCards`/`customMods`).
 */
export function sanitizeCustomCardCatalog(raw: unknown, legacy?: 'combat' | 'court' | 'quartett'): CustomCardCatalog | null {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!isPlainRecord(value)) return null;
  const shaped = 'combatCards' in value || 'courtCards' in value || 'quartettCards' in value;
  const source: Record<string, unknown> = shaped ? value : legacy ? { [`${legacy}Cards`]: value } : {};

  const combatCards: Record<string, ParsedCombatCard> = {};
  for (const [id, card] of entriesOf(source.combatCards)) {
    const keywords = Array.isArray(card.keywords) ? [...new Set(card.keywords.filter((k): k is string => typeof k === 'string' && KNOWN_KEYWORDS.has(k)))] : undefined;
    // Auslöser, Effekte und Zielwahl gehen nur roh und klein weiter; ihre Form prüft das Drachenspiel selbst (#270).
    const rawRules = (value: unknown) => (value !== undefined && JSON.stringify(value).length <= 4000 ? JSON.parse(JSON.stringify(value)) : undefined);
    combatCards[id] = withOptional({ id, name: cleanText(card.name, 60) ?? id } as ParsedCombatCard, {
      triggers: Array.isArray(card.triggers) ? rawRules(card.triggers) : undefined,
      effects: Array.isArray(card.effects) ? rawRules(card.effects) : undefined,
      targeting: cleanText(card.targeting, 20),
      house: cleanText(card.house, 20),
      cost: cleanInt(card.cost, 0, 20),
      attack: cleanInt(card.attack, 0, 99),
      health: cleanInt(card.health, 1, 99),
      keywords,
      emoji: cleanText(card.emoji, 16),
      quote: cleanText(card.quote, 200),
      text: cleanText(card.text, 300),
    });
  }

  const courtCards: Record<string, ParsedCourtCard> = {};
  for (const [key, card] of entriesOf(source.courtCards)) {
    courtCards[key] = withOptional({ key, id: key, name: cleanText(card.name, 60) ?? key } as ParsedCourtCard, {
      price: cleanInt(card.price, 0, 99),
      baseChips: cleanInt(card.baseChips, 0, 999),
      multiplier: cleanInt(card.multiplier, 1, 99),
      emoji: cleanText(card.emoji, 16),
      text: cleanText(card.text, 300),
    });
  }

  const quartettCards: Record<string, ParsedQuartettCard> = {};
  for (const [id, card] of entriesOf(source.quartettCards)) {
    const values: Record<string, number> = {};
    const rawValues = isPlainRecord(card.values) ? Object.entries(card.values) : [];
    for (const [prop, raw] of rawValues.filter(([k]) => k.length > 0 && k.length <= 40 && !FORBIDDEN_KEYS.has(k)).slice(0, 20)) {
      const num = typeof raw === 'string' ? Number(raw) : raw;
      if (typeof num === 'number' && Number.isFinite(num)) values[prop] = Math.min(1e12, Math.max(-1e12, num));
    }
    quartettCards[id] = withOptional({ id, name: cleanText(card.name, 60) ?? id, values } as ParsedQuartettCard, { emoji: cleanText(card.emoji, 16) });
  }

  const checksum = typeof value.checksum === 'string' && /^[0-9a-f]{1,16}$/i.test(value.checksum) ? value.checksum : '';
  const notices = Array.isArray(value.notices) ? value.notices.filter((n): n is string => typeof n === 'string').slice(0, 50).map((n) => n.slice(0, 300)) : [];
  const quartettSet = sanitizeQuartettSet(value.quartettSet);
  return { checksum, notices, combatCards, courtCards, quartettCards, ...(quartettSet ? { quartettSet } : {}) };
}

/**
 * Prüft ein eigenes Quartett-Set: 2–16 Gruppen (Buchstaben A–P) mit genau vier Karten (A1–A4),
 * 2–6 Eigenschaften, endliche Werte. Sonst null – dann gilt das gewählte Standard-Set.
 */
export function sanitizeQuartettSet(raw: unknown): CustomQuartettSet | null {
  if (!isPlainRecord(raw) || !Array.isArray(raw.properties) || !Array.isArray(raw.cards)) return null;
  const properties = raw.properties
    .filter(isPlainRecord)
    .map((p) => ({
      id: typeof p.id === 'string' && /^[a-z][a-z0-9_]{0,29}$/.test(p.id) ? p.id : '',
      label: cleanText(p.label, 30) ?? '',
      unit: cleanText(p.unit, 12) ?? '',
      higherWins: p.higherWins !== false,
      ...(p.format === 'plain' || p.format === 'year' ? { format: p.format as 'plain' | 'year' } : {}),
    }))
    .filter((p, i, all) => p.id && p.label && all.findIndex((q) => q.id === p.id) === i)
    .slice(0, 6);
  if (properties.length < 2) return null;
  const cards = raw.cards
    .filter(isPlainRecord)
    .filter((c) => typeof c.id === 'string' && /^[A-P][1-4]$/.test(c.id))
    .map((c) => {
      const values: Record<string, number> = {};
      const rawValues = isPlainRecord(c.values) ? c.values : {};
      for (const p of properties) {
        const num = typeof rawValues[p.id] === 'string' ? Number(rawValues[p.id]) : rawValues[p.id];
        values[p.id] = typeof num === 'number' && Number.isFinite(num) ? Math.min(1e12, Math.max(-1e12, num)) : 0;
      }
      const image = typeof c.image === 'string' && /^[\w.-]{1,80}\.(webp|png|jpe?g|svg|gif)$/i.test(c.image) ? c.image : undefined;
      return withOptional({ id: c.id as string, name: cleanText(c.name, 60) ?? (c.id as string), emoji: cleanText(c.emoji, 16) ?? '🃏', values }, { source: cleanText(c.source, 200), image });
    })
    .filter((c, i, all) => all.findIndex((d) => d.id === c.id) === i);
  const groupIds = [...new Set(cards.map((c) => c.id[0]!))].sort();
  if (groupIds.length < 2 || groupIds.length > 16 || groupIds.some((g) => cards.filter((c) => c.id[0] === g).length !== 4)) return null;
  const rawGroups = Array.isArray(raw.groups) ? raw.groups.filter(isPlainRecord) : [];
  const groups = groupIds.map((id) => ({ id, name: cleanText(rawGroups.find((g) => g.id === id)?.name, 40) ?? `Gruppe ${id}` }));
  return { name: cleanText(raw.name, 60) ?? 'Eigenes Set', emoji: cleanText(raw.emoji, 16) ?? '🃏', properties, groups, cards };
}

const SPECIAL_TAGS = ['combat', 'drachenspiel', 'court', 'narrenhof', 'quartett', 'woelfe', 'role'];

/** Ob eine Notiz eine Spezialkarte ist (Drachenspiel, Narrenhof, Quartett, Wölfe) – nach Notiztyp oder Schlagwort. */
export function isSpecialCardNote(note: Pick<AnkiNote, 'mid' | 'tags'>): boolean {
  return note.mid === BUB_COMBAT_CARD_NOTETYPE_ID || note.mid === BUB_COURT_CARD_NOTETYPE_ID || note.mid === BUB_QUARTETT_CARD_NOTETYPE_ID || note.tags.some((tag) => SPECIAL_TAGS.includes(tag));
}
