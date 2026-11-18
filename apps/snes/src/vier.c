/*
 * Vier in einer Reihe für Brett & Blatt 16 – nach packages/games/four-in-a-row/src/rules.ts,
 * mit allen Brettgrößen und PopOut (eigenen Stein unten herausziehen, Wiederholungsregel,
 * Zuggrenze 200).
 *
 * Zug: [Art (0 einwerfen, 1 herausziehen), Spalte].
 */
#include "spiel.h"
#include "bild.h"
#include "klang.h"

#define ZELLEN_MAX 63
#define LINIEN_MAX 32
#define POPOUT_GRENZE 200
#define SCHLUESSEL 17 /* Platz am Zug und 63 Felder zu je 2 Bit */

typedef struct {
  u8 spalten, reihen;
  u8 felder[ZELLEN_MAX]; /* spaltenweise von unten: felder[spalte * reihen + reihe], 0 leer, 1/2 Platz 0/1 */
  u8 zug;
  u8 popout;
  u8 sieger;
  u8 remis; /* 0, 1 voll, 2 Wiederholung, 3 Zuggrenze, 4 festgefahren */
  u16 zuege;
  u8 linien_n;
  u8 linien[LINIEN_MAX][4];
  u8 letzte_art, letzte_spalte; /* 0xff: noch kein Zug */
  u16 gesehen_n;
  u8 gesehen[POPOUT_GRENZE + 2][SCHLUESSEL];
} Vier;

static const u8 GROESSEN[4][2] = {{6, 5}, {7, 6}, {8, 7}, {9, 7}};
static const s8 RICHTUNGEN[4][2] = {{1, 0}, {0, 1}, {1, 1}, {1, -1}};

static u8 hoehe(const Vier *v, u8 spalte) {
  u8 h = 0;
  const u8 *f = v->felder + spalte * v->reihen;
  while (h < v->reihen && f[h]) h++;
  return h;
}

static void schluessel(const Vier *v, u8 platz, u8 *s) {
  u8 i, n = v->spalten * v->reihen;
  for (i = 1; i < SCHLUESSEL; i++) s[i] = 0;
  s[0] = platz;
  for (i = 0; i < n; i++) s[1 + (i >> 2)] |= v->felder[i] << ((i & 3) * 2);
}

static void merken(Vier *v, u8 platz) {
  schluessel(v, platz, v->gesehen[v->gesehen_n]);
  v->gesehen_n++;
}

static u8 wie_oft(const Vier *v) {
  const u8 *neu = v->gesehen[v->gesehen_n - 1];
  u16 i;
  u8 k, n = 0, gleich;
  for (i = 0; i < v->gesehen_n; i++) {
    gleich = 1;
    for (k = 0; k < SCHLUESSEL; k++)
      if (v->gesehen[i][k] != neu[k]) {
        gleich = 0;
        break;
      }
    n += gleich;
  }
  return n;
}

/* Alle Vierer eines Platzes in der Reihenfolge von findLines (Spalte, Reihe, Richtung). */
static u8 vierer_finden(const Vier *v, u8 wert, u8 (*linien)[4]) {
  u8 c, r, d, i, n = 0;
  s8 ec, er;
  for (c = 0; c < v->spalten; c++) {
    for (r = 0; r < v->reihen; r++) {
      for (d = 0; d < 4; d++) {
        ec = c + 3 * RICHTUNGEN[d][0];
        er = r + 3 * RICHTUNGEN[d][1];
        if (ec < 0 || ec >= v->spalten || er < 0 || er >= v->reihen) continue;
        for (i = 0; i < 4; i++)
          if (v->felder[(c + i * RICHTUNGEN[d][0]) * v->reihen + r + i * RICHTUNGEN[d][1]] != wert) break;
        if (i < 4) continue;
        if (linien && n < LINIEN_MAX)
          for (i = 0; i < 4; i++) linien[n][i] = (c + i * RICHTUNGEN[d][0]) * v->reihen + r + i * RICHTUNGEN[d][1];
        n++;
      }
    }
  }
  return n;
}

static void vier_aufbauen(u8 *stand, const u8 *optionen, u8 plaetze, const char *seed) {
  Vier *v = (Vier *)stand;
  u8 i;
  (void)plaetze;
  (void)seed;
  v->spalten = GROESSEN[optionen[0]][0];
  v->reihen = GROESSEN[optionen[0]][1];
  for (i = 0; i < ZELLEN_MAX; i++) v->felder[i] = 0;
  v->zug = 0;
  v->popout = optionen[1];
  v->sieger = PLATZ_KEIN;
  v->remis = 0;
  v->zuege = 0;
  v->linien_n = 0;
  v->letzte_art = 0xff;
  v->letzte_spalte = 0xff;
  v->gesehen_n = 0;
  if (v->popout) merken(v, 0);
}

static u8 vier_ergebnis(const u8 *stand, u8 *sieger) {
  const Vier *v = (const Vier *)stand;
  if (v->sieger != PLATZ_KEIN) {
    if (sieger) *sieger = 1 << (v->sieger);
    return ERGEBNIS_SIEG;
  }
  return v->remis ? ERGEBNIS_REMIS : ERGEBNIS_LAEUFT;
}

static u8 vier_am_zug(const u8 *stand) {
  const Vier *v = (const Vier *)stand;
  if (v->sieger != PLATZ_KEIN || v->remis) return PLATZ_KEIN;
  return v->zug;
}

static u16 zuege_fuer(const Vier *v, u8 platz, Zug *zuege) {
  u8 c;
  u16 n = 0;
  for (c = 0; c < v->spalten; c++) {
    if (hoehe(v, c) >= v->reihen) continue;
    zuege[n].n = 2;
    zuege[n].b[0] = 0;
    zuege[n].b[1] = c;
    n++;
  }
  if (v->popout) {
    for (c = 0; c < v->spalten; c++) {
      if (v->felder[c * v->reihen] != platz + 1) continue;
      zuege[n].n = 2;
      zuege[n].b[0] = 1;
      zuege[n].b[1] = c;
      n++;
    }
  }
  return n;
}

static u16 vier_zuege(const u8 *stand, Zug *zuege) {
  const Vier *v = (const Vier *)stand;
  if (vier_am_zug(stand) == PLATZ_KEIN) return 0;
  return zuege_fuer(v, v->zug, zuege);
}

static u8 vier_ziehen(u8 *stand, const Zug *zug) {
  Vier *v = (Vier *)stand;
  u8 ich = v->zug, gegner = v->zug ^ 1;
  u8 c = zug->b[1], r, eigene, andere;
  u8 *f = v->felder + c * v->reihen;
  static Zug probe[2 * 9];
  if (zug->b[0] == 0) {
    f[hoehe(v, c)] = ich + 1;
  } else {
    for (r = 0; r + 1 < v->reihen; r++) f[r] = f[r + 1];
    f[v->reihen - 1] = 0;
  }
  v->letzte_art = zug->b[0];
  v->letzte_spalte = c;
  v->zuege++;
  v->zug = gegner;

  // Wer zieht und dabei (auch) einen Vierer hat, gewinnt – beim Herausziehen kann auch ein Vierer des Gegners entstehen.
  eigene = vierer_finden(v, ich + 1, v->linien);
  andere = 0;
  if (!eigene) {
    if (zug->b[0] == 1) andere = vierer_finden(v, gegner + 1, v->linien);
  }
  if (eigene) {
    v->sieger = ich;
    v->linien_n = eigene;
  } else if (andere) {
    v->sieger = gegner;
    v->linien_n = andere;
  } else {
    v->linien_n = 0;
    if (v->popout) {
      merken(v, gegner);
      if (wie_oft(v) >= 3) v->remis = 2;
      else if (v->zuege >= POPOUT_GRENZE) v->remis = 3;
      else if (zuege_fuer(v, gegner, probe) == 0) v->remis = 4;
    } else {
      for (r = 0; r < v->spalten * v->reihen; r++)
        if (!v->felder[r]) break;
      if (r == v->spalten * v->reihen) v->remis = 1;
    }
  }
  return KLANG_SETZEN;
}

static u16 vier_ausgeben(const u8 *stand, u8 *p) {
  const Vier *v = (const Vier *)stand;
  u16 n = 0;
  u8 i, k, zellen = v->spalten * v->reihen;
  p[n++] = v->spalten;
  p[n++] = v->reihen;
  for (i = 0; i < zellen; i++) p[n++] = v->felder[i] ? v->felder[i] - 1 : PLATZ_KEIN;
  p[n++] = v->zug;
  p[n++] = v->popout;
  p[n++] = v->sieger;
  p[n++] = v->remis;
  p[n++] = v->zuege & 0xff;
  p[n++] = v->zuege >> 8;
  p[n++] = v->linien_n;
  for (i = 0; i < v->linien_n && i < LINIEN_MAX; i++)
    for (k = 0; k < 4; k++) p[n++] = v->linien[i][k];
  return n;
}

/* ------------------------------------------------------------------ Bot */

/*
 * Negamax mit Alpha-Beta über die klassischen Einwurf-Züge. Die Bewertung zählt Vierer-Fenster
 * und wird beim Ziehen nur für die Fenster durch das neue Feld nachgeführt – eine volle
 * Bewertung je Stellung wäre auf dem 65816 zu langsam.
 */
#define FENSTER_MAX 96
#define FENSTER_JE_FELD 16
static u8 b_spalten, b_reihen, b_hoehe[9];
static u8 b_feld[ZELLEN_MAX];
static u8 fenster_n;
static u8 fenster[FENSTER_MAX][4];
static u8 fenster_von[ZELLEN_MAX][FENSTER_JE_FELD + 1];
static u8 anzahl[2][FENSTER_MAX];
static s16 wertung; /* aus Sicht von Platz 0 */
static u8 gewonnen;
static u16 b_start, b_budget;
static u8 abbruch;
static const s16 WERT[5] = {0, 1, 5, 40, 0};
static const u8 MITTE_ZUERST[10][9] = {
  {0}, {0}, {0}, {0}, {0}, {2, 3, 1, 4, 0, 5}, {3, 2, 4, 1, 5, 0, 6}, {3, 4, 2, 5, 1, 6, 0, 7}, {4, 3, 5, 2, 6, 1, 7, 0, 8},
};

static s16 fenster_wert(u8 w) {
  u8 a = anzahl[0][w], b = anzahl[1][w];
  if (a && !b) return WERT[a];
  if (b && !a) return -WERT[b];
  return 0;
}

static void bot_vorbereiten(const Vier *v) {
  u8 c, r, d, i, w, zelle;
  s8 ec, er;
  b_spalten = v->spalten;
  b_reihen = v->reihen;
  for (i = 0; i < ZELLEN_MAX; i++) {
    b_feld[i] = 0;
    fenster_von[i][0] = 0;
  }
  fenster_n = 0;
  for (c = 0; c < b_spalten; c++)
    for (r = 0; r < b_reihen; r++)
      for (d = 0; d < 4; d++) {
        ec = c + 3 * RICHTUNGEN[d][0];
        er = r + 3 * RICHTUNGEN[d][1];
        if (ec < 0 || ec >= b_spalten || er < 0 || er >= b_reihen) continue;
        w = fenster_n++;
        anzahl[0][w] = anzahl[1][w] = 0;
        for (i = 0; i < 4; i++) {
          zelle = (c + i * RICHTUNGEN[d][0]) * b_reihen + r + i * RICHTUNGEN[d][1];
          fenster[w][i] = zelle;
          fenster_von[zelle][++fenster_von[zelle][0]] = w;
        }
      }
  wertung = 0;
  for (c = 0; c < b_spalten; c++) b_hoehe[c] = 0;
  // Bestehende Steine eintragen.
  for (c = 0; c < b_spalten; c++)
    for (r = 0; r < b_reihen; r++) {
      zelle = c * b_reihen + r;
      if (!v->felder[zelle]) continue;
      b_feld[zelle] = v->felder[zelle];
      b_hoehe[c] = r + 1;
      for (i = 1; i <= fenster_von[zelle][0]; i++) anzahl[v->felder[zelle] - 1][fenster_von[zelle][i]]++;
    }
  for (w = 0; w < fenster_n; w++) wertung += fenster_wert(w);
}

static void setzen(u8 c, u8 platz) {
  u8 zelle = c * b_reihen + b_hoehe[c]++, i, w;
  b_feld[zelle] = platz + 1;
  for (i = 1; i <= fenster_von[zelle][0]; i++) {
    w = fenster_von[zelle][i];
    wertung -= fenster_wert(w);
    if (++anzahl[platz][w] == 4) gewonnen = 1;
    wertung += fenster_wert(w);
  }
}

static void zuruecknehmen(u8 c, u8 platz) {
  u8 zelle = c * b_reihen + --b_hoehe[c], i, w;
  b_feld[zelle] = 0;
  for (i = 1; i <= fenster_von[zelle][0]; i++) {
    w = fenster_von[zelle][i];
    wertung -= fenster_wert(w);
    anzahl[platz][w]--;
    wertung += fenster_wert(w);
  }
}

static s16 suche(u8 platz, u8 tiefe, s16 alpha, s16 beta) {
  u8 k, c, sieg, voll = 1;
  s16 wert, bester = -30000;
  if ((u16)(BILDER() - b_start) > b_budget) {
    abbruch = 1;
    return 0;
  }
  if (tiefe == 0) return platz == 0 ? wertung : -wertung;
  for (k = 0; k < b_spalten; k++) {
    c = MITTE_ZUERST[b_spalten][k];
    if (b_hoehe[c] >= b_reihen) continue;
    voll = 0;
    gewonnen = 0;
    setzen(c, platz);
    sieg = gewonnen;
    wert = sieg ? 10000 + tiefe : -suche(platz ^ 1, tiefe - 1, -beta, -alpha);
    zuruecknehmen(c, platz);
    if (wert > bester) {
      bester = wert;
      if (bester > alpha) alpha = bester;
      if (alpha >= beta) break;
    }
  }
  return voll ? 0 : bester;
}

/* Beste Spalte mit wachsender Tiefe, solange das Zeitbudget reicht. */
static u8 beste_spalte(u8 platz, u8 max_tiefe, Zufall *z) {
  u8 tiefe, k, c, n, beste = 0xff;
  u8 kandidaten[9];
  s16 wert, bester;
  for (tiefe = 1; tiefe <= max_tiefe; tiefe++) {
    bester = -30000;
    n = 0;
    abbruch = 0;
    for (k = 0; k < b_spalten; k++) {
      c = MITTE_ZUERST[b_spalten][k];
      if (b_hoehe[c] >= b_reihen) continue;
      gewonnen = 0;
      setzen(c, platz);
      wert = gewonnen ? 20000 : -suche(platz ^ 1, tiefe - 1, -30000, 30000);
      zuruecknehmen(c, platz);
      if (abbruch) break;
      if (wert > bester) {
        bester = wert;
        n = 0;
      }
      if (wert == bester) kandidaten[n++] = c;
    }
    if (abbruch) break;
    beste = kandidaten[n > 1 ? zufall_bis(z, n) : 0];
    if (bester >= 10000) break;
  }
  return beste;
}

/*
 * PopOut: nur ein Zug voraus – gewinnen, sonst keinen Sieg des Gegners zulassen. Gerechnet wird
 * auf einer Kopie der Felder; geprüft werden nur Reihen durch die veränderte Spalte.
 */
static u8 sim[2][ZELLEN_MAX];

static u8 reihe_durch(const u8 *f, s8 c, s8 r, u8 wert) {
  u8 d, n;
  s8 x, y;
  for (d = 0; d < 4; d++) {
    n = 1;
    for (x = c + RICHTUNGEN[d][0], y = r + RICHTUNGEN[d][1]; x >= 0 && x < b_spalten && y >= 0 && y < b_reihen && f[x * b_reihen + y] == wert; x += RICHTUNGEN[d][0], y += RICHTUNGEN[d][1]) n++;
    for (x = c - RICHTUNGEN[d][0], y = r - RICHTUNGEN[d][1]; x >= 0 && x < b_spalten && y >= 0 && y < b_reihen && f[x * b_reihen + y] == wert; x -= RICHTUNGEN[d][0], y -= RICHTUNGEN[d][1]) n++;
    if (n >= 4) return 1;
  }
  return 0;
}

/* Führt einen Zug auf `f` aus. Gibt den Sieger zurück (PLATZ_KEIN, wenn keiner). */
static u8 sim_ziehen(u8 *f, const Zug *zug, u8 platz) {
  u8 c = zug->b[1], r, h = 0, eigen = 0, fremd = 0;
  u8 *s = f + c * b_reihen;
  while (h < b_reihen && s[h]) h++;
  if (zug->b[0] == 0) {
    s[h] = platz + 1;
    return reihe_durch(f, c, h, platz + 1) ? platz : PLATZ_KEIN;
  }
  for (r = 0; r + 1 < b_reihen; r++) s[r] = s[r + 1];
  s[b_reihen - 1] = 0;
  for (r = 0; r < b_reihen; r++) {
    if (!s[r]) continue;
    if (reihe_durch(f, c, r, s[r])) {
      if (s[r] == platz + 1) eigen = 1;
      else fremd = 1;
    }
  }
  return eigen ? platz : fremd ? (platz ^ 1) : PLATZ_KEIN;
}

static u8 sim_zuege(const u8 *f, u8 platz, Zug *zuege) {
  u8 c, n = 0;
  for (c = 0; c < b_spalten; c++) {
    if (!f[c * b_reihen + b_reihen - 1]) {
      zuege[n].n = 2;
      zuege[n].b[0] = 0;
      zuege[n++].b[1] = c;
    }
    if (f[c * b_reihen] == platz + 1) {
      zuege[n].n = 2;
      zuege[n].b[0] = 1;
      zuege[n++].b[1] = c;
    }
  }
  return n;
}

static Zug bot_zuege[18], bot_antworten[18];

static void popout_bot(const Vier *v, u8 stufe, Zufall *z, Zug *zug) {
  u8 n, m, i, j, k, sicher = 0, ich = v->zug, sieger;
  u8 sichere[18];
  u8 zellen = v->spalten * v->reihen;
  b_spalten = v->spalten;
  b_reihen = v->reihen;
  n = zuege_fuer(v, ich, bot_zuege);
  if (stufe == STUFE_LEICHT) {
    if (zufall_halb(z)) {
      *zug = bot_zuege[zufall_bis(z, n)];
      return;
    }
  }
  for (i = 0; i < n; i++) {
    for (k = 0; k < zellen; k++) sim[0][k] = v->felder[k];
    sieger = sim_ziehen(sim[0], &bot_zuege[i], ich);
    if (sieger == ich) {
      *zug = bot_zuege[i];
      return;
    }
    if (sieger != PLATZ_KEIN) continue;
    // Kann der Gegner danach sofort gewinnen?
    m = sim_zuege(sim[0], ich ^ 1, bot_antworten);
    for (j = 0; j < m; j++) {
      for (k = 0; k < zellen; k++) sim[1][k] = sim[0][k];
      if (sim_ziehen(sim[1], &bot_antworten[j], ich ^ 1) == (ich ^ 1)) break;
    }
    if (j == m) sichere[sicher++] = i;
  }
  if (sicher) *zug = bot_zuege[sichere[zufall_bis(z, sicher)]];
  else *zug = bot_zuege[zufall_bis(z, n)];
}

static void vier_bot(const u8 *stand, u8 stufe, Zufall *z, Zug *zug) {
  const Vier *v = (const Vier *)stand;
  static const u8 TIEFE[STUFEN] = {2, 4, 8};
  static const u16 BUDGET[STUFEN] = {30, 60, 120};
  u8 c;
  if (v->popout) {
    popout_bot(v, stufe, z, zug);
    return;
  }
  // Leicht: jeder vierte Zug zufällig (wie in der Web-App).
  if (stufe == STUFE_LEICHT) {
    if (zufall_bis(z, 4) == 0) {
      zug_zufaellig(&spiel_vier, stand, z, zug);
      return;
    }
  }
  bot_vorbereiten(v);
  b_start = BILDER();
  b_budget = BUDGET[stufe];
  c = beste_spalte(v->zug, TIEFE[stufe], z);
  if (c == 0xff) {
    zug_zufaellig(&spiel_vier, stand, z, zug);
    return;
  }
  zug->n = 2;
  zug->b[0] = 0;
  zug->b[1] = c;
}

/* ------------------------------------------------------------------ Oberfläche */

static u8 groesse(const Vier *v) {
  return v->reihen <= 6 ? 3 : 2;
}

static void vier_gitter(const u8 *stand, u8 *b, u8 *h) {
  const Vier *v = (const Vier *)stand;
  *b = v->spalten;
  *h = v->popout ? 2 : 1;
}

static u8 vier_feld_an(const u8 *stand, u8 x, u8 y) {
  (void)stand;
  return y ? 16 + x : x;
}

static u8 vier_felder(const u8 *stand, const Zug *zug, u8 *felder) {
  (void)stand;
  felder[0] = zug->b[0] ? 16 + zug->b[1] : zug->b[1];
  return 1;
}

static void vier_zeichnen(const u8 *stand, const u8 *markierung, u8 aktiv) {
  const Vier *v = (const Vier *)stand;
  u8 s = groesse(v);
  u8 x0 = (BILD_B - v->spalten * s) / 2, y0 = 4;
  u8 c, r, i, k, pal, zelle, schwebe, ziehen;
  u16 bild;
  u16 leer = s == 3 ? KARTE_VIER24_LEER : KARTE_VIER16_LEER;
  u16 rot = s == 3 ? KARTE_VIER24_ROT : KARTE_VIER16_ROT;
  u16 gelb = s == 3 ? KARTE_VIER24_GELB : KARTE_VIER16_GELB;
  tafel(x0 - 1, y0 + s - 1, v->spalten * s + 2, v->reihen * s + 2);
  flaeche_leeren(0, y0, 32, s);
  flaeche_leeren(0, y0 + s + v->reihen * s + 1, 32, 1);
  for (c = 0; c < v->spalten; c++) {
    schwebe = aktiv && (markierung[c] & MARK_CURSOR);
    ziehen = aktiv && (markierung[16 + c] & MARK_CURSOR);
    if (schwebe) {
      bild = v->zug == 0 ? (s == 3 ? KARTE_VIER24_SCHWEBE_ROT : KARTE_VIER16_SCHWEBE_ROT) : (s == 3 ? KARTE_VIER24_SCHWEBE_GELB : KARTE_VIER16_SCHWEBE_GELB);
      karte(x0 + c * s, y0, bild, s, s, PAL_BRETT);
    }
    if (ziehen) kachel(x0 + c * s + s / 2, y0 + s + v->reihen * s + 1, 0x90, PAL_GELB);
    for (r = 0; r < v->reihen; r++) {
      zelle = c * v->reihen + r;
      pal = PAL_BRETT;
      if (schwebe || (ziehen && r == 0)) pal = PAL_BRETT_AUSWAHL;
      for (i = 0; i < v->linien_n && i < LINIEN_MAX; i++)
        for (k = 0; k < 4; k++)
          if (v->linien[i][k] == zelle) pal = PAL_BRETT_MARKE;
      bild = v->felder[zelle] == 1 ? rot : v->felder[zelle] == 2 ? gelb : leer;
      karte(x0 + c * s, y0 + s + (v->reihen - 1 - r) * s, bild, s, s, pal);
    }
  }
}

/* ------------------------------------------------------------------ Steckbrief */

/* Wortlaut aus packages/games/four-in-a-row/src/meta.ts (howToPlay). */
static const char *const ANLEITUNG[] = {
  "Werft abwechselnd einen Stein in eine Spalte. Er fällt auf den untersten freien Platz.",
  "Wer zuerst vier eigene Steine in einer Reihe hat – waagerecht, senkrecht oder diagonal –, gewinnt.",
  "Ist das Brett voll, endet die Partie unentschieden.",
  "PopOut (Option): Statt einzuwerfen darfst du einen eigenen Stein ganz unten herausziehen; die Steine darüber rutschen nach.",
  0,
};
static const char *const PLATZ_NAMEN[] = {"Rot", "Gelb"};
static const u8 PLATZ_PALETTEN[] = {PAL_ROT, PAL_GELB};
static const char *const GROESSEN_TEXT[] = {"6 × 5", "7 × 6", "8 × 7", "9 × 7"};
static const char *const AN_AUS[] = {"aus", "an"};
static const Option OPTIONEN[] = {
  {"Brett", GROESSEN_TEXT, 4, 1},
  {"PopOut", AN_AUS, 2, 0},
};

const Spiel spiel_vier = {
  "Vier in einer Reihe",
  ANLEITUNG,
  "✚ Spalte · A einwerfen · PopOut: ✚ runter, A zieht heraus",
  PLATZ_NAMEN,
  PLATZ_PALETTEN,
  2,
  2,
  0,
  OPTIONEN,
  2,
  FARBEN_VIER,
  vier_aufbauen,
  vier_am_zug,
  vier_zuege,
  vier_ziehen,
  vier_ergebnis,
  vier_bot,
  vier_ausgeben,
  vier_gitter,
  vier_feld_an,
  vier_felder,
  vier_zeichnen,
  3,
  0,
};
