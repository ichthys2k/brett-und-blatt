/*
 * Mäxle für Brett & Blatt 16 – nach packages/games/maexle/src/rules.ts, 2–6 Spieler (die Web-App
 * erlaubt bis 10). Zufall wie in der Web-App: Strom „würfel“, je Wurf zwei Zahlen.
 *
 * Züge: [0] würfeln, [1, Wert] ansagen, [2] glauben, [3] anzweifeln, [4, Wert] blind weitergeben.
 * Werte wie in der Web-App: höherer Würfel vorn (42), Pasche 11–66, Mäxle 21.
 */
#include "spiel.h"
#include "bild.h"
#include "klang.h"

#define MAEXLE 21
#define KEIN 0xff
#define ANSAGEN_MAX 24

/* Rangfolge von niedrig nach hoch (RANKING). */
static const u8 RANG[21] = {31, 32, 41, 42, 43, 51, 52, 53, 54, 61, 62, 63, 64, 65, 11, 22, 33, 44, 55, 66, MAEXLE};

typedef struct {
  u8 sitz, wert, blind;
} Ansage;

typedef struct {
  u8 punkte; /* 0 Leben, 1 Strafpunkte */
  u8 grenze, kosten, blind, schuetteln;
  u8 plaetze;
  u8 strafe[PLAETZE_MAX];
  u8 zug;
  u8 phase; /* 0 würfeln, 1 ansagen, 2 antworten */
  u8 hat_wurf, w1, w2;
  u8 gewuerfelt_von;
  u8 ansagen_n;
  Ansage ansagen[ANSAGEN_MAX];
  /* Zuletzt aufgedeckt */
  u8 auf, auf_wurf, auf_w1, auf_w2;
  Ansage auf_ansage;
  u8 auf_zweifler, auf_wahr, auf_verlierer, auf_menge, auf_maexle;
  u16 runde;
  u8 gezeigt[PLAETZE_MAX], luegen[PLAETZE_MAX], knapp[PLAETZE_MAX];
  Zufall zufall;
} Maexle;

static s8 rang(u8 wert) {
  u8 i;
  for (i = 0; i < 21; i++)
    if (RANG[i] == wert) return i;
  return -1;
}

static u8 wert_von(u8 a, u8 b) {
  return a > b ? a * 10 + b : b * 10 + a;
}

static u8 dabei(const Maexle *m, u8 sitz) {
  if (m->punkte) return 1;
  return m->strafe[sitz] < m->grenze;
}

static u8 naechster(const Maexle *m, u8 von) {
  u8 k, s;
  for (k = 1; k <= m->plaetze; k++) {
    s = (von + k) % m->plaetze;
    if (dabei(m, s)) return s;
  }
  return von;
}

static const Ansage *letzte(const Maexle *m) {
  return m->ansagen_n ? &m->ansagen[m->ansagen_n - 1] : 0;
}

static void maexle_aufbauen(u8 *stand, const u8 *optionen, u8 plaetze, const char *seed) {
  Maexle *m = (Maexle *)stand;
  u8 i;
  m->grenze = optionen[0] + 1;
  m->kosten = optionen[1] == 0 ? 2 : 1;
  m->blind = optionen[2];
  m->punkte = optionen[3];
  m->schuetteln = optionen[4] == 0;
  m->plaetze = plaetze;
  for (i = 0; i < PLAETZE_MAX; i++) m->strafe[i] = m->gezeigt[i] = m->luegen[i] = m->knapp[i] = 0;
  m->zug = 0;
  m->phase = 0;
  m->hat_wurf = m->w1 = m->w2 = 0;
  m->gewuerfelt_von = KEIN;
  m->ansagen_n = 0;
  m->auf = 0;
  m->runde = 1;
  zufall_strom(&m->zufall, seed, "würfel");
}

static u8 maexle_ergebnis(const u8 *stand, u8 *sieger) {
  const Maexle *m = (const Maexle *)stand;
  u8 s, voll = 0, beste = 255, im_spiel = 0, maske = 0;
  if (m->punkte) {
    for (s = 0; s < m->plaetze; s++) {
      if (m->strafe[s] >= m->grenze) voll = 1;
      if (m->strafe[s] < beste) beste = m->strafe[s];
    }
    if (!voll) return ERGEBNIS_LAEUFT;
    for (s = 0; s < m->plaetze; s++)
      if (m->strafe[s] == beste) maske |= 1 << s;
    if (sieger) *sieger = maske;
    return ERGEBNIS_SIEG;
  }
  for (s = 0; s < m->plaetze; s++) {
    if (!dabei(m, s)) continue;
    im_spiel++;
    maske |= 1 << s;
  }
  if (im_spiel > 1) return ERGEBNIS_LAEUFT;
  if (sieger) *sieger = maske;
  return ERGEBNIS_SIEG;
}

static u8 maexle_am_zug(const u8 *stand) {
  const Maexle *m = (const Maexle *)stand;
  if (maexle_ergebnis(stand, 0) != ERGEBNIS_LAEUFT) return PLATZ_KEIN;
  return m->zug;
}

static u16 werte_darueber(const Maexle *m, u8 art, Zug *zuege, u16 n) {
  const Ansage *a = letzte(m);
  s8 r = a ? rang(a->wert) : -1;
  u8 i;
  for (i = r + 1; i < 21; i++) {
    zuege[n].n = 2;
    zuege[n].b[0] = art;
    zuege[n++].b[1] = RANG[i];
  }
  return n;
}

static u16 maexle_zuege(const u8 *stand, Zug *zuege) {
  const Maexle *m = (const Maexle *)stand;
  u16 n = 0;
  if (maexle_am_zug(stand) == PLATZ_KEIN) return 0;
  if (m->phase == 0) {
    zuege[0].n = 1;
    zuege[0].b[0] = 0;
    return 1;
  }
  if (m->phase == 1) return werte_darueber(m, 1, zuege, 0);
  zuege[n].n = 1;
  zuege[n++].b[0] = 2;
  zuege[n].n = 1;
  zuege[n++].b[0] = 3;
  if (m->blind) {
    if (letzte(m)) n = werte_darueber(m, 4, zuege, n);
  }
  return n;
}

static void wuerfeln(Maexle *m, u8 sitz) {
  m->w1 = zufall_bis(&m->zufall, 6) + 1;
  m->w2 = zufall_bis(&m->zufall, 6) + 1;
  m->hat_wurf = 1;
  m->gewuerfelt_von = sitz;
  m->phase = 1;
}

/* Wie endRound. */
static void runde_beenden(Maexle *m, u8 wurf, u8 zweifler, u8 wahr, u8 verlierer, u8 menge, u8 maexle) {
  const Ansage *a = letzte(m);
  s8 vorher;
  m->strafe[verlierer] += menge;
  if (m->strafe[verlierer] > m->grenze) m->strafe[verlierer] = m->grenze;
  if (wurf) {
    m->gezeigt[a->sitz]++;
    if (!wahr) {
      m->luegen[a->sitz]++;
      vorher = m->ansagen_n >= 2 ? rang(m->ansagen[m->ansagen_n - 2].wert) : -1;
      if (rang(a->wert) == vorher + 1) m->knapp[a->sitz]++;
    }
  }
  m->auf = 1;
  m->auf_wurf = wurf;
  m->auf_w1 = wurf ? m->w1 : 0;
  m->auf_w2 = wurf ? m->w2 : 0;
  m->auf_ansage = *a;
  m->auf_zweifler = zweifler;
  m->auf_wahr = wahr;
  m->auf_verlierer = verlierer;
  m->auf_menge = menge;
  m->auf_maexle = maexle;
  m->hat_wurf = m->w1 = m->w2 = 0;
  m->gewuerfelt_von = KEIN;
  m->ansagen_n = 0;
  m->phase = 0;
  m->runde++;
  m->zug = dabei(m, verlierer) ? verlierer : naechster(m, verlierer);
}

static u8 maexle_ziehen(u8 *stand, const Zug *zug) {
  Maexle *m = (Maexle *)stand;
  u8 ich = m->zug, wahr, verlierer, menge, ist;
  const Ansage *a = letzte(m);
  switch (zug->b[0]) {
    case 0:
      wuerfeln(m, ich);
      return KLANG_SETZEN;
    case 1:
    case 4:
      m->ansagen[m->ansagen_n].sitz = ich;
      m->ansagen[m->ansagen_n].wert = zug->b[1];
      m->ansagen[m->ansagen_n].blind = zug->b[0] == 4;
      m->ansagen_n++;
      m->zug = naechster(m, ich);
      m->phase = 2;
      return KLANG_KLICK;
    case 2:
      if (a->wert == MAEXLE) {
        // Höher als ein Mäxle geht nicht: Wer es glaubt, verliert ein Leben, ohne aufzudecken.
        runde_beenden(m, 0, ich, 1, ich, 1, 1);
        return KLANG_ENDE;
      }
      wuerfeln(m, ich);
      return KLANG_SETZEN;
  }
  // Anzweifeln: aufdecken.
  ist = wert_von(m->w1, m->w2);
  wahr = rang(ist) >= rang(a->wert);
  menge = 1;
  if (wahr) {
    if (a->wert == MAEXLE) menge = m->kosten;
  }
  verlierer = wahr ? ich : a->sitz;
  runde_beenden(m, 1, ich, wahr, verlierer, menge, 0);
  return KLANG_ENDE;
}

static u16 maexle_ausgeben(const u8 *stand, u8 *p) {
  const Maexle *m = (const Maexle *)stand;
  u16 n = 0;
  u8 i;
  p[n++] = m->punkte;
  p[n++] = m->grenze;
  p[n++] = m->kosten;
  p[n++] = m->blind;
  p[n++] = m->schuetteln;
  p[n++] = m->plaetze;
  for (i = 0; i < m->plaetze; i++) p[n++] = m->strafe[i];
  p[n++] = m->zug;
  p[n++] = m->phase;
  p[n++] = m->hat_wurf;
  p[n++] = m->w1;
  p[n++] = m->w2;
  p[n++] = m->gewuerfelt_von;
  p[n++] = m->ansagen_n;
  for (i = 0; i < m->ansagen_n; i++) {
    p[n++] = m->ansagen[i].sitz;
    p[n++] = m->ansagen[i].wert;
    p[n++] = m->ansagen[i].blind;
  }
  p[n++] = m->auf;
  if (m->auf) {
    p[n++] = m->auf_wurf;
    p[n++] = m->auf_w1;
    p[n++] = m->auf_w2;
    p[n++] = m->auf_ansage.sitz;
    p[n++] = m->auf_ansage.wert;
    p[n++] = m->auf_ansage.blind;
    p[n++] = m->auf_zweifler;
    p[n++] = m->auf_wahr;
    p[n++] = m->auf_verlierer;
    p[n++] = m->auf_menge;
    p[n++] = m->auf_maexle;
  }
  p[n++] = m->runde & 0xff;
  p[n++] = m->runde >> 8;
  for (i = 0; i < m->plaetze; i++) {
    p[n++] = m->gezeigt[i];
    p[n++] = m->luegen[i];
    p[n++] = m->knapp[i];
  }
  for (i = 0; i < 4; i++) {
    p[n++] = m->zufall.s[i] & 0xff;
    p[n++] = (m->zufall.s[i] >> 8) & 0xff;
    p[n++] = (m->zufall.s[i] >> 16) & 0xff;
    p[n++] = (m->zufall.s[i] >> 24) & 0xff;
  }
  return n;
}

/* ------------------------------------------------------------------ Bot */

/*
 * Wahrscheinlichkeiten statt Suche: Von 36 Würfen erreichen so viele mindestens einen Rang
 * (Pasche zählen einmal, alles andere zweimal). Geglaubt wird, was wahrscheinlich ist; wer lügen
 * muss, sagt knapp über der Vorgabe an. „Schwer“ merkt sich, wie oft jemand gelogen hat.
 */
static u8 wuerfe_ab(s8 r) {
  u8 i, n = 0;
  for (i = r < 0 ? 0 : r; i < 21; i++) n += (RANG[i] % 11 == 0) ? 1 : 2;
  return n;
}

static void maexle_bot(const u8 *stand, u8 stufe, Zufall *z, Zug *zug) {
  const Maexle *m = (const Maexle *)stand;
  const Ansage *a = letzte(m);
  s8 r_vor = a ? rang(a->wert) : -1, r_ist;
  u8 ich = m->zug, chance, schwelle;
  zug->n = 1;
  if (m->phase == 0) {
    zug->b[0] = 0;
    return;
  }
  if (m->phase == 1) {
    zug->n = 2;
    zug->b[0] = 1;
    r_ist = rang(wert_von(m->w1, m->w2));
    if (r_ist > r_vor) {
      // Wahr ansagen – „leicht“ übertreibt manchmal trotzdem.
      zug->b[1] = RANG[r_ist];
      if (stufe == STUFE_LEICHT) {
        if (zufall_halb(z)) {
          if (r_ist < 20) zug->b[1] = RANG[r_ist + 1 + zufall_bis(z, 20 - r_ist)];
        }
      }
      return;
    }
    // Lügen: knapp darüber, „schwer“ gelegentlich etwas höher.
    zug->b[1] = RANG[r_vor + 1];
    if (stufe == STUFE_SCHWER) {
      if (r_vor + 2 < 21) {
        if (zufall_bis(z, 3) == 0) zug->b[1] = RANG[r_vor + 2];
      }
    }
    return;
  }
  // Antworten.
  if (a->wert == MAEXLE) {
    // Ein echtes Mäxle kommt in 2 von 36 Würfen – wer es ansagt, lügt oft.
    zug->b[0] = zufall_bis(z, 3) == 0 ? 2 : 3;
    return;
  }
  chance = wuerfe_ab(r_vor); /* von 36 */
  schwelle = 18;
  if (stufe == STUFE_SCHWER) {
    // Wer oft lügt, wird eher angezweifelt.
    if (m->gezeigt[a->sitz] >= 2) {
      if (m->luegen[a->sitz] * 2 > m->gezeigt[a->sitz]) schwelle = 24;
    }
  }
  if (stufe == STUFE_LEICHT) schwelle = 8 + zufall_bis(z, 20);
  zug->b[0] = chance >= schwelle ? 2 : 3;
  (void)ich;
}

/* ------------------------------------------------------------------ Oberfläche */

#define FELD_WUERFELN 0
#define FELD_GLAUBEN 1
#define FELD_ZWEIFELN 2
#define FELD_WERT 10

static const u16 WUERFEL_BILD[7] = {KARTE_WUERFEL_LEER, KARTE_WUERFEL_1, KARTE_WUERFEL_2, KARTE_WUERFEL_3, KARTE_WUERFEL_4, KARTE_WUERFEL_5, KARTE_WUERFEL_6};

static void maexle_gitter(const u8 *stand, u8 *b, u8 *h) {
  (void)stand;
  *b = 7;
  *h = 4;
}

static u8 maexle_feld_an(const u8 *stand, u8 x, u8 y) {
  (void)stand;
  if (y == 0) return x < 3 ? x : FELD_KEIN;
  return FELD_WERT + (y - 1) * 7 + x;
}

static u8 maexle_felder(const u8 *stand, const Zug *zug, u8 *felder) {
  (void)stand;
  if (zug->b[0] == 0) felder[0] = FELD_WUERFELN;
  else if (zug->b[0] == 2) felder[0] = FELD_GLAUBEN;
  else if (zug->b[0] == 3) felder[0] = FELD_ZWEIFELN;
  else felder[0] = FELD_WERT + rang(zug->b[1]);
  return 1;
}

static void aktion(u8 x, u8 y, const char *name, u8 feld, const u8 *markierung, u8 aktiv) {
  kachel(x, y, aktiv && (markierung[feld] & MARK_CURSOR) ? K_PFEIL : 0, PAL_GELB);
  text(x + 1, y, name, aktiv && (markierung[feld] & MARK_ZIEL) ? PAL_TEXT : PAL_GRAU);
}

static void maexle_zeichnen(const u8 *stand, const u8 *markierung, u8 aktiv) {
  const Maexle *m = (const Maexle *)stand;
  const Ansage *a = letzte(m);
  u8 s, y, i, zeigen, pal;
  static const char *const NAMEN[6] = {"Spieler 1", "Spieler 2", "Spieler 3", "Spieler 4", "Spieler 5", "Spieler 6"};
  tafel(0, 4, 32, 20);
  // Spieler mit Leben bzw. Strafpunkten.
  for (s = 0; s < m->plaetze; s++) {
    y = 5 + s;
    flaeche_leeren(1, y, 30, 1);
    text(2, y, NAMEN[s], s == m->zug ? PAL_GELB : dabei(m, s) ? PAL_TEXT : PAL_GRAU);
    if (m->punkte) {
      text(13, y, "Strafe", PAL_GRAU);
      zahl(20, y, m->strafe[s], 2, PAL_TEXT);
    } else {
      for (i = 0; i < m->grenze; i++) kachel(13 + i, y, i < m->grenze - m->strafe[s] ? 0x92 : 0x93, i < m->grenze - m->strafe[s] ? PAL_ROT : PAL_GRAU);
    }
  }
  // Ansage und Wurf.
  flaeche_leeren(1, 12, 30, 4);
  text(2, 12, "Ansage:", PAL_GRAU);
  if (a) {
    zahl(10, 12, a->wert, 2, PAL_GELB);
    if (a->wert == MAEXLE) text(13, 12, "Mäxle!", PAL_GELB);
    text(20, 12, NAMEN[a->sitz], PAL_GRAU);
  }
  // Den Wurf sieht nur, wer gewürfelt hat (am Zug und gerade beim Ansagen).
  zeigen = aktiv && m->hat_wurf && m->gewuerfelt_von == m->zug && m->phase == 1;
  text(2, 14, "Becher:", PAL_GRAU);
  karte(10, 13, WUERFEL_BILD[zeigen ? m->w1 : 0], 2, 2, PAL_BRETT);
  karte(13, 13, WUERFEL_BILD[zeigen ? m->w2 : 0], 2, 2, PAL_BRETT);
  // Letzte Aufdeckung.
  flaeche_leeren(1, 16, 30, 1);
  if (m->auf) {
    if (m->auf_wurf) {
      text(2, 16, "Lag:", PAL_GRAU);
      zahl(7, 16, wert_von(m->auf_w1, m->auf_w2), 2, PAL_TEXT);
      text(10, 16, m->auf_wahr ? "stimmte" : "gelogen", m->auf_wahr ? PAL_TEXT : PAL_ROT);
    } else {
      text(2, 16, "Mäxle geglaubt", PAL_TEXT);
    }
    text(18, 16, NAMEN[m->auf_verlierer], PAL_ROT);
    text(28, 16, "−", PAL_ROT);
    zahl(29, 16, m->auf_menge, 1, PAL_ROT);
  }
  // Aktionen und Werte.
  flaeche_leeren(1, 18, 30, 5);
  aktion(2, 18, "Würfeln", FELD_WUERFELN, markierung, aktiv);
  aktion(12, 18, "Glauben", FELD_GLAUBEN, markierung, aktiv);
  aktion(22, 18, "Zweifeln", FELD_ZWEIFELN, markierung, aktiv);
  for (i = 0; i < 21; i++) {
    y = 20 + i / 7;
    pal = aktiv && (markierung[FELD_WERT + i] & MARK_ZIEL) ? PAL_TEXT : PAL_GRAU;
    kachel(2 + (i % 7) * 4, y, aktiv && (markierung[FELD_WERT + i] & MARK_CURSOR) ? K_PFEIL : 0, PAL_GELB);
    zahl(3 + (i % 7) * 4, y, RANG[i], 2, pal);
  }
}

/* ------------------------------------------------------------------ Steckbrief */

/* Wortlaut aus packages/games/maexle/src/meta.ts (howToPlay). */
static const char *const ANLEITUNG[] = {
  "Würfle verdeckt, schau heimlich unter den Becher und sag einen Wert an, der höher ist als die vorige Ansage. Lügen ist erlaubt.",
  "Der höhere Würfel zählt als Zehner: 4 und 2 ist 42. Pasche schlagen alle normalen Würfe, das Mäxle (2 und 1) schlägt alles.",
  "Wer den Becher bekommt, glaubt (und würfelt selbst neu) oder zweifelt an. Beim Anzweifeln wird aufgedeckt: Gelogen kostet den Ansager ein Leben, sonst den Zweifler.",
  "Ein angesagtes Mäxle glauben kostet sofort ein Leben; wer ein echtes Mäxle anzweifelt, verliert zwei.",
  "Wer keine Leben mehr hat, scheidet aus. Wer zuletzt übrig ist, gewinnt.",
  0,
};
static const char *const PLATZ_NAMEN[] = {"Spieler 1", "Spieler 2", "Spieler 3", "Spieler 4", "Spieler 5", "Spieler 6"};
static const u8 PLATZ_PALETTEN[] = {PAL_ROT, PAL_BLAU, PAL_GELB, PAL_TEXT, PAL_GRAU, PAL_ROT};
static const char *const LEBEN[] = {"1", "2", "3", "4", "5", "6"};
static const char *const KOSTEN[] = {"2 Leben", "1 Leben"};
static const char *const AN_AUS[] = {"aus", "an"};
static const char *const WERTUNG[] = {"Leben", "Strafpunkte"};
static const char *const SCHUETTELN[] = {"Schütteln", "nur Knopf"};
static const Option OPTIONEN[] = {
  {"Leben", LEBEN, 6, 2},
  {"Mäxle", KOSTEN, 2, 0},
  {"Blind", AN_AUS, 2, 0},
  {"Wertung", WERTUNG, 2, 0},
  {"Würfeln", SCHUETTELN, 2, 0},
};

const Spiel spiel_maexle = {
  "Mäxle",
  ANLEITUNG,
  "✚ wählen · A: Würfeln, Glauben, Zweifeln oder einen Wert ansagen (weiß = erlaubt)",
  PLATZ_NAMEN,
  PLATZ_PALETTEN,
  2,
  6,
  1,
  OPTIONEN,
  5,
  FARBEN_WUERFEL,
  maexle_aufbauen,
  maexle_am_zug,
  maexle_zuege,
  maexle_ziehen,
  maexle_ergebnis,
  maexle_bot,
  maexle_ausgeben,
  maexle_gitter,
  maexle_feld_an,
  maexle_felder,
  maexle_zeichnen,
  0,
  0,
};
