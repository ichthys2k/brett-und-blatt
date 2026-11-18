/*
 * Dame für Brett & Blatt 16 – nach packages/games/checkers/src/rules.ts mit den Varianten
 * Klassisch Deutsch (fliegende Dame, Steine schlagen nur vorwärts), International (Steine schlagen
 * auch rückwärts, Mehrheitszwang) und Englisch (kurze Dame), auf 8 × 8 oder 10 × 10.
 * Remis-Angebote gibt es auf dem SNES nicht (in der Web-App sind sie kein Teil von legalMoves).
 *
 * Zug: [von, nach, Zahl der Geschlagenen, Geschlagene …, Zahl der Sprungfelder, Sprungfelder …].
 * Felder zeilenweise von oben links (Index 0 = a8 bzw. a10).
 */
#include "spiel.h"
#include "bild.h"
#include "klang.h"

#define ZELLEN_MAX 100
#define KETTE_MAX 12
#define GESEHEN_MAX 48
#define SCHLUESSEL 26 /* Platz am Zug und 50 dunkle Felder zu je 4 Bit */

enum { LEER, W_STEIN, W_DAME, S_STEIN, S_DAME };
enum { DEUTSCH, INTERNATIONAL, ENGLISCH };

typedef struct {
  u8 groesse;
  u8 felder[ZELLEN_MAX];
  u8 zug;
  u8 sieger;
  u8 ende; /* 0, 1 geschlagen, 2 blockiert, 3 Wiederholung, 4 Zugregel */
  u8 seit; /* Halbzüge ohne Schlagen und ohne Vorrücken eines Steins */
  u8 variante;
  u8 drehen;
  u8 letzt_von, letzt_nach;
  u16 halbzuege;
  /*
   * Stellungen seit dem letzten Schlagen oder Steinzug: Diese Züge sind nicht umkehrbar, frühere
   * Stellungen kehren also nie wieder – so reicht eine kurze Liste für die Wiederholungsregel.
   */
  u8 gesehen_n;
  u8 gesehen[GESEHEN_MAX][SCHLUESSEL];
} Dame;

#define PLATZ_VON(v) ((v) >= S_STEIN ? 1 : 0)
#define IST_DAME(v) ((v) == W_DAME || (v) == S_DAME)

static const s8 ALLE[4][2] = {{-1, -1}, {-1, 1}, {1, -1}, {1, 1}}; /* (Reihe, Spalte) */

/* ------------------------------------------------------------------ Zugerzeugung */

static const u8 *g_f;
static u8 g_g, g_var, g_von, g_wert, g_platz, g_dame;
static u8 g_kette[KETTE_MAX], g_pfad[KETTE_MAX];
static Zug *g_aus;
static u16 g_n, g_max;

static u8 im_brett(s8 r, s8 c) {
  return r >= 0 && c >= 0 && r < g_g && c < g_g;
}

static u8 schon_geschlagen(u8 feld, u8 tiefe) {
  u8 i;
  for (i = 0; i < tiefe; i++)
    if (g_kette[i] == feld) return 1;
  return 0;
}

static void eintragen(u8 nach, u8 tiefe) {
  u8 i, k = 0;
  Zug *z;
  u16 j;
  if (g_n >= g_max) return;
  if (4 + 2 * tiefe > ZUG_BYTES) return; /* mehr als neun Sprünge passen nicht in einen Zug */
  z = &g_aus[g_n];
  z->b[k++] = g_von;
  z->b[k++] = nach;
  z->b[k++] = tiefe;
  for (i = 0; i < tiefe; i++) z->b[k++] = g_kette[i];
  z->b[k++] = tiefe;
  for (i = 0; i < tiefe; i++) z->b[k++] = g_pfad[i];
  z->n = k;
  // Gleiche Züge (durch Verzweigung des Wegs) nur einmal.
  for (j = 0; j < g_n; j++)
    if (zug_gleich(&g_aus[j], z)) return;
  g_n++;
}

static u8 frei(u8 feld) {
  return g_f[feld] == LEER || feld == g_von;
}

/* Wie collectCaptures: alle vollständigen Schlagketten ab `aktuell`. */
static void sammeln(u8 aktuell, u8 tiefe) {
  s8 r = aktuell / g_g, c = aktuell % g_g, mr, mc, lr, lc, vor;
  u8 d, mitte, land, gefunden = 0, kron, n_richt, ziel;
  vor = g_platz == 0 ? -1 : 1;
  if (tiefe >= KETTE_MAX) return;
  if (!g_dame) {
    // Einfacher Stein: vorwärts schräg, international in alle vier Richtungen.
    n_richt = g_var == INTERNATIONAL ? 4 : 2;
    for (d = 0; d < n_richt; d++) {
      if (g_var == INTERNATIONAL) {
        mr = ALLE[d][0];
        mc = ALLE[d][1];
      } else {
        mr = vor;
        mc = d == 0 ? -1 : 1;
      }
      lr = r + 2 * mr;
      lc = c + 2 * mc;
      if (!im_brett(lr, lc)) continue;
      mitte = (r + mr) * g_g + c + mc;
      land = lr * g_g + lc;
      if (g_f[mitte] == LEER) continue;
      if (PLATZ_VON(g_f[mitte]) == g_platz) continue;
      if (schon_geschlagen(mitte, tiefe)) continue;
      if (!frei(land)) continue;
      gefunden = 1;
      g_kette[tiefe] = mitte;
      g_pfad[tiefe] = land;
      kron = (g_platz == 0 && lr == 0) || (g_platz == 1 && lr == g_g - 1);
      // Auf der Grundreihe endet der Zug, der Stein wird gekrönt.
      if (kron) eintragen(land, tiefe + 1);
      else sammeln(land, tiefe + 1);
    }
  } else if (g_var == ENGLISCH) {
    // Kurze Dame.
    for (d = 0; d < 4; d++) {
      lr = r + 2 * ALLE[d][0];
      lc = c + 2 * ALLE[d][1];
      if (!im_brett(lr, lc)) continue;
      mitte = (r + ALLE[d][0]) * g_g + c + ALLE[d][1];
      land = lr * g_g + lc;
      if (g_f[mitte] == LEER) continue;
      if (PLATZ_VON(g_f[mitte]) == g_platz) continue;
      if (schon_geschlagen(mitte, tiefe)) continue;
      if (!frei(land)) continue;
      gefunden = 1;
      g_kette[tiefe] = mitte;
      g_pfad[tiefe] = land;
      sammeln(land, tiefe + 1);
    }
  } else {
    // Fliegende Dame: über freie Felder bis zum ersten Stein, dahinter auf jedes freie Feld.
    for (d = 0; d < 4; d++) {
      mr = r + ALLE[d][0];
      mc = c + ALLE[d][1];
      while (im_brett(mr, mc)) {
        ziel = mr * g_g + mc;
        if (!frei(ziel)) break;
        mr += ALLE[d][0];
        mc += ALLE[d][1];
      }
      if (!im_brett(mr, mc)) continue;
      mitte = mr * g_g + mc;
      if (PLATZ_VON(g_f[mitte]) == g_platz) continue;
      if (schon_geschlagen(mitte, tiefe)) continue;
      lr = mr + ALLE[d][0];
      lc = mc + ALLE[d][1];
      while (im_brett(lr, lc)) {
        land = lr * g_g + lc;
        if (!frei(land)) break;
        gefunden = 1;
        g_kette[tiefe] = mitte;
        g_pfad[tiefe] = land;
        sammeln(land, tiefe + 1);
        lr += ALLE[d][0];
        lc += ALLE[d][1];
      }
    }
  }
  if (!gefunden && tiefe > 0) eintragen(aktuell, tiefe);
}

/* Alle Brettzüge wie boardMoves. */
static u16 zuege_erzeugen(const u8 *f, u8 g, u8 variante, u8 platz, Zug *aus, u16 max) {
  u8 i, d, ziel, meiste = 0, vor;
  s8 r, c, nr, nc;
  u16 k, n;
  g_f = f;
  g_g = g;
  g_var = variante;
  g_platz = platz;
  g_aus = aus;
  g_n = 0;
  g_max = max;
  for (i = 0; i < g * g; i++) {
    if (f[i] == LEER) continue;
    if (PLATZ_VON(f[i]) != platz) continue;
    g_von = i;
    g_wert = f[i];
    g_dame = IST_DAME(f[i]);
    sammeln(i, 0);
  }
  if (g_n) {
    if (variante != INTERNATIONAL) return g_n;
    // Mehrheitszwang: nur Züge mit den meisten geschlagenen Steinen.
    for (k = 0; k < g_n; k++)
      if (aus[k].b[2] > meiste) meiste = aus[k].b[2];
    n = 0;
    for (k = 0; k < g_n; k++)
      if (aus[k].b[2] == meiste) aus[n++] = aus[k];
    return n;
  }
  vor = platz == 0 ? 0xff : 1;
  n = 0;
  for (i = 0; i < g * g; i++) {
    if (f[i] == LEER) continue;
    if (PLATZ_VON(f[i]) != platz) continue;
    r = i / g;
    c = i % g;
    for (d = 0; d < 4; d++) {
      if (!IST_DAME(f[i])) {
        if (d >= 2) break;
        nr = r + (s8)vor;
        nc = c + (d == 0 ? -1 : 1);
      } else {
        nr = r + ALLE[d][0];
        nc = c + ALLE[d][1];
      }
      while (nr >= 0 && nc >= 0 && nr < g && nc < g) {
        ziel = nr * g + nc;
        if (f[ziel] != LEER) break;
        if (n < max) {
          aus[n].n = 4;
          aus[n].b[0] = i;
          aus[n].b[1] = ziel;
          aus[n].b[2] = 0;
          aus[n].b[3] = 0;
          n++;
        }
        // Nur die fliegende Dame zieht weiter.
        if (!IST_DAME(f[i]) || variante == ENGLISCH) break;
        nr += ALLE[d][0];
        nc += ALLE[d][1];
      }
    }
  }
  return n;
}

/* Führt einen Zug auf den Feldern aus; gibt 1 zurück, wenn ein Stein gezogen oder geschlagen wurde. */
static u8 ausfuehren(u8 *f, u8 g, const Zug *z) {
  u8 von = z->b[0], nach = z->b[1], n = z->b[2], i, wert = f[von], reihe = nach / g, platz;
  platz = PLATZ_VON(wert);
  f[von] = LEER;
  for (i = 0; i < n; i++) f[z->b[3 + i]] = LEER;
  if (!IST_DAME(wert)) {
    if (platz == 0 && reihe == 0) wert = W_DAME;
    if (platz == 1 && reihe == g - 1) wert = S_DAME;
  }
  f[nach] = wert;
  return n > 0 || !IST_DAME(f[nach]) || wert != f[nach];
}

/* ------------------------------------------------------------------ Regeln */

static void merken(Dame *m) {
  u8 *s = m->gesehen[m->gesehen_n];
  u8 i, k = 0;
  if (m->gesehen_n >= GESEHEN_MAX) return;
  for (i = 0; i < SCHLUESSEL; i++) s[i] = 0;
  s[0] = m->zug;
  for (i = 0; i < m->groesse * m->groesse; i++) {
    if (((i / m->groesse) + (i % m->groesse)) % 2 == 0) continue;
    s[1 + (k >> 1)] |= m->felder[i] << ((k & 1) * 4);
    k++;
  }
  m->gesehen_n++;
}

static void dame_aufbauen(u8 *stand, const u8 *optionen, u8 plaetze, const char *seed) {
  Dame *m = (Dame *)stand;
  u8 r, c, g, reihen;
  (void)plaetze;
  (void)seed;
  m->variante = optionen[0];
  g = optionen[1] ? 10 : 8;
  m->groesse = g;
  m->drehen = optionen[2] == 0;
  reihen = g == 10 ? 4 : 3;
  for (r = 0; r < g; r++)
    for (c = 0; c < g; c++) {
      if ((r + c) % 2 == 0) m->felder[r * g + c] = LEER;
      else if (r < reihen) m->felder[r * g + c] = S_STEIN;
      else if (r >= g - reihen) m->felder[r * g + c] = W_STEIN;
      else m->felder[r * g + c] = LEER;
    }
  m->zug = 0;
  m->sieger = PLATZ_KEIN;
  m->ende = 0;
  m->seit = 0;
  m->letzt_von = m->letzt_nach = PLATZ_KEIN;
  m->halbzuege = 0;
  m->gesehen_n = 0;
  merken(m);
}

static u8 dame_ergebnis(const u8 *stand, u8 *sieger) {
  const Dame *m = (const Dame *)stand;
  if (m->sieger != PLATZ_KEIN) {
    if (sieger) *sieger = 1 << (m->sieger);
    return ERGEBNIS_SIEG;
  }
  return m->ende ? ERGEBNIS_REMIS : ERGEBNIS_LAEUFT;
}

static u8 dame_am_zug(const u8 *stand) {
  const Dame *m = (const Dame *)stand;
  return m->ende ? PLATZ_KEIN : m->zug;
}

static u16 dame_zuege(const u8 *stand, Zug *zuege) {
  const Dame *m = (const Dame *)stand;
  if (m->ende) return 0;
  return zuege_erzeugen(m->felder, m->groesse, m->variante, m->zug, zuege, ZUEGE_MAX);
}

static Zug probe[1];

static u8 dame_ziehen(u8 *stand, const Zug *zug) {
  Dame *m = (Dame *)stand;
  u8 ich = m->zug, gegner = ich ^ 1, i, k, gleich, wie_oft = 0, hat, unumkehrbar, war_stein;
  const u8 *neu;
  war_stein = !IST_DAME(m->felder[zug->b[0]]);
  ausfuehren(m->felder, m->groesse, zug);
  unumkehrbar = zug->b[2] > 0 || war_stein;
  m->seit = unumkehrbar ? 0 : m->seit + 1;
  m->letzt_von = zug->b[0];
  m->letzt_nach = zug->b[1];
  m->halbzuege++;
  m->zug = gegner;
  if (unumkehrbar) m->gesehen_n = 0;
  merken(m);
  if (m->gesehen_n > 0) {
    neu = m->gesehen[m->gesehen_n - 1];
    for (i = 0; i < m->gesehen_n; i++) {
      gleich = 1;
      for (k = 0; k < SCHLUESSEL; k++)
        if (m->gesehen[i][k] != neu[k]) gleich = 0;
      wie_oft += gleich;
    }
  }
  hat = 0;
  for (i = 0; i < m->groesse * m->groesse; i++) {
    if (m->felder[i] == LEER) continue;
    if (PLATZ_VON(m->felder[i]) == gegner) hat = 1;
  }
  if (!hat) {
    m->ende = 1;
    m->sieger = ich;
  } else if (zuege_erzeugen(m->felder, m->groesse, m->variante, gegner, probe, 1) == 0) {
    m->ende = 2;
    m->sieger = ich;
  } else if (wie_oft >= 3) {
    m->ende = 3;
  } else if (m->seit >= 40) {
    m->ende = 4;
  }
  return zug->b[2] ? KLANG_ENDE : KLANG_SETZEN;
}

static u16 dame_ausgeben(const u8 *stand, u8 *p) {
  const Dame *m = (const Dame *)stand;
  u16 n = 0;
  u8 i;
  p[n++] = m->groesse;
  for (i = 0; i < m->groesse * m->groesse; i++) p[n++] = m->felder[i];
  p[n++] = m->zug;
  p[n++] = m->sieger;
  p[n++] = m->ende;
  p[n++] = m->seit;
  p[n++] = m->letzt_von;
  p[n++] = m->letzt_nach;
  p[n++] = m->halbzuege & 0xff;
  p[n++] = m->halbzuege >> 8;
  p[n++] = m->variante;
  return n;
}

/* ------------------------------------------------------------------ Bot */

/*
 * Negamax mit Alpha-Beta auf Kopien des Bretts; Bewertung wie evaluate in rules.ts (Material,
 * Vorrücken, Grundreihe, Dame in der Mitte, Rand). Wiederholung und Zugregel kennt die Suche nicht.
 */
#define TIEFE_MAX 5
#define SUCHE_ZUEGE 48
static u8 b_f[TIEFE_MAX + 1][ZELLEN_MAX];
extern Zug dame_suche[TIEFE_MAX][SUCHE_ZUEGE]; /* in Bank $7F (ram.asm) */
#define b_zuege dame_suche
static u8 b_g, b_var, b_abbruch;
static u16 b_start, b_budget;

static s16 bewerten(const u8 *f, u8 platz) {
  u8 i, r, c, v, eigen;
  s16 wert = 0, w, mitte;
  for (i = 0; i < b_g * b_g; i++) {
    v = f[i];
    if (v == LEER) continue;
    r = i / b_g;
    c = i % b_g;
    eigen = PLATZ_VON(v) == platz;
    if (!IST_DAME(v)) {
      w = 100 + (PLATZ_VON(v) == 0 ? b_g - 1 - r : r) * 6;
      if ((v == W_STEIN && r == b_g - 1) || (v == S_STEIN && r == 0)) w += 12;
    } else {
      mitte = (r * 2 > b_g - 1 ? r * 2 - (b_g - 1) : (b_g - 1) - r * 2) + (c * 2 > b_g - 1 ? c * 2 - (b_g - 1) : (b_g - 1) - c * 2);
      w = 320 + 10 - mitte;
    }
    if (c == 0 || c == b_g - 1) w += 4;
    wert += eigen ? w : -w;
  }
  return wert;
}

static s16 suche(u8 e, u8 platz, u8 tiefe, s16 alpha, s16 beta) {
  u16 n, i;
  u8 k;
  s16 wert, bester = -30000;
  if ((u16)(BILDER() - b_start) > b_budget) {
    b_abbruch = 1;
    return 0;
  }
  n = zuege_erzeugen(b_f[e], b_g, b_var, platz, b_zuege[e], SUCHE_ZUEGE);
  if (n == 0) return -10000 - tiefe;
  if (tiefe == 0) return bewerten(b_f[e], platz);
  for (i = 0; i < n; i++) {
    for (k = 0; k < b_g * b_g; k++) b_f[e + 1][k] = b_f[e][k];
    ausfuehren(b_f[e + 1], b_g, &b_zuege[e][i]);
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

static void dame_bot(const u8 *stand, u8 stufe, Zufall *z, Zug *zug) {
  static const u8 TIEFE[STUFEN] = {1, 3, TIEFE_MAX - 1};
  static const u16 BUDGET[STUFEN] = {30, 60, 110};
  static u16 beste[ZUEGE_MAX];
  const Dame *m = (const Dame *)stand;
  u16 n = dame_zuege(stand, zugliste), i, k;
  u8 tiefe, j;
  s16 wert, bester;
  *zug = zugliste[zufall_bis(z, n)];
  if (n == 1) return;
  if (stufe == STUFE_LEICHT) {
    if (zufall_bis(z, 3) == 0) return;
  }
  b_g = m->groesse;
  b_var = m->variante;
  b_start = BILDER();
  b_budget = BUDGET[stufe];
  for (tiefe = 1; tiefe <= TIEFE[stufe]; tiefe++) {
    b_abbruch = 0;
    bester = -30000;
    k = 0;
    for (i = 0; i < n; i++) {
      for (j = 0; j < b_g * b_g; j++) b_f[0][j] = m->felder[j];
      ausfuehren(b_f[0], b_g, &zugliste[i]);
      for (j = 0; j < b_g * b_g; j++) b_f[1][j] = b_f[0][j];
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

/* Gedreht wird zum Spieler am Zug, wenn die Option an ist (Hot-Seat am selben Gerät). */
static u8 gedreht(const Dame *m) {
  return m->drehen && m->zug == 1 && !m->ende;
}

static void dame_gitter(const u8 *stand, u8 *b, u8 *h) {
  const Dame *m = (const Dame *)stand;
  *b = *h = m->groesse;
}

static u8 dame_feld_an(const u8 *stand, u8 x, u8 y) {
  const Dame *m = (const Dame *)stand;
  u8 g = m->groesse;
  if (gedreht(m)) {
    x = g - 1 - x;
    y = g - 1 - y;
  }
  if ((x + y) % 2 == 0) return FELD_KEIN;
  return y * g + x;
}

static u8 dame_felder(const u8 *stand, const Zug *zug, u8 *felder) {
  u8 n = 0, i, ncap = zug->b[2], npfad;
  (void)stand;
  felder[n++] = zug->b[0];
  if (!ncap) {
    felder[n++] = zug->b[1];
    return n;
  }
  npfad = zug->b[3 + ncap];
  for (i = 0; i < npfad && n < FOLGE_MAX; i++) felder[n++] = zug->b[4 + ncap + i];
  return n;
}

static void dame_zeichnen(const u8 *stand, const u8 *markierung, u8 aktiv) {
  const Dame *m = (const Dame *)stand;
  static const u16 BILD[5] = {KARTE_DAME_LEER, KARTE_DAME_WEISS, KARTE_DAME_WEISS_DAME, KARTE_DAME_SCHWARZ, KARTE_DAME_SCHWARZ_DAME};
  u8 g = m->groesse, x0 = (BILD_B - 2 * g) / 2, y0 = 4 + (20 - 2 * g) / 2, x, y, i, pal, dreh = gedreht(m);
  tafel(x0 - 1, y0 - 1, 2 * g + 2, 2 * g + 2);
  for (y = 0; y < g; y++) {
    for (x = 0; x < g; x++) {
      i = dreh ? (g - 1 - y) * g + (g - 1 - x) : y * g + x;
      if (((i / g) + (i % g)) % 2 == 0) {
        karte(x0 + x * 2, y0 + y * 2, KARTE_DAME_HELL, 2, 2, PAL_BRETT);
        continue;
      }
      pal = PAL_BRETT;
      if (i == m->letzt_von || i == m->letzt_nach) pal = PAL_BRETT_MARKE;
      if (aktiv) {
        if (markierung[i] & (MARK_GEWAEHLT | MARK_ZIEL)) pal = PAL_BRETT_MARKE;
        if (markierung[i] & MARK_CURSOR) pal = PAL_BRETT_AUSWAHL;
      }
      karte(x0 + x * 2, y0 + y * 2, BILD[m->felder[i]], 2, 2, pal);
    }
  }
}

/* ------------------------------------------------------------------ Steckbrief */

/* Wortlaut aus packages/games/checkers/src/meta.ts (howToPlay), ohne Remis-Angebot. */
static const char *const ANLEITUNG[] = {
  "Gespielt wird auf den dunklen Feldern. Weiß beginnt. Einfache Steine ziehen diagonal ein Feld vorwärts.",
  "Kannst du schlagen, musst du schlagen (Schlagpflicht): Überspringe einen gegnerischen Stein diagonal auf das freie Feld dahinter. Geht es danach weiter, musst du im selben Zug weiterschlagen.",
  "Erreicht dein Stein die gegnerische Grundreihe, wird er zur Dame. Die fliegende Dame darf beliebig weit diagonal vor- und rückwärts ziehen und springen.",
  "Wer alle Steine des Gegners schlägt oder ihn bewegungsunfähig blockiert, gewinnt.",
  0,
};
static const char *const PLATZ_NAMEN[] = {"Weiß", "Schwarz"};
static const u8 PLATZ_PALETTEN[] = {PAL_TEXT, PAL_GRAU};
static const char *const VARIANTEN[] = {"Deutsch", "International", "Englisch"};
static const char *const GROESSEN[] = {"8 × 8", "10 × 10"};
static const char *const DREHEN[] = {"zum Spieler", "fest"};
static const Option OPTIONEN[] = {
  {"Regeln", VARIANTEN, 3, 0},
  {"Brett", GROESSEN, 2, 0},
  {"Drehen", DREHEN, 2, 0},
};

const Spiel spiel_dame = {
  "Dame",
  ANLEITUNG,
  "A wählt den Stein, dann das Ziel bzw. jedes Sprungfeld nacheinander · B zurück",
  PLATZ_NAMEN,
  PLATZ_PALETTEN,
  2,
  2,
  0,
  OPTIONEN,
  3,
  FARBEN_DAME,
  dame_aufbauen,
  dame_am_zug,
  dame_zuege,
  dame_ziehen,
  dame_ergebnis,
  dame_bot,
  dame_ausgeben,
  dame_gitter,
  dame_feld_an,
  dame_felder,
  dame_zeichnen,
  0,
  5,
};
