/*
 * Teiler-Duell für Brett & Blatt 16 – nach packages/games/factor-grid/src/rules.ts mit beiden
 * Varianten (Steuereintreiber, Teiler & Vielfache) und den Zahlenräumen 20, 30, 50; allein oder zu zweit.
 *
 * Zug: [Zahl].
 */
#include "spiel.h"
#include "bild.h"
#include "klang.h"

#define ZAHLEN_MAX 50
#define FREI 0xff

typedef struct {
  u8 plaetze;
  u8 kette; /* 0 Steuereintreiber, 1 Teiler & Vielfache */
  u8 groesse;
  u8 besitzer[ZAHLEN_MAX]; /* Platz 0/1 (1 = Steuereintreiber allein) oder FREI */
  u16 punkte[2];
  u8 zug;
  u8 zuletzt; /* zuletzt gewählte Zahl, 0 = keine */
  u8 verlauf_n;
  u8 vorbei;
  u8 sieger; /* 0, 1, 2 = unentschieden, FREI = offen */
  u8 letzt_platz, letzt_zahl; /* letzte Aktion, FREI = keine */
  u8 besteuert_n, besteuert[ZAHLEN_MAX];
  u8 gefegt_n, gefegt[ZAHLEN_MAX];
} Teiler;

static const u8 GROESSEN[3] = {20, 30, 50};

/* Freie echte Teiler von n (aufsteigend) – mit liste 0 nur zählen. */
static u8 freie_teiler(const u8 *besitzer, u8 n, u8 *liste) {
  u8 d, k = 0;
  for (d = 1; d * 2 <= n; d++) {
    if (n % d) continue;
    if (besitzer[d - 1] != FREI) continue;
    if (liste) liste[k] = d;
    k++;
  }
  return k;
}

static u8 nachbar(u8 zuletzt, u8 n) {
  if (!zuletzt) return n % 2 == 0;
  return n % zuletzt == 0 || zuletzt % n == 0;
}

/* Erlaubte Zahlen (aufsteigend); gibt die Anzahl zurück. */
static u8 erlaubte(const Teiler *t, const u8 *besitzer, u8 zuletzt, u8 *liste) {
  u8 n, k = 0;
  for (n = 1; n <= t->groesse; n++) {
    if (besitzer[n - 1] != FREI) continue;
    if (t->kette) {
      if (!nachbar(zuletzt, n)) continue;
    } else {
      if (n < 2) continue;
      if (!freie_teiler(besitzer, n, 0)) continue;
    }
    if (liste) liste[k] = n;
    k++;
  }
  return k;
}

static void teiler_aufbauen(u8 *stand, const u8 *optionen, u8 plaetze, const char *seed) {
  Teiler *t = (Teiler *)stand;
  u8 i;
  (void)seed;
  t->plaetze = plaetze;
  t->kette = optionen[0];
  t->groesse = GROESSEN[optionen[1]];
  for (i = 0; i < ZAHLEN_MAX; i++) t->besitzer[i] = FREI;
  t->punkte[0] = t->punkte[1] = 0;
  t->zug = 0;
  t->zuletzt = 0;
  t->verlauf_n = 0;
  t->vorbei = 0;
  t->sieger = FREI;
  t->letzt_platz = t->letzt_zahl = FREI;
  t->besteuert_n = t->gefegt_n = 0;
}

static u8 teiler_ergebnis(const u8 *stand, u8 *sieger) {
  const Teiler *t = (const Teiler *)stand;
  if (!t->vorbei) return ERGEBNIS_LAEUFT;
  if (t->sieger == 2) return ERGEBNIS_REMIS;
  if (t->plaetze == 1 && t->sieger != 0) return ERGEBNIS_VERLOREN;
  if (sieger) *sieger = 1 << t->sieger;
  return ERGEBNIS_SIEG;
}

static u8 teiler_am_zug(const u8 *stand) {
  const Teiler *t = (const Teiler *)stand;
  return t->vorbei ? PLATZ_KEIN : t->zug;
}

static u16 teiler_zuege(const u8 *stand, Zug *zuege) {
  const Teiler *t = (const Teiler *)stand;
  static u8 liste[ZAHLEN_MAX];
  u8 n, i;
  if (t->vorbei) return 0;
  n = erlaubte(t, t->besitzer, t->zuletzt, liste);
  for (i = 0; i < n; i++) {
    zuege[i].n = 1;
    zuege[i].b[0] = liste[i];
  }
  return n;
}

static u8 teiler_ziehen(u8 *stand, const Zug *zug) {
  Teiler *t = (Teiler *)stand;
  u8 n = zug->b[0], ich = t->zug, anderer = ich ^ 1, i, weiter;
  t->letzt_platz = ich;
  t->letzt_zahl = n;
  t->besteuert_n = t->gefegt_n = 0;
  t->verlauf_n++;
  if (t->kette) {
    t->besitzer[n - 1] = ich;
    t->punkte[ich] += 1;
    t->zug = t->plaetze == 1 ? 0 : anderer;
    t->zuletzt = n;
    if (erlaubte(t, t->besitzer, n, 0) == 0) {
      t->vorbei = 1;
      // Allein: Ziel ist mindestens die Hälfte aller Zahlen.
      if (t->plaetze == 1) t->sieger = t->verlauf_n >= t->groesse / 2 ? 0 : 1;
      else t->sieger = ich;
    }
    return KLANG_SETZEN;
  }
  // Steuereintreiber: Wer wählt, bekommt die Zahl; die freien echten Teiler gehen an den anderen.
  t->besteuert_n = freie_teiler(t->besitzer, n, t->besteuert);
  t->besitzer[n - 1] = ich;
  t->punkte[ich] += n;
  for (i = 0; i < t->besteuert_n; i++) {
    t->besitzer[t->besteuert[i] - 1] = anderer;
    t->punkte[anderer] += t->besteuert[i];
  }
  t->zug = t->plaetze == 1 ? 0 : anderer;
  t->zuletzt = n;
  weiter = erlaubte(t, t->besitzer, n, 0) > 0;
  if (!weiter) {
    // Allein kassiert der Steuereintreiber den Rest.
    if (t->plaetze == 1) {
      for (i = 1; i <= t->groesse; i++) {
        if (t->besitzer[i - 1] != FREI) continue;
        t->besitzer[i - 1] = 1;
        t->punkte[1] += i;
        t->gefegt[t->gefegt_n++] = i;
      }
    }
    t->vorbei = 1;
    if (t->punkte[0] > t->punkte[1]) t->sieger = 0;
    else if (t->punkte[1] > t->punkte[0]) t->sieger = 1;
    else t->sieger = 2;
  }
  return t->besteuert_n ? KLANG_ENDE : KLANG_SETZEN;
}

static u16 teiler_ausgeben(const u8 *stand, u8 *p) {
  const Teiler *t = (const Teiler *)stand;
  u16 n = 0;
  u8 i;
  p[n++] = t->plaetze;
  p[n++] = t->kette;
  p[n++] = t->groesse;
  for (i = 0; i < t->groesse; i++) p[n++] = t->besitzer[i];
  p[n++] = t->punkte[0] & 0xff;
  p[n++] = t->punkte[0] >> 8;
  p[n++] = t->punkte[1] & 0xff;
  p[n++] = t->punkte[1] >> 8;
  p[n++] = t->zug;
  p[n++] = t->zuletzt ? t->zuletzt : FREI;
  p[n++] = t->verlauf_n;
  p[n++] = t->vorbei;
  p[n++] = t->sieger;
  p[n++] = t->letzt_platz;
  p[n++] = t->letzt_zahl;
  p[n++] = t->besteuert_n;
  for (i = 0; i < t->besteuert_n; i++) p[n++] = t->besteuert[i];
  p[n++] = t->gefegt_n;
  for (i = 0; i < t->gefegt_n; i++) p[n++] = t->gefegt[i];
  return n;
}

/* ------------------------------------------------------------------ Bot */

/*
 * Steuereintreiber: Gewinn der Zahl minus Abgaben an den Gegner; „schwer“ zieht zusätzlich die
 * beste Antwort des Gegners ab. Kette: Züge, nach denen der Gegner festsitzt, sonst die, die ihm
 * die wenigsten Möglichkeiten lassen.
 */
static u8 b_besitzer[ZAHLEN_MAX];

static s16 steuer_wert(const Teiler *t, const u8 *besitzer, u8 n) {
  static u8 teiler[ZAHLEN_MAX];
  u8 k = freie_teiler(besitzer, n, teiler), i;
  s16 wert = n;
  for (i = 0; i < k; i++) wert -= teiler[i];
  (void)t;
  return wert;
}

/*
 * Kette allein: Tiefensuche nach der längsten Kette (Zeitbudget). Felder mit wenigen Anschlüssen
 * zuerst – so findet die Suche früh lange Ketten.
 */
#define KETTE_MAX 51
static u8 k_liste[KETTE_MAX][ZAHLEN_MAX];
static u8 k_beste, k_erster, k_abbruch;
static u16 k_start, k_budget;
static const Teiler *k_t;

static void kette_suchen(u8 zuletzt, u8 laenge, u8 erster) {
  u8 n, i;
  if (laenge > k_beste) {
    k_beste = laenge;
    k_erster = erster;
  }
  if ((u16)(BILDER() - k_start) > k_budget) {
    k_abbruch = 1;
    return;
  }
  if (laenge >= KETTE_MAX - 1) return;
  n = erlaubte(k_t, b_besitzer, zuletzt, k_liste[laenge]);
  for (i = 0; i < n; i++) {
    b_besitzer[k_liste[laenge][i] - 1] = 0;
    kette_suchen(k_liste[laenge][i], laenge + 1, erster ? erster : k_liste[laenge][i]);
    b_besitzer[k_liste[laenge][i] - 1] = FREI;
    if (k_abbruch) return;
  }
}

static void teiler_bot(const u8 *stand, u8 stufe, Zufall *z, Zug *zug) {
  const Teiler *t = (const Teiler *)stand;
  static u8 liste[ZAHLEN_MAX], antworten[ZAHLEN_MAX], beste[ZAHLEN_MAX], teiler[ZAHLEN_MAX];
  u8 n = erlaubte(t, t->besitzer, t->zuletzt, liste), i, j, k, m, an, b = 0, ich = t->zug;
  s16 wert, bester = -30000, gegen, wert_gegner;
  zug->n = 1;
  if (stufe == STUFE_LEICHT) {
    if (zufall_bis(z, 3) == 0) {
      zug->b[0] = liste[zufall_bis(z, n)];
      return;
    }
  }
  if (t->kette && t->plaetze == 1) {
    for (k = 0; k < t->groesse; k++) b_besitzer[k] = t->besitzer[k];
    k_t = t;
    k_beste = 0;
    k_erster = liste[zufall_bis(z, n)];
    k_abbruch = 0;
    k_start = BILDER();
    k_budget = stufe == STUFE_SCHWER ? 100 : stufe == STUFE_MITTEL ? 40 : 10;
    kette_suchen(t->zuletzt, 0, 0);
    zug->b[0] = k_erster;
    return;
  }
  for (i = 0; i < n; i++) {
    for (k = 0; k < t->groesse; k++) b_besitzer[k] = t->besitzer[k];
    if (t->kette) {
      b_besitzer[liste[i] - 1] = ich;
      an = erlaubte(t, b_besitzer, liste[i], antworten);
      wert = an == 0 ? 1000 : -(s16)an;
      if (stufe == STUFE_SCHWER) {
        // Lässt eine Antwort uns festsitzen? Dann schlecht.
        for (j = 0; j < an; j++) {
          b_besitzer[antworten[j] - 1] = ich ^ 1;
          m = erlaubte(t, b_besitzer, antworten[j], 0);
          b_besitzer[antworten[j] - 1] = FREI;
          if (m == 0) {
            wert -= 500;
            break;
          }
        }
      }
    } else {
      wert = steuer_wert(t, b_besitzer, liste[i]);
      // Vorausschau auf die beste Antwort nur zu zweit (allein antwortet niemand).
      if (stufe == STUFE_SCHWER && t->plaetze == 2) {
        k = freie_teiler(b_besitzer, liste[i], teiler);
        b_besitzer[liste[i] - 1] = ich;
        for (j = 0; j < k; j++) b_besitzer[teiler[j] - 1] = ich ^ 1;
        an = erlaubte(t, b_besitzer, liste[i], antworten);
        gegen = 0;
        for (j = 0; j < an; j++) {
          wert_gegner = steuer_wert(t, b_besitzer, antworten[j]);
          if (wert_gegner > gegen) gegen = wert_gegner;
        }
        wert -= gegen;
      }
    }
    if (wert > bester) {
      bester = wert;
      b = 0;
    }
    if (wert == bester) beste[b++] = liste[i];
  }
  zug->b[0] = beste[zufall_bis(z, b)];
}

/* ------------------------------------------------------------------ Oberfläche */

#define X0 1
#define Y0 6

static void teiler_gitter(const u8 *stand, u8 *b, u8 *h) {
  const Teiler *t = (const Teiler *)stand;
  *b = 10;
  *h = t->groesse / 10;
}

static u8 teiler_feld_an(const u8 *stand, u8 x, u8 y) {
  (void)stand;
  return y * 10 + x + 1;
}

static u8 teiler_felder(const u8 *stand, const Zug *zug, u8 *felder) {
  (void)stand;
  felder[0] = zug->b[0];
  return 1;
}

static void teiler_zeichnen(const u8 *stand, const u8 *markierung, u8 aktiv) {
  const Teiler *t = (const Teiler *)stand;
  u8 n, x, y, pal;
  tafel(0, Y0 - 1, 32, t->groesse / 5 + 3);
  for (n = 1; n <= t->groesse; n++) {
    x = X0 + ((n - 1) % 10) * 3;
    y = Y0 + ((n - 1) / 10) * 2;
    if (t->besitzer[n - 1] == 0) pal = PAL_ROT;
    else if (t->besitzer[n - 1] == 1) pal = PAL_BLAU;
    else if (aktiv && (markierung[n] & MARK_ZIEL)) pal = PAL_TEXT;
    else pal = PAL_GRAU;
    if (n == t->letzt_zahl) pal = PAL_GELB;
    kachel(x, y, aktiv && (markierung[n] & MARK_CURSOR) ? Z_PFEIL_RECHTS : 0, PAL_GELB);
    zahl(x + 1, y, n, 2, pal);
  }
  y = Y0 + t->groesse / 5 + 3;
  flaeche_leeren(0, y, 32, 1);
  text(2, y, "Punkte", PAL_GRAU);
  zahl(10, y, t->punkte[0], 4, PAL_ROT);
  text(15, y, ":", PAL_GRAU);
  zahl(17, y, t->punkte[1], 4, PAL_BLAU);
  if (t->plaetze == 1) text(22, y, "Steuer", PAL_BLAU);
}

/* ------------------------------------------------------------------ Steckbrief */

/* Wortlaut aus packages/games/factor-grid/src/meta.ts (howToPlay). */
static const char *const ANLEITUNG[] = {
  "Auf dem Brett liegen die Zahlen von 1 bis 20, 30 oder 50.",
  "Variante „Steuereintreiber“: Wähle eine freie Zahl, die noch mindestens einen freien echten Teiler hat. Du erhältst die Zahl als Punkte – dein Gegenüber (oder allein der Steuereintreiber) kassiert automatisch alle freien Teiler!",
  "Allein gegen den Steuereintreiber gilt außerdem: Sobald keine Zahl mehr freie Teiler hat, bekommt der Steuereintreiber den gesamten Rest.",
  "Variante „Teiler & Vielfache“: Wählt abwechselnd eine freie Zahl, die ein Teiler oder ein Vielfaches der zuletzt gezogenen Zahl ist (der erste Zug muss gerade sein). Wer nicht mehr ziehen kann, verliert!",
  0,
};
static const char *const PLATZ_NAMEN[] = {"Rot", "Blau"};
static const u8 PLATZ_PALETTEN[] = {PAL_ROT, PAL_BLAU};
static const char *const VARIANTEN[] = {"Steuer", "Kette"};
static const char *const RAUM[] = {"1 bis 20", "1 bis 30", "1 bis 50"};
static const Option OPTIONEN[] = {
  {"Variante", VARIANTEN, 2, 0},
  {"Zahlen", RAUM, 3, 1},
};

const Spiel spiel_teiler = {
  "Teiler-Duell",
  ANLEITUNG,
  "✚ Zahl wählen · A nehmen · Weiß: wählbar, Rot/Blau: vergeben",
  PLATZ_NAMEN,
  PLATZ_PALETTEN,
  1,
  2,
  0,
  OPTIONEN,
  2,
  FARBEN_TTT,
  teiler_aufbauen,
  teiler_am_zug,
  teiler_zuege,
  teiler_ziehen,
  teiler_ergebnis,
  teiler_bot,
  teiler_ausgeben,
  teiler_gitter,
  teiler_feld_an,
  teiler_felder,
  teiler_zeichnen,
  0,
  0,
};
