#include "stich.h"

static u8 get_farbe(u8 karte) {
  return (karte % 52) / 13;
}

static u8 get_rang(u8 karte) {
  return ((karte % 52) % 13) + 1;
}

u8 stich_augen(u8 karte) {
  u8 rang = get_rang(karte);
  switch (rang) {
    case 1: return 11;  /* Ass / Sau */
    case 10: return 10; /* Zehn */
    case 13: return 4;  /* König */
    case 12: return 3;  /* Dame / Ober */
    case 11: return 2;  /* Bube / Unter */
    default: return 0;  /* 7, 8, 9 */
  }
}

static u8 standard_suit_power(u8 rang) {
  switch (rang) {
    case 1: return 8;
    case 10: return 7;
    case 13: return 6;
    case 12: return 5;
    case 11: return 4;
    case 9: return 3;
    case 8: return 2;
    case 7: return 1;
    default: return 0;
  }
}

static u8 null_suit_power(u8 rang) {
  switch (rang) {
    case 7: return 1;
    case 8: return 2;
    case 9: return 3;
    case 10: return 4;
    case 11: return 5;
    case 12: return 6;
    case 13: return 7;
    case 1: return 8;
    default: return 0;
  }
}

static u8 binokel_power(u8 rang) {
  switch (rang) {
    case 1: return 6;
    case 10: return 5;
    case 13: return 4;
    case 12: return 3;
    case 11: return 2;
    case 7: return 1;
    default: return 0;
  }
}

/* Kartenstärken für Sonderkarten:
 * Buben (Skat & Schafkopf & Doko): C:104, S:103, H:102, D:101
 * Ober/Damen (Schafkopf & Doko):   C:204, S:203, H:202, D:201
 */
static const u8 JACK_POWERS[4] = {104, 101, 102, 103}; /* C=104, D=101, H=102, S=103 */
static const u8 QUEEN_POWERS[4] = {204, 201, 202, 203}; /* C=204, D=201, H=202, S=203 */

u8 stich_ist_trumpf(u8 karte, const StichVertrag *v) {
  u8 f = get_farbe(karte);
  u8 r = get_rang(karte);

  switch (v->spieltyp) {
    case KONTRAKT_SKAT_FARBE:
      if (r == 11) return 1;
      return f == v->trumpf_farbe;
    case KONTRAKT_SKAT_GRAND:
      return r == 11;
    case KONTRAKT_SKAT_NULL:
      return 0;

    case KONTRAKT_SCHAFKOPF_SAUSPIEL:
    case KONTRAKT_SCHAFKOPF_RAMSCH:
      if (r == 12 || r == 11) return 1;
      return f == FARBE_H;
    case KONTRAKT_SCHAFKOPF_SOLO:
      if (r == 12 || r == 11) return 1;
      return f == v->trumpf_farbe;
    case KONTRAKT_SCHAFKOPF_WENZ:
      return r == 11;
    case KONTRAKT_SCHAFKOPF_GEIER:
      return r == 12;
    case KONTRAKT_SCHAFKOPF_FARBWENZ:
      if (r == 11) return 1;
      return f == v->trumpf_farbe;
    case KONTRAKT_SCHAFKOPF_BETTEL:
      return 0;

    case KONTRAKT_DOKO_NORMAL:
      if (f == FARBE_H && r == 10) return 1; /* Dulle */
      if (r == 12 || r == 11) return 1;
      return f == FARBE_D;
    case KONTRAKT_DOKO_FARBSOLO:
      if (f == FARBE_H && r == 10) return 1;
      if (r == 12 || r == 11) return 1;
      return f == v->trumpf_farbe;
    case KONTRAKT_DOKO_DAMENSOLO:
      return r == 12;
    case KONTRAKT_DOKO_BUBENSOLO:
      return r == 11;
    case KONTRAKT_DOKO_FLEISCHLOS:
      return 0;

    case KONTRAKT_BINOKEL:
      if (v->trumpf_farbe == STICH_KEIN) return 0;
      return f == v->trumpf_farbe;
  }
  return 0;
}

u8 stich_effektive_farbe(u8 karte, const StichVertrag *v) {
  if (stich_ist_trumpf(karte, v)) return STICH_TRUMPF;
  return get_farbe(karte);
}

u16 stich_karte_staerke(u8 karte, const StichVertrag *v) {
  u8 f = get_farbe(karte);
  u8 r = get_rang(karte);

  if (v->spieltyp == KONTRAKT_SKAT_NULL || v->spieltyp == KONTRAKT_SCHAFKOPF_BETTEL) {
    return null_suit_power(r);
  }

  if (v->spieltyp == KONTRAKT_BINOKEL) {
    u8 p = binokel_power(r);
    if (v->trumpf_farbe != STICH_KEIN && f == v->trumpf_farbe) {
      return 20 + p;
    }
    return p;
  }

  /* Buben und Ober in Skat / Schafkopf / Doppelkopf */
  if (v->spieltyp == KONTRAKT_SKAT_FARBE || v->spieltyp == KONTRAKT_SKAT_GRAND) {
    if (r == 11) return JACK_POWERS[f];
    if (v->spieltyp == KONTRAKT_SKAT_FARBE && f == v->trumpf_farbe) {
      return 20 + standard_suit_power(r);
    }
    return standard_suit_power(r);
  }

  if (v->spieltyp >= KONTRAKT_SCHAFKOPF_SAUSPIEL && v->spieltyp <= KONTRAKT_SCHAFKOPF_RAMSCH) {
    u8 has_ober = (v->spieltyp == KONTRAKT_SCHAFKOPF_SAUSPIEL || v->spieltyp == KONTRAKT_SCHAFKOPF_SOLO ||
                   v->spieltyp == KONTRAKT_SCHAFKOPF_GEIER || v->spieltyp == KONTRAKT_SCHAFKOPF_RAMSCH);
    u8 has_unter = (v->spieltyp == KONTRAKT_SCHAFKOPF_SAUSPIEL || v->spieltyp == KONTRAKT_SCHAFKOPF_SOLO ||
                    v->spieltyp == KONTRAKT_SCHAFKOPF_WENZ || v->spieltyp == KONTRAKT_SCHAFKOPF_FARBWENZ ||
                    v->spieltyp == KONTRAKT_SCHAFKOPF_RAMSCH);
    u8 tf = (v->spieltyp == KONTRAKT_SCHAFKOPF_SAUSPIEL || v->spieltyp == KONTRAKT_SCHAFKOPF_RAMSCH) ? FARBE_H : v->trumpf_farbe;
    u8 has_suit = (v->spieltyp == KONTRAKT_SCHAFKOPF_SAUSPIEL || v->spieltyp == KONTRAKT_SCHAFKOPF_SOLO ||
                   v->spieltyp == KONTRAKT_SCHAFKOPF_FARBWENZ || v->spieltyp == KONTRAKT_SCHAFKOPF_RAMSCH);

    if (has_ober && r == 12) return QUEEN_POWERS[f];
    if (has_unter && r == 11) return JACK_POWERS[f];
    if (has_suit && f == tf) return 20 + standard_suit_power(r);
    return standard_suit_power(r);
  }

  if (v->spieltyp >= KONTRAKT_DOKO_NORMAL && v->spieltyp <= KONTRAKT_DOKO_FLEISCHLOS) {
    if (v->spieltyp == KONTRAKT_DOKO_FLEISCHLOS) {
      return standard_suit_power(r);
    }
    if (v->spieltyp == KONTRAKT_DOKO_DAMENSOLO) {
      if (r == 12) return QUEEN_POWERS[f];
      return standard_suit_power(r);
    }
    if (v->spieltyp == KONTRAKT_DOKO_BUBENSOLO) {
      if (r == 11) return JACK_POWERS[f];
      return standard_suit_power(r);
    }
    /* Normal oder Farbsolo */
    u8 tf = (v->spieltyp == KONTRAKT_DOKO_NORMAL) ? FARBE_D : v->trumpf_farbe;
    if (f == FARBE_H && r == 10) return 301; /* Dulle */
    if (r == 12) return QUEEN_POWERS[f];
    if (r == 11) return JACK_POWERS[f];
    if (f == tf) return 20 + standard_suit_power(r);
    return standard_suit_power(r);
  }

  return standard_suit_power(r);
}

u8 stich_gewinner(const StichKarte *karten, u8 anzahl, const StichVertrag *v) {
  u8 i;
  u8 best_idx = 0;
  u8 lead_eff;
  u16 best_pwr;

  if (anzahl == 0) return 0;
  lead_eff = stich_effektive_farbe(karten[0].karte, v);
  best_pwr = stich_karte_staerke(karten[0].karte, v);

  /* Prüfen ob zweite Dulle sticht */
  for (i = 1; i < anzahl; i++) {
    u8 c = karten[i].karte;
    u8 eff = stich_effektive_farbe(c, v);
    u16 pwr = stich_karte_staerke(c, v);

    if (v->dullen_zweite_sticht && (v->spieltyp == KONTRAKT_DOKO_NORMAL || v->spieltyp == KONTRAKT_DOKO_FARBSOLO)) {
      if (get_farbe(c) == FARBE_H && get_rang(c) == 10) {
        /* Wenn schon eine Dulle liegt, sticht die zweite */
        u8 j;
        for (j = 0; j < i; j++) {
          if (get_farbe(karten[j].karte) == FARBE_H && get_rang(karten[j].karte) == 10) {
            pwr = 302;
            break;
          }
        }
      }
    }

    /* Gewinnt gegen bisherige beste Karte? */
    if (eff == STICH_TRUMPF) {
      if (stich_effektive_farbe(karten[best_idx].karte, v) != STICH_TRUMPF) {
        best_idx = i;
        best_pwr = pwr;
      } else if (pwr > best_pwr) {
        best_idx = i;
        best_pwr = pwr;
      }
    } else if (eff == lead_eff) {
      if (stich_effektive_farbe(karten[best_idx].karte, v) != STICH_TRUMPF && pwr > best_pwr) {
        best_idx = i;
        best_pwr = pwr;
      }
    }
  }

  return best_idx;
}

u8 stich_erlaubte_karten(
  const u8 *hand,
  u8 hand_n,
  const StichKarte *stich,
  u8 stich_n,
  const StichVertrag *v,
  u8 *erlaubt_maske
) {
  u8 i;
  u8 lead_eff;
  u8 follow_count = 0;
  u8 trump_count = 0;
  u8 count = 0;
  u8 is_binokel = (v->spieltyp == KONTRAKT_BINOKEL);

  if (stich_n == 0) {
    /* Ausspiel: Jede Handkarte erlaubt (außer besondere Rufe wie Sauspiel) */
    for (i = 0; i < hand_n; i++) {
      erlaubt_maske[i] = 1;
      count++;
    }
    return count;
  }

  lead_eff = stich_effektive_farbe(stich[0].karte, v);

  /* Zählen wie viele Karten die angespielte effektive Farbe bedienen können */
  for (i = 0; i < hand_n; i++) {
    u8 eff = stich_effektive_farbe(hand[i], v);
    if (eff == lead_eff) follow_count++;
    if (eff == STICH_TRUMPF) trump_count++;
  }

  /* Bei Binokel: Farbzwang, Überstichzwang, Trumpfzwang, Übertrumpfen */
  if (is_binokel) {
    u8 stich_has_trump = 0;
    u16 highest_lead_pwr = 0;
    u16 highest_trump_pwr = 0;

    for (i = 0; i < stich_n; i++) {
      u8 c = stich[i].karte;
      u8 eff = stich_effektive_farbe(c, v);
      u16 p = stich_karte_staerke(c, v);
      if (eff == STICH_TRUMPF) {
        stich_has_trump = 1;
        if (p > highest_trump_pwr) highest_trump_pwr = p;
      } else if (eff == lead_eff) {
        if (p > highest_lead_pwr) highest_lead_pwr = p;
      }
    }

    if (follow_count > 0) {
      /* Angespielte Farbe muss bedient werden */
      if (!stich_has_trump && lead_eff != STICH_TRUMPF) {
        /* Überstichzwang in Fehlfarbe wenn noch kein Trumpf im Stich */
        u8 higher_count = 0;
        for (i = 0; i < hand_n; i++) {
          if (stich_effektive_farbe(hand[i], v) == lead_eff && stich_karte_staerke(hand[i], v) > highest_lead_pwr) {
            higher_count++;
          }
        }
        if (higher_count > 0) {
          for (i = 0; i < hand_n; i++) {
            u8 ok = (stich_effektive_farbe(hand[i], v) == lead_eff && stich_karte_staerke(hand[i], v) > highest_lead_pwr);
            erlaubt_maske[i] = ok;
            if (ok) count++;
          }
          return count;
        }
      } else if (lead_eff == STICH_TRUMPF) {
        /* Trumpf angespielt: Übertrumpfzwang */
        u8 higher_count = 0;
        for (i = 0; i < hand_n; i++) {
          if (stich_effektive_farbe(hand[i], v) == STICH_TRUMPF && stich_karte_staerke(hand[i], v) > highest_trump_pwr) {
            higher_count++;
          }
        }
        if (higher_count > 0) {
          for (i = 0; i < hand_n; i++) {
            u8 ok = (stich_effektive_farbe(hand[i], v) == STICH_TRUMPF && stich_karte_staerke(hand[i], v) > highest_trump_pwr);
            erlaubt_maske[i] = ok;
            if (ok) count++;
          }
          return count;
        }
      }
      /* Sonst beliebig bedienen */
      for (i = 0; i < hand_n; i++) {
        u8 ok = (stich_effektive_farbe(hand[i], v) == lead_eff);
        erlaubt_maske[i] = ok;
        if (ok) count++;
      }
      return count;
    }

    /* Kann nicht bedienen: Trumpfzwang */
    if (v->trumpf_farbe != STICH_KEIN && trump_count > 0) {
      if (stich_has_trump) {
        /* Übertrumpfzwang */
        u8 higher_count = 0;
        for (i = 0; i < hand_n; i++) {
          if (stich_effektive_farbe(hand[i], v) == STICH_TRUMPF && stich_karte_staerke(hand[i], v) > highest_trump_pwr) {
            higher_count++;
          }
        }
        if (higher_count > 0) {
          for (i = 0; i < hand_n; i++) {
            u8 ok = (stich_effektive_farbe(hand[i], v) == STICH_TRUMPF && stich_karte_staerke(hand[i], v) > highest_trump_pwr);
            erlaubt_maske[i] = ok;
            if (ok) count++;
          }
          return count;
        }
      }
      /* Beliebigen Trumpf spielen */
      for (i = 0; i < hand_n; i++) {
        u8 ok = (stich_effektive_farbe(hand[i], v) == STICH_TRUMPF);
        erlaubt_maske[i] = ok;
        if (ok) count++;
      }
      return count;
    }

    /* Kann weder bedienen noch trumpfen: Beliebige Karte */
    for (i = 0; i < hand_n; i++) {
      erlaubt_maske[i] = 1;
      count++;
    }
    return count;
  }

  /* Standard-Farbzwang (Skat, Schafkopf, Doppelkopf) */
  if (follow_count > 0) {
    for (i = 0; i < hand_n; i++) {
      u8 ok = (stich_effektive_farbe(hand[i], v) == lead_eff);
      erlaubt_maske[i] = ok;
      if (ok) count++;
    }
  } else {
    for (i = 0; i < hand_n; i++) {
      erlaubt_maske[i] = 1;
      count++;
    }
  }

  return count;
}
