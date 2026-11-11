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

export interface CustomCardCatalog {
  checksum: string;
  notices: string[];
  combatCards: Record<string, ParsedCombatCard>;
  courtCards: Record<string, ParsedCourtCard>;
  quartettCards: Record<string, ParsedQuartettCard>;
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

  const bild = get('Bild');
  if (bild) card.emoji = bild;
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
