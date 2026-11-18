/*
 * Paare finden für Brett & Blatt 16 – nach packages/games/pairs/src/rules.ts mit den Kartensets
 * Tiere, Einmaleins und Englisch und den Rastern 12 bis 30 Karten; 1–6 Spieler.
 *
 * Zug: [Karte]. Die Karten liegen auf Ebene 2 (karte_unten), die Schrift darüber.
 */
#include "spiel.h"
#include "bild.h"
#include "klang.h"

#define KARTEN_MAX 30
#define PAARE_MAX 32
#define PROTOKOLL 80
#define VERDECKT 0
#define OFFEN 1
#define GENOMMEN 0x10 /* + Platz */

typedef struct {
  u8 karte, paar, seite;
  u16 schritt;
} Eintrag;

typedef struct {
  u8 plaetze, satz, spalten, zeilen, n, weiter;
  u8 paar[KARTEN_MAX], seite[KARTEN_MAX], status[KARTEN_MAX];
  u8 offen_n, offen[2];
  u8 zug;
  u8 punkte[PLAETZE_MAX];
  u16 runden, schritt;
  u8 protokoll_n, protokoll_start; /* Ringpuffer */
  Eintrag protokoll[PROTOKOLL];
  u8 fehlgriffe[PAARE_MAX * PLAETZE_MAX]; /* Paar * 6 + Platz */
} Paare;

/* ------------------------------------------------------------------ Inhalte */

/* content/paare/tiere.json: Bilder werden auf dem SNES zu Namen (gleiches Paar, gleicher Name). */
static const char *const TIERE[PAARE_MAX] = {
  "Hund", "Katze", "Maus", "Hamster", "Hase", "Fuchs", "Bär", "Panda", "Koala", "Tiger", "Löwe",
  "Kuh", "Ferkel", "Frosch", "Affe", "Hahn", "Pfau", "Papagei", "Ente", "Flamingo", "Pferd",
  "Einhorn", "Biene", "Dachs", "Falter", "Schild kröte", "Krake", "Krabbe", "Delfin", "Wal",
  "Giraffe", "Elefant",
};
/* content/paare/einmaleins.json */
static const char *const EINS_A[30] = {
  "2 · 3", "2 · 4", "3 · 3", "2 · 5", "3 · 4", "2 · 7", "3 · 5", "4 · 4", "3 · 6", "4 · 5",
  "3 · 7", "4 · 6", "5 · 5", "3 · 9", "4 · 7", "5 · 6", "4 · 8", "5 · 7", "6 · 6", "5 · 8",
  "6 · 7", "5 · 9", "6 · 8", "7 · 7", "6 · 9", "7 · 8", "7 · 9", "8 · 8", "8 · 9", "9 · 9",
};
static const char *const EINS_B[30] = {
  "6", "8", "9", "10", "12", "14", "15", "16", "18", "20", "21", "24", "25", "27", "28",
  "30", "32", "35", "36", "40", "42", "45", "48", "49", "54", "56", "63", "64", "72", "81",
};
/* content/paare/englisch.json */
static const char *const ENGL_A[30] = {
  "Hund", "Katze", "Haus", "Baum", "Buch", "Apfel", "Sonne", "Mond", "Wasser", "Schule",
  "Freund", "Auto", "Vogel", "Fisch", "Blume", "Tisch", "Stuhl", "Fenster", "Tür", "Brot",
  "Milch", "rot", "grün", "blau", "groß", "klein", "Lehrer", "Pferd", "Maus", "Herz",
};
static const char *const ENGL_B[30] = {
  "dog", "cat", "house", "tree", "book", "apple", "sun", "moon", "water", "school",
  "friend", "car", "bird", "fish", "flower", "table", "chair", "window", "door", "bread",
  "milk", "red", "green", "blue", "big", "small", "teacher", "horse", "mouse", "heart",
};
static const u8 SATZ_PAARE[3] = {32, 30, 30};
/* LAYOUTS ohne 36 (sechs Spalten passen nicht nebeneinander). */
static const u8 SPALTEN[5] = {3, 4, 4, 4, 5};
static const u8 ZEILEN[5] = {4, 4, 5, 6, 6};

static const char *seite_text(u8 satz, u8 paar, u8 seite) {
  if (satz == 0) return TIERE[paar];
  if (satz == 1) return seite ? EINS_B[paar] : EINS_A[paar];
  return seite ? ENGL_B[paar] : ENGL_A[paar];
}

/* ------------------------------------------------------------------ Regeln */

static void paare_aufbauen(u8 *stand, const u8 *optionen, u8 plaetze, const char *seed) {
  Paare *p = (Paare *)stand;
  static u8 wahl[PAARE_MAX];
  Zufall z;
  u8 i, j, t, anzahl, gesamt;
  u16 k;
  p->plaetze = plaetze;
  p->satz = optionen[0];
  p->spalten = SPALTEN[optionen[1]];
  p->zeilen = ZEILEN[optionen[1]];
  p->weiter = optionen[2] == 0;
  p->n = p->spalten * p->zeilen;
  anzahl = p->n / 2;
  gesamt = SATZ_PAARE[p->satz];
  zufall_strom(&z, seed, "karten");
  // rng.shuffle(Paarnummern).slice(0, anzahl)
  for (i = 0; i < gesamt; i++) wahl[i] = i;
  for (i = gesamt - 1; i > 0; i--) {
    j = zufall_bis(&z, i + 1);
    t = wahl[i];
    wahl[i] = wahl[j];
    wahl[j] = t;
  }
  // rng.shuffle(je Paar Seite a und b)
  for (i = 0; i < anzahl; i++) {
    p->paar[i * 2] = wahl[i];
    p->seite[i * 2] = 0;
    p->paar[i * 2 + 1] = wahl[i];
    p->seite[i * 2 + 1] = 1;
  }
  for (i = p->n - 1; i > 0; i--) {
    j = zufall_bis(&z, i + 1);
    t = p->paar[i];
    p->paar[i] = p->paar[j];
    p->paar[j] = t;
    t = p->seite[i];
    p->seite[i] = p->seite[j];
    p->seite[j] = t;
  }
  for (i = 0; i < p->n; i++) p->status[i] = VERDECKT;
  p->offen_n = 0;
  p->zug = 0;
  for (i = 0; i < PLAETZE_MAX; i++) p->punkte[i] = 0;
  p->runden = 0;
  p->schritt = 0;
  p->protokoll_n = 0;
  p->protokoll_start = 0;
  for (k = 0; k < PAARE_MAX * PLAETZE_MAX; k++) p->fehlgriffe[k] = 0;
}

static u8 alle_genommen(const Paare *p) {
  u8 i;
  for (i = 0; i < p->n; i++) {
    if (p->status[i] < GENOMMEN) return 0;
  }
  return 1;
}

static u8 paare_ergebnis(const u8 *stand, u8 *sieger) {
  const Paare *p = (const Paare *)stand;
  u8 i, beste = 0, maske = 0, anzahl = 0;
  if (!alle_genommen(p)) return ERGEBNIS_LAEUFT;
  for (i = 0; i < p->plaetze; i++) {
    if (p->punkte[i] > beste) beste = p->punkte[i];
  }
  for (i = 0; i < p->plaetze; i++) {
    if (p->punkte[i] != beste) continue;
    maske |= 1 << i;
    anzahl++;
  }
  if (anzahl > 1 && anzahl == p->plaetze) return ERGEBNIS_REMIS;
  if (sieger) *sieger = maske;
  return ERGEBNIS_SIEG;
}

static u8 paare_am_zug(const u8 *stand) {
  const Paare *p = (const Paare *)stand;
  return alle_genommen(p) ? PLATZ_KEIN : p->zug;
}

static u8 waehlbar(const Paare *p, u8 karte) {
  if (p->status[karte] == VERDECKT) return 1;
  if (p->offen_n == 2) {
    if (p->offen[0] == karte) return 1;
    if (p->offen[1] == karte) return 1;
  }
  return 0;
}

static u16 paare_zuege(const u8 *stand, Zug *zuege) {
  const Paare *p = (const Paare *)stand;
  u8 i;
  u16 k = 0;
  if (alle_genommen(p)) return 0;
  for (i = 0; i < p->n; i++) {
    if (!waehlbar(p, i)) continue;
    zuege[k].n = 1;
    zuege[k].b[0] = i;
    k++;
  }
  return k;
}

static void eintragen(Paare *p, u8 karte) {
  u8 stelle;
  Eintrag *e;
  if (p->protokoll_n < PROTOKOLL) {
    stelle = p->protokoll_n;
    p->protokoll_n++;
  } else {
    stelle = p->protokoll_start;
    p->protokoll_start++;
    if (p->protokoll_start == PROTOKOLL) p->protokoll_start = 0;
  }
  e = &p->protokoll[stelle];
  e->karte = karte;
  e->paar = p->paar[karte];
  e->seite = p->seite[karte];
  e->schritt = p->schritt;
}

static u8 paare_ziehen(u8 *stand, const Zug *zug) {
  Paare *p = (Paare *)stand;
  u8 karte = zug->b[0], a, b, ich = p->zug;
  if (p->offen_n == 2) {
    p->status[p->offen[0]] = VERDECKT;
    p->status[p->offen[1]] = VERDECKT;
    p->offen_n = 0;
  }
  p->status[karte] = OFFEN;
  p->offen[p->offen_n] = karte;
  p->offen_n++;
  eintragen(p, karte);
  p->schritt++;
  if (p->offen_n < 2) return KLANG_KLICK;
  a = p->offen[0];
  b = p->offen[1];
  p->runden++;
  if (p->paar[a] == p->paar[b]) {
    p->status[a] = GENOMMEN + ich;
    p->status[b] = GENOMMEN + ich;
    p->offen_n = 0;
    p->punkte[ich]++;
    if (!p->weiter) p->zug = (ich + 1) % p->plaetze;
    return alle_genommen(p) ? KLANG_ENDE : KLANG_SETZEN;
  }
  p->fehlgriffe[p->paar[a] * PLAETZE_MAX + ich]++;
  if (p->paar[b] != p->paar[a]) p->fehlgriffe[p->paar[b] * PLAETZE_MAX + ich]++;
  p->zug = (ich + 1) % p->plaetze;
  return KLANG_KLICK;
}

static u16 paare_ausgeben(const u8 *stand, u8 *a) {
  const Paare *p = (const Paare *)stand;
  u16 n = 0, k;
  u8 i, j;
  const Eintrag *e;
  a[n++] = p->plaetze;
  a[n++] = p->spalten;
  a[n++] = p->zeilen;
  a[n++] = p->weiter;
  for (i = 0; i < p->n; i++) {
    a[n++] = p->paar[i];
    a[n++] = p->seite[i];
    a[n++] = p->status[i];
  }
  a[n++] = p->offen_n;
  for (i = 0; i < p->offen_n; i++) a[n++] = p->offen[i];
  a[n++] = p->zug;
  for (i = 0; i < p->plaetze; i++) a[n++] = p->punkte[i];
  a[n++] = p->runden & 0xff;
  a[n++] = p->runden >> 8;
  a[n++] = p->schritt & 0xff;
  a[n++] = p->schritt >> 8;
  a[n++] = p->protokoll_n;
  for (i = 0; i < p->protokoll_n; i++) {
    j = p->protokoll_start + i;
    if (j >= PROTOKOLL) j -= PROTOKOLL;
    e = &p->protokoll[j];
    a[n++] = e->karte;
    a[n++] = e->paar;
    a[n++] = e->seite;
    a[n++] = e->schritt & 0xff;
    a[n++] = e->schritt >> 8;
  }
  // Fehlgriffe: nur die gesetzten, nach Paar und Platz geordnet.
  for (k = 0; k < PAARE_MAX * PLAETZE_MAX; k++) {
    if (!p->fehlgriffe[k]) continue;
    a[n++] = k / PLAETZE_MAX;
    a[n++] = k % PLAETZE_MAX;
    a[n++] = p->fehlgriffe[k];
  }
  a[n++] = 0xff;
  return n;
}

/* ------------------------------------------------------------------ Bot */

/*
 * Wie der Bot „Gedächtnis“ der Web-App: Er kennt nur das öffentliche Protokoll und vergisst je
 * nach Stufe ältere Karten (Spanne in Aufdeck-Schritten, Zuverlässigkeit in Prozent).
 */
static const u16 SPANNE[STUFEN] = {4, 14, 1000};
static const u8 VERLASS[STUFEN] = {75, 90, 97};

static void paare_bot(const u8 *stand, u8 stufe, Zufall *z, Zug *zug) {
  const Paare *p = (const Paare *)stand;
  static u8 zuletzt[KARTEN_MAX];   /* Eintrag + 1 des jüngsten Protokolleintrags, 0 = nie gesehen */
  static u8 gemerkt[KARTEN_MAX];   /* gemerktes Paar oder 0xff */
  static u8 liste[KARTEN_MAX];
  u8 i, j, n, erste = 0xff, wahl;
  const Eintrag *e;
  zug->n = 1;
  for (i = 0; i < p->n; i++) {
    zuletzt[i] = 0;
    gemerkt[i] = 0xff;
  }
  for (i = 0; i < p->protokoll_n; i++) {
    j = p->protokoll_start + i;
    if (j >= PROTOKOLL) j -= PROTOKOLL;
    zuletzt[p->protokoll[j].karte] = j + 1;
  }
  for (i = 0; i < p->n; i++) {
    if (!zuletzt[i]) continue;
    if (!waehlbar(p, i)) continue;
    e = &p->protokoll[zuletzt[i] - 1];
    if (p->schritt - e->schritt > SPANNE[stufe]) continue;
    if (zufall_bis(z, 100) >= VERLASS[stufe]) continue;
    gemerkt[i] = e->paar;
  }
  if (p->offen_n == 1) erste = p->offen[0];
  if (erste != 0xff) {
    // Zweite Karte: den gemerkten Partner, sonst eine noch nie gesehene Karte.
    for (i = 0; i < p->n; i++) {
      if (i == erste) continue;
      if (gemerkt[i] != p->paar[erste]) continue;
      zug->b[0] = i;
      return;
    }
  } else {
    for (i = 0; i < p->n; i++) {
      if (gemerkt[i] == 0xff) continue;
      for (j = i + 1; j < p->n; j++) {
        if (gemerkt[j] != gemerkt[i]) continue;
        zug->b[0] = i;
        return;
      }
    }
  }
  n = 0;
  for (i = 0; i < p->n; i++) {
    if (i == erste) continue;
    if (!waehlbar(p, i)) continue;
    if (zuletzt[i]) continue;
    liste[n++] = i;
  }
  if (!n) {
    for (i = 0; i < p->n; i++) {
      if (i == erste) continue;
      if (waehlbar(p, i)) liste[n++] = i;
    }
  }
  wahl = liste[zufall_bis(z, n)];
  zug->b[0] = wahl;
}

/* ------------------------------------------------------------------ Oberfläche */

#define KARTE_B 6
#define KARTE_H 3
#define Y0 5

static void paare_gitter(const u8 *stand, u8 *b, u8 *h) {
  const Paare *p = (const Paare *)stand;
  *b = p->spalten;
  *h = p->zeilen;
}

static u8 paare_feld_an(const u8 *stand, u8 x, u8 y) {
  const Paare *p = (const Paare *)stand;
  return y * p->spalten + x;
}

static u8 paare_felder(const u8 *stand, const Zug *zug, u8 *felder) {
  (void)stand;
  felder[0] = zug->b[0];
  return 1;
}

/* Eine Zeile Kartentext mittig in die Karte schreiben. */
static void zeile(u8 x, u8 y, const char *s, u8 pal) {
  u8 l = text_laenge(s);
  text(x + (KARTE_B - l) / 2, y, s, pal);
}

/* Kartentext in ein bis zwei Zeilen: an einem Leerzeichen oder mit Trennstrich (nur ASCII-Wörter). */
static void kartentext(u8 x, u8 y, const char *s, u8 pal) {
  static char oben[12], unten[12];
  u8 l = text_laenge(s), i, k, mitte;
  if (l <= KARTE_B) {
    zeile(x, y + 1, s, pal);
    return;
  }
  for (i = 0; s[i] && s[i] != ' '; i++) oben[i] = s[i];
  if (s[i] == ' ') {
    oben[i] = 0;
    for (k = 0; s[i + 1 + k]; k++) unten[k] = s[i + 1 + k];
    unten[k] = 0;
  } else {
    mitte = (l + 1) / 2;
    for (i = 0; i < mitte; i++) oben[i] = s[i];
    oben[i++] = '-';
    oben[i] = 0;
    for (k = 0; s[mitte + k]; k++) unten[k] = s[mitte + k];
    unten[k] = 0;
  }
  zeile(x, y, oben, pal);
  zeile(x, y + 1, unten, pal);
}

static void paare_zeichnen(const u8 *stand, const u8 *markierung, u8 aktiv) {
  const Paare *p = (const Paare *)stand;
  u8 i, x, y, sx, sy, x0, schritt_x, schritt_y, pal, cursor, offen;
  schritt_x = p->spalten == 5 ? 6 : 7;
  schritt_y = p->zeilen == 6 ? 3 : 4;
  x0 = (32 - (p->spalten - 1) * schritt_x - KARTE_B) / 2;
  tafel(0, 4, 32, 22);
  flaeche_leeren(1, 5, 30, 20);
  for (i = 0; i < p->n; i++) {
    sx = i % p->spalten;
    sy = i / p->spalten;
    x = x0 + sx * schritt_x;
    y = Y0 + sy * schritt_y;
    cursor = aktiv && (markierung[i] & MARK_CURSOR);
    offen = p->status[i] == OFFEN;
    if (p->status[i] >= GENOMMEN) {
      if (cursor) kachel(x + KARTE_B / 2, y + 1, K_PFEIL, PAL_GELB);
      continue;
    }
    pal = cursor ? PAL_BRETT_AUSWAHL : offen ? PAL_BRETT_MARKE : PAL_BRETT;
    if (offen) {
      karte_unten(x, y, KARTE_PAARE_OFFEN, KARTE_B, KARTE_H, pal);
      kartentext(x, y, seite_text(p->satz, p->paar[i], p->seite[i]), pal);
    } else {
      karte_unten(x, y, KARTE_PAARE_RUECKEN, KARTE_B, KARTE_H, pal);
    }
  }
  // Punkte je Platz in seiner Farbe, der Platz am Zug mit Pfeil.
  y = 24;
  flaeche_leeren(1, y, 30, 1);
  if (p->plaetze == 1) {
    text(2, y, "Züge", PAL_GRAU);
    zahl(7, y, p->runden, 3, PAL_GELB);
    text(12, y, "Paare", PAL_GRAU);
    zahl(18, y, p->punkte[0], 2, PAL_GELB);
    return;
  }
  for (i = 0; i < p->plaetze; i++) {
    x = 1 + i * 5;
    if (i == p->zug) kachel(x, y, Z_PFEIL_RECHTS, PAL_GELB);
    zahl(x + 1, y, i + 1, 1, spiel_paare.platz_paletten[i]);
    text(x + 2, y, ":", PAL_GRAU);
    zahl(x + 3, y, p->punkte[i], 2, PAL_TEXT);
  }
}

/* ------------------------------------------------------------------ Steckbrief */

/* Wortlaut aus packages/games/pairs/src/meta.ts (howToPlay). */
static const char *const ANLEITUNG[] = {
  "Alle Karten liegen verdeckt. Wer dran ist, deckt zwei Karten auf.",
  "Passen sie zusammen – gleiches Bild oder zusammengehörige Begriffe wie „7 · 8“ und „56“ –, behältst du das Paar und bist noch einmal dran.",
  "Sonst bleiben die Karten offen liegen, bis der Nächste aufdeckt. Gut merken!",
  "Wer am Ende die meisten Paare hat, gewinnt. Allein spielst du gegen die Zahl deiner Züge.",
  0,
};
static const char *const PLATZ_NAMEN[] = {"Spieler 1", "Spieler 2", "Spieler 3", "Spieler 4", "Spieler 5", "Spieler 6"};
static const u8 PLATZ_PALETTEN[] = {PAL_ROT, PAL_BLAU, PAL_GELB, PAL_TEXT, PAL_GRAU, PAL_ROT};
static const char *const SAETZE[] = {"Tiere", "Einmaleins", "Englisch"};
static const char *const GROESSEN[] = {"12 Karten", "16 Karten", "20 Karten", "24 Karten", "30 Karten"};
static const char *const WEITER[] = {"nochmal", "Nächster"};
static const Option OPTIONEN[] = {
  {"Karten", SAETZE, 3, 0},
  {"Raster", GROESSEN, 5, 1},
  {"Nach Paar", WEITER, 2, 0},
};

const Spiel spiel_paare = {
  "Paare finden",
  ANLEITUNG,
  "✚ Karte wählen · A aufdecken",
  PLATZ_NAMEN,
  PLATZ_PALETTEN,
  1,
  6,
  0,
  OPTIONEN,
  3,
  FARBEN_PAARE,
  paare_aufbauen,
  paare_am_zug,
  paare_zuege,
  paare_ziehen,
  paare_ergebnis,
  paare_bot,
  paare_ausgeben,
  paare_gitter,
  paare_feld_an,
  paare_felder,
  paare_zeichnen,
  0,
  0,
  0,
};
