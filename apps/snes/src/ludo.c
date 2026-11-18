/*
 * Nicht ärgern! für Brett & Blatt 16 – nach packages/games/ludo/src/rules.ts mit Kreuz- und
 * Sternbrett, allen Regeloptionen und 2–6 Spielern.
 *
 * Zug: [0] würfeln, [1, Figur] ziehen, [2] passen.
 */
#include "spiel.h"
#include "bild.h"
#include "klang.h"

#define FIGUREN 4
#define ZIEL_LAENGE 4
#define HAUS 0
#define BAHN 1
#define ZIEL 2
#define KEINER 0xff

typedef struct {
  u8 plaetze, stern, zug, ziehen; /* ziehen: 0 = würfeln, 1 = Figur ziehen */
  u8 wurf;                        /* 0 = keiner */
  u8 wuerfe, nochmal;
  u8 bereich[PLAETZE_MAX * FIGUREN], stelle[PLAETZE_MAX * FIGUREN];
  u8 schlagpflicht, nur_ein_wurf, eins_raus, genau;
  u8 letzt_platz, letzt_wurf; /* lastRoll, KEINER = keiner */
  u8 sieger;                  /* KEINER = offen */
  Zufall zufall;
} Ludo;

/* Wie SIX_ARMS: welcher Arm des Sternbretts zu welchem Platz gehört. */
static const u8 ARME[5][6] = {
  {0, 3, 0, 0, 0, 0},
  {0, 2, 4, 0, 0, 0},
  {0, 1, 3, 4, 0, 0},
  {0, 1, 2, 3, 4, 0},
  {0, 1, 2, 3, 4, 5},
};

static u8 arm(const Ludo *l, u8 platz) {
  return ARME[l->plaetze - 2][platz];
}

static u8 bahn_laenge(const Ludo *l) {
  return l->stern ? 54 : 40;
}

static u8 start_feld(const Ludo *l, u8 platz) {
  if (l->stern) return arm(l, platz) * 9 + 5;
  if (l->plaetze == 2) return platz ? 20 : 0;
  return (platz * 10) % 40;
}

/* colorIndex: zu zweit Gelb und Rot. */
static u8 farbe_von(u8 plaetze, u8 platz) {
  if (plaetze == 2) return platz ? 2 : 0;
  return platz;
}

static u8 absolut(const Ludo *l, u8 platz, u8 schritt) {
  u16 a = start_feld(l, platz) + schritt;
  return a % bahn_laenge(l);
}

static u8 auf_bahn(const Ludo *l, u8 platz) {
  u8 i;
  for (i = 0; i < FIGUREN; i++) {
    if (l->bereich[platz * FIGUREN + i] == BAHN) return 1;
  }
  return 0;
}

static u8 max_wuerfe(const Ludo *l, u8 platz) {
  if (l->nur_ein_wurf) return 1;
  return auf_bahn(l, platz) ? 1 : 3;
}

static u8 raus_wurf(const Ludo *l, u8 w) {
  if (w == 6) return 1;
  if (l->eins_raus && w == 1) return 1;
  return 0;
}

static void ludo_aufbauen(u8 *stand, const u8 *optionen, u8 plaetze, const char *seed) {
  Ludo *l = (Ludo *)stand;
  u8 p, i;
  l->plaetze = plaetze;
  l->stern = plaetze > 4 || optionen[0] == 1;
  l->schlagpflicht = optionen[1];
  l->nur_ein_wurf = optionen[2];
  l->eins_raus = optionen[3];
  l->genau = optionen[4] == 0;
  for (p = 0; p < PLAETZE_MAX; p++) {
    for (i = 0; i < FIGUREN; i++) {
      l->bereich[p * FIGUREN + i] = HAUS;
      l->stelle[p * FIGUREN + i] = i;
    }
  }
  l->zug = 0;
  l->ziehen = 0;
  l->wurf = 0;
  l->nochmal = 0;
  l->letzt_platz = KEINER;
  l->letzt_wurf = KEINER;
  l->sieger = KEINER;
  zufall_strom(&l->zufall, seed, "ludo-dice");
  l->wuerfe = max_wuerfe(l, 0);
}

static u8 eigene_auf(const Ludo *l, u8 platz, u8 bereich, u8 stelle) {
  u8 i;
  for (i = 0; i < FIGUREN; i++) {
    if (l->bereich[platz * FIGUREN + i] != bereich) continue;
    if (l->stelle[platz * FIGUREN + i] == stelle) return 1;
  }
  return 0;
}

/* canMovePiece */
static u8 beweglich(const Ludo *l, u8 platz, u8 figur, u8 w) {
  u8 b = l->bereich[platz * FIGUREN + figur], s = l->stelle[platz * FIGUREN + figur], n = bahn_laenge(l), weiter, ziel, k;
  if (b == HAUS) return 0;
  if (b == BAHN) {
    weiter = s + w;
    if (weiter < n) return !eigene_auf(l, platz, BAHN, weiter);
    ziel = weiter - n;
    if (ziel >= ZIEL_LAENGE) return !l->genau;
    if (eigene_auf(l, platz, ZIEL, ziel)) return 0;
    if (l->genau) {
      for (k = 0; k < ziel; k++) {
        if (eigene_auf(l, platz, ZIEL, k)) return 0;
      }
    }
    return 1;
  }
  ziel = s + w;
  if (ziel >= ZIEL_LAENGE) return !l->genau;
  if (eigene_auf(l, platz, ZIEL, ziel)) return 0;
  if (l->genau) {
    for (k = s + 1; k <= ziel; k++) {
      if (eigene_auf(l, platz, ZIEL, k)) return 0;
    }
  }
  return 1;
}

/* Gegner auf einem absoluten Bahnfeld? Gibt den Fortschritt des am weitesten gelaufenen + 1 zurück, sonst 0. */
static u8 gegner_auf(const Ludo *l, u8 platz, u8 feld) {
  u8 p, i, r = 0, k;
  for (p = 0; p < l->plaetze; p++) {
    if (p == platz) continue;
    for (i = 0; i < FIGUREN; i++) {
      k = p * FIGUREN + i;
      if (l->bereich[k] != BAHN) continue;
      if (absolut(l, p, l->stelle[k]) != feld) continue;
      if (l->stelle[k] + 1 > r) r = l->stelle[k] + 1;
    }
  }
  return r;
}

/* Zielfeld (absolut) eines Zugs, wenn er auf der Bahn endet, sonst KEINER. */
static u8 zielfeld(const Ludo *l, u8 platz, u8 figur, u8 w) {
  u8 k = platz * FIGUREN + figur, weiter;
  if (l->bereich[k] == HAUS) return raus_wurf(l, w) ? start_feld(l, platz) : KEINER;
  if (l->bereich[k] != BAHN) return KEINER;
  weiter = l->stelle[k] + w;
  if (weiter >= bahn_laenge(l)) return KEINER;
  return absolut(l, platz, weiter);
}

static u8 schlaegt(const Ludo *l, u8 platz, u8 figur, u8 w) {
  u8 f = zielfeld(l, platz, figur, w);
  if (f == KEINER) return 0;
  return gegner_auf(l, platz, f) > 0;
}

/* legalMoves in der Zugphase mit Wurf w: Figuren nach `figuren`, gibt die Anzahl zurück (0 = passen). */
static u8 zugfiguren(const Ludo *l, u8 w, u8 *figuren) {
  u8 platz = l->zug, i, n = 0, haus = KEINER, start = KEINER, k, m;
  for (i = 0; i < FIGUREN; i++) {
    k = platz * FIGUREN + i;
    if (l->bereich[k] == HAUS && haus == KEINER) haus = i;
    if (l->bereich[k] == BAHN && l->stelle[k] == 0 && start == KEINER) start = i;
  }
  if (raus_wurf(l, w) && haus != KEINER) {
    if (start != KEINER) {
      if (beweglich(l, platz, start, w)) {
        figuren[0] = start;
        return 1;
      }
    } else {
      figuren[0] = haus;
      return 1;
    }
  }
  for (i = 0; i < FIGUREN; i++) {
    if (beweglich(l, platz, i, w)) figuren[n++] = i;
  }
  if (n && l->schlagpflicht) {
    m = 0;
    for (i = 0; i < n; i++) {
      if (schlaegt(l, platz, figuren[i], w)) figuren[m++] = figuren[i];
    }
    if (m) n = m;
  }
  return n;
}

static u8 ludo_ergebnis(const u8 *stand, u8 *sieger) {
  const Ludo *l = (const Ludo *)stand;
  if (l->sieger == KEINER) return ERGEBNIS_LAEUFT;
  if (sieger) *sieger = 1 << l->sieger;
  return ERGEBNIS_SIEG;
}

static u8 ludo_am_zug(const u8 *stand) {
  const Ludo *l = (const Ludo *)stand;
  return l->sieger == KEINER ? l->zug : PLATZ_KEIN;
}

static u16 ludo_zuege(const u8 *stand, Zug *zuege) {
  const Ludo *l = (const Ludo *)stand;
  static u8 figuren[FIGUREN];
  u8 n, i;
  if (l->sieger != KEINER) return 0;
  if (!l->ziehen) {
    zuege[0].n = 1;
    zuege[0].b[0] = 0;
    return 1;
  }
  n = zugfiguren(l, l->wurf, figuren);
  if (!n) {
    zuege[0].n = 1;
    zuege[0].b[0] = 2;
    return 1;
  }
  for (i = 0; i < n; i++) {
    zuege[i].n = 2;
    zuege[i].b[0] = 1;
    zuege[i].b[1] = figuren[i];
  }
  return n;
}

static void naechster(Ludo *l) {
  l->zug = (l->zug + 1) % l->plaetze;
  l->ziehen = 0;
  l->wurf = 0;
  l->wuerfe = max_wuerfe(l, l->zug);
  l->nochmal = 0;
}

/* Gegner auf dem Feld zurück ins Häuschen. */
static u8 rauswerfen(Ludo *l, u8 platz, u8 feld) {
  u8 p, i, k, r = 0;
  for (p = 0; p < l->plaetze; p++) {
    if (p == platz) continue;
    for (i = 0; i < FIGUREN; i++) {
      k = p * FIGUREN + i;
      if (l->bereich[k] != BAHN) continue;
      if (absolut(l, p, l->stelle[k]) != feld) continue;
      l->bereich[k] = HAUS;
      l->stelle[k] = i;
      r = 1;
    }
  }
  return r;
}

static u8 ludo_ziehen(u8 *stand, const Zug *zug) {
  Ludo *l = (Ludo *)stand;
  static u8 figuren[FIGUREN];
  u8 w, platz = l->zug, k, weiter, ziel, klang = KLANG_SETZEN, i, alle;
  if (zug->b[0] == 0) {
    w = zufall_bis(&l->zufall, 6) + 1;
    l->wuerfe--;
    if (zugfiguren(l, w, figuren)) {
      l->ziehen = 1;
      l->wurf = w;
      l->wuerfe = 0;
      l->nochmal = w == 6;
      l->letzt_platz = l->letzt_wurf = KEINER;
      return KLANG_KLICK;
    }
    if (l->wuerfe) {
      l->wurf = w;
      l->nochmal = 0;
      l->letzt_platz = l->letzt_wurf = KEINER;
      return KLANG_KLICK;
    }
    l->letzt_platz = platz;
    l->letzt_wurf = w;
    naechster(l);
    return KLANG_KLICK;
  }
  if (zug->b[0] == 2) {
    naechster(l);
    return KLANG_KLICK;
  }
  w = l->wurf;
  k = platz * FIGUREN + zug->b[1];
  if (l->bereich[k] == HAUS) {
    l->bereich[k] = BAHN;
    l->stelle[k] = 0;
    if (rauswerfen(l, platz, start_feld(l, platz))) klang = KLANG_ENDE;
  } else if (l->bereich[k] == BAHN) {
    weiter = l->stelle[k] + w;
    if (weiter < bahn_laenge(l)) {
      l->stelle[k] = weiter;
      if (rauswerfen(l, platz, absolut(l, platz, weiter))) klang = KLANG_ENDE;
    } else {
      ziel = weiter - bahn_laenge(l);
      if (ziel > ZIEL_LAENGE - 1) ziel = ZIEL_LAENGE - 1;
      l->bereich[k] = ZIEL;
      l->stelle[k] = ziel;
    }
  } else {
    ziel = l->stelle[k] + w;
    if (ziel > ZIEL_LAENGE - 1) ziel = ZIEL_LAENGE - 1;
    l->stelle[k] = ziel;
  }
  alle = 1;
  for (i = 0; i < FIGUREN; i++) {
    if (l->bereich[platz * FIGUREN + i] != ZIEL) alle = 0;
  }
  if (alle) {
    l->sieger = platz;
    l->wurf = 0;
    return KLANG_SIEG;
  }
  if (l->nochmal) {
    l->ziehen = 0;
    l->wurf = 0;
    l->wuerfe = 1;
    l->nochmal = 0;
    return klang;
  }
  naechster(l);
  return klang;
}

static u16 ludo_ausgeben(const u8 *stand, u8 *a) {
  const Ludo *l = (const Ludo *)stand;
  u16 n = 0;
  u8 i;
  a[n++] = l->plaetze;
  a[n++] = l->stern;
  a[n++] = l->zug;
  a[n++] = l->ziehen;
  a[n++] = l->wurf;
  a[n++] = l->wuerfe;
  a[n++] = l->nochmal;
  for (i = 0; i < l->plaetze * FIGUREN; i++) {
    a[n++] = l->bereich[i];
    a[n++] = l->stelle[i];
  }
  a[n++] = l->schlagpflicht;
  a[n++] = l->nur_ein_wurf;
  a[n++] = l->eins_raus;
  a[n++] = l->genau;
  a[n++] = l->letzt_platz;
  a[n++] = l->letzt_wurf;
  for (i = 0; i < 4; i++) {
    a[n++] = l->zufall.s[i] & 0xff;
    a[n++] = (l->zufall.s[i] >> 8) & 0xff;
    a[n++] = (l->zufall.s[i] >> 16) & 0xff;
    a[n++] = (l->zufall.s[i] >> 24) & 0xff;
  }
  return n;
}

/* ------------------------------------------------------------------ Bot */

/* Steht ein Gegner 1–6 Felder hinter dem absoluten Feld? */
static u8 bedroht(const Ludo *l, u8 platz, u8 feld) {
  u8 p, i, k, n = bahn_laenge(l), d, von;
  for (p = 0; p < l->plaetze; p++) {
    if (p == platz) continue;
    for (i = 0; i < FIGUREN; i++) {
      k = p * FIGUREN + i;
      if (l->bereich[k] != BAHN) continue;
      von = absolut(l, p, l->stelle[k]);
      d = (feld + n - von) % n;
      if (d >= 1 && d <= 6) return 1;
    }
  }
  return 0;
}

/* evaluateMove aus packages/games/ludo/src/bots.ts */
static s16 bewerten(const Ludo *l, u8 figur) {
  u8 platz = l->zug, k = platz * FIGUREN + figur, w = l->wurf, n = bahn_laenge(l), weiter, ziel, i, andere, vorher, nachher, feld, g;
  s16 wert = 50;
  if (l->bereich[k] == HAUS) {
    wert += 450;
    if (gegner_auf(l, platz, start_feld(l, platz))) wert += 250;
    return wert;
  }
  if (l->bereich[k] == BAHN) {
    if (l->stelle[k] == 0) {
      for (i = 0; i < FIGUREN; i++) {
        if (l->bereich[platz * FIGUREN + i] == HAUS) {
          wert += 350;
          break;
        }
      }
    }
    weiter = l->stelle[k] + w;
    if (weiter >= n) {
      ziel = weiter - n;
      if (ziel > ZIEL_LAENGE - 1) ziel = ZIEL_LAENGE - 1;
      wert += 300 + ziel * 20;
      andere = 0;
      for (i = 0; i < FIGUREN; i++) {
        if (i != figur && l->bereich[platz * FIGUREN + i] == ZIEL) andere++;
      }
      if (andere == 3) wert += 5000;
      return wert;
    }
    feld = absolut(l, platz, weiter);
    g = gegner_auf(l, platz, feld);
    if (g > 1) wert += 400 + (g - 1) * 5;
    vorher = bedroht(l, platz, absolut(l, platz, l->stelle[k]));
    nachher = bedroht(l, platz, feld);
    if (vorher && !nachher) wert += 150;
    else if (!vorher && nachher) wert -= 100;
    wert += weiter * 3;
    return wert;
  }
  // Im Ziel: Beim flexiblen Einzug darf eine Figur „ziehen“, ohne sich zu bewegen – das ist ein verschenkter Wurf.
  ziel = l->stelle[k] + w;
  if (ziel > ZIEL_LAENGE - 1) ziel = ZIEL_LAENGE - 1;
  if (ziel == l->stelle[k]) return -200;
  return wert + 80 + ziel * 20;
}

static void ludo_bot(const u8 *stand, u8 stufe, Zufall *z, Zug *zug) {
  const Ludo *l = (const Ludo *)stand;
  static Zug liste[FIGUREN];
  u8 n = ludo_zuege(stand, liste), i, k, beste = 0, weit;
  s16 wert, bester = -32000;
  *zug = liste[0];
  if (n == 1) return;
  if (stufe == STUFE_LEICHT) {
    *zug = liste[zufall_bis(z, n)];
    return;
  }
  if (stufe == STUFE_MITTEL) {
    for (i = 0; i < n; i++) {
      k = l->zug * FIGUREN + liste[i].b[1];
      if (l->bereich[k] == HAUS) {
        *zug = liste[i];
        return;
      }
    }
    for (i = 0; i < n; i++) {
      k = l->zug * FIGUREN + liste[i].b[1];
      if (l->bereich[k] == BAHN && l->stelle[k] == 0) {
        *zug = liste[i];
        return;
      }
    }
    weit = 0;
    for (i = 0; i < n; i++) {
      k = l->zug * FIGUREN + liste[i].b[1];
      if (l->stelle[k] + 1 > weit) {
        weit = l->stelle[k] + 1;
        beste = i;
      }
    }
    *zug = liste[beste];
    return;
  }
  for (i = 0; i < n; i++) {
    wert = bewerten(l, liste[i].b[1]) + (s16)zufall_bis(z, 11) - 5;
    if (wert > bester) {
      bester = wert;
      beste = i;
    }
  }
  *zug = liste[beste];
}

/* ------------------------------------------------------------------ Oberfläche */

/* Kreuzbrett: Felder auf dem 11 × 11-Gitter (CLASSIC_TRACK, CLASSIC_GOALS in ui/geometry.ts). */
static const u8 KREUZ_BAHN_X[40] = {6, 6, 6, 6, 6, 7, 8, 9, 10, 10, 10, 9, 8, 7, 6, 6, 6, 6, 6, 5, 4, 4, 4, 4, 4, 3, 2, 1, 0, 0, 0, 1, 2, 3, 4, 4, 4, 4, 4, 5};
static const u8 KREUZ_BAHN_Y[40] = {0, 1, 2, 3, 4, 4, 4, 4, 4, 5, 6, 6, 6, 6, 6, 7, 8, 9, 10, 10, 10, 9, 8, 7, 6, 6, 6, 6, 6, 5, 4, 4, 4, 4, 4, 3, 2, 1, 0, 0};
static const u8 KREUZ_ZIEL_X[16] = {5, 5, 5, 5, 9, 8, 7, 6, 5, 5, 5, 5, 1, 2, 3, 4};
static const u8 KREUZ_ZIEL_Y[16] = {1, 2, 3, 4, 5, 5, 5, 5, 9, 8, 7, 6, 5, 5, 5, 5};
static const u8 KREUZ_HAUS_X[4] = {0, 9, 9, 0};
static const u8 KREUZ_HAUS_Y[4] = {0, 0, 9, 9};

/* Sternbrett: Kachelstellen aus der Geometrie der Web-App (Maßstab 1,7 Kacheln je Feldabstand). */
static const u8 STERN_BAHN_X[54] = {10, 10, 10, 10, 12, 13, 13, 13, 13, 15, 17, 18, 20, 20, 21, 20, 18, 17, 17, 18, 20, 21, 20, 20, 18, 17, 15, 13, 13, 13, 13, 12, 10, 10, 10, 10, 8, 7, 5, 4, 3, 2, 3, 5, 6, 6, 5, 3, 2, 3, 4, 5, 7, 8};
static const u8 STERN_BAHN_Y[54] = {9, 8, 6, 4, 4, 4, 6, 8, 9, 11, 10, 9, 8, 9, 11, 12, 13, 13, 16, 16, 17, 18, 20, 21, 20, 19, 19, 20, 21, 23, 25, 25, 25, 23, 21, 20, 19, 19, 20, 21, 20, 18, 17, 16, 16, 13, 13, 12, 11, 9, 8, 9, 10, 11};
static const u8 STERN_ZIEL_X[24] = {12, 12, 12, 12, 19, 17, 16, 15, 19, 17, 16, 15, 12, 12, 12, 12, 4, 6, 7, 9, 4, 6, 7, 9};
static const u8 STERN_ZIEL_Y[24] = {6, 8, 9, 11, 10, 11, 12, 13, 19, 18, 17, 16, 23, 21, 20, 18, 19, 18, 17, 16, 10, 11, 12, 13};
static const u8 STERN_HAUS_X[24] = {15, 17, 15, 17, 20, 22, 20, 22, 15, 17, 15, 17, 6, 8, 6, 8, 2, 3, 2, 3, 6, 8, 6, 8};
static const u8 STERN_HAUS_Y[24] = {6, 6, 7, 7, 14, 14, 15, 15, 22, 22, 23, 23, 22, 22, 23, 23, 14, 14, 15, 15, 6, 6, 7, 7};

#define FELD_WURF 4
#define PANEL_X 23

static const u16 FELD_FARBE[6] = {KARTE_LUDO_FELD_0, KARTE_LUDO_FELD_1, KARTE_LUDO_FELD_2, KARTE_LUDO_FELD_3, KARTE_LUDO_FELD_4, KARTE_LUDO_FELD_5};
static const u16 FIGUR[6] = {KARTE_LUDO_FIGUR_0, KARTE_LUDO_FIGUR_1, KARTE_LUDO_FIGUR_2, KARTE_LUDO_FIGUR_3, KARTE_LUDO_FIGUR_4, KARTE_LUDO_FIGUR_5};
static const u16 KFELD_FARBE[6] = {KARTE_LUDO_KFELD_0, KARTE_LUDO_KFELD_1, KARTE_LUDO_KFELD_2, KARTE_LUDO_KFELD_3, KARTE_LUDO_KFELD_4, KARTE_LUDO_KFELD_5};
static const u16 KFIGUR[6] = {KARTE_LUDO_KFIGUR_0, KARTE_LUDO_KFIGUR_1, KARTE_LUDO_KFIGUR_2, KARTE_LUDO_KFIGUR_3, KARTE_LUDO_KFIGUR_4, KARTE_LUDO_KFIGUR_5};

static void ludo_gitter(const u8 *stand, u8 *b, u8 *h) {
  (void)stand;
  *b = 5;
  *h = 1;
}

static u8 ludo_feld_an(const u8 *stand, u8 x, u8 y) {
  (void)stand;
  (void)y;
  return x == 0 ? FELD_WURF : x - 1;
}

static u8 ludo_felder(const u8 *stand, const Zug *zug, u8 *felder) {
  (void)stand;
  felder[0] = zug->b[0] == 1 ? zug->b[1] : FELD_WURF;
  return 1;
}

/* Ecke des Bretts eines Platzes: Kreuz nach Farbe, Stern nach Arm. */
static u8 ecke(const Ludo *l, u8 platz) {
  return l->stern ? arm(l, platz) : farbe_von(l->plaetze, platz);
}

/* Kachelstelle: Bahnfeld (absolut), Zielfeld oder Hausplatz einer Ecke. */
static void stelle_bahn(const Ludo *l, u8 feld, u8 *x, u8 *y) {
  if (l->stern) {
    *x = STERN_BAHN_X[feld];
    *y = STERN_BAHN_Y[feld];
  } else {
    *x = 1 + KREUZ_BAHN_X[feld] * 2;
    *y = 4 + KREUZ_BAHN_Y[feld] * 2;
  }
}

static void stelle_ziel(const Ludo *l, u8 e, u8 i, u8 *x, u8 *y) {
  if (l->stern) {
    *x = STERN_ZIEL_X[e * 4 + i];
    *y = STERN_ZIEL_Y[e * 4 + i];
  } else {
    *x = 1 + KREUZ_ZIEL_X[e * 4 + i] * 2;
    *y = 4 + KREUZ_ZIEL_Y[e * 4 + i] * 2;
  }
}

static void stelle_haus(const Ludo *l, u8 e, u8 i, u8 *x, u8 *y) {
  if (l->stern) {
    *x = STERN_HAUS_X[e * 4 + i];
    *y = STERN_HAUS_Y[e * 4 + i];
  } else {
    *x = 1 + (KREUZ_HAUS_X[e] + (i & 1)) * 2;
    *y = 4 + (KREUZ_HAUS_Y[e] + (i >> 1)) * 2;
  }
}

static void feld_malen(const Ludo *l, u8 x, u8 y, u8 farbe, u8 pal) {
  if (l->stern) karte(x, y, farbe == KEINER ? KARTE_LUDO_KFELD : KFELD_FARBE[farbe], 1, 1, pal);
  else karte(x, y, farbe == KEINER ? KARTE_LUDO_FELD : FELD_FARBE[farbe], 2, 2, pal);
}

static void figur_malen(const Ludo *l, u8 x, u8 y, u8 farbe, u8 pal) {
  if (l->stern) karte(x, y, KFIGUR[farbe], 1, 1, pal);
  else karte(x, y, FIGUR[farbe], 2, 2, pal);
}

/* Wohin zöge die Figur mit dem aktuellen Wurf? (für die Zielmarke) */
static u8 ziel_von(const Ludo *l, u8 figur, u8 *x, u8 *y) {
  u8 platz = l->zug, k = platz * FIGUREN + figur, weiter, ziel, n = bahn_laenge(l);
  if (l->bereich[k] == HAUS) {
    stelle_bahn(l, start_feld(l, platz), x, y);
    return 1;
  }
  if (l->bereich[k] == BAHN) {
    weiter = l->stelle[k] + l->wurf;
    if (weiter < n) {
      stelle_bahn(l, absolut(l, platz, weiter), x, y);
      return 1;
    }
    ziel = weiter - n;
  } else {
    ziel = l->stelle[k] + l->wurf;
  }
  if (ziel > ZIEL_LAENGE - 1) ziel = ZIEL_LAENGE - 1;
  stelle_ziel(l, ecke(l, platz), ziel, x, y);
  return 1;
}

static void ludo_zeichnen(const u8 *stand, const u8 *markierung, u8 aktiv) {
  const Ludo *l = (const Ludo *)stand;
  u8 i, e, p, f, x, y, k, pal, n = bahn_laenge(l), besetzt, ecken = l->stern ? 6 : 4, farbe;
  static u8 ecken_farbe[6];
  flaeche_leeren(0, 4, PANEL_X, 22);
  tafel(PANEL_X, 4, 32 - PANEL_X, 22);
  flaeche_leeren(PANEL_X + 1, 5, 32 - PANEL_X - 2, 20);
  // Farbe je Ecke (freie Arme des Sternbretts bleiben neutral).
  for (e = 0; e < 6; e++) ecken_farbe[e] = KEINER;
  for (p = 0; p < l->plaetze; p++) ecken_farbe[ecke(l, p)] = farbe_von(l->plaetze, p);
  if (!l->stern) {
    for (e = 0; e < 4; e++) ecken_farbe[e] = e;
  }
  // Leere Felder: Bahn (Startfelder in Eckenfarbe), Ziele, Häuschen.
  for (f = 0; f < n; f++) {
    farbe = KEINER;
    for (e = 0; e < ecken; e++) {
      if (l->stern ? f == e * 9 + 5 : f == e * 10) farbe = ecken_farbe[e];
    }
    stelle_bahn(l, f, &x, &y);
    feld_malen(l, x, y, farbe, PAL_BRETT);
  }
  for (e = 0; e < ecken; e++) {
    for (i = 0; i < 4; i++) {
      stelle_ziel(l, e, i, &x, &y);
      feld_malen(l, x, y, ecken_farbe[e], PAL_BRETT);
      stelle_haus(l, e, i, &x, &y);
      feld_malen(l, x, y, ecken_farbe[e], PAL_BRETT);
    }
  }
  // Zielmarke der Figur unter dem Cursor.
  if (aktiv && l->ziehen && l->sieger == KEINER) {
    for (i = 0; i < FIGUREN; i++) {
      if (!(markierung[i] & MARK_CURSOR)) continue;
      if (!(markierung[i] & MARK_ZIEL)) continue;
      if (ziel_von(l, i, &x, &y)) feld_malen(l, x, y, KEINER, PAL_BRETT_MARKE);
    }
  }
  // Figuren.
  for (p = 0; p < l->plaetze; p++) {
    for (i = 0; i < FIGUREN; i++) {
      k = p * FIGUREN + i;
      if (l->bereich[k] == HAUS) stelle_haus(l, ecke(l, p), i, &x, &y);
      else if (l->bereich[k] == ZIEL) stelle_ziel(l, ecke(l, p), l->stelle[k], &x, &y);
      else stelle_bahn(l, absolut(l, p, l->stelle[k]), &x, &y);
      pal = PAL_BRETT;
      if (aktiv && p == l->zug && (markierung[i] & MARK_CURSOR)) pal = PAL_BRETT_AUSWAHL;
      figur_malen(l, x, y, farbe_von(l->plaetze, p), pal);
    }
  }
  // Seitenleiste: Wurf und Knopf.
  x = PANEL_X + 1;
  text(x, 5, "Wurf", PAL_GRAU);
  if (l->wurf) zahl(x + 5, 5, l->wurf, 1, PAL_GELB);
  else if (l->letzt_wurf != KEINER) zahl(x + 5, 5, l->letzt_wurf, 1, PAL_GRAU);
  if (!l->ziehen && l->sieger == KEINER) {
    text(x, 7, "Würfe", PAL_GRAU);
    zahl(x + 6, 7, l->wuerfe, 1, PAL_TEXT);
  }
  besetzt = aktiv && (markierung[FELD_WURF] & MARK_CURSOR);
  kachel(x, 9, besetzt ? K_PFEIL : 0, PAL_GELB);
  if (l->ziehen) text(x + 1, 9, (markierung[FELD_WURF] & MARK_ZIEL) ? "Passen" : "Ziehen", PAL_TEXT);
  else text(x + 1, 9, "Würfeln", PAL_TEXT);
  for (p = 0; p < l->plaetze; p++) {
    y = 12 + p * 2;
    kachel(x, y, p == l->zug ? Z_PFEIL_RECHTS : 0, PAL_GELB);
    karte(x + 1, y, KFIGUR[farbe_von(l->plaetze, p)], 1, 1, PAL_BRETT);
    k = 0;
    for (i = 0; i < FIGUREN; i++) {
      if (l->bereich[p * FIGUREN + i] == ZIEL) k++;
    }
    zahl(x + 3, y, k, 1, PAL_TEXT);
    text(x + 4, y, "/4", PAL_GRAU);
  }
}

/* ------------------------------------------------------------------ Steckbrief */

/* Wortlaut aus packages/games/ludo/src/meta.ts (howToPlay). */
static const char *const ANLEITUNG[] = {
  "Bringe alle vier Figuren deiner Farbe aus dem Wartehäuschen ins Ziel.",
  "Bei einer 6 musst du eine Figur auf das Startfeld setzen und darfst noch einmal würfeln.",
  "Hast du keinen Stein auf der Strecke, darfst du bis zu dreimal würfeln.",
  "Endet dein Zug auf einem gegnerischen Stein, wird dieser geschlagen und muss zurück ins Häuschen.",
  "Schlagen ist freiwillig. Mit der Option „Schlagpflicht“ musst du schlagen, wenn du kannst.",
  "Zu fünft oder sechst spielt ihr auf dem Sternbrett mit sechs Armen und 54 Feldern; auf Wunsch geht das auch mit weniger Spielern.",
  "Wer zuerst alle vier Figuren in den Zielfeldern hat, gewinnt die Partie.",
  0,
};
static const char *const PLATZ_NAMEN[] = {"Gelb", "Grün", "Rot", "Blau", "Lila", "Türkis"};
static const u8 PLATZ_PALETTEN[] = {PAL_GELB, PAL_TEXT, PAL_ROT, PAL_BLAU, PAL_GRAU, PAL_TEXT};
static const char *const BRETTER[] = {"Kreuz", "Stern"};
static const char *const SCHLAGEN[] = {"freiwillig", "Pflicht"};
static const char *const WUERFE[] = {"3 bei leer", "immer 1"};
static const char *const RAUS[] = {"bei 6", "bei 6 oder 1"};
static const char *const EINZUG[] = {"genau", "flexibel"};
static const Option OPTIONEN[] = {
  {"Brett", BRETTER, 2, 0},
  {"Schlagen", SCHLAGEN, 2, 0},
  {"Würfe", WUERFE, 2, 0},
  {"Raus", RAUS, 2, 0},
  {"Ins Ziel", EINZUG, 2, 0},
};

const Spiel spiel_ludo = {
  "Nicht ärgern!",
  ANLEITUNG,
  "✚ Würfeln oder Figur wählen · A ausführen · Grün: Zielfeld",
  PLATZ_NAMEN,
  PLATZ_PALETTEN,
  2,
  6,
  0,
  OPTIONEN,
  5,
  FARBEN_LUDO,
  ludo_aufbauen,
  ludo_am_zug,
  ludo_zuege,
  ludo_ziehen,
  ludo_ergebnis,
  ludo_bot,
  ludo_ausgeben,
  ludo_gitter,
  ludo_feld_an,
  ludo_felder,
  ludo_zeichnen,
  0,
  0,
  0,
  farbe_von,
};
