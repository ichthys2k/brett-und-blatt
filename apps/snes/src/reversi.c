/*
 * Reversi für Brett & Blatt 16 – nach packages/games/reversi/src/rules.ts (Brettgrößen 6, 8, 10;
 * Kreuzstellung oder freie Eröffnung; Passen geschieht von selbst).
 *
 * Zug: [Feld], Felder zeilenweise von oben links.
 */
#include "spiel.h"
#include "bild.h"
#include "klang.h"

#define ZELLEN_MAX 100

typedef struct {
  u8 groesse;
  u8 felder[ZELLEN_MAX]; /* 0 leer, 1 Schwarz (Platz 0), 2 Weiß (Platz 1) */
  u8 zug;
  u8 frei;  /* freie Eröffnung */
  u8 vorbei;
  u8 letzter; /* PLATZ_KEIN: noch kein Zug */
  u8 umgedreht_n;
  u8 umgedreht[ZELLEN_MAX];
} Reversi;

static const s8 RICHTUNGEN[8][2] = {{-1, -1}, {-1, 0}, {-1, 1}, {0, -1}, {0, 1}, {1, -1}, {1, 0}, {1, 1}};
static const u8 GROESSEN[3] = {6, 8, 10};

static u8 mitte(u8 groesse, u8 i) {
  u8 m = groesse / 2;
  return (m - 1 + (i >> 1)) * groesse + m - 1 + (i & 1);
}

static u8 in_eroeffnung(const Reversi *r) {
  u8 i, n = 0;
  if (!r->frei) return 0;
  for (i = 0; i < r->groesse * r->groesse; i++)
    if (r->felder[i]) n++;
  return n < 4;
}

/*
 * Steine, die ein Stein auf `feld` umdrehen würde, in der Reihenfolge von flipsFor (Richtungen
 * wie DIRECTIONS, je Richtung vom Feld weg). Mit `liste` 0 wird nur gezählt.
 */
static u8 umdrehen(const u8 *f, u8 groesse, u8 feld, u8 platz, u8 *liste) {
  u8 d, n = 0, k, start, wert = platz + 1, anderer = 2 - platz;
  s8 r, c, zr = feld / groesse, zc = feld % groesse;
  if (f[feld]) return 0;
  for (d = 0; d < 8; d++) {
    start = n;
    r = zr + RICHTUNGEN[d][0];
    c = zc + RICHTUNGEN[d][1];
    k = 0;
    while (r >= 0 && r < groesse && c >= 0 && c < groesse && f[r * groesse + c] == anderer) {
      if (liste) liste[n + k] = r * groesse + c;
      k++;
      r += RICHTUNGEN[d][0];
      c += RICHTUNGEN[d][1];
    }
    if (k > 0 && r >= 0 && r < groesse && c >= 0 && c < groesse && f[r * groesse + c] == wert) n = start + k;
  }
  return n;
}

static u8 kann_setzen(const u8 *f, u8 groesse, u8 platz) {
  u8 i;
  for (i = 0; i < groesse * groesse; i++) {
    if (f[i]) continue;
    if (umdrehen(f, groesse, i, platz, 0)) return 1;
  }
  return 0;
}

static void reversi_aufbauen(u8 *stand, const u8 *optionen, Zufall *z) {
  Reversi *r = (Reversi *)stand;
  u8 i, k;
  (void)z;
  r->groesse = GROESSEN[optionen[0]];
  r->frei = optionen[1];
  for (i = 0; i < ZELLEN_MAX; i++) r->felder[i] = 0;
  if (!r->frei) {
    // Über eine lokale Variable: `r->felder[mitte(…)] = …` bringt 816-tcc zum Absturz (ICE 2).
    for (i = 0; i < 4; i++) {
      k = mitte(r->groesse, i);
      r->felder[k] = (i == 0 || i == 3) ? 2 : 1;
    }
  }
  r->zug = 0;
  r->vorbei = 0;
  r->letzter = PLATZ_KEIN;
  r->umgedreht_n = 0;
}

static void zaehlen(const Reversi *r, u8 *schwarz, u8 *weiss) {
  u8 i;
  *schwarz = *weiss = 0;
  for (i = 0; i < r->groesse * r->groesse; i++) {
    if (r->felder[i] == 1) (*schwarz)++;
    else if (r->felder[i] == 2) (*weiss)++;
  }
}

static u8 reversi_ergebnis(const u8 *stand, u8 *sieger) {
  const Reversi *r = (const Reversi *)stand;
  u8 s, w;
  if (!r->vorbei) return ERGEBNIS_LAEUFT;
  zaehlen(r, &s, &w);
  if (s == w) return ERGEBNIS_REMIS;
  if (sieger) *sieger = s > w ? 0 : 1;
  return ERGEBNIS_SIEG;
}

static u8 reversi_am_zug(const u8 *stand) {
  const Reversi *r = (const Reversi *)stand;
  return r->vorbei ? PLATZ_KEIN : r->zug;
}

static u16 reversi_zuege(const u8 *stand, Zug *zuege) {
  const Reversi *r = (const Reversi *)stand;
  u8 i, k;
  u16 n = 0;
  if (r->vorbei) return 0;
  if (in_eroeffnung(r)) {
    for (k = 0; k < 4; k++) {
      i = mitte(r->groesse, k);
      if (r->felder[i]) continue;
      zuege[n].n = 1;
      zuege[n++].b[0] = i;
    }
    return n;
  }
  for (i = 0; i < r->groesse * r->groesse; i++) {
    // Getrennte Bedingungen: `a || !f()` übersetzt 816-tcc hier falsch.
    if (r->felder[i]) continue;
    if (!umdrehen(r->felder, r->groesse, i, r->zug, 0)) continue;
    zuege[n].n = 1;
    zuege[n++].b[0] = i;
  }
  return n;
}

static u8 reversi_ziehen(u8 *stand, const Zug *zug) {
  Reversi *r = (Reversi *)stand;
  u8 feld = zug->b[0], ich = r->zug, i, eroeffnung = in_eroeffnung(r);
  r->umgedreht_n = eroeffnung ? 0 : umdrehen(r->felder, r->groesse, feld, ich, r->umgedreht);
  r->felder[feld] = ich + 1;
  for (i = 0; i < r->umgedreht_n; i++) r->felder[r->umgedreht[i]] = ich + 1;
  r->letzter = feld;
  r->zug = ich ^ 1;
  // Kann der Gegner nicht setzen, muss er passen; kann niemand mehr, ist Schluss.
  eroeffnung = in_eroeffnung(r);
  if (!eroeffnung) {
    if (!kann_setzen(r->felder, r->groesse, ich ^ 1)) {
      if (kann_setzen(r->felder, r->groesse, ich)) r->zug = ich;
      else r->vorbei = 1;
    }
  }
  return KLANG_SETZEN;
}

static u16 reversi_ausgeben(const u8 *stand, u8 *p) {
  const Reversi *r = (const Reversi *)stand;
  u16 n = 0;
  u8 i;
  p[n++] = r->groesse;
  for (i = 0; i < r->groesse * r->groesse; i++) p[n++] = r->felder[i] ? r->felder[i] - 1 : PLATZ_KEIN;
  p[n++] = r->zug;
  p[n++] = r->frei;
  p[n++] = r->vorbei;
  p[n++] = r->letzter;
  p[n++] = r->umgedreht_n;
  for (i = 0; i < r->umgedreht_n; i++) p[n++] = r->umgedreht[i];
  return n;
}

/* ------------------------------------------------------------------ Bot */

/*
 * Negamax mit Alpha-Beta über Kopien des Bretts je Tiefe. Bewertung wie evaluate in rules.ts:
 * Ecken sehr wertvoll, die Felder daneben gefährlich, solange die Ecke frei ist, Ränder gut;
 * gegen Ende zählt die Steinzahl. Die Beweglichkeit lässt der Bot weg – sie kostet auf dem
 * SNES zu viel Zeit.
 */
#define TIEFE_MAX 6
static u8 b_brett[TIEFE_MAX + 1][ZELLEN_MAX];
static u8 b_groesse, b_zellen, b_abbruch;
static u16 b_start, b_budget;
static u8 b_liste[ZELLEN_MAX];
static s8 b_gewicht[ZELLEN_MAX];

static void gewichte(void) {
  u8 i, r, c, last = b_groesse - 1;
  u8 rand_r, rand_c;
  for (i = 0; i < b_zellen; i++) {
    r = i / b_groesse;
    c = i % b_groesse;
    rand_r = r == 0 || r == last;
    rand_c = c == 0 || c == last;
    if (rand_r && rand_c) b_gewicht[i] = 100;
    else if ((r <= 1 || r >= last - 1) && (c <= 1 || c >= last - 1)) {
      // X- und C-Felder: gefährlich, solange die Ecke frei ist (siehe bewerten).
      b_gewicht[i] = (rand_r || rand_c) ? -20 : -50;
    } else if (rand_r || rand_c) b_gewicht[i] = 8;
    else b_gewicht[i] = 1;
  }
}

static s16 bewerten(const u8 *f, u8 platz) {
  u8 i, r, c, last = b_groesse - 1, leer = 0, ecke;
  s16 wert = 0, w, steine = 0;
  for (i = 0; i < b_zellen; i++) {
    if (!f[i]) {
      leer++;
      continue;
    }
    w = b_gewicht[i];
    if (w < 0) {
      r = i / b_groesse;
      c = i % b_groesse;
      ecke = (r <= 1 ? 0 : last) * b_groesse + (c <= 1 ? 0 : last);
      if (f[ecke]) w = 5;
    }
    if (f[i] == platz + 1) {
      wert += w;
      steine++;
    } else {
      wert -= w;
      steine--;
    }
  }
  if (leer < 14) wert += steine * (14 - leer);
  return wert;
}

static s16 suche(u8 ebene, u8 platz, u8 tiefe, s16 alpha, s16 beta, u8 gepasst) {
  const u8 *f = b_brett[ebene];
  u8 *nach = b_brett[ebene + 1];
  u8 i, k, n, gefunden = 0;
  s16 wert, bester = -30000;
  if ((u16)(BILDER() - b_start) > b_budget) {
    b_abbruch = 1;
    return 0;
  }
  if (tiefe == 0) return bewerten(f, platz);
  for (i = 0; i < b_zellen; i++) {
    if (f[i]) continue;
    n = umdrehen(f, b_groesse, i, platz, b_liste);
    if (!n) continue;
    gefunden = 1;
    for (k = 0; k < b_zellen; k++) nach[k] = f[k];
    nach[i] = platz + 1;
    for (k = 0; k < n; k++) nach[b_liste[k]] = platz + 1;
    wert = -suche(ebene + 1, platz ^ 1, tiefe - 1, -beta, -alpha, 0);
    if (b_abbruch) return 0;
    if (wert > bester) {
      bester = wert;
      if (bester > alpha) alpha = bester;
      if (alpha >= beta) break;
    }
  }
  if (!gefunden) {
    // Passen; passen beide, ist das Spiel aus: Steine zählen.
    if (gepasst) {
      wert = 0;
      for (i = 0; i < b_zellen; i++) wert += f[i] == platz + 1 ? 1 : f[i] ? -1 : 0;
      return wert * 1000;
    }
    for (k = 0; k < b_zellen; k++) nach[k] = f[k];
    return -suche(ebene + 1, platz ^ 1, tiefe, -beta, -alpha, 1);
  }
  return bester;
}

static void reversi_bot(const u8 *stand, u8 stufe, Zufall *z, Zug *zug) {
  static const u8 TIEFE[STUFEN] = {1, 2, TIEFE_MAX - 1};
  static const u16 BUDGET[STUFEN] = {40, 70, 120};
  const Reversi *r = (const Reversi *)stand;
  static u8 kandidaten[ZELLEN_MAX];
  u8 tiefe, i, k, n, m, beste_n, zufaellig;
  u8 beste[ZELLEN_MAX];
  s16 wert, bester;
  u16 anzahl = reversi_zuege(stand, zugliste);
  zufaellig = anzahl == 1;
  if (in_eroeffnung(r)) zufaellig = 1;
  if (stufe == STUFE_LEICHT) {
    if (zufall_bis(z, 3) == 0) zufaellig = 1;
  }
  if (zufaellig) {
    *zug = zugliste[zufall_bis(z, anzahl)];
    return;
  }
  for (i = 0; i < anzahl; i++) kandidaten[i] = zugliste[i].b[0];
  b_groesse = r->groesse;
  b_zellen = b_groesse * b_groesse;
  gewichte();
  b_start = BILDER();
  b_budget = BUDGET[stufe];
  beste_n = 0;
  for (tiefe = 1; tiefe <= TIEFE[stufe]; tiefe++) {
    b_abbruch = 0;
    bester = -30000;
    m = 0;
    for (i = 0; i < anzahl; i++) {
      for (k = 0; k < b_zellen; k++) b_brett[1][k] = r->felder[k];
      n = umdrehen(r->felder, b_groesse, kandidaten[i], r->zug, b_liste);
      b_brett[1][kandidaten[i]] = r->zug + 1;
      for (k = 0; k < n; k++) b_brett[1][b_liste[k]] = r->zug + 1;
      wert = -suche(1, r->zug ^ 1, tiefe - 1, -30000, 30000, 0);
      if (b_abbruch) break;
      if (wert > bester) {
        bester = wert;
        m = 0;
      }
      if (wert == bester) beste[m++] = kandidaten[i];
    }
    if (b_abbruch) break;
    beste_n = m;
    for (k = 0; k < m; k++) kandidaten[ZELLEN_MAX - 1 - k] = beste[k];
  }
  zug->n = 1;
  if (!beste_n) zug->b[0] = kandidaten[0];
  else zug->b[0] = kandidaten[ZELLEN_MAX - 1 - zufall_bis(z, beste_n)];
}

/* ------------------------------------------------------------------ Oberfläche */

static void reversi_gitter(const u8 *stand, u8 *b, u8 *h) {
  const Reversi *r = (const Reversi *)stand;
  *b = *h = r->groesse;
}

static u8 reversi_feld_an(const u8 *stand, u8 x, u8 y) {
  const Reversi *r = (const Reversi *)stand;
  return y * r->groesse + x;
}

static u8 reversi_felder(const u8 *stand, const Zug *zug, u8 *felder) {
  (void)stand;
  felder[0] = zug->b[0];
  return 1;
}

static void reversi_zeichnen(const u8 *stand, const u8 *markierung, u8 aktiv) {
  const Reversi *r = (const Reversi *)stand;
  u8 g = r->groesse, x0 = (BILD_B - 2 * g) / 2, y0 = 4 + (20 - 2 * g) / 2;
  u8 i, pal, s, w;
  u16 bild;
  tafel(x0 - 1, y0 - 1, 2 * g + 2, 2 * g + 2);
  for (i = 0; i < g * g; i++) {
    pal = PAL_BRETT;
    if (aktiv && (markierung[i] & MARK_CURSOR)) pal = PAL_BRETT_AUSWAHL;
    else if (i == r->letzter) pal = PAL_BRETT_MARKE;
    if (r->felder[i] == 1) bild = KARTE_REVERSI_SCHWARZ;
    else if (r->felder[i] == 2) bild = KARTE_REVERSI_WEISS;
    else if (aktiv && (markierung[i] & MARK_ZIEL)) bild = KARTE_REVERSI_HINWEIS;
    else bild = KARTE_REVERSI_LEER;
    karte(x0 + (i % g) * 2, y0 + (i / g) * 2, bild, 2, 2, pal);
  }
  zaehlen(r, &s, &w);
  flaeche_leeren(0, 24, 32, 1);
  text(8, 24, "Schwarz", PAL_TEXT);
  zahl(16, 24, s, 3, PAL_GELB);
  text(19, 24, ":", PAL_GRAU);
  zahl(20, 24, w, 3, PAL_GELB);
  text(24, 24, "Weiß", PAL_TEXT);
}

/* ------------------------------------------------------------------ Steckbrief */

/* Wortlaut aus packages/games/reversi/src/meta.ts (howToPlay). */
static const char *const ANLEITUNG[] = {
  "Schwarz beginnt. Setze einen Stein so, dass gegnerische Steine zwischen ihm und einem deiner Steine eingeschlossen sind – in einer oder mehreren Richtungen.",
  "Alle eingeschlossenen Steine werden umgedreht und gehören dann dir.",
  "Wer nicht setzen kann, muss passen. Kann niemand mehr setzen, ist Schluss.",
  "Wer am Ende mehr Steine hat, gewinnt. Tipp: Ecken lassen sich nie mehr umdrehen.",
  0,
};
static const char *const PLATZ_NAMEN[] = {"Schwarz", "Weiß"};
static const u8 PLATZ_PALETTEN[] = {PAL_GRAU, PAL_TEXT};
static const char *const GROESSEN_TEXT[] = {"6 × 6", "8 × 8", "10 × 10"};
static const char *const EROEFFNUNG[] = {"Kreuz", "frei"};
static const Option OPTIONEN[] = {
  {"Brett", GROESSEN_TEXT, 3, 1},
  {"Eröffnung", EROEFFNUNG, 2, 0},
};

const Spiel spiel_reversi = {
  "Reversi",
  ANLEITUNG,
  "✚ Feld wählen · A setzen (Punkte zeigen erlaubte Felder)",
  PLATZ_NAMEN,
  PLATZ_PALETTEN,
  2,
  0,
  OPTIONEN,
  2,
  FARBEN_REVERSI,
  reversi_aufbauen,
  reversi_am_zug,
  reversi_zuege,
  reversi_ziehen,
  reversi_ergebnis,
  reversi_bot,
  reversi_ausgeben,
  reversi_gitter,
  reversi_feld_an,
  reversi_felder,
  reversi_zeichnen,
  2,
  2,
};
