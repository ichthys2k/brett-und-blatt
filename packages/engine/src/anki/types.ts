/*
 * Das Datenmodell von Anki (Vorhaben #101, Schritt L1). Notiztypen und Stapel bleiben als JSON in der Form des alten Anki-Schemas
 * (Schema 11, `col.models` und `col.decks`) mit **allen** Schlüsseln erhalten, auch denen, die Brett & Blatt nicht kennt. So geht
 * beim Bearbeiten nichts verloren, was Anki später wieder braucht. Die Felder, die wir selbst lesen, sind unten typisiert.
 */

export interface AnkiField {
  name: string;
  ord: number;
  [key: string]: unknown;
}

export interface AnkiTemplate {
  name: string;
  ord: number;
  /** Vorderseite. */
  qfmt: string;
  /** Rückseite. */
  afmt: string;
  [key: string]: unknown;
}

/** Welche Felder eine Vorlage braucht, damit eine Karte entsteht: (Vorlagen-Nummer, „any“ | „all“ | „none“, Feld-Nummern). */
export type AnkiReq = [number, 'any' | 'all' | 'none', number[]];

export interface AnkiNotetype {
  id: number;
  name: string;
  /** 0 = normal, 1 = Lückentext (Cloze). */
  type: 0 | 1;
  /** Änderung in Sekunden. */
  mod: number;
  sortf: number;
  flds: AnkiField[];
  tmpls: AnkiTemplate[];
  css: string;
  req: AnkiReq[];
  [key: string]: unknown;
}

export interface AnkiDeck {
  id: number;
  /** Eltern und Kind sind mit `::` getrennt. */
  name: string;
  /** Änderung in Sekunden. */
  mod: number;
  [key: string]: unknown;
}

export interface AnkiNote {
  id: number;
  guid: string;
  /** Notiztyp. */
  mid: number;
  /** Stapel der Karten dieser Notiz. */
  did: number;
  /** Änderung in Sekunden. */
  mod: number;
  tags: string[];
  fields: string[];
  /** Aus einem Paket: Markierungen und Zusatzdaten der Notiz (bleiben für den Rückweg nach Anki erhalten). */
  flags?: number;
  data?: string;
}

/** Löschvermerk: damit ein anderes Gerät Gelöschtes nicht zurückbringt. Notizen über die `guid`, Stapel und Notiztypen über die `id`. */
export interface AnkiGrave {
  kind: 'note' | 'deck' | 'notetype';
  key: string;
  /** Zeit der Löschung in Millisekunden. */
  at: number;
}

export interface AnkiCollection {
  v: 2;
  notetypes: AnkiNotetype[];
  decks: AnkiDeck[];
  notes: AnkiNote[];
  graves: AnkiGrave[];
}

/** Karte einer Notiz. Entsteht aus Notiz und Notiztyp; der Lernstand kommt später (L5) dazu. */
export interface AnkiCard {
  id: number;
  nid: number;
  did: number;
  /** Nummer der Vorlage bzw. der Lücke (c1 = 0). */
  ord: number;
}
