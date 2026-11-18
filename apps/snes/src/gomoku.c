/*
 * Gomoku für Brett & Blatt 16 – nach packages/games/gomoku/src/rules.ts (15 × 15, fünf oder mehr
 * in einer Reihe gewinnen; die Gewinnreihe sind fünf Steine um den letzten Stein wie in findWinLine).
 *
 * Zug: [Feld], Felder zeilenweise von oben links.
 */
#include "spiel.h"
#include "bild.h"
#include "klang.h"

#define G 15
#define ZELLEN (G * G)

typedef struct {
  u8 felder[ZELLEN]; /* 0 leer, 1 Schwarz (Platz 0), 2 Weiß (Platz 1) */
  u8 zug;
  u8 sieger;
  u8 reihe[5];
  u8 belegt;
  u8 letzter;
} Gomoku;

static const s8 RICHTUNGEN[4][2] = {{1, 0}, {0, 1}, {1, 1}, {1, -1}}; /* (Spalte, Reihe) */

static void gomoku_aufbauen(u8 *stand, const u8 *optionen, u8 plaetze, const char *seed) {
  Gomoku *g = (Gomoku *)stand;
  u8 i;
  (void)optionen;
  (void)plaetze;
  (void)seed;
  for (i = 0; i < ZELLEN; i++) g->felder[i] = 0;
  g->zug = 0;
  g->sieger = PLATZ_KEIN;
  for (i = 0; i < 5; i++) g->reihe[i] = PLATZ_KEIN;
  g->belegt = 0;
  g->letzter = PLATZ_KEIN;
}

static u8 gomoku_ergebnis(const u8 *stand, u8 *sieger) {
  const Gomoku *g = (const Gomoku *)stand;
  if (g->sieger != PLATZ_KEIN) {
    if (sieger) *sieger = 1 << (g->sieger);
    return ERGEBNIS_SIEG;
  }
  return g->belegt == ZELLEN ? ERGEBNIS_REMIS : ERGEBNIS_LAEUFT;
}

static u8 gomoku_am_zug(const u8 *stand) {
  if (gomoku_ergebnis(stand, 0) != ERGEBNIS_LAEUFT) return PLATZ_KEIN;
  return ((const Gomoku *)stand)->zug;
}

static u16 gomoku_zuege(const u8 *stand, Zug *zuege) {
  const Gomoku *g = (const Gomoku *)stand;
  u8 i;
  u16 n = 0;
  if (gomoku_am_zug(stand) == PLATZ_KEIN) return 0;
  for (i = 0; i < ZELLEN; i++) {
    if (g->felder[i]) continue;
    zuege[n].n = 1;
    zuege[n++].b[0] = i;
  }
  return n;
}

/* Gewinnreihe durch `feld` wie findWinLine mit lastCell; gibt 1 zurück, wenn gefunden. */
static u8 reihe_finden(Gomoku *g, u8 feld, u8 wert) {
  static u8 linie[9];
  u8 d, n, i, k, start;
  s8 c, r, x, y;
  c = feld % G;
  r = feld / G;
  for (d = 0; d < 4; d++) {
    // Rückwärts (vorne einfügen), dann das Feld, dann vorwärts – je höchstens vier Schritte.
    n = 0;
    for (i = 1; i < 5; i++) {
      x = c - RICHTUNGEN[d][0] * i;
      y = r - RICHTUNGEN[d][1] * i;
      if (x < 0 || x >= G || y < 0 || y >= G) break;
      if (g->felder[y * G + x] != wert) break;
      n++;
    }
    for (k = 0; k < n; k++) {
      x = c - RICHTUNGEN[d][0] * (n - k);
      y = r - RICHTUNGEN[d][1] * (n - k);
      linie[k] = y * G + x;
    }
    k = n;
    linie[n++] = feld;
    for (i = 1; i < 5; i++) {
      x = c + RICHTUNGEN[d][0] * i;
      y = r + RICHTUNGEN[d][1] * i;
      if (x < 0 || x >= G || y < 0 || y >= G) break;
      if (g->felder[y * G + x] != wert) break;
      linie[n++] = y * G + x;
    }
    if (n >= 5) {
      // start = max(0, min(idx - 2, len - 5)) mit idx = Stelle des Felds in der Linie.
      start = k >= 2 ? k - 2 : 0;
      if (start > n - 5) start = n - 5;
      for (i = 0; i < 5; i++) g->reihe[i] = linie[start + i];
      return 1;
    }
  }
  return 0;
}

static u8 gomoku_ziehen(u8 *stand, const Zug *zug) {
  Gomoku *g = (Gomoku *)stand;
  u8 feld = zug->b[0];
  g->felder[feld] = g->zug + 1;
  g->belegt++;
  g->letzter = feld;
  if (reihe_finden(g, feld, g->zug + 1)) g->sieger = g->zug;
  g->zug ^= 1;
  return KLANG_SETZEN;
}

static u16 gomoku_ausgeben(const u8 *stand, u8 *p) {
  const Gomoku *g = (const Gomoku *)stand;
  u16 n = 0;
  u8 i;
  for (i = 0; i < ZELLEN; i++) p[n++] = g->felder[i] ? g->felder[i] - 1 : PLATZ_KEIN;
  p[n++] = g->zug;
  p[n++] = g->sieger;
  for (i = 0; i < 5; i++) p[n++] = g->reihe[i];
  return n;
}

/* ------------------------------------------------------------------ Bot */

/*
 * Ohne Suche: Jedes freie Feld in der Nähe der Steine bekommt eine Bewertung aus Angriff (eigene
 * Reihen, die es verlängert) und Abwehr (gegnerische Reihen, die es unterbricht). Länge und offene
 * Enden je Richtung bestimmen den Wert – fünf gewinnt, offene Vierer und Dreier sind Drohungen.
 */
static s16 linien_wert(const u8 *f, u8 feld, u8 wert, u8 stufe) {
  u8 d, n, offen;
  s8 c = feld % G, r = feld / G, x, y;
  s16 summe = 0;
  for (d = 0; d < 4; d++) {
    n = 1;
    offen = 0;
    x = c + RICHTUNGEN[d][0];
    y = r + RICHTUNGEN[d][1];
    while (x >= 0 && x < G && y >= 0 && y < G && f[y * G + x] == wert) {
      n++;
      x += RICHTUNGEN[d][0];
      y += RICHTUNGEN[d][1];
    }
    if (x >= 0 && x < G && y >= 0 && y < G && !f[y * G + x]) offen++;
    x = c - RICHTUNGEN[d][0];
    y = r - RICHTUNGEN[d][1];
    while (x >= 0 && x < G && y >= 0 && y < G && f[y * G + x] == wert) {
      n++;
      x -= RICHTUNGEN[d][0];
      y -= RICHTUNGEN[d][1];
    }
    if (x >= 0 && x < G && y >= 0 && y < G && !f[y * G + x]) offen++;
    if (n >= 5) summe += 10000;
    else if (n == 4) summe += offen == 2 ? 2000 : offen ? 400 : 0;
    else if (n == 3) summe += offen == 2 ? (stufe == STUFE_LEICHT ? 60 : 300) : offen ? 40 : 0;
    else if (n == 2) summe += offen == 2 ? 20 : offen ? 6 : 0;
    else summe += offen;
  }
  return summe;
}

static u8 in_der_naehe(const u8 *f, u8 feld) {
  s8 c = feld % G, r = feld / G, x, y;
  for (y = r - 2; y <= r + 2; y++) {
    if (y < 0 || y >= G) continue;
    for (x = c - 2; x <= c + 2; x++) {
      if (x < 0 || x >= G) continue;
      if (f[y * G + x]) return 1;
    }
  }
  return 0;
}

static void gomoku_bot(const u8 *stand, u8 stufe, Zufall *z, Zug *zug) {
  const Gomoku *g = (const Gomoku *)stand;
  static u8 beste[ZELLEN];
  u8 i, n = 0, ich = g->zug + 1, gegner = 2 - g->zug;
  s16 wert, bester = -1, angriff, abwehr;
  zug->n = 1;
  if (g->belegt == 0) {
    zug->b[0] = 7 * G + 7;
    return;
  }
  for (i = 0; i < ZELLEN; i++) {
    if (g->felder[i]) continue;
    if (!in_der_naehe(g->felder, i)) continue;
    angriff = linien_wert(g->felder, i, ich, stufe);
    abwehr = linien_wert(g->felder, i, gegner, stufe);
    // Schwer verteidigt fast so wichtig wie es angreift, leicht vor allem den eigenen Plan.
    if (stufe == STUFE_LEICHT) wert = angriff + abwehr / 4;
    else if (stufe == STUFE_MITTEL) wert = angriff + abwehr / 2;
    else wert = angriff + abwehr - abwehr / 8;
    if (wert > bester) {
      bester = wert;
      n = 0;
    }
    if (wert == bester) beste[n++] = i;
  }
  if (!n) {
    zug_zufaellig(&spiel_gomoku, stand, z, zug);
    return;
  }
  zug->b[0] = beste[zufall_bis(z, n)];
}

/* ------------------------------------------------------------------ Oberfläche */

#define X0 8
#define Y0 6

static void gomoku_gitter(const u8 *stand, u8 *b, u8 *h) {
  (void)stand;
  *b = *h = G;
}

static u8 gomoku_feld_an(const u8 *stand, u8 x, u8 y) {
  (void)stand;
  return y * G + x;
}

static u8 gomoku_felder(const u8 *stand, const Zug *zug, u8 *felder) {
  (void)stand;
  felder[0] = zug->b[0];
  return 1;
}

/* Kartenadressen je Art (Mitte, Stern, Ränder, Ecken) für leer, schwarz, weiß. */
static const u16 ARTEN[10][3] = {
  {KARTE_GOMOKU_MITTE_LEER, KARTE_GOMOKU_MITTE_SCHWARZ, KARTE_GOMOKU_MITTE_WEISS},
  {KARTE_GOMOKU_STERN_LEER, KARTE_GOMOKU_STERN_SCHWARZ, KARTE_GOMOKU_STERN_WEISS},
  {KARTE_GOMOKU_OBEN_LEER, KARTE_GOMOKU_OBEN_SCHWARZ, KARTE_GOMOKU_OBEN_WEISS},
  {KARTE_GOMOKU_UNTEN_LEER, KARTE_GOMOKU_UNTEN_SCHWARZ, KARTE_GOMOKU_UNTEN_WEISS},
  {KARTE_GOMOKU_LINKS_LEER, KARTE_GOMOKU_LINKS_SCHWARZ, KARTE_GOMOKU_LINKS_WEISS},
  {KARTE_GOMOKU_RECHTS_LEER, KARTE_GOMOKU_RECHTS_SCHWARZ, KARTE_GOMOKU_RECHTS_WEISS},
  {KARTE_GOMOKU_OL_LEER, KARTE_GOMOKU_OL_SCHWARZ, KARTE_GOMOKU_OL_WEISS},
  {KARTE_GOMOKU_OR_LEER, KARTE_GOMOKU_OR_SCHWARZ, KARTE_GOMOKU_OR_WEISS},
  {KARTE_GOMOKU_UL_LEER, KARTE_GOMOKU_UL_SCHWARZ, KARTE_GOMOKU_UL_WEISS},
  {KARTE_GOMOKU_UR_LEER, KARTE_GOMOKU_UR_SCHWARZ, KARTE_GOMOKU_UR_WEISS},
};

static u8 art(u8 x, u8 y) {
  if (y == 0) return x == 0 ? 6 : x == G - 1 ? 7 : 2;
  if (y == G - 1) return x == 0 ? 8 : x == G - 1 ? 9 : 3;
  if (x == 0) return 4;
  if (x == G - 1) return 5;
  if ((x == 3 || x == 7 || x == 11) && (y == 3 || y == 7 || y == 11) && (x == y || x + y == 14)) return 1;
  return 0;
}

static void gomoku_zeichnen(const u8 *stand, const u8 *markierung, u8 aktiv) {
  const Gomoku *g = (const Gomoku *)stand;
  u8 x, y, i, k, pal;
  tafel(X0 - 1, Y0 - 1, G + 2, G + 2);
  for (y = 0; y < G; y++) {
    for (x = 0; x < G; x++) {
      i = y * G + x;
      pal = PAL_BRETT;
      if (aktiv && (markierung[i] & MARK_CURSOR)) pal = PAL_BRETT_AUSWAHL;
      else if (i == g->letzter) pal = PAL_BRETT_MARKE;
      for (k = 0; k < 5; k++)
        if (g->reihe[k] == i) pal = PAL_BRETT_MARKE;
      karte(X0 + x, Y0 + y, ARTEN[art(x, y)][g->felder[i]], 1, 1, pal);
    }
  }
}

/* ------------------------------------------------------------------ Steckbrief */

/* Wortlaut aus packages/games/gomoku/src/meta.ts (howToPlay). */
static const char *const ANLEITUNG[] = {
  "Ihr setzt abwechselnd einen schwarzen oder weißen Stein auf ein freies Feld.",
  "Schwarz beginnt.",
  "Wer zuerst fünf Steine in einer Reihe hat – waagerecht, senkrecht oder diagonal –, gewinnt.",
  "Ist das Brett voll, ohne dass jemand fünf in einer Reihe hat, endet die Partie unentschieden.",
  0,
};
static const char *const PLATZ_NAMEN[] = {"Schwarz", "Weiß"};
static const u8 PLATZ_PALETTEN[] = {PAL_GRAU, PAL_TEXT};

const Spiel spiel_gomoku = {
  "Gomoku",
  ANLEITUNG,
  "✚ Schnittpunkt wählen · A setzen · Start: Pause",
  PLATZ_NAMEN,
  PLATZ_PALETTEN,
  2,
  2,
  0,
  0,
  0,
  FARBEN_GOMOKU,
  gomoku_aufbauen,
  gomoku_am_zug,
  gomoku_zuege,
  gomoku_ziehen,
  gomoku_ergebnis,
  gomoku_bot,
  gomoku_ausgeben,
  gomoku_gitter,
  gomoku_feld_an,
  gomoku_felder,
  gomoku_zeichnen,
  7,
  7,
};
