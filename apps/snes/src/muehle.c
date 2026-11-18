/*
 * Mühle für Brett & Blatt 16 – nach packages/games/mill/src/rules.ts und board.ts mit allen
 * Optionen: Springen, Steine aus Mühlen nehmen, Doppelmühle, Remis nach Zügen ohne Mühle.
 *
 * Punkte wie board.ts: Ring * 8 + j, j im Uhrzeigersinn ab der linken oberen Ecke.
 * Zug: [Art (0 setzen, 1 ziehen), von (0xff beim Setzen), nach, Zahl der weggenommenen Steine,
 *       weggenommene Punkte aufsteigend].
 */
#include "spiel.h"
#include "bild.h"
#include "klang.h"

#define PUNKTE 24
#define GESEHEN_MAX 420
#define SCHLUESSEL 7 /* Platz am Zug und 24 Punkte zu je 2 Bit */

typedef struct {
  u8 punkte[PUNKTE]; /* 0 leer, 1 Weiß (Platz 0), 2 Schwarz (Platz 1) */
  u8 hand[2];
  u8 zug;
  u16 ohne_muehle;
  u8 sieger;
  u8 remis; /* 0, 1 Wiederholung, 2 Zuggrenze */
  Zug letzter;
  u8 springen, immer, doppelt;
  u8 remis_nach; /* Halbzüge ohne Mühle bis zum Remis, 0 = aus */
  /*
   * Stellungen seit dem letzten Schlagen (für die Wiederholungsregel). Frühere Stellungen hatten
   * mehr Steine und können nicht wiederkehren – so bleibt die Liste kurz und trotzdem genau.
   */
  u16 gesehen_n;
  u8 gesehen[GESEHEN_MAX][SCHLUESSEL];
} Muehle;

static const u8 NACHBARN[PUNKTE][5] = {
  /* je Punkt: Anzahl, dann Nachbarn in der Reihenfolge von NEIGHBORS */
  {2, 1, 7}, {3, 2, 0, 9}, {2, 3, 1}, {3, 4, 2, 11}, {2, 5, 3}, {3, 6, 4, 13}, {2, 7, 5}, {3, 0, 6, 15},
  {2, 9, 15}, {4, 10, 8, 1, 17}, {2, 11, 9}, {4, 12, 10, 3, 19}, {2, 13, 11}, {4, 14, 12, 5, 21}, {2, 15, 13}, {4, 8, 14, 7, 23},
  {2, 17, 23}, {3, 18, 16, 9}, {2, 19, 17}, {3, 20, 18, 11}, {2, 21, 19}, {3, 22, 20, 13}, {2, 23, 21}, {3, 16, 22, 15},
};

static const u8 MUEHLEN[16][3] = {
  {0, 1, 2}, {2, 3, 4}, {4, 5, 6}, {6, 7, 0},
  {8, 9, 10}, {10, 11, 12}, {12, 13, 14}, {14, 15, 8},
  {16, 17, 18}, {18, 19, 20}, {20, 21, 22}, {22, 23, 16},
  {1, 9, 17}, {3, 11, 19}, {5, 13, 21}, {7, 15, 23},
};

/* Rasterlage (0–6) jedes Punkts. */
static const u8 LAGE[PUNKTE][2] = {
  {0, 0}, {3, 0}, {6, 0}, {6, 3}, {6, 6}, {3, 6}, {0, 6}, {0, 3},
  {1, 1}, {3, 1}, {5, 1}, {5, 3}, {5, 5}, {3, 5}, {1, 5}, {1, 3},
  {2, 2}, {3, 2}, {4, 2}, {4, 3}, {4, 4}, {3, 4}, {2, 4}, {2, 3},
};

static const u8 REMIS_NACH[3] = {100, 60, 0};

static u8 in_muehle(const u8 *p, u8 punkt) {
  u8 m, wert = p[punkt];
  if (!wert) return 0;
  for (m = 0; m < 16; m++) {
    if (MUEHLEN[m][0] != punkt && MUEHLEN[m][1] != punkt && MUEHLEN[m][2] != punkt) continue;
    if (p[MUEHLEN[m][0]] == wert && p[MUEHLEN[m][1]] == wert && p[MUEHLEN[m][2]] == wert) return 1;
  }
  return 0;
}

static u8 muehlen_geschlossen(const u8 *p, u8 punkt, u8 wert) {
  u8 m, n = 0;
  for (m = 0; m < 16; m++) {
    if (MUEHLEN[m][0] != punkt && MUEHLEN[m][1] != punkt && MUEHLEN[m][2] != punkt) continue;
    if (p[MUEHLEN[m][0]] == wert && p[MUEHLEN[m][1]] == wert && p[MUEHLEN[m][2]] == wert) n++;
  }
  return n;
}

static u8 steine(const u8 *p, u8 wert) {
  u8 i, n = 0;
  for (i = 0; i < PUNKTE; i++)
    if (p[i] == wert) n++;
  return n;
}

/* Steine des Gegners, die man nach einer Mühle wegnehmen darf (aufsteigend). */
static u8 wegnehmbar(u8 immer, const u8 *p, u8 gegner_wert, u8 *liste) {
  u8 i, n = 0, frei = 0;
  for (i = 0; i < PUNKTE; i++)
    if (p[i] == gegner_wert && !in_muehle(p, i)) frei++;
  for (i = 0; i < PUNKTE; i++) {
    if (p[i] != gegner_wert) continue;
    if (!immer && frei > 0 && in_muehle(p, i)) continue;
    liste[n++] = i;
  }
  return n;
}

/* ------------------------------------------------------------------ Züge */

/*
 * Erzeugt alle Züge für `platz` auf den Punkten `p` (Reihenfolge egal, Vergleich als Menge).
 * Gemeinsam für Regeln und Bot.
 */
static u16 zuege_erzeugen(const Muehle *m, const u8 *p, const u8 *hand, u8 platz, Zug *zuege, u16 max) {
  static u8 nach[PUNKTE], erste[PUNKTE], zweite[PUNKTE];
  u8 von, ziel, k, a, b, n1, n2, i, geschlossen, wert = platz + 1, gegner = 2 - platz, phase, klein, gross;
  u16 n = 0, j, schritt_start;
  // Phase: 0 setzen, 1 ziehen, 2 springen.
  if (hand[platz]) phase = 0;
  else if (m->springen && steine(p, wert) == 3) phase = 2;
  else phase = 1;
  for (von = 0; von < (phase == 0 ? 1 : PUNKTE); von++) {
    if (phase && p[von] != wert) continue;
    for (k = 0; k < (phase == 1 ? NACHBARN[von][0] : PUNKTE); k++) {
      ziel = phase == 1 ? NACHBARN[von][1 + k] : k;
      if (p[ziel]) continue;
      for (i = 0; i < PUNKTE; i++) nach[i] = p[i];
      if (phase) nach[von] = 0;
      nach[ziel] = wert;
      geschlossen = muehlen_geschlossen(nach, ziel, wert);
      schritt_start = n;
      n1 = geschlossen ? wegnehmbar(m->immer, nach, gegner, erste) : 0;
      if (n1 == 0) {
        if (n >= max) return n;
        zuege[n].n = 4;
        zuege[n].b[0] = phase ? 1 : 0;
        zuege[n].b[1] = phase ? von : 0xff;
        zuege[n].b[2] = ziel;
        zuege[n].b[3] = 0;
        n++;
        continue;
      }
      for (a = 0; a < n1; a++) {
        if (geschlossen >= 2 && m->doppelt) {
          nach[erste[a]] = 0;
          n2 = wegnehmbar(m->immer, nach, gegner, zweite);
          nach[erste[a]] = gegner;
          if (n2 == 0) {
            if (n >= max) return n;
            zuege[n].n = 5;
            zuege[n].b[0] = phase ? 1 : 0;
            zuege[n].b[1] = phase ? von : 0xff;
            zuege[n].b[2] = ziel;
            zuege[n].b[3] = 1;
            zuege[n].b[4] = erste[a];
            n++;
          }
          for (b = 0; b < n2; b++) {
            // {a, b} und {b, a} sind derselbe Zug: schon erzeugte Paare dieses Schritts überspringen.
            klein = erste[a] < zweite[b] ? erste[a] : zweite[b];
            gross = erste[a] < zweite[b] ? zweite[b] : erste[a];
            for (j = schritt_start; j < n; j++)
              if (zuege[j].n == 6 && zuege[j].b[4] == klein && zuege[j].b[5] == gross) break;
            if (j < n) continue;
            if (n >= max) return n;
            zuege[n].n = 6;
            zuege[n].b[0] = phase ? 1 : 0;
            zuege[n].b[1] = phase ? von : 0xff;
            zuege[n].b[2] = ziel;
            zuege[n].b[3] = 2;
            zuege[n].b[4] = erste[a] < zweite[b] ? erste[a] : zweite[b];
            zuege[n].b[5] = erste[a] < zweite[b] ? zweite[b] : erste[a];
            n++;
          }
        } else {
          if (n >= max) return n;
          zuege[n].n = 5;
          zuege[n].b[0] = phase ? 1 : 0;
          zuege[n].b[1] = phase ? von : 0xff;
          zuege[n].b[2] = ziel;
          zuege[n].b[3] = 1;
          zuege[n].b[4] = erste[a];
          n++;
        }
      }
    }
  }
  return n;
}

/* ------------------------------------------------------------------ Regeln */

static void muehle_aufbauen(u8 *stand, const u8 *optionen, u8 plaetze, const char *seed) {
  Muehle *m = (Muehle *)stand;
  u8 i;
  (void)plaetze;
  (void)seed;
  for (i = 0; i < PUNKTE; i++) m->punkte[i] = 0;
  m->hand[0] = m->hand[1] = 9;
  m->zug = 0;
  m->ohne_muehle = 0;
  m->sieger = PLATZ_KEIN;
  m->remis = 0;
  m->letzter.n = 0;
  m->springen = optionen[0] == 0;
  m->immer = optionen[1];
  m->doppelt = optionen[2];
  m->remis_nach = REMIS_NACH[optionen[3]];
  m->gesehen_n = 0;
}

static u8 muehle_ergebnis(const u8 *stand, u8 *sieger) {
  const Muehle *m = (const Muehle *)stand;
  if (m->sieger != PLATZ_KEIN) {
    if (sieger) *sieger = 1 << (m->sieger);
    return ERGEBNIS_SIEG;
  }
  return m->remis ? ERGEBNIS_REMIS : ERGEBNIS_LAEUFT;
}

static u8 muehle_am_zug(const u8 *stand) {
  const Muehle *m = (const Muehle *)stand;
  if (m->sieger != PLATZ_KEIN || m->remis) return PLATZ_KEIN;
  return m->zug;
}

static u16 muehle_zuege(const u8 *stand, Zug *zuege) {
  const Muehle *m = (const Muehle *)stand;
  if (muehle_am_zug(stand) == PLATZ_KEIN) return 0;
  return zuege_erzeugen(m, m->punkte, m->hand, m->zug, zuege, ZUEGE_MAX);
}

static Zug probe[1];

static u8 muehle_ziehen(u8 *stand, const Zug *zug) {
  Muehle *m = (Muehle *)stand;
  u8 ich = m->zug, gegner = ich ^ 1, i, k, gleich, wie_oft;
  u8 *neu;
  if (zug->b[0] == 0) m->hand[ich]--;
  else m->punkte[zug->b[1]] = 0;
  m->punkte[zug->b[2]] = ich + 1;
  for (i = 0; i < zug->b[3]; i++) m->punkte[zug->b[4 + i]] = 0;
  m->zug = gegner;
  m->ohne_muehle = zug->b[3] ? 0 : m->ohne_muehle + 1;
  m->letzter = *zug;
  if (zug->b[3]) m->gesehen_n = 0;

  // Verloren hat, wer weniger als drei Steine hat oder nicht mehr ziehen kann.
  if (steine(m->punkte, gegner + 1) + m->hand[gegner] < 3) {
    m->sieger = ich;
    return KLANG_SIEG;
  }
  if (zuege_erzeugen(m, m->punkte, m->hand, gegner, probe, 1) == 0) {
    m->sieger = ich;
    return KLANG_SIEG;
  }
  if (m->hand[0] == 0 && m->hand[1] == 0) {
    if (m->gesehen_n < GESEHEN_MAX) {
      neu = m->gesehen[m->gesehen_n++];
      for (k = 0; k < SCHLUESSEL; k++) neu[k] = 0;
      neu[0] = gegner;
      for (i = 0; i < PUNKTE; i++) neu[1 + (i >> 2)] |= m->punkte[i] << ((i & 3) * 2);
      wie_oft = 0;
      for (i = 0; i < m->gesehen_n; i++) {
        gleich = 1;
        for (k = 0; k < SCHLUESSEL; k++)
          if (m->gesehen[i][k] != neu[k]) gleich = 0;
        wie_oft += gleich;
      }
      if (wie_oft >= 3) m->remis = 1;
    }
    if (!m->remis) {
      if (m->remis_nach) {
        if (m->ohne_muehle >= m->remis_nach) m->remis = 2;
      }
    }
  }
  return zug->b[3] ? KLANG_ENDE : KLANG_SETZEN;
}

static u16 muehle_ausgeben(const u8 *stand, u8 *p) {
  const Muehle *m = (const Muehle *)stand;
  u16 n = 0;
  u8 i;
  for (i = 0; i < PUNKTE; i++) p[n++] = m->punkte[i] ? m->punkte[i] - 1 : PLATZ_KEIN;
  p[n++] = m->hand[0];
  p[n++] = m->hand[1];
  p[n++] = m->zug;
  p[n++] = m->ohne_muehle & 0xff;
  p[n++] = m->ohne_muehle >> 8;
  p[n++] = m->sieger;
  p[n++] = m->remis;
  p[n++] = m->letzter.n;
  for (i = 0; i < m->letzter.n; i++) p[n++] = m->letzter.b[i];
  p[n++] = m->springen;
  p[n++] = m->immer;
  p[n++] = m->doppelt;
  p[n++] = m->remis_nach;
  return n;
}

/* ------------------------------------------------------------------ Bot */

/*
 * Negamax mit Alpha-Beta auf Kopien der Punkte; Bewertung wie evaluate in rules.ts (Steine,
 * Mühlen, offene Zweier, Beweglichkeit). Wiederholung und Remis-Regel kennt die Suche nicht.
 */
#define TIEFE_MAX 4
static u8 b_p[TIEFE_MAX + 1][PUNKTE];
static u8 b_h[TIEFE_MAX + 1][2];
#define SUCHE_ZUEGE 100 /* je Tiefe; mehr Züge sieht die Suche nicht (Speicher) */
extern Zug muehle_suche[TIEFE_MAX][SUCHE_ZUEGE]; /* in Bank $7F (ram.asm) */
#define b_zuege muehle_suche
static const Muehle *b_m;
static u16 b_start, b_budget;
static u8 b_abbruch;

static s16 beweglich(const u8 *p, const u8 *h, u8 platz) {
  u8 i, k;
  s16 n = 0;
  if (h[platz]) return 0;
  if (b_m->springen && steine(p, platz + 1) == 3) return 0;
  for (i = 0; i < PUNKTE; i++) {
    if (p[i] != platz + 1) continue;
    for (k = 0; k < NACHBARN[i][0]; k++)
      if (!p[NACHBARN[i][1 + k]]) n++;
  }
  return n;
}

static s16 bewerten(const u8 *p, const u8 *h, u8 platz) {
  u8 m, eigen, fremd, k, wert = platz + 1;
  s16 summe = ((s16)steine(p, wert) + h[platz] - (s16)steine(p, 2 - platz) - h[platz ^ 1]) * 100;
  for (m = 0; m < 16; m++) {
    eigen = fremd = 0;
    for (k = 0; k < 3; k++) {
      if (p[MUEHLEN[m][k]] == wert) eigen++;
      else if (p[MUEHLEN[m][k]]) fremd++;
    }
    if (eigen == 3) summe += 12;
    else if (eigen == 2 && !fremd) summe += 8;
    if (fremd == 3) summe -= 12;
    else if (fremd == 2 && !eigen) summe -= 8;
  }
  summe += (beweglich(p, h, platz) - beweglich(p, h, platz ^ 1)) * 3;
  return summe;
}

static void b_ausfuehren(u8 e, const Zug *z, u8 platz) {
  u8 i;
  for (i = 0; i < PUNKTE; i++) b_p[e + 1][i] = b_p[e][i];
  b_h[e + 1][0] = b_h[e][0];
  b_h[e + 1][1] = b_h[e][1];
  if (z->b[0] == 0) b_h[e + 1][platz]--;
  else b_p[e + 1][z->b[1]] = 0;
  b_p[e + 1][z->b[2]] = platz + 1;
  for (i = 0; i < z->b[3]; i++) b_p[e + 1][z->b[4 + i]] = 0;
}

static s16 suche(u8 e, u8 platz, u8 tiefe, s16 alpha, s16 beta) {
  u16 n, i;
  s16 wert, bester = -30000;
  if ((u16)(BILDER() - b_start) > b_budget) {
    b_abbruch = 1;
    return 0;
  }
  if (steine(b_p[e], platz + 1) + b_h[e][platz] < 3) return -10000 - tiefe;
  n = zuege_erzeugen(b_m, b_p[e], b_h[e], platz, b_zuege[e], SUCHE_ZUEGE);
  if (n == 0) return -10000 - tiefe;
  if (tiefe == 0) return bewerten(b_p[e], b_h[e], platz);
  for (i = 0; i < n; i++) {
    b_ausfuehren(e, &b_zuege[e][i], platz);
    wert = -suche(e + 1, platz ^ 1, tiefe - 1, -beta, -alpha);
    if (b_abbruch) return 0;
    if (wert > bester) {
      bester = wert;
      if (bester > alpha) alpha = bester;
      if (alpha >= beta) break;
    }
  }
  return bester;
}

static void muehle_bot(const u8 *stand, u8 stufe, Zufall *z, Zug *zug) {
  static const u8 TIEFE[STUFEN] = {1, 2, TIEFE_MAX - 1};
  static const u16 BUDGET[STUFEN] = {30, 60, 110};
  static u16 beste[ZUEGE_MAX];
  const Muehle *m = (const Muehle *)stand;
  u16 n = muehle_zuege(stand, zugliste), i, k;
  u8 tiefe;
  s16 wert, bester;
  *zug = zugliste[zufall_bis(z, n)];
  if (stufe == STUFE_LEICHT) {
    if (zufall_bis(z, 3) == 0) return;
  }
  b_m = m;
  for (i = 0; i < PUNKTE; i++) b_p[0][i] = m->punkte[i];
  b_h[0][0] = m->hand[0];
  b_h[0][1] = m->hand[1];
  b_start = BILDER();
  b_budget = BUDGET[stufe];
  for (tiefe = 1; tiefe <= TIEFE[stufe]; tiefe++) {
    b_abbruch = 0;
    bester = -30000;
    k = 0;
    for (i = 0; i < n; i++) {
      b_ausfuehren(0, &zugliste[i], m->zug);
      wert = -suche(1, m->zug ^ 1, tiefe - 1, -30000, 30000);
      if (b_abbruch) break;
      if (wert > bester) {
        bester = wert;
        k = 0;
      }
      if (wert == bester) beste[k++] = i;
    }
    if (b_abbruch) break;
    *zug = zugliste[beste[zufall_bis(z, k)]];
    if (bester >= 10000) break;
  }
}

/* ------------------------------------------------------------------ Oberfläche */

#define X0 5
#define Y0 4

static void muehle_gitter(const u8 *stand, u8 *b, u8 *h) {
  (void)stand;
  *b = *h = 7;
}

static u8 muehle_feld_an(const u8 *stand, u8 x, u8 y) {
  u8 i;
  (void)stand;
  for (i = 0; i < PUNKTE; i++)
    if (LAGE[i][0] == x && LAGE[i][1] == y) return i;
  return FELD_KEIN;
}

static u8 muehle_felder(const u8 *stand, const Zug *zug, u8 *felder) {
  u8 n = 0, i;
  (void)stand;
  if (zug->b[0]) felder[n++] = zug->b[1];
  felder[n++] = zug->b[2];
  for (i = 0; i < zug->b[3]; i++) felder[n++] = zug->b[4 + i];
  return n;
}

static void muehle_zeichnen(const u8 *stand, const u8 *markierung, u8 aktiv) {
  const Muehle *m = (const Muehle *)stand;
  u8 x, y, i, punkt, inhalt, pal, gewaehlt = 0;
  for (i = 0; i < PUNKTE; i++)
    if (markierung[i] & MARK_GEWAEHLT) gewaehlt = 1;
  tafel(X0 - 1, Y0 - 1, 23, 23);
  for (y = 0; y < 7; y++) {
    for (x = 0; x < 7; x++) {
      punkt = muehle_feld_an(stand, x, y);
      inhalt = punkt == FELD_KEIN ? 0 : m->punkte[punkt];
      pal = PAL_BRETT;
      if (punkt != FELD_KEIN && aktiv) {
        if (markierung[punkt] & MARK_GEWAEHLT) pal = PAL_BRETT_MARKE;
        // Mögliche Ziele zeigen – beim ersten Setzen wären das alle freien Punkte, das wäre zu unruhig.
        else if ((markierung[punkt] & MARK_ZIEL) && (gewaehlt || m->hand[m->zug] == 0)) pal = PAL_BRETT_MARKE;
        if (markierung[punkt] & MARK_CURSOR) pal = PAL_BRETT_AUSWAHL;
      }
      karte(X0 + x * 3, Y0 + y * 3, KARTE_MUEHLE + ((u16)(y * 7 + x) * 3 + inhalt) * 18, 3, 3, pal);
    }
  }
  // Steine in der Hand links (Weiß) und rechts (Schwarz).
  flaeche_leeren(0, 10, 4, 3);
  flaeche_leeren(28, 10, 4, 3);
  text(1, 10, "○", PAL_TEXT);
  zahl(1, 11, m->hand[0], 2, PAL_TEXT);
  text(29, 10, "●", PAL_GRAU);
  zahl(29, 11, m->hand[1], 2, PAL_TEXT);
}

/* ------------------------------------------------------------------ Steckbrief */

/* Wortlaut aus packages/games/mill/src/meta.ts (howToPlay). */
static const char *const ANLEITUNG[] = {
  "Zuerst setzt ihr abwechselnd eure neun Steine auf freie Punkte, danach zieht ihr sie entlang der Linien auf einen freien Nachbarpunkt.",
  "Drei eigene Steine in einer Linie sind eine Mühle. Dann nimmst du einen gegnerischen Stein weg – aber keinen aus einer Mühle, außer es geht nicht anders.",
  "Wer nur noch drei Steine hat, darf springen: auf jeden freien Punkt.",
  "Wer weniger als drei Steine hat oder nicht mehr ziehen kann, verliert.",
  0,
};
static const char *const PLATZ_NAMEN[] = {"Weiß", "Schwarz"};
static const u8 PLATZ_PALETTEN[] = {PAL_TEXT, PAL_GRAU};
static const char *const AN_AUS[] = {"an", "aus"};
static const char *const AUS_MUEHLEN[] = {"wenn nötig", "immer"};
static const char *const DOPPEL[] = {"ein Stein", "zwei Steine"};
static const char *const REMIS_TEXT[] = {"50 Züge", "30 Züge", "aus"};
static const Option OPTIONEN[] = {
  {"Springen", AN_AUS, 2, 0},
  {"Aus Mühle", AUS_MUEHLEN, 2, 0},
  {"Doppelt", DOPPEL, 2, 0},
  {"Remis", REMIS_TEXT, 3, 0},
};

const Spiel spiel_muehle = {
  "Mühle",
  ANLEITUNG,
  "A wählt Punkte nacheinander: Stein, Ziel, dann den Stein zum Wegnehmen · B zurück",
  PLATZ_NAMEN,
  PLATZ_PALETTEN,
  2,
  2,
  0,
  OPTIONEN,
  4,
  FARBEN_MUEHLE,
  muehle_aufbauen,
  muehle_am_zug,
  muehle_zuege,
  muehle_ziehen,
  muehle_ergebnis,
  muehle_bot,
  muehle_ausgeben,
  muehle_gitter,
  muehle_feld_an,
  muehle_felder,
  muehle_zeichnen,
  3,
  0,
};
