/*
 * Zielzahl für Brett & Blatt 16 – nach packages/games/target-number/src/rules.ts, Modus
 * „Klassisch 24“ (vier Karten) mit beiden Rechenzeichen-Sätzen und 3–10 Runden; 1–6 Spieler geben
 * nacheinander verdeckt ab. Die Modi mit 5 und 6 Karten bleiben der Web-App vorbehalten: ihre
 * Kandidatensuche bräuchte auf dem SNES Sekunden je Runde.
 *
 * Zug „Abgabe“: [0, Schritte, je Schritt a, Zeichen, b, Endkarte] (Zeichen 0 +, 1 −, 2 ·, 3 :).
 * Erlaubt ist jede gültige Rechnung (Spiel.erlaubt wie isLegal); die Zugliste enthält wie
 * legalMoves die fünf besten Kandidaten. Zusatzzüge der Bedienung: [10, a, Zeichen, b] rechnet
 * einen Schritt, [11] nimmt ihn zurück (nur im ROM, nicht im Vergleich).
 */
#include "spiel.h"
#include "bild.h"
#include "klang.h"

#define KARTEN 4
#define ITEMS_MAX 4
#define SCHRITTE_MAX 3
#define KANDIDATEN_MAX 400
#define TOP 5
#define KEIN 0xff
#define PLUS 0
#define MINUS 1
#define MAL 2
#define GETEILT 3

typedef struct {
  u8 n, final, alle, punkte;
  s32 wert, abstand;
  u8 st[SCHRITTE_MAX * 3];
} Kandidat;

typedef struct {
  u8 n, final;
  u8 st[SCHRITTE_MAX * 3];
} Abgabe;

typedef struct {
  u8 plaetze, nur_asm, runden, runde, fertig;
  u8 ziel;
  u8 karten[KARTEN];
  u8 abgegeben[PLAETZE_MAX], alle[PLAETZE_MAX], r_punkte[PLAETZE_MAX];
  s32 wert[PLAETZE_MAX];
  u16 punkte[PLAETZE_MAX];
  u8 lr_runde;
  s32 lr_wert[PLAETZE_MAX];
  u8 lr_alle[PLAETZE_MAX], lr_punkte[PLAETZE_MAX];
  Zufall zufall;
  /* Nur im ROM: die fünf besten Kandidaten der Runde (legalMoves) und die Rechnung des Platzes am Zug. */
  u8 top_n;
  Abgabe top[TOP];
  u8 e_n, e_schritte;
  s32 e_wert[ITEMS_MAX];
  u8 e_st[SCHRITTE_MAX * 3];
  s32 e_links[SCHRITTE_MAX], e_rechts[SCHRITTE_MAX], e_ergebnis[SCHRITTE_MAX];
} Zielzahl;

static const u8 POOL_24[20][4] = {
  {1, 2, 3, 4}, {1, 3, 4, 6}, {1, 4, 5, 6}, {2, 3, 4, 6}, {2, 3, 5, 12}, {2, 4, 6, 8}, {2, 5, 7, 10},
  {3, 3, 6, 6}, {3, 4, 5, 8}, {3, 4, 7, 9}, {3, 5, 6, 9}, {3, 6, 8, 10}, {4, 4, 6, 8}, {4, 5, 6, 9},
  {4, 6, 7, 9}, {4, 7, 8, 9}, {5, 5, 7, 11}, {5, 6, 7, 8}, {6, 6, 8, 8}, {2, 6, 9, 12},
};
static const u8 RUNDEN[4] = {3, 5, 8, 10};
static const char ZEICHEN[4][4] = {"+", "−", "·", ":"};

extern Kandidat ziel_kandidaten[];
typedef char ziel_passt[sizeof(Kandidat) * KANDIDATEN_MAX <= 9600 ? 1 : -1];

/* applySingleStep: Ergebnis nach *ergebnis, 0 wenn der Schritt nicht geht. */
static u8 rechnen(s32 a, u8 op, s32 b, u8 nur_asm, s32 *ergebnis) {
  if (op == PLUS) {
    *ergebnis = a + b;
    return 1;
  }
  if (op == MINUS) {
    if (a < b) return 0;
    *ergebnis = a - b;
    return 1;
  }
  if (op == MAL) {
    *ergebnis = a * b;
    return 1;
  }
  if (nur_asm) return 0;
  if (b <= 0) return 0;
  if (a % b) return 0;
  *ergebnis = a / b;
  return 1;
}

/* Punkte für einen Wert (scoreSubmission). */
static u8 wertung(s32 wert, s32 ziel, u8 alle) {
  s32 d = wert - ziel;
  if (d < 0) d = -d;
  if (d == 0) return alle ? 12 : 10;
  if (d <= 2) return 7;
  if (d <= 5) return 5;
  if (d <= 10) return 3;
  return 1;
}

/* ------------------------------------------------------------------ Kandidatensuche (findCandidateMoves) */

static u16 k_n;
static u8 k_exakt_alle;
static u8 k_nur_asm;
static s32 k_ziel;
static u8 k_st[SCHRITTE_MAX * 3];
static s32 k_items[SCHRITTE_MAX + 1][ITEMS_MAX];

static void aufnehmen(u8 schritte, u8 final, s32 wert, u8 rest) {
  Kandidat *k;
  u16 i;
  u8 alle = 0, j;
  if (rest == 1) {
    if (schritte == KARTEN - 1) alle = 1;
  }
  for (i = 0; i < k_n; i++) {
    k = &ziel_kandidaten[i];
    if (k->wert != wert) continue;
    if (k->alle != alle) continue;
    if (k->n == schritte) return;
  }
  if (k_n >= KANDIDATEN_MAX) return;
  k = &ziel_kandidaten[k_n++];
  k->n = schritte;
  k->final = final;
  k->alle = alle;
  k->wert = wert;
  k->abstand = wert - k_ziel;
  if (k->abstand < 0) k->abstand = -k->abstand;
  k->punkte = wertung(wert, k_ziel, alle);
  for (j = 0; j < schritte * 3; j++) k->st[j] = k_st[j];
}

static void suchen(u8 tiefe, u8 n) {
  u8 i, j, op, k, m, aufzeichnen;
  s32 c, d;
  s32 *items = k_items[tiefe];
  s32 *naechste = k_items[tiefe + 1];
  if (k_exakt_alle) {
    if (k_n >= 8) return;
  }
  if (tiefe >= SCHRITTE_MAX) return;
  for (i = 0; i < n; i++) {
    for (j = 0; j < n; j++) {
      if (i == j) continue;
      for (op = 0; op < 4; op++) {
        if (op == GETEILT) {
          if (k_nur_asm) continue;
        }
        if (op == PLUS || op == MAL) {
          if (i > j) continue;
        }
        if (!rechnen(items[i], op, items[j], k_nur_asm, &c)) continue;
        m = 0;
        for (k = 0; k < n; k++) {
          if (k != i && k != j) naechste[m++] = items[k];
        }
        naechste[m++] = c;
        k_st[tiefe * 3] = i;
        k_st[tiefe * 3 + 1] = op;
        k_st[tiefe * 3 + 2] = j;
        d = c - k_ziel;
        if (d < 0) d = -d;
        aufzeichnen = tiefe + 1 <= 2;
        if (d <= 10) aufzeichnen = 1;
        if (aufzeichnen) {
          aufnehmen(tiefe + 1, m - 1, c, m);
          if (d == 0) {
            if (m == 1) k_exakt_alle = 1;
          }
        }
        if (k_exakt_alle) continue;
        if (m <= 1) continue;
        if (tiefe + 1 >= SCHRITTE_MAX) continue;
        suchen(tiefe + 1, m);
      }
    }
  }
}

/* Vergleich für die Sortierung: Gehört a vor b? */
static u8 vorher(const Kandidat *a, const Kandidat *b) {
  if (a->punkte != b->punkte) return a->punkte > b->punkte;
  if (a->abstand != b->abstand) return a->abstand < b->abstand;
  if (a->alle != b->alle) return a->alle;
  return a->n > b->n;
}

static void kandidaten_finden(Zielzahl *z) {
  static Kandidat t;
  u16 i, j;
  u8 k, beste = 0;
  s32 da, db;
  k_n = 0;
  k_exakt_alle = 0;
  k_nur_asm = z->nur_asm;
  k_ziel = z->ziel;
  for (k = 1; k < KARTEN; k++) {
    da = (s32)z->karten[k] - k_ziel;
    if (da < 0) da = -da;
    db = (s32)z->karten[beste] - k_ziel;
    if (db < 0) db = -db;
    if (da < db) beste = k;
  }
  aufnehmen(0, beste, z->karten[beste], KARTEN);
  for (k = 0; k < KARTEN; k++) k_items[0][k] = z->karten[k];
  suchen(0, KARTEN);
  // Stabil sortieren (Einfügen) wie Array.prototype.sort.
  for (i = 1; i < k_n; i++) {
    t = ziel_kandidaten[i];
    j = i;
    while (j > 0) {
      if (!vorher(&t, &ziel_kandidaten[j - 1])) break;
      ziel_kandidaten[j] = ziel_kandidaten[j - 1];
      j--;
    }
    ziel_kandidaten[j] = t;
  }
  z->top_n = k_n < TOP ? k_n : TOP;
  for (i = 0; i < z->top_n; i++) {
    z->top[i].n = ziel_kandidaten[i].n;
    z->top[i].final = ziel_kandidaten[i].final;
    for (k = 0; k < SCHRITTE_MAX * 3; k++) z->top[i].st[k] = ziel_kandidaten[i].st[k];
  }
}

/* ------------------------------------------------------------------ Regeln */

static void eingabe_leeren(Zielzahl *z) {
  u8 i;
  z->e_n = KARTEN;
  z->e_schritte = 0;
  for (i = 0; i < KARTEN; i++) z->e_wert[i] = z->karten[i];
}

/* generateRoundPuzzle im Modus „Klassisch 24“. */
static void runde_vorbereiten(Zielzahl *z) {
  u8 i, j, t, w = zufall_bis(&z->zufall, 20);
  for (i = 0; i < KARTEN; i++) z->karten[i] = POOL_24[w][i];
  for (i = KARTEN - 1; i > 0; i--) {
    j = zufall_bis(&z->zufall, i + 1);
    t = z->karten[i];
    z->karten[i] = z->karten[j];
    z->karten[j] = t;
  }
  z->ziel = 24;
  for (i = 0; i < PLAETZE_MAX; i++) z->abgegeben[i] = 0;
  kandidaten_finden(z);
  eingabe_leeren(z);
}

static void ziel_aufbauen(u8 *stand, const u8 *optionen, u8 plaetze, const char *seed) {
  Zielzahl *z = (Zielzahl *)stand;
  u8 i;
  z->plaetze = plaetze;
  z->nur_asm = optionen[0];
  z->runden = RUNDEN[optionen[1]];
  z->runde = 1;
  z->fertig = 0;
  z->lr_runde = 0;
  for (i = 0; i < PLAETZE_MAX; i++) z->punkte[i] = 0;
  zufall_strom(&z->zufall, seed, "target-number");
  runde_vorbereiten(z);
}

static u8 ziel_am_zug(const u8 *stand) {
  const Zielzahl *z = (const Zielzahl *)stand;
  u8 i;
  if (z->fertig) return PLATZ_KEIN;
  for (i = 0; i < z->plaetze; i++) {
    if (!z->abgegeben[i]) return i;
  }
  return PLATZ_KEIN;
}

static u8 ziel_ergebnis(const u8 *stand, u8 *sieger) {
  const Zielzahl *z = (const Zielzahl *)stand;
  u8 i, maske = 0;
  u16 beste = 0;
  if (!z->fertig) return ERGEBNIS_LAEUFT;
  for (i = 0; i < z->plaetze; i++) {
    if (z->punkte[i] > beste) beste = z->punkte[i];
  }
  for (i = 0; i < z->plaetze; i++) {
    if (z->punkte[i] == beste) maske |= 1 << i;
  }
  if (sieger) *sieger = maske;
  return ERGEBNIS_SIEG;
}

static void abgabe_zug(const Abgabe *a, Zug *zug) {
  u8 k;
  zug->b[0] = 0;
  zug->b[1] = a->n;
  for (k = 0; k < a->n * 3; k++) zug->b[2 + k] = a->st[k];
  zug->b[2 + a->n * 3] = a->final;
  zug->n = 3 + a->n * 3;
}

/* simulateSteps + finalIndex: Wert und „alle Karten“ einer Abgabe; 0, wenn sie nicht geht. */
static u8 abgabe_rechnen(const Zielzahl *z, const Zug *zug, s32 *wert, u8 *alle) {
  static s32 items[ITEMS_MAX];
  u8 n = KARTEN, s, k, m, a, op, b, schritte;
  s32 c;
  if (zug->n < 3) return 0;
  if (zug->b[0] != 0) return 0;
  schritte = zug->b[1];
  if (schritte > SCHRITTE_MAX) return 0;
  if (zug->n != 3 + schritte * 3) return 0;
  for (k = 0; k < KARTEN; k++) items[k] = z->karten[k];
  for (s = 0; s < schritte; s++) {
    a = zug->b[2 + s * 3];
    op = zug->b[3 + s * 3];
    b = zug->b[4 + s * 3];
    if (a >= n) return 0;
    if (b >= n) return 0;
    if (a == b) return 0;
    if (op > GETEILT) return 0;
    if (!rechnen(items[a], op, items[b], z->nur_asm, &c)) return 0;
    m = 0;
    for (k = 0; k < n; k++) {
      if (k != a && k != b) items[m++] = items[k];
    }
    items[m++] = c;
    n = m;
  }
  k = zug->b[2 + schritte * 3];
  if (k >= n) return 0;
  *wert = items[k];
  *alle = 0;
  if (n == 1) {
    if (schritte == KARTEN - 1) *alle = 1;
  }
  return 1;
}

static u16 ziel_zuege(const u8 *stand, Zug *zuege) {
  const Zielzahl *z = (const Zielzahl *)stand;
  u8 i;
  if (ziel_am_zug(stand) == PLATZ_KEIN) return 0;
  for (i = 0; i < z->top_n; i++) abgabe_zug(&z->top[i], &zuege[i]);
  return z->top_n;
}

static u8 ziel_erlaubt(const u8 *stand, const Zug *zug) {
  const Zielzahl *z = (const Zielzahl *)stand;
  s32 w;
  u8 alle, ok;
  if (ziel_am_zug(stand) == PLATZ_KEIN) return 0;
  ok = abgabe_rechnen(z, zug, &w, &alle);
  return ok;
}

/* Die eigene Rechnung als Abgabe mit Endkarte f. */
static void eigene_abgabe(const Zielzahl *z, u8 f, Zug *zug) {
  u8 k;
  zug->b[0] = 0;
  zug->b[1] = z->e_schritte;
  for (k = 0; k < z->e_schritte * 3; k++) zug->b[2 + k] = z->e_st[k];
  zug->b[2 + z->e_schritte * 3] = f;
  zug->n = 3 + z->e_schritte * 3;
}

static u16 ziel_zusatz(const u8 *stand, Zug *zuege) {
  const Zielzahl *z = (const Zielzahl *)stand;
  u8 a, b, op, f;
  u16 k = 0;
  s32 c;
  if (ziel_am_zug(stand) == PLATZ_KEIN) return 0;
  if (z->e_schritte < SCHRITTE_MAX) {
    for (a = 0; a < z->e_n; a++) {
      for (b = 0; b < z->e_n; b++) {
        if (a == b) continue;
        for (op = 0; op < 4; op++) {
          if (!rechnen(z->e_wert[a], op, z->e_wert[b], z->nur_asm, &c)) continue;
          zuege[k].n = 4;
          zuege[k].b[0] = 10;
          zuege[k].b[1] = a;
          zuege[k].b[2] = op;
          zuege[k].b[3] = b;
          k++;
        }
      }
    }
  }
  if (z->e_schritte) {
    zuege[k].n = 1;
    zuege[k].b[0] = 11;
    k++;
  }
  for (f = 0; f < z->e_n; f++) eigene_abgabe(z, f, &zuege[k++]);
  return k;
}

static u8 ziel_ziehen(u8 *stand, const Zug *zug) {
  Zielzahl *z = (Zielzahl *)stand;
  u8 ich = ziel_am_zug(stand), a, b, op, k, m, s, alle;
  s32 c, w;
  if (zug->b[0] == 10) {
    a = zug->b[1];
    op = zug->b[2];
    b = zug->b[3];
    rechnen(z->e_wert[a], op, z->e_wert[b], z->nur_asm, &c);
    s = z->e_schritte;
    z->e_links[s] = z->e_wert[a];
    z->e_rechts[s] = z->e_wert[b];
    z->e_ergebnis[s] = c;
    z->e_st[s * 3] = a;
    z->e_st[s * 3 + 1] = op;
    z->e_st[s * 3 + 2] = b;
    z->e_schritte++;
    m = 0;
    for (k = 0; k < z->e_n; k++) {
      if (k != a && k != b) z->e_wert[m++] = z->e_wert[k];
    }
    z->e_wert[m++] = c;
    z->e_n = m;
    return KLANG_KLICK;
  }
  if (zug->b[0] == 11) {
    // Zurücknehmen: die Rechnung ohne den letzten Schritt neu aufbauen.
    static u8 st[SCHRITTE_MAX * 3];
    static Zug schritt;
    s = z->e_schritte - 1;
    for (k = 0; k < SCHRITTE_MAX * 3; k++) st[k] = z->e_st[k];
    eingabe_leeren(z);
    schritt.n = 4;
    schritt.b[0] = 10;
    for (k = 0; k < s; k++) {
      schritt.b[1] = st[k * 3];
      schritt.b[2] = st[k * 3 + 1];
      schritt.b[3] = st[k * 3 + 2];
      ziel_ziehen(stand, &schritt);
    }
    return KLANG_KLICK;
  }
  abgabe_rechnen(z, zug, &w, &alle);
  z->abgegeben[ich] = 1;
  z->wert[ich] = w;
  z->alle[ich] = alle;
  z->r_punkte[ich] = wertung(w, z->ziel, alle);
  eingabe_leeren(z);
  if (ziel_am_zug(stand) != PLATZ_KEIN) return KLANG_SETZEN;
  for (k = 0; k < z->plaetze; k++) {
    z->punkte[k] += z->r_punkte[k];
    z->lr_wert[k] = z->wert[k];
    z->lr_alle[k] = z->alle[k];
    z->lr_punkte[k] = z->r_punkte[k];
  }
  z->lr_runde = z->runde;
  if (z->runde >= z->runden) {
    z->fertig = 1;
    return KLANG_SIEG;
  }
  z->runde++;
  runde_vorbereiten(z);
  return KLANG_ENDE;
}

static void wert3(u8 *a, u16 *n, s32 w) {
  u32 v = (u32)w;
  a[(*n)++] = v & 0xff;
  a[(*n)++] = (v >> 8) & 0xff;
  a[(*n)++] = (v >> 16) & 0xff;
}

static u16 ziel_ausgeben(const u8 *stand, u8 *a) {
  const Zielzahl *z = (const Zielzahl *)stand;
  u16 n = 0;
  u8 i, p;
  a[n++] = z->plaetze;
  a[n++] = z->nur_asm;
  a[n++] = z->runden;
  a[n++] = z->runde;
  a[n++] = z->fertig;
  a[n++] = z->ziel;
  for (i = 0; i < KARTEN; i++) a[n++] = z->karten[i];
  for (p = 0; p < z->plaetze; p++) {
    if (!z->abgegeben[p]) {
      a[n++] = KEIN;
      continue;
    }
    a[n++] = 1;
    wert3(a, &n, z->wert[p]);
    a[n++] = z->alle[p];
    a[n++] = z->r_punkte[p];
  }
  for (p = 0; p < z->plaetze; p++) {
    a[n++] = z->punkte[p] & 0xff;
    a[n++] = z->punkte[p] >> 8;
  }
  a[n++] = z->lr_runde;
  if (z->lr_runde) {
    for (p = 0; p < z->plaetze; p++) {
      wert3(a, &n, z->lr_wert[p]);
      a[n++] = z->lr_alle[p];
      a[n++] = z->lr_punkte[p];
    }
  }
  for (i = 0; i < 4; i++) {
    a[n++] = z->zufall.s[i] & 0xff;
    a[n++] = (z->zufall.s[i] >> 8) & 0xff;
    a[n++] = (z->zufall.s[i] >> 16) & 0xff;
    a[n++] = (z->zufall.s[i] >> 24) & 0xff;
  }
  return n;
}

/* ------------------------------------------------------------------ Bot */

/* Wie der „Rechenfuchs“: schwer der beste Kandidat, mittel einer der besten zwei, leicht ein kurzer Versuch. */
static void ziel_bot(const u8 *stand, u8 stufe, Zufall *zf, Zug *zug) {
  const Zielzahl *z = (const Zielzahl *)stand;
  static u8 kurz[TOP];
  u8 i, n = 0, w;
  if (stufe == STUFE_SCHWER) w = 0;
  else if (stufe == STUFE_MITTEL) w = zufall_bis(zf, z->top_n < 2 ? z->top_n : 2);
  else {
    for (i = 0; i < z->top_n; i++) {
      if (z->top[i].n <= 2) kurz[n++] = i;
    }
    w = n ? kurz[zufall_bis(zf, n)] : zufall_bis(zf, z->top_n);
  }
  abgabe_zug(&z->top[w], zug);
}

/* ------------------------------------------------------------------ Oberfläche */

#define FELD_ZEICHEN 30
#define FELD_ZURUECK 40
#define FELD_ABGABE 50
#define FELD_NIE 0xfe
#define SPALTE 7

static void ziel_gitter(const u8 *stand, u8 *b, u8 *h) {
  (void)stand;
  *b = 4;
  *h = 3;
}

static u8 ziel_feld_an(const u8 *stand, u8 x, u8 y) {
  const Zielzahl *z = (const Zielzahl *)stand;
  if (y == 0) return x < z->e_n ? x : FELD_KEIN;
  if (y == 1) {
    if (x == GETEILT) {
      if (z->nur_asm) return FELD_KEIN;
    }
    return FELD_ZEICHEN + x;
  }
  if (x == 0) return FELD_ZURUECK;
  if (x == 1) return FELD_ABGABE;
  return FELD_KEIN;
}

static u8 ziel_felder(const u8 *stand, const Zug *zug, u8 *felder) {
  const Zielzahl *z = (const Zielzahl *)stand;
  static Zug eigen;
  u8 f;
  if (zug->b[0] == 10) {
    felder[0] = zug->b[1];
    felder[1] = FELD_ZEICHEN + zug->b[2];
    felder[2] = zug->b[3];
    return 3;
  }
  if (zug->b[0] == 11) {
    felder[0] = FELD_ZURUECK;
    return 1;
  }
  // Abgeben lässt sich nur die eigene Rechnung (mit gewählter Endzahl).
  for (f = 0; f < z->e_n; f++) {
    eigene_abgabe(z, f, &eigen);
    if (!zug_gleich(&eigen, zug)) continue;
    felder[0] = FELD_ABGABE;
    felder[1] = f;
    return 2;
  }
  felder[0] = FELD_NIE;
  return 1;
}

static void zahl_text(char *t, s32 v) {
  char z[8];
  u8 n = 0, k = 0;
  u32 b = (u32)v;
  do {
    z[n++] = '0' + (u8)(b % 10);
    b /= 10;
  } while (b);
  while (n) t[k++] = z[--n];
  t[k] = 0;
}

static void knopf(u8 x, u8 y, const char *t, u8 feld, const u8 *markierung, u8 aktiv) {
  u8 pal = PAL_GRAU;
  if (aktiv) {
    if (markierung[feld] & MARK_ZIEL) pal = PAL_TEXT;
    if (markierung[feld] & MARK_GEWAEHLT) pal = PAL_GELB;
  }
  kachel(x, y, aktiv && (markierung[feld] & MARK_CURSOR) ? K_PFEIL : 0, PAL_GELB);
  text(x + 1, y, t, pal);
}

static void ziel_zeichnen(const u8 *stand, const u8 *markierung, u8 aktiv) {
  const Zielzahl *z = (const Zielzahl *)stand;
  static char t[24];
  u8 i, x, y, p, ich = ziel_am_zug(stand);
  tafel(0, 4, 32, 22);
  flaeche_leeren(1, 5, 30, 20);
  text(1, 5, "Runde", PAL_GRAU);
  zahl(7, 5, z->runde, 2, PAL_TEXT);
  text(9, 5, "/", PAL_GRAU);
  zahl(10, 5, z->runden, 2, PAL_TEXT);
  text(18, 5, "Ziel", PAL_GRAU);
  zahl(23, 5, z->ziel, 3, PAL_GELB);
  // Zahlen (Karten und Zwischenergebnisse) und Rechenzeichen.
  for (i = 0; i < z->e_n; i++) {
    zahl_text(t, z->e_wert[i]);
    knopf(2 + i * SPALTE, 8, t, i, markierung, aktiv);
  }
  for (i = 0; i < 4; i++) {
    if (i == GETEILT) {
      if (z->nur_asm) continue;
    }
    knopf(2 + i * SPALTE, 11, ZEICHEN[i], FELD_ZEICHEN + i, markierung, aktiv);
  }
  // Bisherige Rechnung.
  for (i = 0; i < z->e_schritte; i++) {
    y = 14 + i;
    x = 3;
    zahl_text(t, z->e_links[i]);
    x += text(x, y, t, PAL_TEXT) + 1;
    x += text(x, y, ZEICHEN[z->e_st[i * 3 + 1]], PAL_GELB) + 1;
    zahl_text(t, z->e_rechts[i]);
    x += text(x, y, t, PAL_TEXT) + 1;
    x += text(x, y, "=", PAL_GRAU) + 1;
    zahl_text(t, z->e_ergebnis[i]);
    text(x, y, t, PAL_TEXT);
  }
  knopf(2, 19, "Zurück", FELD_ZURUECK, markierung, aktiv);
  knopf(12, 19, "Abgeben", FELD_ABGABE, markierung, aktiv);
  text(3, 21, "Abgeben, dann die Endzahl", PAL_GRAU);
  // Punkte; wer schon abgegeben hat, ist grau.
  y = 24;
  for (p = 0; p < z->plaetze; p++) {
    x = 1 + p * 5;
    kachel(x, y, p == ich ? Z_PFEIL_RECHTS : 0, PAL_GELB);
    zahl(x + 1, y, z->punkte[p], 3, z->abgegeben[p] ? PAL_GRAU : spiel_zielzahl.platz_paletten[p]);
  }
}

/* ------------------------------------------------------------------ Steckbrief */

/* Nach packages/games/target-number/src/meta.ts (howToPlay), für den Controller angepasst. */
static const char *const ANLEITUNG[] = {
  "In jeder Runde liegen vier Zahlenkarten offen auf dem Tisch, dazu die Zielzahl 24.",
  "Wähle nacheinander eine Zahl, ein Rechenzeichen (+, −, ·, :) und eine zweite Zahl, um sie zu verrechnen.",
  "Divisionen müssen glatt aufgehen, Subtraktionen dürfen nicht negativ werden.",
  "Triffst du die Zielzahl genau, gibt es 10 Punkte (mit allen Karten sogar 12 Punkte). Auch wer nah dran ist, sammelt Punkte!",
  "Sobald alle ihr Ergebnis abgegeben haben, beginnt die nächste Runde.",
  0,
};
static const char *const PLATZ_NAMEN[] = {"Spieler 1", "Spieler 2", "Spieler 3", "Spieler 4", "Spieler 5", "Spieler 6"};
static const u8 PLATZ_PALETTEN[] = {PAL_ROT, PAL_BLAU, PAL_GELB, PAL_TEXT, PAL_GRAU, PAL_ROT};
static const char *const ZEICHEN_TEXT[] = {"+ − · :", "+ − ·"};
static const char *const RUNDEN_TEXT[] = {"3 Runden", "5 Runden", "8 Runden", "10 Runden"};
static const Option OPTIONEN[] = {
  {"Zeichen", ZEICHEN_TEXT, 2, 0},
  {"Runden", RUNDEN_TEXT, 4, 1},
};

const Spiel spiel_zielzahl = {
  "Zielzahl",
  ANLEITUNG,
  "✚ Zahl, Zeichen, Zahl wählen · B zurück · „Abgeben“ und Endzahl",
  PLATZ_NAMEN,
  PLATZ_PALETTEN,
  1,
  6,
  1,
  OPTIONEN,
  2,
  FARBEN_TTT,
  ziel_aufbauen,
  ziel_am_zug,
  ziel_zuege,
  ziel_ziehen,
  ziel_ergebnis,
  ziel_bot,
  ziel_ausgeben,
  ziel_gitter,
  ziel_feld_an,
  ziel_felder,
  ziel_zeichnen,
  0,
  0,
  ziel_zusatz,
  0,
  ziel_erlaubt,
};
