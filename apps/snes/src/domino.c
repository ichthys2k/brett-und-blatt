/*
 * Domino für Brett & Blatt 16 – nach packages/games/dominoes/src/rules.ts: Block-, Zieh- und
 * Fünfer-Domino (mit Spinner), Doppel-6/9/12, Teams zu viert, Zielpunkte; 2–4 Spieler.
 * Mexican Train und die Rechenterm-Anzeige gibt es nur in der Web-App.
 *
 * Zug: [0, Stein, Ende] legen (Ende 0 links, 1 rechts, 2 oben, 3 unten), [1] ziehen, [2] passen.
 */
#include "spiel.h"
#include "bild.h"
#include "klang.h"

#define STEINE 91
#define KEIN 0xff
#define BLOCK 0
#define ZIEHEN 1
#define FUENFER 2

static const u8 STEIN_A[91] = {0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 5, 5, 6, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 9, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 8, 9, 9, 9, 10, 10, 10, 11, 11, 12};
static const u8 STEIN_B[91] = {0, 1, 2, 3, 4, 5, 6, 1, 2, 3, 4, 5, 6, 2, 3, 4, 5, 6, 3, 4, 5, 6, 4, 5, 6, 5, 6, 6, 7, 8, 9, 7, 8, 9, 7, 8, 9, 7, 8, 9, 7, 8, 9, 7, 8, 9, 7, 8, 9, 7, 8, 9, 8, 9, 9, 10, 11, 12, 10, 11, 12, 10, 11, 12, 10, 11, 12, 10, 11, 12, 10, 11, 12, 10, 11, 12, 10, 11, 12, 10, 11, 12, 10, 11, 12, 10, 11, 12, 11, 12, 12};

typedef struct {
  u8 plaetze, variante, spinner, teams, satz;
  u16 ziel;
  u8 runde;
  u8 kette_n, kette[STEINE], k_links[STEINE], k_rechts[STEINE];
  u8 spinner_i; /* KEIN = keiner */
  u8 oben_n, oben[STEINE], o_rechts[STEINE];
  u8 unten_n, unten[STEINE], u_rechts[STEINE];
  u8 hand_n[4], hand[4 * STEINE];
  u8 vorrat_n, vorrat[STEINE];
  u16 punkte[4];
  u8 zug, eroeffnung, passen;
  u16 fehlt[4]; /* Bitmaske der Augenzahlen, die ein Platz nicht bedienen konnte */
  u8 l_platz, l_stein, l_ende; /* lastPlayed, l_platz = KEIN: keiner */
  u16 l_punkte;
  u8 r_runde, r_sieger, r_blockiert; /* lastRound, r_runde = 0: keine */
  u16 r_punkte;
  u8 vorbei;
  Zufall zufall;
} Domino;

static const u16 ZIELE[4] = {50, 100, 150, 250};
static const u8 SAETZE[3] = {6, 9, 12};

static u8 augen(u8 s) {
  return STEIN_A[s] + STEIN_B[s];
}

static u8 pasch(u8 s) {
  return STEIN_A[s] == STEIN_B[s];
}

static u8 anzahl_steine(u8 satz) {
  return (u8)(((u16)(satz + 1) * (satz + 2)) / 2);
}

static u8 hand_groesse(const Domino *d) {
  if (d->satz == 9) return d->plaetze == 2 ? 9 : 7;
  if (d->satz == 12) return d->plaetze == 2 ? 12 : 9;
  if (d->variante == BLOCK) return 7;
  return d->plaetze == 2 ? 7 : 5;
}

static u8 stein_von(u8 a, u8 b) {
  u8 i, lo = a < b ? a : b, hi = a < b ? b : a;
  for (i = 0; i < STEINE; i++) {
    if (STEIN_A[i] == lo && STEIN_B[i] == hi) return i;
  }
  return KEIN;
}

/* Sortiert eine Hand aufsteigend (Einfügen). */
static void sortieren(u8 *h, u8 n) {
  u8 i, j, t;
  for (i = 1; i < n; i++) {
    t = h[i];
    j = i;
    while (j > 0 && h[j - 1] > t) {
      h[j] = h[j - 1];
      j--;
    }
    h[j] = t;
  }
}

static u16 rang(u8 s) {
  return (pasch(s) ? 1000 : 0) + augen(s) * 20 + STEIN_B[s];
}

/* deal(): mischen, austeilen (vom Ende des Stapels), höchsten Pasch suchen. */
static void austeilen(Domino *d) {
  u8 i, j, t, n = anzahl_steine(d->satz), g = hand_groesse(d), p;
  u16 r, beste;
  for (i = 0; i < n; i++) d->vorrat[i] = i;
  for (i = n - 1; i > 0; i--) {
    j = zufall_bis(&d->zufall, i + 1);
    t = d->vorrat[i];
    d->vorrat[i] = d->vorrat[j];
    d->vorrat[j] = t;
  }
  d->vorrat_n = n;
  for (p = 0; p < d->plaetze; p++) {
    for (i = 0; i < g; i++) d->hand[p * STEINE + i] = d->vorrat[d->vorrat_n - g + i];
    d->vorrat_n -= g;
    d->hand_n[p] = g;
    sortieren(&d->hand[p * STEINE], g);
  }
  d->eroeffnung = d->hand[0];
  d->zug = 0;
  beste = rang(d->eroeffnung);
  for (p = 0; p < d->plaetze; p++) {
    for (i = 0; i < g; i++) {
      r = rang(d->hand[p * STEINE + i]);
      if (r > beste) {
        beste = r;
        d->eroeffnung = d->hand[p * STEINE + i];
        d->zug = p;
      }
    }
  }
  d->kette_n = 0;
  d->spinner_i = KEIN;
  d->oben_n = 0;
  d->unten_n = 0;
  d->passen = 0;
  for (p = 0; p < 4; p++) d->fehlt[p] = 0;
  d->l_platz = KEIN;
}

static void domino_aufbauen(u8 *stand, const u8 *optionen, u8 plaetze, const char *seed) {
  Domino *d = (Domino *)stand;
  u8 i;
  d->plaetze = plaetze;
  d->variante = optionen[0];
  d->satz = SAETZE[optionen[1]];
  d->teams = plaetze == 4 && optionen[2] == 1;
  d->ziel = ZIELE[optionen[3]];
  d->spinner = d->variante == FUENFER && optionen[4] == 1;
  d->runde = 1;
  for (i = 0; i < 4; i++) d->punkte[i] = 0;
  d->r_runde = 0;
  d->r_sieger = KEIN;
  d->r_blockiert = 0;
  d->r_punkte = 0;
  d->vorbei = 0;
  zufall_strom(&d->zufall, seed, "mischen");
  austeilen(d);
}

static u8 spinner_offen(const Domino *d) {
  if (!d->spinner) return 0;
  if (d->spinner_i == KEIN) return 0;
  if (d->spinner_i == 0) return 0;
  return d->spinner_i < d->kette_n - 1;
}

/* Offene Enden: Werte nach w[0..3], gibt die Zahl der Enden (2 oder 4) zurück; 0 bei leerer Kette. */
static u8 enden(const Domino *d, u8 *w) {
  u8 s;
  if (!d->kette_n) return 0;
  w[0] = d->k_links[0];
  w[1] = d->k_rechts[d->kette_n - 1];
  if (!spinner_offen(d)) return 2;
  s = d->k_links[d->spinner_i];
  w[2] = d->oben_n ? d->o_rechts[d->oben_n - 1] : s;
  w[3] = d->unten_n ? d->u_rechts[d->unten_n - 1] : s;
  return 4;
}

static u8 passt(u8 s, u8 w) {
  if (STEIN_A[s] == w) return 1;
  return STEIN_B[s] == w;
}

/* playsFor: alle Legezüge des Platzes am Zug. */
static u16 legezuege(const Domino *d, Zug *z) {
  u8 i, s, w[4], e, p = d->zug;
  u16 k = 0;
  if (!d->kette_n) {
    for (i = 0; i < d->hand_n[p]; i++) {
      if (d->hand[p * STEINE + i] == d->eroeffnung) {
        z[0].n = 3;
        z[0].b[0] = 0;
        z[0].b[1] = d->eroeffnung;
        z[0].b[2] = 1;
        return 1;
      }
    }
    for (i = 0; i < d->hand_n[p]; i++) {
      z[k].n = 3;
      z[k].b[0] = 0;
      z[k].b[1] = d->hand[p * STEINE + i];
      z[k].b[2] = 1;
      k++;
    }
    return k;
  }
  e = enden(d, w);
  for (i = 0; i < d->hand_n[p]; i++) {
    s = d->hand[p * STEINE + i];
    if (passt(s, w[0])) {
      z[k].n = 3;
      z[k].b[0] = 0;
      z[k].b[1] = s;
      z[k].b[2] = 0;
      k++;
    }
    if (passt(s, w[1]) && w[0] != w[1]) {
      z[k].n = 3;
      z[k].b[0] = 0;
      z[k].b[1] = s;
      z[k].b[2] = 1;
      k++;
    }
    if (e == 4) {
      if (passt(s, w[2])) {
        z[k].n = 3;
        z[k].b[0] = 0;
        z[k].b[1] = s;
        z[k].b[2] = 2;
        k++;
      }
      if (passt(s, w[3])) {
        z[k].n = 3;
        z[k].b[0] = 0;
        z[k].b[1] = s;
        z[k].b[2] = 3;
        k++;
      }
    }
  }
  return k;
}

static u8 domino_ergebnis(const u8 *stand, u8 *sieger) {
  const Domino *d = (const Domino *)stand;
  u8 i, maske = 0, n = 0;
  u16 beste = 0;
  if (!d->vorbei) return ERGEBNIS_LAEUFT;
  for (i = 0; i < d->plaetze; i++) {
    if (d->punkte[i] > beste) beste = d->punkte[i];
  }
  for (i = 0; i < d->plaetze; i++) {
    if (d->punkte[i] != beste) continue;
    maske |= 1 << i;
    n++;
  }
  if (n == d->plaetze) return ERGEBNIS_REMIS;
  if (sieger) *sieger = maske;
  return ERGEBNIS_SIEG;
}

static u8 domino_am_zug(const u8 *stand) {
  const Domino *d = (const Domino *)stand;
  return d->vorbei ? PLATZ_KEIN : d->zug;
}

static u16 domino_zuege(const u8 *stand, Zug *z) {
  const Domino *d = (const Domino *)stand;
  u16 k;
  if (d->vorbei) return 0;
  k = legezuege(d, z);
  if (k) return k;
  z[0].n = 1;
  z[0].b[0] = d->variante != BLOCK && d->vorrat_n ? 1 : 2;
  return 1;
}

static void punkte_geben(Domino *d, u8 platz, u16 p) {
  d->punkte[platz] += p;
  if (d->teams) d->punkte[(platz + 2) % 4] += p;
}

static u16 rest(const Domino *d, u8 p) {
  u16 r = 0;
  u8 i;
  for (i = 0; i < d->hand_n[p]; i++) r += augen(d->hand[p * STEINE + i]);
  return r;
}

static void runde_beenden(Domino *d, u8 sieger, u8 blockiert) {
  u16 punkte = 0, m;
  u8 p, i;
  if (sieger != KEIN) {
    for (p = 0; p < d->plaetze; p++) {
      if (p == sieger) continue;
      if (d->teams && p == (sieger + 2) % 4) continue;
      punkte += rest(d, p);
    }
    if (d->variante == FUENFER) {
      m = punkte % 5;
      punkte -= m;
      if (m >= 3) punkte += 5;
    }
    punkte_geben(d, sieger, punkte);
  }
  d->r_runde = d->runde;
  d->r_sieger = sieger;
  d->r_punkte = punkte;
  d->r_blockiert = blockiert;
  for (i = 0; i < d->plaetze; i++) {
    if (d->punkte[i] >= d->ziel) {
      d->vorbei = 1;
      return;
    }
  }
  d->runde++;
  austeilen(d);
}

static void fehlt_merken(Domino *d, u8 p) {
  u8 w[4], e = enden(d, w), i;
  for (i = 0; i < e; i++) d->fehlt[p] |= 1 << w[i];
}

static u16 enden_summe(const Domino *d) {
  u16 sum;
  u8 s;
  if (!d->kette_n) return 0;
  if (d->kette_n == 1) return augen(d->kette[0]);
  sum = (pasch(d->kette[0]) ? 2 : 1) * d->k_links[0];
  sum += (pasch(d->kette[d->kette_n - 1]) ? 2 : 1) * d->k_rechts[d->kette_n - 1];
  if (spinner_offen(d)) {
    s = d->k_links[d->spinner_i];
    if (!d->oben_n) sum += s;
    else sum += (pasch(d->oben[d->oben_n - 1]) ? 2 : 1) * d->o_rechts[d->oben_n - 1];
    if (!d->unten_n) sum += s;
    else sum += (pasch(d->unten[d->unten_n - 1]) ? 2 : 1) * d->u_rechts[d->unten_n - 1];
  }
  return sum;
}

static u8 domino_ziehen(u8 *stand, const Zug *zug) {
  Domino *d = (Domino *)stand;
  u8 p = d->zug, s, a, b, w, i, k, ende, kleinste, anzahl;
  u16 sum, gewertet = 0, r, tief;
  if (zug->b[0] == 1) {
    s = d->vorrat[--d->vorrat_n];
    d->hand[p * STEINE + d->hand_n[p]] = s;
    d->hand_n[p]++;
    sortieren(&d->hand[p * STEINE], d->hand_n[p]);
    fehlt_merken(d, p);
    return KLANG_KLICK;
  }
  if (zug->b[0] == 2) {
    fehlt_merken(d, p);
    d->zug = (p + 1) % d->plaetze;
    d->passen++;
    if (d->passen >= d->plaetze) {
      if (d->teams) {
        r = rest(d, 0) + rest(d, 2);
        tief = rest(d, 1) + rest(d, 3);
        runde_beenden(d, r < tief ? 0 : tief < r ? 1 : KEIN, 1);
      } else {
        tief = 0xffff;
        for (i = 0; i < d->plaetze; i++) {
          r = rest(d, i);
          if (r < tief) tief = r;
        }
        anzahl = 0;
        kleinste = KEIN;
        for (i = 0; i < d->plaetze; i++) {
          if (rest(d, i) != tief) continue;
          anzahl++;
          kleinste = i;
        }
        runde_beenden(d, anzahl == 1 ? kleinste : KEIN, 1);
      }
      return KLANG_ENDE;
    }
    return KLANG_KLICK;
  }
  s = zug->b[1];
  ende = zug->b[2];
  a = STEIN_A[s];
  b = STEIN_B[s];
  if (ende == 2) {
    w = d->oben_n ? d->o_rechts[d->oben_n - 1] : d->k_links[d->spinner_i];
    d->oben[d->oben_n] = s;
    d->o_rechts[d->oben_n] = a == w ? b : a;
    d->oben_n++;
  } else if (ende == 3) {
    w = d->unten_n ? d->u_rechts[d->unten_n - 1] : d->k_links[d->spinner_i];
    d->unten[d->unten_n] = s;
    d->u_rechts[d->unten_n] = a == w ? b : a;
    d->unten_n++;
  } else if (!d->kette_n) {
    d->kette[0] = s;
    d->k_links[0] = a;
    d->k_rechts[0] = b;
    d->kette_n = 1;
    if (d->spinner && pasch(s)) d->spinner_i = 0;
  } else if (ende == 0) {
    w = d->k_links[0];
    for (i = d->kette_n; i > 0; i--) {
      d->kette[i] = d->kette[i - 1];
      d->k_links[i] = d->k_links[i - 1];
      d->k_rechts[i] = d->k_rechts[i - 1];
    }
    d->kette[0] = s;
    d->k_links[0] = b == w ? a : b;
    d->k_rechts[0] = w;
    d->kette_n++;
    if (d->spinner_i != KEIN) d->spinner_i++;
    else if (d->spinner && pasch(s)) d->spinner_i = 0;
  } else {
    w = d->k_rechts[d->kette_n - 1];
    k = d->kette_n;
    d->kette[k] = s;
    d->k_links[k] = w;
    d->k_rechts[k] = a == w ? b : a;
    d->kette_n++;
    if (d->spinner && pasch(s) && d->spinner_i == KEIN) d->spinner_i = k;
  }
  // Stein aus der Hand nehmen.
  k = 0;
  for (i = 0; i < d->hand_n[p]; i++) {
    if (d->hand[p * STEINE + i] != s) d->hand[p * STEINE + k++] = d->hand[p * STEINE + i];
  }
  d->hand_n[p] = k;
  if (d->variante == FUENFER) {
    sum = enden_summe(d);
    if (sum > 0 && sum % 5 == 0) gewertet = sum;
    punkte_geben(d, p, gewertet);
  }
  d->zug = (p + 1) % d->plaetze;
  d->eroeffnung = KEIN;
  d->passen = 0;
  d->l_platz = p;
  d->l_stein = s;
  d->l_ende = ende;
  d->l_punkte = gewertet;
  if (d->punkte[p] >= d->ziel) {
    d->vorbei = 1;
    return KLANG_SIEG;
  }
  if (!d->hand_n[p]) {
    runde_beenden(d, p, 0);
    return KLANG_ENDE;
  }
  return gewertet ? KLANG_ENDE : KLANG_SETZEN;
}

static u16 domino_ausgeben(const u8 *stand, u8 *a) {
  const Domino *d = (const Domino *)stand;
  u16 n = 0;
  u8 i, p;
  a[n++] = d->plaetze;
  a[n++] = d->variante;
  a[n++] = d->spinner;
  a[n++] = d->teams;
  a[n++] = d->satz;
  a[n++] = d->ziel & 0xff;
  a[n++] = d->ziel >> 8;
  a[n++] = d->runde;
  a[n++] = d->kette_n;
  for (i = 0; i < d->kette_n; i++) {
    a[n++] = d->kette[i];
    a[n++] = d->k_links[i];
    a[n++] = d->k_rechts[i];
  }
  a[n++] = d->spinner_i;
  a[n++] = d->oben_n;
  for (i = 0; i < d->oben_n; i++) {
    a[n++] = d->oben[i];
    a[n++] = d->o_rechts[i];
  }
  a[n++] = d->unten_n;
  for (i = 0; i < d->unten_n; i++) {
    a[n++] = d->unten[i];
    a[n++] = d->u_rechts[i];
  }
  for (p = 0; p < d->plaetze; p++) {
    a[n++] = d->hand_n[p];
    for (i = 0; i < d->hand_n[p]; i++) a[n++] = d->hand[p * STEINE + i];
  }
  a[n++] = d->vorrat_n;
  for (i = 0; i < d->vorrat_n; i++) a[n++] = d->vorrat[i];
  for (p = 0; p < d->plaetze; p++) {
    a[n++] = d->punkte[p] & 0xff;
    a[n++] = d->punkte[p] >> 8;
  }
  a[n++] = d->zug;
  a[n++] = d->eroeffnung;
  a[n++] = d->passen;
  for (p = 0; p < d->plaetze; p++) {
    for (i = 0; i <= 12; i++) {
      if (d->fehlt[p] & (1 << i)) a[n++] = i;
    }
    a[n++] = KEIN;
  }
  a[n++] = d->l_platz;
  if (d->l_platz != KEIN) {
    a[n++] = d->l_stein;
    a[n++] = d->l_ende;
    a[n++] = d->l_punkte & 0xff;
    a[n++] = d->l_punkte >> 8;
  }
  a[n++] = d->r_runde;
  if (d->r_runde) {
    a[n++] = d->r_sieger;
    a[n++] = d->r_punkte & 0xff;
    a[n++] = d->r_punkte >> 8;
    a[n++] = d->r_blockiert;
  }
  a[n++] = d->vorbei;
  for (i = 0; i < 4; i++) {
    a[n++] = d->zufall.s[i] & 0xff;
    a[n++] = (d->zufall.s[i] >> 8) & 0xff;
    a[n++] = (d->zufall.s[i] >> 16) & 0xff;
    a[n++] = (d->zufall.s[i] >> 24) & 0xff;
  }
  return n;
}

/* ------------------------------------------------------------------ Bot */

/*
 * Wie der Domino-Bot der Web-App ohne Stichproben: „leicht“ legt irgendeinen passenden Stein,
 * „mittel“ nimmt Fünfer-Punkte und sonst den schwersten Stein, „schwer“ wertet zusätzlich Pasche,
 * offen gehaltene eigene Zahlen und Zahlen, die dem Nächsten fehlen. Probezüge laufen auf einer
 * Kopie in Bank $7F (ram.asm).
 */
extern u8 domino_probe[];
/* domino_probe in ram.asm muss den Spielstand fassen. */
typedef char domino_passt[sizeof(Domino) <= 1536 ? 1 : -1];

static void kopieren(u8 *ziel, const u8 *quelle) {
  u16 i;
  for (i = 0; i < sizeof(Domino); i++) ziel[i] = quelle[i];
}

static void domino_bot(const u8 *stand, u8 stufe, Zufall *z, Zug *zug) {
  const Domino *d = (const Domino *)stand;
  Domino *p = (Domino *)domino_probe;
  static Zug liste[64];
  u16 n = legezuege(d, liste), i, beste = 0;
  u8 ich = d->zug, naechster = (d->zug + 1) % d->plaetze, s, j, l, r, halten, sperrt;
  s16 wert, bester = -32000, sofort;
  if (!n) {
    zug->n = 1;
    zug->b[0] = d->variante != BLOCK && d->vorrat_n ? 1 : 2;
    return;
  }
  if (stufe == STUFE_LEICHT) {
    *zug = liste[zufall_bis(z, n)];
    return;
  }
  for (i = 0; i < n; i++) {
    kopieren(domino_probe, stand);
    domino_ziehen(domino_probe, &liste[i]);
    s = liste[i].b[1];
    sofort = 0;
    if (d->variante == FUENFER && p->runde == d->runde) sofort = p->l_punkte;
    if (stufe == STUFE_MITTEL) {
      wert = sofort * 10 + augen(s);
    } else if (p->runde != d->runde || p->vorbei) {
      wert = 1000 + sofort;
    } else {
      l = p->k_links[0];
      r = p->k_rechts[p->kette_n - 1];
      halten = 0;
      for (j = 0; j < p->hand_n[ich]; j++) {
        if (passt(p->hand[ich * STEINE + j], l)) halten++;
        else if (passt(p->hand[ich * STEINE + j], r)) halten++;
      }
      sperrt = 0;
      if (d->fehlt[naechster] & (1 << l)) sperrt++;
      if (d->fehlt[naechster] & (1 << r)) sperrt++;
      wert = sofort * 3 + augen(s) + (pasch(s) ? 4 : 0) + halten * 2 + sperrt * 3;
    }
    wert = wert * 4 + zufall_bis(z, 4);
    if (wert > bester) {
      bester = wert;
      beste = i;
    }
  }
  *zug = liste[beste];
}

/* ------------------------------------------------------------------ Oberfläche */

#define FELD_ENDE 100
#define FELD_ZIEHEN 104
#define HAND_Y 19
#define HAND_SPALTEN 6
#define HAND_ZEILEN 6

static void domino_gitter(const u8 *stand, u8 *b, u8 *h) {
  const Domino *d = (const Domino *)stand;
  u8 n = d->vorbei ? 0 : d->hand_n[d->zug];
  *b = HAND_SPALTEN;
  *h = 1 + (n + HAND_SPALTEN - 1) / HAND_SPALTEN;
  if (*h > 1 + HAND_ZEILEN) *h = 1 + HAND_ZEILEN;
}

static u8 domino_feld_an(const u8 *stand, u8 x, u8 y) {
  const Domino *d = (const Domino *)stand;
  u8 i;
  if (y == 0) return x < 5 ? FELD_ENDE + x : FELD_KEIN;
  i = (y - 1) * HAND_SPALTEN + x;
  if (i >= d->hand_n[d->zug]) return FELD_KEIN;
  return d->hand[d->zug * STEINE + i];
}

static u8 domino_felder(const u8 *stand, const Zug *zug, u8 *felder) {
  (void)stand;
  if (zug->b[0] != 0) {
    felder[0] = FELD_ZIEHEN;
    return 1;
  }
  felder[0] = zug->b[1];
  felder[1] = FELD_ENDE + zug->b[2];
  return 2;
}

#include "../res/brett_grafik.h"
extern char brett_bg, brett_bg_ende, brett_bg_pal;

static void domino_grafik_laden(void) {
  bild_kacheln_laden((const u8 *)&brett_bg, (u16)(&brett_bg_ende - &brett_bg));
  bild_bg_paletten((const u8 *)&brett_bg_pal, PAL_BRETT, 3);
}

/* Zeichnet einen echten 16×8-Elfenbein-Dominostein (2 Kacheln breit) mit Augenpunkten. */
static void domino_stein(u8 x, u8 y, u8 a, u8 b, u8 pal) {
  kachel(x, y, BRETT_DOMINO_L_BASIS + a, pal);
  kachel(x + 1, y, BRETT_DOMINO_R_BASIS + b, pal);
}

/* Eine Steinreihe mit Umbruch; gibt die nächste freie Zeile zurück. */
static u8 reihe(u8 y, u8 y_max, const u8 *steine, const u8 *links, const u8 *rechts, u8 n, u8 zuletzt, u8 vorne) {
  u8 i, x = 1 + vorne, s, a, b, pal;
  for (i = 0; i < n; i++) {
    s = steine[i];
    a = links ? links[i] : STEIN_A[s];
    b = rechts[i];
    if (x + 2 > 31) {
      x = 1 + vorne;
      y++;
      if (y > y_max) return y;
    }
    pal = s == zuletzt ? PAL_BRETT_AUSWAHL : pasch(s) ? PAL_BRETT_MARKE : PAL_BRETT;
    domino_stein(x, y, a, b, pal);
    x += 3;
  }
  return y + 1;
}

static void knopf(u8 x, u8 y, const char *name, u8 feld, const u8 *markierung, u8 aktiv) {
  kachel(x, y, aktiv && (markierung[feld] & MARK_CURSOR) ? K_PFEIL : 0, PAL_GELB);
  text(x + 1, y, name, aktiv && (markierung[feld] & MARK_ZIEL) ? PAL_TEXT : PAL_GRAU);
}

static void domino_zeichnen(const u8 *stand, const u8 *markierung, u8 aktiv) {
  const Domino *d = (const Domino *)stand;
  u8 i, p, x, y, s, pal, zuletzt = d->l_platz == KEIN ? KEIN : d->l_stein;
  tafel(0, 4, 32, 22);
  flaeche_leeren(1, 5, 30, 20);
  // Kopf: Runde, Vorrat, Punkte je Platz.
  text(1, 5, "Runde", PAL_GRAU);
  zahl(7, 5, d->runde, 2, PAL_TEXT);
  text(10, 5, "Vorrat", PAL_GRAU);
  zahl(17, 5, d->vorrat_n, 2, PAL_TEXT);
  text(20, 5, "Ziel", PAL_GRAU);
  zahl(25, 5, d->ziel, 3, PAL_TEXT);
  for (p = 0; p < d->plaetze; p++) {
    x = 1 + p * 7;
    kachel(x, 6, p == d->zug && !d->vorbei ? Z_PFEIL_RECHTS : 0, PAL_GELB);
    zahl(x + 1, 6, p + 1, 1, spiel_domino.platz_paletten[p]);
    text(x + 2, 6, ":", PAL_GRAU);
    zahl(x + 3, 6, d->punkte[p], 3, PAL_TEXT);
  }
  // Kette (mit Umbruch), dann die Spinner-Äste.
  y = reihe(8, 14, d->kette, d->k_links, d->k_rechts, d->kette_n, zuletzt, 0);
  if (spinner_offen(d)) {
    if (y > 15) y = 15;
    text(1, y, "▲", PAL_GELB);
    if (d->oben_n) y = reihe(y, 15, d->oben, 0, d->o_rechts, d->oben_n, zuletzt, 1);
    else y++;
    if (y > 16) y = 16;
    text(1, y, "▼", PAL_GELB);
    if (d->unten_n) reihe(y, 16, d->unten, 0, d->u_rechts, d->unten_n, zuletzt, 1);
  }
  // Knöpfe: Enden, Ziehen/Passen.
  y = HAND_Y - 1;
  knopf(1, y, "Links", FELD_ENDE, markierung, aktiv);
  knopf(8, y, "Rechts", FELD_ENDE + 1, markierung, aktiv);
  if (spinner_offen(d)) {
    knopf(16, y, "▲", FELD_ENDE + 2, markierung, aktiv);
    knopf(19, y, "▼", FELD_ENDE + 3, markierung, aktiv);
  }
  knopf(23, y, d->variante != BLOCK && d->vorrat_n ? "Ziehen" : "Passen", FELD_ZIEHEN, markierung, aktiv);
  // Hand nur für den, der gerade selbst zieht – sonst verdeckt.
  if (d->vorbei) return;
  if (!aktiv) {
    text(1, HAND_Y + 1, "Hand:", PAL_GRAU);
    zahl(7, HAND_Y + 1, d->hand_n[d->zug], 2, PAL_TEXT);
    text(10, HAND_Y + 1, "Steine", PAL_GRAU);
    return;
  }
  for (i = 0; i < d->hand_n[d->zug] && i < HAND_SPALTEN * HAND_ZEILEN; i++) {
    s = d->hand[d->zug * STEINE + i];
    x = 1 + (i % HAND_SPALTEN) * 5;
    y = HAND_Y + i / HAND_SPALTEN;
    pal = (markierung[s] & (MARK_GEWAEHLT | MARK_CURSOR)) ? PAL_BRETT_AUSWAHL : (markierung[s] & MARK_ZIEL) ? PAL_BRETT : PAL_BRETT_MARKE;
    kachel(x, y, markierung[s] & MARK_CURSOR ? K_PFEIL : 0, PAL_GELB);
    domino_stein(x + 1, y, STEIN_A[s], STEIN_B[s], pal);
  }
}

/* ------------------------------------------------------------------ Steckbrief */

/* Wortlaut aus packages/games/dominoes/src/meta.ts (howToPlay). */
static const char *const ANLEITUNG[] = {
  "Gespielt wird mit 28 Steinen von [0|0] bis [6|6]. Wer den höchsten Pasch hat, legt ihn zuerst.",
  "Reihum legt ihr einen Stein an ein offenes Ende der Kette – die Augenzahl muss passen.",
  "Kannst du nicht legen: Beim Block-Domino passt du, beim Zieh- und Fünfer-Domino ziehst du aus dem Vorrat, bis es geht.",
  "Wer zuerst alle Steine los ist, gewinnt die Runde und bekommt die Augen der anderen. Geht nichts mehr, gewinnt, wer die wenigsten Augen hat.",
  "Fünfer-Domino: Ergeben die offenen Enden zusammen 5, 10, 15 …, bekommst du sofort so viele Punkte. Ein Pasch am Ende zählt doppelt.",
  "Wer zuerst die Zielpunktzahl erreicht, gewinnt.",
  0,
};
static const char *const PLATZ_NAMEN[] = {"Spieler 1", "Spieler 2", "Spieler 3", "Spieler 4"};
static const u8 PLATZ_PALETTEN[] = {PAL_ROT, PAL_BLAU, PAL_GELB, PAL_TEXT};
static const char *const VARIANTEN[] = {"Block", "Ziehen", "Fünfer"};
static const char *const SATZ[] = {"Doppel-6", "Doppel-9", "Doppel-12"};
static const char *const TEAMS[] = {"jeder allein", "2 gegen 2"};
static const char *const ZIELE_TEXT[] = {"50 Punkte", "100 Punkte", "150 Punkte", "250 Punkte"};
static const char *const SPINNER[] = {"nein", "ja"};
static const Option OPTIONEN[] = {
  {"Variante", VARIANTEN, 3, 1},
  {"Steine", SATZ, 3, 0},
  {"Teams", TEAMS, 2, 0},
  {"Ziel", ZIELE_TEXT, 4, 1},
  {"Spinner", SPINNER, 2, 0},
};

const Spiel spiel_domino = {
  "Domino",
  ANLEITUNG,
  "✚ Stein wählen · A nehmen · dann Ende wählen · Gelb: zuletzt gelegt",
  PLATZ_NAMEN,
  PLATZ_PALETTEN,
  2,
  4,
  1,
  OPTIONEN,
  5,
  FARBEN_TTT,
  domino_aufbauen,
  domino_am_zug,
  domino_zuege,
  domino_ziehen,
  domino_ergebnis,
  domino_bot,
  domino_ausgeben,
  domino_gitter,
  domino_feld_an,
  domino_felder,
  domino_zeichnen,
  1,
  1,
  0,
  0,
  0,
  domino_grafik_laden,
  0,
  0,
};
