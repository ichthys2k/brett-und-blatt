/*
 * Würfelblock für Brett & Blatt 16 – nach packages/games/kniffel/src/rules.ts, 1–6 Spieler.
 * Zufall wie in der Web-App: Strom „kniffel“, je Wurf fünf Zahlen (auch für gehaltene Würfel).
 *
 * Züge: [0] würfeln, [1, Kategorie] eintragen; Zusatzzug (wie isLegal): [2, Würfel] halten/lösen.
 * Kategorien in der Reihenfolge von ALL_CATEGORIES: Einser … Sechser, Dreierpasch, Viererpasch,
 * Full House, Kleine Straße, Große Straße, Fünferpasch, Chance.
 */
#include "spiel.h"
#include "bild.h"
#include "klang.h"

#define KATEGORIEN 13
#define LEER 0xff

typedef struct {
  u8 plaetze;
  u8 zug;
  u8 eintragen; /* Phase „score“ */
  u8 wuerfe;    /* rollsLeft */
  u8 hat_wuerfel;
  u8 werte[5];
  u8 gehalten[5];
  u8 punkte[PLAETZE_MAX][KATEGORIEN];
  u8 oben[PLAETZE_MAX], bonus[PLAETZE_MAX], unten[PLAETZE_MAX];
  u16 gesamt[PLAETZE_MAX];
  u8 fertig;
  Zufall zufall;
} Kniffel;

static u8 zaehlen(const u8 *werte, u8 *anzahl) {
  u8 i, max = 0;
  for (i = 0; i <= 6; i++) anzahl[i] = 0;
  for (i = 0; i < 5; i++) anzahl[werte[i]]++;
  for (i = 1; i <= 6; i++)
    if (anzahl[i] > max) max = anzahl[i];
  return max;
}

/* Wie calculateScore. */
static u8 wertung(u8 kat, const u8 *werte) {
  u8 anzahl[7], max, i, summe = 0, drei = 0, zwei = 0;
  max = zaehlen(werte, anzahl);
  for (i = 0; i < 5; i++) summe += werte[i];
  if (kat < 6) return anzahl[kat + 1] * (kat + 1);
  switch (kat) {
    case 6: return max >= 3 ? summe : 0;
    case 7: return max >= 4 ? summe : 0;
    case 8:
      // Full House: genau eine Drei und eine Zwei (fünf gleiche zählen nicht).
      for (i = 1; i <= 6; i++) {
        if (anzahl[i] == 3) drei = 1;
        if (anzahl[i] == 2) zwei = 1;
      }
      return drei && zwei ? 25 : 0;
    case 9:
      if (anzahl[1] && anzahl[2] && anzahl[3] && anzahl[4]) return 30;
      if (anzahl[2] && anzahl[3] && anzahl[4] && anzahl[5]) return 30;
      if (anzahl[3] && anzahl[4] && anzahl[5] && anzahl[6]) return 30;
      return 0;
    case 10:
      if (anzahl[2] && anzahl[3] && anzahl[4] && anzahl[5] && (anzahl[1] || anzahl[6])) return 40;
      return 0;
    case 11: return max >= 5 ? 50 : 0;
    case 12: return summe;
  }
  return 0;
}

static void neu_rechnen(Kniffel *k, u8 p) {
  u8 i;
  u16 oben = 0, unten = 0;
  for (i = 0; i < 6; i++)
    if (k->punkte[p][i] != LEER) oben += k->punkte[p][i];
  for (i = 6; i < KATEGORIEN; i++)
    if (k->punkte[p][i] != LEER) unten += k->punkte[p][i];
  k->oben[p] = oben;
  k->bonus[p] = oben >= 63 ? 35 : 0;
  k->unten[p] = unten;
  k->gesamt[p] = oben + k->bonus[p] + unten;
}

static u8 voll(const Kniffel *k, u8 p) {
  u8 i;
  for (i = 0; i < KATEGORIEN; i++)
    if (k->punkte[p][i] == LEER) return 0;
  return 1;
}

static u8 alle_voll(const Kniffel *k) {
  u8 p;
  for (p = 0; p < k->plaetze; p++)
    if (!voll(k, p)) return 0;
  return 1;
}

static void kniffel_aufbauen(u8 *stand, const u8 *optionen, u8 plaetze, const char *seed) {
  Kniffel *k = (Kniffel *)stand;
  u8 p, i;
  (void)optionen;
  k->plaetze = plaetze < 1 ? 1 : plaetze > 6 ? 6 : plaetze;
  k->zug = 0;
  k->eintragen = 0;
  k->wuerfe = 3;
  k->hat_wuerfel = 0;
  for (i = 0; i < 5; i++) k->werte[i] = k->gehalten[i] = 0;
  for (p = 0; p < PLAETZE_MAX; p++) {
    for (i = 0; i < KATEGORIEN; i++) k->punkte[p][i] = LEER;
    k->oben[p] = k->bonus[p] = k->unten[p] = 0;
    k->gesamt[p] = 0;
  }
  k->fertig = 0;
  zufall_strom(&k->zufall, seed, "kniffel");
}

static u8 kniffel_ergebnis(const u8 *stand, u8 *sieger) {
  const Kniffel *k = (const Kniffel *)stand;
  u8 p;
  u16 max = 0;
  if (!k->fertig) {
    if (!alle_voll(k)) return ERGEBNIS_LAEUFT;
  }
  for (p = 0; p < k->plaetze; p++)
    if (k->gesamt[p] > max) max = k->gesamt[p];
  if (sieger) {
    *sieger = 0;
    for (p = 0; p < k->plaetze; p++)
      if (k->gesamt[p] == max) *sieger |= 1 << p;
  }
  return ERGEBNIS_SIEG;
}

static u8 kniffel_am_zug(const u8 *stand) {
  const Kniffel *k = (const Kniffel *)stand;
  if (kniffel_ergebnis(stand, 0) != ERGEBNIS_LAEUFT) return PLATZ_KEIN;
  return k->zug;
}

static u16 eintraege(const Kniffel *k, Zug *zuege, u16 n) {
  u8 i;
  for (i = 0; i < KATEGORIEN; i++) {
    if (k->punkte[k->zug][i] != LEER) continue;
    zuege[n].n = 2;
    zuege[n].b[0] = 1;
    zuege[n++].b[1] = i;
  }
  return n;
}

static u16 kniffel_zuege(const u8 *stand, Zug *zuege) {
  const Kniffel *k = (const Kniffel *)stand;
  u16 n = 0;
  if (kniffel_am_zug(stand) == PLATZ_KEIN) return 0;
  if (!k->eintragen && k->wuerfe > 0) {
    zuege[n].n = 1;
    zuege[n++].b[0] = 0;
    if (k->hat_wuerfel) n = eintraege(k, zuege, n);
    return n;
  }
  if (k->hat_wuerfel) n = eintraege(k, zuege, n);
  return n;
}

/* Würfel halten oder lösen – erlaubt nach einem Wurf, solange noch Würfe übrig sind. */
static u16 kniffel_zusatz(const u8 *stand, Zug *zuege) {
  const Kniffel *k = (const Kniffel *)stand;
  u8 i;
  if (kniffel_am_zug(stand) == PLATZ_KEIN) return 0;
  if (k->eintragen) return 0;
  if (k->wuerfe == 0) return 0;
  if (k->hat_wuerfel == 0) return 0;
  for (i = 0; i < 5; i++) {
    zuege[i].n = 2;
    zuege[i].b[0] = 2;
    zuege[i].b[1] = i;
  }
  return 5;
}

static u8 kniffel_ziehen(u8 *stand, const Zug *zug) {
  Kniffel *k = (Kniffel *)stand;
  u8 i, w;
  if (zug->b[0] == 0) {
    for (i = 0; i < 5; i++) {
      w = zufall_bis(&k->zufall, 6) + 1;
      // Ohne `||`: 816-tcc übersetzte `!a || !b[i]` hier falsch.
      if (!k->hat_wuerfel) k->werte[i] = w;
      else if (!k->gehalten[i]) k->werte[i] = w;
    }
    if (!k->hat_wuerfel)
      for (i = 0; i < 5; i++) k->gehalten[i] = 0;
    k->hat_wuerfel = 1;
    k->wuerfe--;
    k->eintragen = k->wuerfe == 0;
    return KLANG_SETZEN;
  }
  if (zug->b[0] == 2) {
    k->gehalten[zug->b[1]] ^= 1;
    return KLANG_KLICK;
  }
  k->punkte[k->zug][zug->b[1]] = wertung(zug->b[1], k->werte);
  neu_rechnen(k, k->zug);
  k->zug = (k->zug + 1) % k->plaetze;
  k->eintragen = 0;
  k->wuerfe = 3;
  k->hat_wuerfel = 0;
  for (i = 0; i < 5; i++) k->werte[i] = k->gehalten[i] = 0;
  k->fertig = alle_voll(k);
  return KLANG_ENDE;
}

static u16 kniffel_ausgeben(const u8 *stand, u8 *p) {
  const Kniffel *k = (const Kniffel *)stand;
  u16 n = 0;
  u8 i, s;
  p[n++] = k->plaetze;
  p[n++] = k->zug;
  p[n++] = k->eintragen;
  p[n++] = k->wuerfe;
  p[n++] = k->hat_wuerfel;
  for (i = 0; i < 5; i++) p[n++] = k->werte[i];
  for (i = 0; i < 5; i++) p[n++] = k->gehalten[i];
  for (s = 0; s < k->plaetze; s++) {
    for (i = 0; i < KATEGORIEN; i++) p[n++] = k->punkte[s][i];
    p[n++] = k->oben[s];
    p[n++] = k->bonus[s];
    p[n++] = k->unten[s];
    p[n++] = k->gesamt[s] & 0xff;
    p[n++] = k->gesamt[s] >> 8;
  }
  p[n++] = k->fertig;
  for (i = 0; i < 4; i++) {
    p[n++] = k->zufall.s[i] & 0xff;
    p[n++] = (k->zufall.s[i] >> 8) & 0xff;
    p[n++] = (k->zufall.s[i] >> 16) & 0xff;
    p[n++] = (k->zufall.s[i] >> 24) & 0xff;
  }
  return n;
}

/* ------------------------------------------------------------------ Bot */

/*
 * Faustregeln statt Suche: Nach jedem Wurf wird ein Ziel gewählt (Straße, Pasch oder Wert),
 * die passenden Würfel werden einzeln gehalten, der Rest neu geworfen. Eingetragen wird, wo die
 * Punkte im Verhältnis zum Erwartbaren am besten sind; Nullen landen zuerst auf Einsern oder
 * dem Fünferpasch.
 */
static const u8 ERWARTET[KATEGORIEN] = {2, 5, 8, 12, 15, 19, 15, 8, 9, 15, 10, 8, 22};

static s16 eintrag_wert(const Kniffel *k, u8 kat, u8 stufe) {
  u8 w = wertung(kat, k->werte);
  s16 wert = (s16)w * 4 - (s16)ERWARTET[kat] * (stufe == STUFE_LEICHT ? 0 : 3);
  u8 oben = k->oben[k->zug];
  // Oben: Drei gleiche oder mehr bringen dem Bonus näher.
  if (kat < 6 && stufe == STUFE_SCHWER && oben < 63 && w >= (kat + 1) * 3) wert += 20;
  if (w == 0) {
    // Nullen lieber auf schwache Felder.
    if (kat == 0) wert += 30;
    if (kat == 11) wert += 15;
  }
  return wert;
}

static u8 beste_kategorie(const Kniffel *k, u8 stufe, s16 *wert) {
  u8 i, beste = 0;
  s16 w, max = -30000;
  for (i = 0; i < KATEGORIEN; i++) {
    if (k->punkte[k->zug][i] != LEER) continue;
    w = eintrag_wert(k, i, stufe);
    if (w > max) {
      max = w;
      beste = i;
    }
  }
  *wert = max;
  return beste;
}

/* Welche Würfel behalten? Bitmaske über die fünf Würfel. */
static u8 behalten(const Kniffel *k) {
  u8 anzahl[7], max, i, wert = 0, maske = 0, gesehen = 0;
  const u8 *frei = k->punkte[k->zug];
  max = zaehlen(k->werte, anzahl);
  // Straße: vier verschiedene in Folge behalten, wenn eine Straße noch frei ist.
  if ((frei[9] == LEER || frei[10] == LEER) && max <= 2) {
    for (i = 1; i <= 3; i++) {
      if (anzahl[i] && anzahl[i + 1] && anzahl[i + 2] && anzahl[i + 3]) {
        for (wert = 0; wert < 5; wert++) {
          u8 v = k->werte[wert];
          if (v >= i && v <= i + 3 && !(gesehen & (1 << v))) {
            maske |= 1 << wert;
            gesehen |= 1 << v;
          }
        }
        return maske;
      }
    }
  }
  // Sonst die häufigste (bei Gleichstand höchste) Zahl.
  for (i = 6; i >= 1; i--) {
    if (anzahl[i] == max) {
      wert = i;
      break;
    }
  }
  if (max < 2 && wert < 5) return 0;
  for (i = 0; i < 5; i++)
    if (k->werte[i] == wert) maske |= 1 << i;
  return maske;
}

static void kniffel_bot(const u8 *stand, u8 stufe, Zufall *z, Zug *zug) {
  const Kniffel *k = (const Kniffel *)stand;
  u8 kat, maske, i;
  s16 wert;
  if (!k->hat_wuerfel) {
    zug->n = 1;
    zug->b[0] = 0;
    return;
  }
  kat = beste_kategorie(k, stufe, &wert);
  // Eintragen, wenn keine Würfe mehr übrig sind oder das Ergebnis schon gut ist.
  if (k->eintragen || k->wuerfe == 0 || wert >= (stufe == STUFE_LEICHT ? 20 : 60)) {
    zug->n = 2;
    zug->b[0] = 1;
    zug->b[1] = kat;
    return;
  }
  maske = behalten(k);
  if (stufe == STUFE_LEICHT) {
    if (zufall_halb(z)) maske = 0;
  }
  // Einen Würfel nach dem anderen halten oder lösen, dann würfeln.
  for (i = 0; i < 5; i++) {
    if (k->gehalten[i] == ((maske >> i) & 1)) continue;
    zug->n = 2;
    zug->b[0] = 2;
    zug->b[1] = i;
    return;
  }
  zug->n = 1;
  zug->b[0] = 0;
}

/* ------------------------------------------------------------------ Oberfläche */

static const char *const KAT_NAMEN[KATEGORIEN] = {
  "Einser", "Zweier", "Dreier", "Vierer", "Fünfer", "Sechser", "Dreierpasch", "Viererpasch", "Full House", "Kl. Straße", "Gr. Straße", "Fünferpasch", "Chance",
};
static const u16 WUERFEL_BILD[7] = {KARTE_WUERFEL_LEER, KARTE_WUERFEL_1, KARTE_WUERFEL_2, KARTE_WUERFEL_3, KARTE_WUERFEL_4, KARTE_WUERFEL_5, KARTE_WUERFEL_6};

#define FELD_WURF 5
#define FELD_KAT 10

static void kniffel_gitter(const u8 *stand, u8 *b, u8 *h) {
  (void)stand;
  *b = 6;
  *h = 1 + KATEGORIEN;
}

static u8 kniffel_feld_an(const u8 *stand, u8 x, u8 y) {
  (void)stand;
  if (y == 0) return x;
  return x == 0 ? FELD_KAT + y - 1 : FELD_KEIN;
}

static u8 kniffel_felder(const u8 *stand, const Zug *zug, u8 *felder) {
  (void)stand;
  if (zug->b[0] == 0) felder[0] = FELD_WURF;
  else if (zug->b[0] == 2) felder[0] = zug->b[1];
  else felder[0] = FELD_KAT + zug->b[1];
  return 1;
}

/* Zeile der Kategorie auf dem Bildschirm (mit Bonuszeile nach den oberen sechs). */
static u8 kat_zeile(u8 kat) {
  return kat < 6 ? 8 + kat : 9 + kat;
}

static void kniffel_zeichnen(const u8 *stand, const u8 *markierung, u8 aktiv) {
  const Kniffel *k = (const Kniffel *)stand;
  u8 i, p, x, y, pal, wert;
  tafel(0, 3, 32, 21);
  // Würfel und Knopf „Würfeln“.
  for (i = 0; i < 5; i++) {
    pal = PAL_BRETT;
    if (k->gehalten[i]) pal = PAL_BRETT_MARKE;
    if (aktiv && (markierung[i] & MARK_CURSOR)) pal = PAL_BRETT_AUSWAHL;
    karte(3 + i * 3, 4, WUERFEL_BILD[k->hat_wuerfel ? k->werte[i] : 0], 2, 2, pal);
  }
  flaeche_leeren(18, 4, 13, 2);
  kachel(18, 4, aktiv && (markierung[FELD_WURF] & MARK_CURSOR) ? K_PFEIL : 0, PAL_GELB);
  text(20, 4, "Würfeln", k->wuerfe && !k->eintragen ? PAL_TEXT : PAL_GRAU);
  zahl(28, 4, k->wuerfe, 1, PAL_GELB);
  if (k->hat_wuerfel) text(20, 5, "Grün: hält", PAL_GRAU);
  // Kopf der Tafel: Spielernummern, der Spieler am Zug gelb.
  flaeche_leeren(1, 7, 30, 1);
  for (p = 0; p < k->plaetze; p++) zahl(14 + p * 3, 7, p + 1, 2, p == k->zug ? PAL_GELB : PAL_GRAU);
  for (i = 0; i < KATEGORIEN; i++) {
    y = kat_zeile(i);
    flaeche_leeren(0, y, 32, 1);
    kachel(0, y, aktiv && (markierung[FELD_KAT + i] & MARK_CURSOR) ? K_PFEIL : 0, PAL_GELB);
    text(1, y, KAT_NAMEN[i], aktiv && (markierung[FELD_KAT + i] & MARK_ZIEL) ? PAL_TEXT : PAL_GRAU);
    for (p = 0; p < k->plaetze; p++) {
      x = 13 + p * 3;
      if (k->punkte[p][i] != LEER) zahl(x, y, k->punkte[p][i], 3, PAL_TEXT);
      else if (p == k->zug && k->hat_wuerfel) {
        // Was dieser Wurf hier brächte.
        wert = wertung(i, k->werte);
        zahl(x, y, wert, 3, PAL_GELB);
      }
    }
  }
  y = 14;
  flaeche_leeren(0, y, 32, 1);
  text(1, y, "Bonus", PAL_GRAU);
  for (p = 0; p < k->plaetze; p++) zahl(13 + p * 3, y, k->bonus[p], 3, PAL_GRAU);
  y = 22;
  flaeche_leeren(0, y, 32, 1);
  text(1, y, "Summe", PAL_GELB);
  for (p = 0; p < k->plaetze; p++) zahl(13 + p * 3, y, k->gesamt[p], 3, PAL_GELB);
}

/* ------------------------------------------------------------------ Steckbrief */

/* Wortlaut aus packages/games/kniffel/src/meta.ts (howToPlay). */
static const char *const ANLEITUNG[] = {
  "Pro Runde hast du bis zu drei Würfe. Du kannst nach jedem Wurf Würfel zum Beiseitelegen auswählen.",
  "Trage das Ergebnis nach dem letzten oder einem früheren Wurf in eine freie Kategorie der Wertungstafel ein.",
  "Obere Sektion: Einser bis Sechser. Erreichst du dort mindestens 63 Punkte, gibt es einen Bonus von 35 Punkten.",
  "Untere Sektion: Dreierpasch, Viererpasch, Full House (25), Kleine Straße (30), Große Straße (40), Fünferpasch (fünf gleiche, 50) und Chance.",
  "Wer nach 13 Runden die höchste Gesamtpunktzahl hat, gewinnt.",
  0,
};
static const char *const PLATZ_NAMEN[] = {"Spieler 1", "Spieler 2", "Spieler 3", "Spieler 4", "Spieler 5", "Spieler 6"};
static const u8 PLATZ_PALETTEN[] = {PAL_ROT, PAL_BLAU, PAL_GELB, PAL_TEXT, PAL_GRAU, PAL_ROT};

const Spiel spiel_kniffel = {
  "Würfelblock",
  ANLEITUNG,
  "Oben: A auf einen Würfel hält oder löst ihn, A auf „Würfeln“ wirft. Unten: A trägt in die Kategorie ein.",
  PLATZ_NAMEN,
  PLATZ_PALETTEN,
  1,
  6,
  0,
  0,
  0,
  FARBEN_WUERFEL,
  kniffel_aufbauen,
  kniffel_am_zug,
  kniffel_zuege,
  kniffel_ziehen,
  kniffel_ergebnis,
  kniffel_bot,
  kniffel_ausgeben,
  kniffel_gitter,
  kniffel_feld_an,
  kniffel_felder,
  kniffel_zeichnen,
  5,
  0,
  kniffel_zusatz,
};
