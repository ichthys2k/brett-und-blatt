/*
 * Rechenmauer für Brett & Blatt 16 – nach packages/games/number-wall/src/rules.ts mit allen
 * Zahlenarten, 3 oder 4 Stufen und 3/5/8 Mauern; 1–6 Spieler geben nacheinander verdeckt ab.
 *
 * Zug „Abgabe“: [0, je Lücke (aufsteigend) 3 Bytes Wert, 24 Bit mit Vorzeichen]. Erlaubt ist jede
 * Abgabe wie bei isLegal (Spiel.erlaubt); die Zugliste enthält wie legalMoves die Lösung und zwei
 * knapp falsche Mauern. Zusatzzüge der Bedienung: [1, Stein, Chip] trägt einen Wert aus den
 * Auswahl-Chips ein (nur im ROM, nicht im Vergleich), und die fertig ausgefüllte Mauer als Abgabe.
 */
#include "spiel.h"
#include "bild.h"
#include "klang.h"

#define STEINE_MAX 10
#define POOL_MAX 12
#define NATUERLICH 0
#define GANZ 1
#define DEZIMAL 2
#define PRODUKT 3
#define KEIN 0xff

typedef struct {
  u8 plaetze, modus, hoehe, runden, runde, fertig;
  u16 vorgabe; /* Bit i: Stein i ist vorgegeben */
  s32 loesung[STEINE_MAX];
  u8 pool_n;
  s32 pool[POOL_MAX];
  u8 abgegeben[PLAETZE_MAX], korrekt[PLAETZE_MAX], r_punkte[PLAETZE_MAX];
  s32 abgabe[PLAETZE_MAX * STEINE_MAX];
  u16 punkte[PLAETZE_MAX];
  u8 lr_runde; /* 0 = noch keine Runde vorbei */
  u8 lr_korrekt[PLAETZE_MAX], lr_punkte[PLAETZE_MAX];
  Zufall zufall;
  /* Eingabe des Platzes am Zug – nur für die Bedienung, nicht im Vergleich. */
  u16 eingabe_maske;
  s32 eingabe[STEINE_MAX];
} Mauer;

static const u8 MUSTER_3[6][3] = {{0, 1, 2}, {0, 1, 4}, {1, 2, 3}, {0, 3, 5}, {2, 4, 5}, {1, 3, 5}};
static const u8 MUSTER_4[7][4] = {{0, 1, 2, 3}, {0, 1, 2, 6}, {1, 2, 3, 4}, {0, 1, 5, 8}, {1, 2, 4, 9}, {1, 5, 7, 9}, {2, 5, 8, 9}};
static const u8 RUNDEN[3] = {3, 5, 8};

static u8 steine(const Mauer *m) {
  return m->hoehe == 3 ? 6 : 10;
}

static u8 stein_index(u8 h, u8 zeile, u8 spalte) {
  u8 i = 0, r;
  for (r = 0; r < zeile; r++) i += h - r;
  return i + spalte;
}

static u8 vorgegeben(const Mauer *m, u8 i) {
  return (m->vorgabe >> i) & 1;
}

/* generateWall */
static void mauer_bauen(Mauer *m) {
  static s32 fehlend[STEINE_MAX];
  u8 h = m->hoehe, c, r, n = steine(m), f = 0, i, k, versuch, schon, j, ziel, d, betrag;
  u8 muster;
  s32 v, links, rechts, kandidat, t, schritt;
  Zufall *z = &m->zufall;
  for (c = 0; c < h; c++) {
    if (m->modus == NATUERLICH) v = 2 + zufall_bis(z, h == 4 ? 14 : 21);
    else if (m->modus == GANZ) {
      v = -9 + (s32)zufall_bis(z, 21);
      if (v == 0) v = 1 + zufall_bis(z, 6);
    } else if (m->modus == DEZIMAL) v = 4 + zufall_bis(z, 35);
    else v = 2 + zufall_bis(z, h == 4 ? 3 : 5);
    m->loesung[c] = v;
  }
  for (r = 1; r < h; r++) {
    for (c = 0; c < h - r; c++) {
      i = stein_index(h, r - 1, c);
      links = m->loesung[i];
      i = stein_index(h, r - 1, c + 1);
      rechts = m->loesung[i];
      i = stein_index(h, r, c);
      m->loesung[i] = m->modus == PRODUKT ? links * rechts : links + rechts;
    }
  }
  m->vorgabe = 0;
  if (h == 3) {
    muster = zufall_bis(z, 6);
    for (k = 0; k < 3; k++) m->vorgabe |= 1 << MUSTER_3[muster][k];
  } else {
    muster = zufall_bis(z, 7);
    for (k = 0; k < 4; k++) m->vorgabe |= 1 << MUSTER_4[muster][k];
  }
  // Chips: alle gesuchten Werte (ohne Doppelte) und drei Ablenker, dann aufsteigend.
  m->pool_n = 0;
  for (i = 0; i < n; i++) {
    if (vorgegeben(m, i)) continue;
    fehlend[f++] = m->loesung[i];
  }
  for (i = 0; i < f; i++) {
    schon = 0;
    for (k = 0; k < m->pool_n; k++) {
      if (m->pool[k] == fehlend[i]) schon = 1;
    }
    if (!schon) m->pool[m->pool_n++] = fehlend[i];
  }
  // (816-tcc übersetzt die Bedingung „versuch < 20 && pool_n < f + 3“ im for-Kopf falsch.)
  ziel = f + 3;
  for (versuch = 0; versuch < 20; versuch++) {
    if (m->pool_n >= ziel) break;
    t = fehlend[zufall_bis(z, f)];
    // Abstand aus [-3, -2, -1, 1, 2, 3] (ohne s8 → s32: das erweitert 816-tcc nicht richtig).
    d = zufall_bis(z, 6);
    betrag = d < 3 ? 3 - d : d - 2;
    if (m->modus == DEZIMAL) betrag *= 5;
    schritt = betrag;
    if (d < 3) schritt = -schritt;
    kandidat = t + schritt;
    if (m->modus == NATUERLICH) {
      if (kandidat <= 0) continue;
    }
    if (m->modus == PRODUKT) {
      if (kandidat <= 1) continue;
    }
    schon = 0;
    for (k = 0; k < m->pool_n; k++) {
      if (m->pool[k] == kandidat) schon = 1;
    }
    if (!schon) m->pool[m->pool_n++] = kandidat;
  }
  for (i = 1; i < m->pool_n; i++) {
    t = m->pool[i];
    j = i;
    while (j > 0) {
      if (m->pool[j - 1] <= t) break;
      m->pool[j] = m->pool[j - 1];
      j--;
    }
    m->pool[j] = t;
  }
  for (i = 0; i < PLAETZE_MAX; i++) m->abgegeben[i] = 0;
  m->eingabe_maske = 0;
}

static void mauer_aufbauen(u8 *stand, const u8 *optionen, u8 plaetze, const char *seed) {
  Mauer *m = (Mauer *)stand;
  u8 i;
  m->plaetze = plaetze;
  m->modus = optionen[0];
  m->hoehe = optionen[1] == 0 ? 3 : 4;
  m->runden = RUNDEN[optionen[2]];
  m->runde = 1;
  m->fertig = 0;
  for (i = 0; i < PLAETZE_MAX; i++) m->punkte[i] = 0;
  m->lr_runde = 0;
  zufall_strom(&m->zufall, seed, "number-wall");
  mauer_bauen(m);
}

static u8 mauer_am_zug(const u8 *stand) {
  const Mauer *m = (const Mauer *)stand;
  u8 i;
  if (m->fertig) return PLATZ_KEIN;
  for (i = 0; i < m->plaetze; i++) {
    if (!m->abgegeben[i]) return i;
  }
  return PLATZ_KEIN;
}

static u8 mauer_ergebnis(const u8 *stand, u8 *sieger) {
  const Mauer *m = (const Mauer *)stand;
  u8 i, maske = 0;
  u16 beste = 0;
  if (!m->fertig) return ERGEBNIS_LAEUFT;
  for (i = 0; i < m->plaetze; i++) {
    if (m->punkte[i] > beste) beste = m->punkte[i];
  }
  for (i = 0; i < m->plaetze; i++) {
    if (m->punkte[i] == beste) maske |= 1 << i;
  }
  if (sieger) *sieger = maske;
  return ERGEBNIS_SIEG;
}

/* Zug „Abgabe“ aus den Werten aller Steine (Vorgaben werden nicht kodiert). */
static void abgabe_zug(const Mauer *m, const s32 *werte, Zug *z) {
  u8 i, n = steine(m), k = 1;
  u32 v;
  z->b[0] = 0;
  for (i = 0; i < n; i++) {
    if (vorgegeben(m, i)) continue;
    v = (u32)werte[i];
    z->b[k++] = v & 0xff;
    z->b[k++] = (v >> 8) & 0xff;
    z->b[k++] = (v >> 16) & 0xff;
  }
  z->n = k;
}

/* Werte aller Steine aus einem Abgabe-Zug; 0, wenn er nicht passt (Länge, Betrag über 100000). */
static u8 abgabe_lesen(const Mauer *m, const Zug *z, s32 *werte) {
  u8 i, n = steine(m), k = 1;
  s32 v;
  if (z->b[0] != 0) return 0;
  for (i = 0; i < n; i++) {
    if (vorgegeben(m, i)) {
      werte[i] = m->loesung[i];
      continue;
    }
    if (k + 3 > z->n) return 0;
    v = (s32)z->b[k] | ((s32)z->b[k + 1] << 8) | ((s32)z->b[k + 2] << 16);
    if (v & 0x800000) v -= 0x1000000;
    if (v > 100000) return 0;
    if (v < -100000) return 0;
    werte[i] = v;
    k += 3;
  }
  return k == z->n;
}

static u16 mauer_zuege(const u8 *stand, Zug *zuege) {
  const Mauer *m = (const Mauer *)stand;
  static s32 werte[STEINE_MAX];
  u8 i, n = steine(m), erste = 1;
  if (mauer_am_zug(stand) == PLATZ_KEIN) return 0;
  // Lösung, die erste Lücke um eins daneben, alle Lücken um eins daneben (wie legalMoves).
  for (i = 0; i < n; i++) werte[i] = m->loesung[i];
  abgabe_zug(m, werte, &zuege[0]);
  for (i = 0; i < n; i++) {
    if (vorgegeben(m, i)) continue;
    if (erste) werte[i]++;
    erste = 0;
  }
  abgabe_zug(m, werte, &zuege[1]);
  for (i = 0; i < n; i++) werte[i] = vorgegeben(m, i) ? m->loesung[i] : m->loesung[i] + 1;
  abgabe_zug(m, werte, &zuege[2]);
  return 3;
}

static u8 mauer_erlaubt(const u8 *stand, const Zug *zug) {
  const Mauer *m = (const Mauer *)stand;
  static s32 werte[STEINE_MAX];
  u8 ok;
  if (mauer_am_zug(stand) == PLATZ_KEIN) return 0;
  ok = abgabe_lesen(m, zug, werte);
  return ok;
}

/* Alle Lücken der Eingabe gefüllt? */
static u8 eingabe_voll(const Mauer *m) {
  u8 i;
  for (i = 0; i < steine(m); i++) {
    if (vorgegeben(m, i)) continue;
    if (!((m->eingabe_maske >> i) & 1)) return 0;
  }
  return 1;
}

static u16 mauer_zusatz(const u8 *stand, Zug *zuege) {
  const Mauer *m = (const Mauer *)stand;
  u8 i, p;
  u16 k = 0;
  if (mauer_am_zug(stand) == PLATZ_KEIN) return 0;
  for (i = 0; i < steine(m); i++) {
    if (vorgegeben(m, i)) continue;
    for (p = 0; p < m->pool_n; p++) {
      zuege[k].n = 3;
      zuege[k].b[0] = 1;
      zuege[k].b[1] = i;
      zuege[k].b[2] = p;
      k++;
    }
  }
  if (eingabe_voll(m)) {
    abgabe_zug(m, m->eingabe, &zuege[k]);
    k++;
  }
  return k;
}

static u8 mauer_ziehen(u8 *stand, const Zug *zug) {
  Mauer *m = (Mauer *)stand;
  static s32 werte[STEINE_MAX];
  u8 ich = mauer_am_zug(stand), i, n = steine(m), richtig = 0, luecken = 0, p;
  if (zug->b[0] == 1) {
    m->eingabe[zug->b[1]] = m->pool[zug->b[2]];
    m->eingabe_maske |= 1 << zug->b[1];
    return KLANG_KLICK;
  }
  abgabe_lesen(m, zug, werte);
  for (i = 0; i < n; i++) {
    m->abgabe[ich * STEINE_MAX + i] = werte[i];
    if (vorgegeben(m, i)) continue;
    luecken++;
    if (werte[i] == m->loesung[i]) richtig++;
  }
  m->abgegeben[ich] = 1;
  m->korrekt[ich] = richtig;
  m->r_punkte[ich] = richtig * 2 + (richtig == luecken && luecken ? 4 : 0);
  m->eingabe_maske = 0;
  if (mauer_am_zug(stand) != PLATZ_KEIN) return KLANG_SETZEN;
  // Alle haben abgegeben: Runde werten.
  for (p = 0; p < m->plaetze; p++) {
    m->punkte[p] += m->r_punkte[p];
    m->lr_korrekt[p] = m->korrekt[p];
    m->lr_punkte[p] = m->r_punkte[p];
  }
  m->lr_runde = m->runde;
  if (m->runde >= m->runden) {
    m->fertig = 1;
    return KLANG_SIEG;
  }
  m->runde++;
  mauer_bauen(m);
  return KLANG_ENDE;
}

static u16 mauer_ausgeben(const u8 *stand, u8 *a) {
  const Mauer *m = (const Mauer *)stand;
  u16 n = 0;
  u8 i, p, k = steine(m);
  u32 v;
  a[n++] = m->plaetze;
  a[n++] = m->modus;
  a[n++] = m->hoehe;
  a[n++] = m->runden;
  a[n++] = m->runde;
  a[n++] = m->fertig;
  for (i = 0; i < k; i++) {
    a[n++] = vorgegeben(m, i);
    v = (u32)m->loesung[i];
    a[n++] = v & 0xff;
    a[n++] = (v >> 8) & 0xff;
    a[n++] = (v >> 16) & 0xff;
  }
  a[n++] = m->pool_n;
  for (i = 0; i < m->pool_n; i++) {
    v = (u32)m->pool[i];
    a[n++] = v & 0xff;
    a[n++] = (v >> 8) & 0xff;
    a[n++] = (v >> 16) & 0xff;
  }
  for (p = 0; p < m->plaetze; p++) {
    if (!m->abgegeben[p]) {
      a[n++] = KEIN;
      continue;
    }
    a[n++] = 1;
    for (i = 0; i < k; i++) {
      v = (u32)m->abgabe[p * STEINE_MAX + i];
      a[n++] = v & 0xff;
      a[n++] = (v >> 8) & 0xff;
      a[n++] = (v >> 16) & 0xff;
    }
    a[n++] = m->korrekt[p];
    a[n++] = m->r_punkte[p];
  }
  for (p = 0; p < m->plaetze; p++) {
    a[n++] = m->punkte[p] & 0xff;
    a[n++] = m->punkte[p] >> 8;
  }
  a[n++] = m->lr_runde;
  if (m->lr_runde) {
    for (p = 0; p < m->plaetze; p++) {
      a[n++] = m->lr_korrekt[p];
      a[n++] = m->lr_punkte[p];
    }
  }
  for (i = 0; i < 4; i++) {
    a[n++] = m->zufall.s[i] & 0xff;
    a[n++] = (m->zufall.s[i] >> 8) & 0xff;
    a[n++] = (m->zufall.s[i] >> 16) & 0xff;
    a[n++] = (m->zufall.s[i] >> 24) & 0xff;
  }
  return n;
}

/* ------------------------------------------------------------------ Bot */

/* Wie der „Mauerbaumeister“: schwer gibt die Lösung ab, mittel eine der ersten zwei Mauern, leicht eine der drei. */
static void mauer_bot(const u8 *stand, u8 stufe, Zufall *z, Zug *zug) {
  static Zug liste[3];
  u16 n = mauer_zuege(stand, liste);
  if (stufe == STUFE_SCHWER) *zug = liste[0];
  else if (stufe == STUFE_MITTEL) *zug = liste[zufall_bis(z, 2)];
  else *zug = liste[zufall_bis(z, n)];
}

/* ------------------------------------------------------------------ Oberfläche */

#define FELD_CHIP 20
#define FELD_ABGABE 40
#define FELD_NIE 0xfe
#define STEIN_B 7
#define CHIPS_JE_ZEILE 4

static u8 chip_zeilen(const Mauer *m) {
  return (m->pool_n + CHIPS_JE_ZEILE - 1) / CHIPS_JE_ZEILE;
}

static void mauer_gitter(const u8 *stand, u8 *b, u8 *h) {
  const Mauer *m = (const Mauer *)stand;
  *b = 4;
  *h = m->hoehe + chip_zeilen(m) + 1;
}

static u8 mauer_feld_an(const u8 *stand, u8 x, u8 y) {
  const Mauer *m = (const Mauer *)stand;
  u8 h = m->hoehe, r, i;
  if (y < h) {
    r = h - 1 - y;
    if (x >= h - r) return FELD_KEIN;
    i = stein_index(h, r, x);
    return vorgegeben(m, i) ? FELD_KEIN : i;
  }
  y -= h;
  if (y < chip_zeilen(m)) {
    i = y * CHIPS_JE_ZEILE + x;
    return i < m->pool_n ? FELD_CHIP + i : FELD_KEIN;
  }
  return x == 0 ? FELD_ABGABE : FELD_KEIN;
}

static u8 mauer_felder(const u8 *stand, const Zug *zug, u8 *felder) {
  const Mauer *m = (const Mauer *)stand;
  static Zug eigen;
  if (zug->b[0] == 1) {
    felder[0] = zug->b[1];
    felder[1] = FELD_CHIP + zug->b[2];
    return 2;
  }
  // Abgeben lässt sich nur die eigene, vollständig ausgefüllte Mauer.
  felder[0] = FELD_NIE;
  if (!eingabe_voll(m)) return 1;
  abgabe_zug(m, m->eingabe, &eigen);
  if (zug_gleich(&eigen, zug)) felder[0] = FELD_ABGABE;
  return 1;
}

/* Wert als Text (Dezimalmodus in Zehnteln). */
static void wert_text(char *t, s32 v, u8 modus) {
  char ziffern[8];
  u8 n = 0, k = 0;
  u32 b;
  if (v < 0) {
    t[k++] = '-';
    b = (u32)(-v);
  } else {
    b = (u32)v;
  }
  if (modus == DEZIMAL) {
    ziffern[n++] = '0' + (u8)(b % 10);
    ziffern[n++] = ',';
    b /= 10;
  }
  do {
    ziffern[n++] = '0' + (u8)(b % 10);
    b /= 10;
  } while (b);
  while (n) t[k++] = ziffern[--n];
  t[k] = 0;
}

static void stein_zeigen(u8 x, u8 y, const char *t, u8 pal, u8 cursor) {
  u8 l = text_laenge(t);
  kachel(x, y, cursor ? K_PFEIL : 0, PAL_GELB);
  text(x + 1 + (STEIN_B - 1 - l) / 2, y, t, pal);
}

static void mauer_zeichnen(const u8 *stand, const u8 *markierung, u8 aktiv) {
  const Mauer *m = (const Mauer *)stand;
  static char t[12];
  u8 h = m->hoehe, r, c, i, x, y, pal, p, cursor, ich = mauer_am_zug(stand);
  tafel(0, 4, 32, 22);
  flaeche_leeren(1, 5, 30, 20);
  text(1, 5, "Mauer", PAL_GRAU);
  zahl(7, 5, m->runde, 1, PAL_TEXT);
  text(8, 5, "/", PAL_GRAU);
  zahl(9, 5, m->runden, 1, PAL_TEXT);
  text(12, 5, m->modus == PRODUKT ? "Oben: Produkt" : "Oben: Summe", PAL_GRAU);
  // Die Mauer: oben die Spitze, unten die Grundreihe.
  for (r = 0; r < h; r++) {
    y = 7 + (h - 1 - r) * 2;
    for (c = 0; c < h - r; c++) {
      i = stein_index(h, r, c);
      x = 1 + (4 - h) * 3 + (r * STEIN_B) / 2 + c * STEIN_B;
      cursor = aktiv && (markierung[i] & MARK_CURSOR);
      if (vorgegeben(m, i)) {
        wert_text(t, m->loesung[i], m->modus);
        pal = PAL_TEXT;
      } else if ((m->eingabe_maske >> i) & 1) {
        wert_text(t, m->eingabe[i], m->modus);
        pal = markierung[i] & MARK_GEWAEHLT ? PAL_GELB : PAL_BLAU;
      } else {
        t[0] = '?';
        t[1] = 0;
        pal = aktiv && (markierung[i] & MARK_GEWAEHLT) ? PAL_GELB : PAL_GRAU;
      }
      stein_zeigen(x, y, t, pal, cursor);
    }
  }
  // Auswahl-Chips und Abgabe.
  y = 8 + h * 2;
  for (i = 0; i < m->pool_n; i++) {
    wert_text(t, m->pool[i], m->modus);
    pal = aktiv && (markierung[FELD_CHIP + i] & MARK_ZIEL) ? PAL_TEXT : PAL_GRAU;
    stein_zeigen(2 + (i % CHIPS_JE_ZEILE) * STEIN_B, y + (i / CHIPS_JE_ZEILE) * 2, t, pal, aktiv && (markierung[FELD_CHIP + i] & MARK_CURSOR));
  }
  y += chip_zeilen(m) * 2;
  kachel(2, y, aktiv && (markierung[FELD_ABGABE] & MARK_CURSOR) ? K_PFEIL : 0, PAL_GELB);
  text(3, y, "Abgeben", aktiv && (markierung[FELD_ABGABE] & MARK_ZIEL) ? PAL_TEXT : PAL_GRAU);
  // Punkte; wer schon abgegeben hat, ist grau.
  y = 24;
  for (p = 0; p < m->plaetze; p++) {
    x = 1 + p * 5;
    kachel(x, y, p == ich ? Z_PFEIL_RECHTS : 0, PAL_GELB);
    zahl(x + 1, y, m->punkte[p], 3, m->abgegeben[p] ? PAL_GRAU : spiel_mauer.platz_paletten[p]);
  }
}

/* ------------------------------------------------------------------ Steckbrief */

/* Wortlaut aus packages/games/number-wall/src/meta.ts (howToPlay). */
static const char *const ANLEITUNG[] = {
  "Jeder Stein der Rechenmauer ist die Summe (im Einmaleins-Modus das Produkt) der beiden Steine direkt darunter.",
  "Einige Steine sind bereits vorgegeben. Suche immer ein Dreieck aus drei Steinen, in dem schon zwei Zahlen stehen, und berechne den dritten Stein!",
  "Wähle einen leeren Stein und dann den passenden Wert aus den Auswahl-Chips.",
  "Jeder richtig berechnete Stein bringt 2 Punkte; ist die ganze Mauer fehlerfrei, gibt es 4 Bonuspunkte dazu.",
  0,
};
static const char *const PLATZ_NAMEN[] = {"Spieler 1", "Spieler 2", "Spieler 3", "Spieler 4", "Spieler 5", "Spieler 6"};
static const u8 PLATZ_PALETTEN[] = {PAL_ROT, PAL_BLAU, PAL_GELB, PAL_TEXT, PAL_GRAU, PAL_ROT};
static const char *const ZAHLEN[] = {"natürlich", "ganz (Minus)", "Dezimal", "Produkt"};
static const char *const HOEHEN[] = {"3 Stufen", "4 Stufen"};
static const char *const RUNDEN_TEXT[] = {"3 Mauern", "5 Mauern", "8 Mauern"};
static const Option OPTIONEN[] = {
  {"Zahlen", ZAHLEN, 4, 0},
  {"Höhe", HOEHEN, 2, 1},
  {"Runden", RUNDEN_TEXT, 3, 1},
};

const Spiel spiel_mauer = {
  "Rechenmauer",
  ANLEITUNG,
  "✚ Stein wählen · A · Wert wählen · A · zum Schluss „Abgeben“",
  PLATZ_NAMEN,
  PLATZ_PALETTEN,
  1,
  6,
  1,
  OPTIONEN,
  3,
  FARBEN_TTT,
  mauer_aufbauen,
  mauer_am_zug,
  mauer_zuege,
  mauer_ziehen,
  mauer_ergebnis,
  mauer_bot,
  mauer_ausgeben,
  mauer_gitter,
  mauer_feld_an,
  mauer_felder,
  mauer_zeichnen,
  0,
  0,
  mauer_zusatz,
  0,
  mauer_erlaubt,
};
