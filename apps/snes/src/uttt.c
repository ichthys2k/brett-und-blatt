/*
 * Ultimate Tic-Tac-Toe für Brett & Blatt 16 – nach packages/games/ultimate-tic-tac-toe/src/rules.ts
 * mit beiden Varianten (entschiedene Felder gesperrt oder weiter bespielbar; unentschiedene kleine
 * Felder zählen für niemanden oder für beide).
 *
 * Zug: [kleines Feld 0–8, Zelle 0–8].
 */
#include "spiel.h"
#include "bild.h"
#include "klang.h"

#define OFFEN 0xff
#define REMIS 2

typedef struct {
  u8 zellen[81]; /* 0 leer, 1 Kreuz (Platz 0), 2 Kreis (Platz 1) */
  u8 felder[9];  /* Besitzer: Platz, REMIS oder OFFEN */
  u8 zwang;      /* kleines Feld für den nächsten Zug oder OFFEN */
  u8 zug;
  u8 sieger;
  u8 reihe[3];
  u8 remis;
  u8 letztes_feld, letzte_zelle;
  u8 bespielbar; /* entschiedene Felder bleiben bespielbar */
  u8 fuer_beide; /* unentschiedene Felder zählen für beide */
} Uttt;

static const u8 REIHEN[8][3] = {
  {0, 1, 2}, {3, 4, 5}, {6, 7, 8}, {0, 3, 6}, {1, 4, 7}, {2, 5, 8}, {0, 4, 8}, {2, 4, 6},
};

static void uttt_aufbauen(u8 *stand, const u8 *optionen, Zufall *z) {
  Uttt *u = (Uttt *)stand;
  u8 i;
  (void)z;
  for (i = 0; i < 81; i++) u->zellen[i] = 0;
  for (i = 0; i < 9; i++) u->felder[i] = OFFEN;
  u->zwang = OFFEN;
  u->zug = 0;
  u->sieger = PLATZ_KEIN;
  u->reihe[0] = u->reihe[1] = u->reihe[2] = PLATZ_KEIN;
  u->remis = 0;
  u->letztes_feld = u->letzte_zelle = PLATZ_KEIN;
  u->bespielbar = optionen[0];
  u->fuer_beide = optionen[1];
}

static u8 hat_platz(const u8 *zellen, u8 feld) {
  u8 i;
  for (i = 0; i < 9; i++)
    if (!zellen[feld * 9 + i]) return 1;
  return 0;
}

static u8 spielbar(const Uttt *u, const u8 *zellen, const u8 *felder, u8 feld) {
  if (!hat_platz(zellen, feld)) return 0;
  return felder[feld] == OFFEN || u->bespielbar;
}

/* Bitmaske der kleinen Felder, in denen gesetzt werden darf. */
static u16 erlaubte_felder(const Uttt *u, const u8 *zellen, const u8 *felder, u8 zwang) {
  u8 f;
  u16 maske = 0;
  if (zwang != OFFEN) {
    if (spielbar(u, zellen, felder, zwang)) return 1 << zwang;
  }
  for (f = 0; f < 9; f++)
    if (spielbar(u, zellen, felder, f)) maske |= 1 << f;
  return maske;
}

static u8 zaehlt(const Uttt *u, const u8 *felder, u8 feld, u8 platz) {
  return felder[feld] == platz || (felder[feld] == REMIS && u->fuer_beide);
}

static u8 uttt_ergebnis(const u8 *stand, u8 *sieger) {
  const Uttt *u = (const Uttt *)stand;
  if (u->sieger != PLATZ_KEIN) {
    if (sieger) *sieger = u->sieger;
    return ERGEBNIS_SIEG;
  }
  return u->remis ? ERGEBNIS_REMIS : ERGEBNIS_LAEUFT;
}

static u8 uttt_am_zug(const u8 *stand) {
  const Uttt *u = (const Uttt *)stand;
  if (u->sieger != PLATZ_KEIN || u->remis) return PLATZ_KEIN;
  return u->zug;
}

static u16 uttt_zuege(const u8 *stand, Zug *zuege) {
  const Uttt *u = (const Uttt *)stand;
  u16 maske, n = 0;
  u8 f, c;
  if (uttt_am_zug(stand) == PLATZ_KEIN) return 0;
  maske = erlaubte_felder(u, u->zellen, u->felder, u->zwang);
  for (f = 0; f < 9; f++) {
    if (!(maske & (1 << f))) continue;
    for (c = 0; c < 9; c++) {
      if (u->zellen[f * 9 + c]) continue;
      zuege[n].n = 2;
      zuege[n].b[0] = f;
      zuege[n++].b[1] = c;
    }
  }
  return n;
}

static u8 kann_noch_gewinnen(const Uttt *u, u8 platz) {
  u8 r, k;
  for (r = 0; r < 8; r++) {
    for (k = 0; k < 3; k++) {
      if (zaehlt(u, u->felder, REIHEN[r][k], platz)) continue;
      if (u->felder[REIHEN[r][k]] == OFFEN) continue;
      break;
    }
    if (k == 3) return 1;
  }
  return 0;
}

static u8 uttt_ziehen(u8 *stand, const Zug *zug) {
  Uttt *u = (Uttt *)stand;
  u8 f = zug->b[0], c = zug->b[1], ich = u->zug, wert = ich + 1, r, k, eins, zwei;
  const u8 *z = u->zellen + f * 9;
  u->zellen[f * 9 + c] = wert;
  if (u->felder[f] == OFFEN) {
    for (r = 0; r < 8; r++)
      if (z[REIHEN[r][0]] == wert && z[REIHEN[r][1]] == wert && z[REIHEN[r][2]] == wert) break;
    if (r < 8) u->felder[f] = ich;
    else if (!hat_platz(u->zellen, f)) u->felder[f] = REMIS;
  }
  u->zug = ich ^ 1;
  u->zwang = c;
  u->letztes_feld = f;
  u->letzte_zelle = c;
  for (r = 0; r < 8; r++) {
    for (k = 0; k < 3; k++)
      if (!zaehlt(u, u->felder, REIHEN[r][k], ich)) break;
    if (k == 3) break;
  }
  if (r < 8) {
    u->sieger = ich;
    for (k = 0; k < 3; k++) u->reihe[k] = REIHEN[r][k];
  } else {
    eins = kann_noch_gewinnen(u, 0);
    zwei = kann_noch_gewinnen(u, 1);
    if (erlaubte_felder(u, u->zellen, u->felder, u->zwang) == 0) u->remis = 1;
    else if (!eins) {
      if (!zwei) u->remis = 1;
    }
  }
  return KLANG_SETZEN;
}

static u16 uttt_ausgeben(const u8 *stand, u8 *p) {
  const Uttt *u = (const Uttt *)stand;
  u16 n = 0;
  u8 i;
  for (i = 0; i < 81; i++) p[n++] = u->zellen[i] ? u->zellen[i] - 1 : PLATZ_KEIN;
  for (i = 0; i < 9; i++) p[n++] = u->felder[i];
  p[n++] = u->zwang;
  p[n++] = u->zug;
  p[n++] = u->sieger;
  for (i = 0; i < 3; i++) p[n++] = u->reihe[i];
  p[n++] = u->remis;
  p[n++] = u->letztes_feld;
  p[n++] = u->letzte_zelle;
  p[n++] = u->bespielbar;
  p[n++] = u->fuer_beide;
  return n;
}

/* ------------------------------------------------------------------ Bot */

/*
 * Negamax mit Alpha-Beta auf Kopien von Zellen und Feldern je Tiefe. Bewertung: gewonnene kleine
 * Felder (Mitte und Ecken mehr wert), offene Zweier im großen und in den kleinen Feldern.
 */
#define TIEFE_MAX 5
static u8 b_zellen[TIEFE_MAX + 1][81];
static u8 b_felder[TIEFE_MAX + 1][9];
static const Uttt *b_u;
static u16 b_start, b_budget;
static u8 b_abbruch;
static const s16 FELD_WERT[9] = {3, 2, 3, 2, 4, 2, 3, 2, 3};

static s16 bewerten(const u8 *zellen, const u8 *felder, u8 platz) {
  u8 r, k, f, eigen, fremd, wert = platz + 1;
  s16 summe = 0;
  for (f = 0; f < 9; f++) {
    if (felder[f] == platz) summe += 30 * FELD_WERT[f];
    else if (felder[f] == (platz ^ 1)) summe -= 30 * FELD_WERT[f];
    else if (felder[f] == OFFEN) {
      for (r = 0; r < 8; r++) {
        eigen = fremd = 0;
        for (k = 0; k < 3; k++) {
          if (zellen[f * 9 + REIHEN[r][k]] == wert) eigen++;
          else if (zellen[f * 9 + REIHEN[r][k]]) fremd++;
        }
        if (eigen == 2 && !fremd) summe += 3 * FELD_WERT[f];
        if (fremd == 2 && !eigen) summe -= 3 * FELD_WERT[f];
      }
    }
  }
  for (r = 0; r < 8; r++) {
    eigen = fremd = 0;
    for (k = 0; k < 3; k++) {
      if (felder[REIHEN[r][k]] == platz) eigen++;
      else if (felder[REIHEN[r][k]] != OFFEN) fremd++;
    }
    if (eigen == 2 && !fremd) summe += 60;
    if (fremd == 2 && !eigen) summe -= 60;
  }
  return summe;
}

/* Setzt auf Ebene `e` + 1 und gibt 1 zurück, wenn `platz` damit die Partie gewinnt. */
static u8 b_setzen(u8 e, u8 f, u8 c, u8 platz) {
  u8 i, r, k, wert = platz + 1;
  const u8 *z;
  for (i = 0; i < 81; i++) b_zellen[e + 1][i] = b_zellen[e][i];
  for (i = 0; i < 9; i++) b_felder[e + 1][i] = b_felder[e][i];
  b_zellen[e + 1][f * 9 + c] = wert;
  if (b_felder[e + 1][f] != OFFEN) return 0;
  z = b_zellen[e + 1] + f * 9;
  for (r = 0; r < 8; r++)
    if (z[REIHEN[r][0]] == wert && z[REIHEN[r][1]] == wert && z[REIHEN[r][2]] == wert) break;
  if (r == 8) {
    if (!hat_platz(b_zellen[e + 1], f)) b_felder[e + 1][f] = REMIS;
    return 0;
  }
  b_felder[e + 1][f] = platz;
  for (r = 0; r < 8; r++) {
    for (k = 0; k < 3; k++)
      if (!zaehlt(b_u, b_felder[e + 1], REIHEN[r][k], platz)) break;
    if (k == 3) return 1;
  }
  return 0;
}

static s16 suche(u8 e, u8 platz, u8 zwang, u8 tiefe, s16 alpha, s16 beta) {
  u16 maske;
  u8 f, c, gefunden = 0;
  s16 wert, bester = -30000;
  if ((u16)(BILDER() - b_start) > b_budget) {
    b_abbruch = 1;
    return 0;
  }
  if (tiefe == 0) return bewerten(b_zellen[e], b_felder[e], platz);
  maske = erlaubte_felder(b_u, b_zellen[e], b_felder[e], zwang);
  for (f = 0; f < 9; f++) {
    if (!(maske & (1 << f))) continue;
    for (c = 0; c < 9; c++) {
      if (b_zellen[e][f * 9 + c]) continue;
      gefunden = 1;
      if (b_setzen(e, f, c, platz)) wert = 10000 + tiefe;
      else wert = -suche(e + 1, platz ^ 1, c, tiefe - 1, -beta, -alpha);
      if (b_abbruch) return 0;
      if (wert > bester) {
        bester = wert;
        if (bester > alpha) alpha = bester;
        if (alpha >= beta) return bester;
      }
    }
  }
  return gefunden ? bester : 0;
}

static void uttt_bot(const u8 *stand, u8 stufe, Zufall *z, Zug *zug) {
  static const u8 TIEFE[STUFEN] = {1, 2, TIEFE_MAX - 1};
  static const u16 BUDGET[STUFEN] = {30, 60, 110};
  static u8 beste_f[81], beste_c[81];
  const Uttt *u = (const Uttt *)stand;
  u16 n = uttt_zuege(stand, zugliste), i;
  u8 tiefe, k, m, gewaehlt = 0;
  s16 wert, bester;
  if (stufe == STUFE_LEICHT) {
    if (zufall_bis(z, 3) == 0) {
      *zug = zugliste[zufall_bis(z, n)];
      return;
    }
  }
  b_u = u;
  for (k = 0; k < 81; k++) b_zellen[0][k] = u->zellen[k];
  for (k = 0; k < 9; k++) b_felder[0][k] = u->felder[k];
  b_start = BILDER();
  b_budget = BUDGET[stufe];
  *zug = zugliste[zufall_bis(z, n)];
  for (tiefe = 1; tiefe <= TIEFE[stufe]; tiefe++) {
    b_abbruch = 0;
    bester = -30000;
    m = 0;
    for (i = 0; i < n; i++) {
      if (b_setzen(0, zugliste[i].b[0], zugliste[i].b[1], u->zug)) wert = 20000;
      else wert = -suche(1, u->zug ^ 1, zugliste[i].b[1], tiefe - 1, -30000, 30000);
      if (b_abbruch) break;
      if (wert > bester) {
        bester = wert;
        m = 0;
      }
      if (wert == bester) {
        beste_f[m] = zugliste[i].b[0];
        beste_c[m++] = zugliste[i].b[1];
      }
    }
    if (b_abbruch) break;
    k = zufall_bis(z, m);
    zug->n = 2;
    zug->b[0] = beste_f[k];
    zug->b[1] = beste_c[k];
    gewaehlt = 1;
    if (bester >= 10000) break;
  }
  (void)gewaehlt;
}

/* ------------------------------------------------------------------ Oberfläche */

#define X0 6
#define Y0 4

static void uttt_gitter(const u8 *stand, u8 *b, u8 *h) {
  (void)stand;
  *b = *h = 9;
}

static u8 uttt_feld_an(const u8 *stand, u8 x, u8 y) {
  (void)stand;
  return ((y / 3) * 3 + x / 3) * 9 + (y % 3) * 3 + x % 3;
}

static u8 uttt_felder(const u8 *stand, const Zug *zug, u8 *felder) {
  (void)stand;
  felder[0] = zug->b[0] * 9 + zug->b[1];
  return 1;
}

static void uttt_zeichnen(const u8 *stand, const u8 *markierung, u8 aktiv) {
  const Uttt *u = (const Uttt *)stand;
  u8 f, c, i, pal, x, y, laeuft = uttt_am_zug(stand) != PLATZ_KEIN, in_reihe;
  u16 maske = laeuft ? erlaubte_felder(u, u->zellen, u->felder, u->zwang) : 0, bild;
  tafel(X0 - 1, Y0 - 1, 22, 22);
  for (f = 0; f < 9; f++) {
    x = X0 + (f % 3) * 7;
    y = Y0 + (f / 3) * 7;
    in_reihe = u->reihe[0] == f || u->reihe[1] == f || u->reihe[2] == f;
    // Entschiedene Felder ohne weiteres Spiel zeigen ein großes Zeichen.
    if (u->felder[f] != OFFEN && !u->bespielbar) {
      bild = u->felder[f] == 0 ? KARTE_TTT_KREUZ : u->felder[f] == 1 ? KARTE_TTT_KREIS : KARTE_TTT_REMIS;
      karte(x, y, bild, 6, 6, in_reihe ? PAL_BRETT_MARKE : PAL_BRETT);
      continue;
    }
    for (c = 0; c < 9; c++) {
      i = f * 9 + c;
      pal = (maske & (1 << f)) ? PAL_BRETT_AUSWAHL : PAL_BRETT;
      if (in_reihe) pal = PAL_BRETT_MARKE;
      if (aktiv && (markierung[i] & MARK_CURSOR)) pal = PAL_BRETT_MARKE;
      if (u->zellen[i] == 1) bild = KARTE_UTTT_KREUZ;
      else if (u->zellen[i] == 2) bild = KARTE_UTTT_KREIS;
      else if (aktiv && (markierung[i] & MARK_CURSOR) && (markierung[i] & MARK_ZIEL)) bild = u->zug == 0 ? KARTE_UTTT_GEIST_KREUZ : KARTE_UTTT_GEIST_KREIS;
      else bild = KARTE_UTTT_LEER;
      karte(x + (c % 3) * 2, y + (c / 3) * 2, bild, 2, 2, pal);
    }
  }
}

/* ------------------------------------------------------------------ Steckbrief */

/* Wortlaut aus packages/games/ultimate-tic-tac-toe/src/meta.ts (howToPlay). */
static const char *const ANLEITUNG[] = {
  "Das Brett besteht aus neun kleinen Tic-Tac-Toe-Feldern.",
  "Wo du im kleinen Feld setzt, bestimmt das große Feld, in dem dein Gegner als Nächstes spielen muss. Es leuchtet auf.",
  "Ist dieses Feld schon entschieden oder voll, darf der Gegner frei wählen.",
  "Drei in einer Reihe gewinnen ein kleines Feld. Drei gewonnene kleine Felder in einer Reihe gewinnen die Partie.",
  0,
};
static const char *const PLATZ_NAMEN[] = {"Kreuz", "Kreis"};
static const u8 PLATZ_PALETTEN[] = {PAL_ROT, PAL_BLAU};
static const char *const ENTSCHIEDEN[] = {"gesperrt", "bespielbar"};
static const char *const REMIS_ZAEHLT[] = {"für keinen", "für beide"};
static const Option OPTIONEN[] = {
  {"Gewonnen", ENTSCHIEDEN, 2, 0},
  {"Remisfeld", REMIS_ZAEHLT, 2, 0},
};

const Spiel spiel_uttt = {
  "Ultimate Tic-Tac-Toe",
  ANLEITUNG,
  "✚ Zelle wählen · A setzen · Helles Holz: hier darfst du setzen",
  PLATZ_NAMEN,
  PLATZ_PALETTEN,
  2,
  0,
  OPTIONEN,
  2,
  FARBEN_UTTT,
  uttt_aufbauen,
  uttt_am_zug,
  uttt_zuege,
  uttt_ziehen,
  uttt_ergebnis,
  uttt_bot,
  uttt_ausgeben,
  uttt_gitter,
  uttt_feld_an,
  uttt_felder,
  uttt_zeichnen,
  4,
  4,
};
