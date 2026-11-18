/*
 * Poker (Texas Hold'em) für Brett & Blatt 16 – nach packages/games/poker/src/rules.ts.
 * 2–4 Spieler, 52 Karten (Französisches Blatt: Kreuz, Karo, Herz, Pik, 2–Ass).
 *
 * Karten (8..59):
 *   code = (rank == 1 ? 14 : rank) * 4 + suit
 *   suit: 0: Kreuz, 1: Karo, 2: Herz, 3: Pik
 *   rank: 2..14 (Ass = 14)
 *
 * Züge:
 *   [actor, 0, 0, 0] – Passen (fold)
 *   [actor, 1, 0, 0] – Schieben (check)
 *   [actor, 2, 0, 0] – Mitgehen (call)
 *   [actor, 3, lo, hi] – Setzen (bet amount)
 *   [actor, 4, lo, hi] – Erhöhen (raise to)
 *   [actor, 5, 0, 0] – All-in
 */
#include "spiel.h"
#include "bild.h"
#include "klang.h"
#include "karten.h"
#include "../res/grafik.h"

#define KEIN 0xff
#define POKER_MAX_PLAETZE 4

enum { STREET_PREFLOP, STREET_FLOP, STREET_TURN, STREET_RIVER, STREET_COMPLETE };
enum { STATUS_ACTIVE, STATUS_WAITING, STATUS_ELIMINATED, STATUS_EMPTY };
enum { MOVE_FOLD, MOVE_CHECK, MOVE_CALL, MOVE_BET, MOVE_RAISE, MOVE_ALLIN };

typedef struct {
  u16 sb;
  u16 bb;
  u16 ante;
} BlindLevel;

static const BlindLevel BLIND_LEVELS[12] = {
  { 10, 20, 2 },
  { 15, 30, 3 },
  { 25, 50, 5 },
  { 50, 100, 10 },
  { 100, 200, 20 },
  { 200, 400, 40 },
  { 400, 800, 80 },
  { 800, 1600, 160 },
  { 1500, 3000, 300 },
  { 3000, 6000, 600 },
  { 6000, 12000, 1200 },
  { 15000, 30000, 3000 },
};

typedef struct {
  u8 status;
  u16 chips;
  u16 hand_start_chips;
  u8 in_hand;
  u8 folded;
  u8 all_in;
  u16 street_bet;
  u16 total_committed;
  u8 acted;
  u8 hole_card_count;
  u8 hole_cards[2];
  u8 place;
} PokerSeat;

typedef struct {
  u8 structure; /* 0: nl, 1: pl, 2: fl */
  u8 mode;      /* 0: tournament, 1: hands20, 2: hands50 */
  u8 max_hands; /* 75 (tournament), 20, 50 */
  u16 start_chips;
  u8 hands_per_level; /* 10 (relaxed), 6 (normal), 4 (fast) */
  u8 ante_mode;       /* 0: none, 1: level4, 2: always */

  u8 seats_count;
  PokerSeat seats[POKER_MAX_PLAETZE];

  u16 hand_number;
  u8 level_index;
  u16 small_blind;
  u16 big_blind;
  u16 ante;

  u8 button;
  u8 small_blind_seat;
  u8 big_blind_seat;
  u8 street;

  u8 board_count;
  u8 board[5];

  u8 deck_count;
  u8 deck[52];

  u8 actor;
  u16 current_bet;
  u16 min_raise;
  u8 raises_in_street;
  u8 last_aggressor;

  Zufall rng;
} Poker;

/* ------------------------------------------------------------------ Hand-Bewertung */

static u32 encode_hand(u8 category, u8 r0, u8 r1, u8 r2, u8 r3, u8 r4) {
  u32 val = ((u32)category) << 20;
  val |= ((u32)r0) << 16;
  val |= ((u32)r1) << 12;
  val |= ((u32)r2) << 8;
  val |= ((u32)r3) << 4;
  val |= ((u32)r4);
  return val;
}

static u8 straight_high(u16 mask) {
  u16 m = (mask & (1 << 14)) ? (mask | 2) : mask;
  s8 high;
  for (high = 14; high >= 5; high--) {
    if (((m >> (high - 4)) & 31) == 31) return (u8)high;
  }
  return 0;
}

static void top_ranks(u16 mask, u8 count, u8 ex1, u8 ex2, u8 *out) {
  u8 n = 0;
  s8 r;
  for (r = 14; r >= 2 && n < count; r--) {
    if ((mask & (1 << r)) && (r != ex1) && (r != ex2)) {
      out[n++] = (u8)r;
    }
  }
  while (n < count) out[n++] = 0;
}

static u32 evaluate_codes(const u8 *codes, u8 n) {
  u8 counts[15];
  u16 suit_mask[4];
  u8 suit_count[4];
  u16 rank_mask = 0;
  u8 i, s;
  u32 flush = 0;
  u8 quad = 0;
  u8 trips[3], trips_n = 0;
  u8 pairs[4], pairs_n = 0;
  s8 r;

  for (i = 0; i < 15; i++) counts[i] = 0;
  for (s = 0; s < 4; s++) { suit_mask[s] = 0; suit_count[s] = 0; }

  for (i = 0; i < n; i++) {
    u8 rank = codes[i] >> 2;
    u8 suit = codes[i] & 3;
    counts[rank]++;
    suit_mask[suit] |= (1 << rank);
    suit_count[suit]++;
    rank_mask |= (1 << rank);
  }

  for (s = 0; s < 4; s++) {
    if (suit_count[s] >= 5) {
      u8 high = straight_high(suit_mask[s]);
      if (high) return encode_hand(8, high, 0, 0, 0, 0); /* Straight Flush */
      {
        u8 top[5];
        top_ranks(suit_mask[s], 5, 0, 0, top);
        flush = encode_hand(5, top[0], top[1], top[2], top[3], top[4]);
      }
    }
  }

  for (r = 14; r >= 2; r--) {
    u8 c = counts[r];
    if (c == 4) { if (!quad) quad = (u8)r; }
    else if (c == 3) { if (trips_n < 3) trips[trips_n++] = (u8)r; }
    else if (c == 2) { if (pairs_n < 4) pairs[pairs_n++] = (u8)r; }
  }

  if (quad) {
    u8 top[1];
    top_ranks(rank_mask, 1, quad, 0, top);
    return encode_hand(7, quad, top[0], 0, 0, 0); /* Quads */
  }
  if (trips_n > 0 && (trips_n > 1 || pairs_n > 0)) {
    u8 second = (trips_n > 1 && (pairs_n == 0 || trips[1] > pairs[0])) ? trips[1] : pairs[0];
    return encode_hand(6, trips[0], second, 0, 0, 0); /* Full House */
  }
  if (flush) return flush;
  {
    u8 straight = straight_high(rank_mask);
    if (straight) return encode_hand(4, straight, 0, 0, 0, 0); /* Straight */
  }
  if (trips_n > 0) {
    u8 top[2];
    top_ranks(rank_mask, 2, trips[0], 0, top);
    return encode_hand(3, trips[0], top[0], top[1], 0, 0); /* Trips */
  }
  if (pairs_n >= 2) {
    u8 top[1];
    top_ranks(rank_mask, 1, pairs[0], pairs[1], top);
    return encode_hand(2, pairs[0], pairs[1], top[0], 0, 0); /* Two Pair */
  }
  if (pairs_n == 1) {
    u8 top[3];
    top_ranks(rank_mask, 3, pairs[0], 0, top);
    return encode_hand(1, pairs[0], top[0], top[1], top[2], 0); /* Pair */
  }
  {
    u8 top[5];
    top_ranks(rank_mask, 5, 0, 0, top);
    return encode_hand(0, top[0], top[1], top[2], top[3], top[4]); /* High Card */
  }
}

/* ------------------------------------------------------------------ Hilfen */

static u8 next_seat_from(const Poker *p, u8 start_exclusive, u8 (*pred)(const PokerSeat *)) {
  u8 offset;
  for (offset = 1; offset <= p->seats_count; offset++) {
    u8 idx = (start_exclusive + offset) % p->seats_count;
    if (pred(&p->seats[idx])) return idx;
  }
  return KEIN;
}

static u8 is_active_with_chips(const PokerSeat *s) {
  return s->status == STATUS_ACTIVE && s->chips > 0;
}

static u8 is_in_hand_can_act(const PokerSeat *s) {
  return s->in_hand && !s->folded && !s->all_in;
}

static u16 post_chip_amount(PokerSeat *seat, u16 amount, u8 count_in_street_bet) {
  u16 paid = seat->chips < amount ? seat->chips : amount;
  seat->chips -= paid;
  seat->total_committed += paid;
  if (count_in_street_bet) seat->street_bet += paid;
  if (seat->chips == 0) seat->all_in = 1;
  return paid;
}

static u16 total_pot(const Poker *p) {
  u16 sum = 0;
  u8 s;
  for (s = 0; s < p->seats_count; s++) sum += p->seats[s].total_committed;
  return sum;
}

static void mark_eliminations(Poker *p) {
  u8 s, remaining = 0, busted_count = 0;
  u8 busted[POKER_MAX_PLAETZE];
  for (s = 0; s < p->seats_count; s++) {
    if (p->seats[s].status == STATUS_ACTIVE) {
      if (p->seats[s].chips > 0) remaining++;
      else busted[busted_count++] = s;
    }
  }
  if (busted_count == 0) return;

  /* Sortiere busted absteigend nach hand_start_chips */
  {
    u8 i, j;
    for (i = 0; i < busted_count; i++) {
      for (j = i + 1; j < busted_count; j++) {
        if (p->seats[busted[j]].hand_start_chips > p->seats[busted[i]].hand_start_chips) {
          u8 tmp = busted[i];
          busted[i] = busted[j];
          busted[j] = tmp;
        }
      }
    }
  }

  for (s = 0; s < busted_count; s++) {
    p->seats[busted[s]].status = STATUS_ELIMINATED;
    p->seats[busted[s]].place = remaining + s + 1;
  }
}

static void start_hand(Poker *p);

static u8 deal_card_from_deck(Poker *p) {
  u8 c = p->deck[0];
  u8 i;
  if (p->deck_count > 0) {
    p->deck_count--;
    for (i = 0; i < p->deck_count; i++) {
      p->deck[i] = p->deck[i + 1];
    }
  }
  return c;
}

static void run_out_and_showdown(Poker *p) {
  u8 s, i, j;
  u32 hand_values[POKER_MAX_PLAETZE];
  u16 committed[POKER_MAX_PLAETZE];
  u8 eligible_mask[POKER_MAX_PLAETZE];

  /* Restliches Board austeilen */
  while (p->board_count < 5 && p->deck_count > 0) {
    u8 c = deal_card_from_deck(p);
    p->board[p->board_count++] = c;
  }

  for (s = 0; s < p->seats_count; s++) {
    committed[s] = p->seats[s].total_committed;
    eligible_mask[s] = (p->seats[s].in_hand && !p->seats[s].folded) ? 1 : 0;
    if (eligible_mask[s]) {
      u8 all_cards[7];
      all_cards[0] = p->seats[s].hole_cards[0];
      all_cards[1] = p->seats[s].hole_cards[1];
      for (i = 0; i < p->board_count; i++) all_cards[2 + i] = p->board[i];
      hand_values[s] = evaluate_codes(all_cards, 2 + p->board_count);
    } else {
      hand_values[s] = 0;
    }
  }

  /* Pots auflösen (Side-Pots) */
  {
    u16 levels[POKER_MAX_PLAETZE];
    u8 levels_n = 0;
    u16 max_committed = 0;
    u16 prev = 0;

    for (s = 0; s < p->seats_count; s++) {
      if (committed[s] > max_committed) max_committed = committed[s];
      if (eligible_mask[s] && committed[s] > 0) {
        u8 exists = 0;
        for (i = 0; i < levels_n; i++) {
          if (levels[i] == committed[s]) { exists = 1; break; }
        }
        if (!exists) levels[levels_n++] = committed[s];
      }
    }

    /* Sortiere levels aufsteigend */
    for (i = 0; i < levels_n; i++) {
      for (j = i + 1; j < levels_n; j++) {
        if (levels[j] < levels[i]) {
          u16 t = levels[i]; levels[i] = levels[j]; levels[j] = t;
        }
      }
    }

    if (levels_n == 0) {
      /* Fallback */
      levels[0] = max_committed;
      levels_n = 1;
    }

    for (i = 0; i < levels_n; i++) {
      u16 level = levels[i];
      u16 cap = (i == levels_n - 1 && max_committed > level) ? max_committed : level;
      u16 slice_amount = 0;
      u8 pot_eligible[POKER_MAX_PLAETZE];
      u8 pot_eligible_n = 0;
      u32 best_val = 0;
      u8 winners[POKER_MAX_PLAETZE];
      u8 winners_n = 0;

      for (s = 0; s < p->seats_count; s++) {
        u16 c = committed[s];
        if (c > prev) {
          u16 cur_cap = c < cap ? c : cap;
          slice_amount += (cur_cap - prev);
        }
      }

      for (s = 0; s < p->seats_count; s++) {
        if (eligible_mask[s] && committed[s] >= level) {
          pot_eligible[pot_eligible_n++] = s;
        }
      }

      if (slice_amount == 0 || pot_eligible_n == 0) {
        prev = cap;
        continue;
      }

      /* Gewinner dieses Pots finden */
      for (j = 0; j < pot_eligible_n; j++) {
        u8 seat = pot_eligible[j];
        if (hand_values[seat] > best_val) {
          best_val = hand_values[seat];
          winners[0] = seat;
          winners_n = 1;
        } else if (hand_values[seat] == best_val) {
          winners[winners_n++] = seat;
        }
      }

      /* Chips verteilen */
      {
        u16 share = slice_amount / winners_n;
        u16 remainder = slice_amount % winners_n;

        for (j = 0; j < winners_n; j++) {
          p->seats[winners[j]].chips += share;
        }

        /* Restliche Chips ab links vom Button */
        while (remainder > 0) {
          u8 best_w = winners[0];
          u8 best_dist = (best_w - p->button - 1 + p->seats_count) % p->seats_count;
          for (j = 1; j < winners_n; j++) {
            u8 dist = (winners[j] - p->button - 1 + p->seats_count) % p->seats_count;
            if (dist < best_dist) {
              best_dist = dist;
              best_w = winners[j];
            }
          }
          p->seats[best_w].chips += 1;
          remainder--;
        }
      }

      prev = cap;
    }
  }

  mark_eliminations(p);
  start_hand(p);
}

static u8 need_to_act_pred(const PokerSeat *s) {
  return s->in_hand && !s->folded && !s->all_in;
}

static void advance_if_round_complete(Poker *p, u8 last_actor) {
  u8 s, in_hand_not_folded_n = 0, can_act_n = 0, need_to_act_n = 0;
  u8 sole_winner = KEIN;

  if (p->street == STREET_COMPLETE) return;

  for (s = 0; s < p->seats_count; s++) {
    if (p->seats[s].in_hand && !p->seats[s].folded) {
      in_hand_not_folded_n++;
      sole_winner = s;
      if (!p->seats[s].all_in) {
        can_act_n++;
        if (!p->seats[s].acted || p->seats[s].street_bet < p->current_bet) {
          need_to_act_n++;
        }
      }
    }
  }

  /* Alle bis auf einen haben gepasst */
  if (in_hand_not_folded_n <= 1) {
    u16 pot = total_pot(p);
    if (sole_winner != KEIN) {
      p->seats[sole_winner].chips += pot;
    }
    mark_eliminations(p);
    start_hand(p);
    return;
  }

  /* Prüfen, ob noch jemand setzen muss */
  {
    u8 no_more_betting = (can_act_n <= 1);
    if (no_more_betting) {
      for (s = 0; s < p->seats_count; s++) {
        if (p->seats[s].in_hand && !p->seats[s].folded && !p->seats[s].all_in) {
          if (p->seats[s].street_bet < p->current_bet) no_more_betting = 0;
        }
      }
    }

    if (need_to_act_n > 0 && !no_more_betting) {
      for (s = 1; s <= p->seats_count; s++) {
        u8 idx = (last_actor + s) % p->seats_count;
        const PokerSeat *st = &p->seats[idx];
        if (st->in_hand && !st->folded && !st->all_in && (!st->acted || st->street_bet < p->current_bet)) {
          p->actor = idx;
          return;
        }
      }
    }
  }

  /* All-in Runout */
  if (can_act_n <= 1) {
    run_out_and_showdown(p);
    return;
  }

  /* Nächste Straße */
  for (s = 0; s < p->seats_count; s++) {
    p->seats[s].street_bet = 0;
    p->seats[s].acted = 0;
  }
  p->current_bet = 0;
  p->min_raise = p->big_blind;
  p->raises_in_street = 0;
  p->last_aggressor = KEIN;

  if (p->street == STREET_PREFLOP) {
    u8 c0, c1, c2;
    p->street = STREET_FLOP;
    c0 = deal_card_from_deck(p);
    c1 = deal_card_from_deck(p);
    c2 = deal_card_from_deck(p);
    p->board[p->board_count++] = c0;
    p->board[p->board_count++] = c1;
    p->board[p->board_count++] = c2;
  } else if (p->street == STREET_FLOP) {
    u8 c;
    p->street = STREET_TURN;
    c = deal_card_from_deck(p);
    p->board[p->board_count++] = c;
  } else if (p->street == STREET_TURN) {
    u8 c;
    p->street = STREET_RIVER;
    c = deal_card_from_deck(p);
    p->board[p->board_count++] = c;
  } else {
    run_out_and_showdown(p);
    return;
  }

  p->actor = next_seat_from(p, p->button, is_in_hand_can_act);
  if (p->actor == KEIN) {
    run_out_and_showdown(p);
  }
}

static void start_hand(Poker *p) {
  u8 playable_count = 0;
  u8 s, prev_level;
  u8 ordered[POKER_MAX_PLAETZE];
  u8 ordered_n = 0;
  u8 cursor;

  for (s = 0; s < p->seats_count; s++) {
    if (p->seats[s].status == STATUS_WAITING) {
      p->seats[s].status = STATUS_ACTIVE;
      if (p->seats[s].chips == 0) p->seats[s].chips = p->start_chips;
    }
    if (p->seats[s].status == STATUS_ACTIVE && p->seats[s].chips > 0) {
      playable_count++;
    }
  }

  if (playable_count <= 1 || p->hand_number >= p->max_hands) {
    p->street = STREET_COMPLETE;
    p->actor = KEIN;
    p->board_count = 0;
    p->deck_count = 0;
    for (s = 0; s < p->seats_count; s++) {
      p->seats[s].in_hand = 0;
      p->seats[s].folded = 1;
      p->seats[s].all_in = 0;
      p->seats[s].street_bet = 0;
      p->seats[s].total_committed = 0;
      p->seats[s].hole_card_count = 0;
    }
    return;
  }

  prev_level = p->level_index;
  p->hand_number++;
  if (p->mode == 0) { /* tournament */
    u16 lvl = (p->hand_number - 1) / p->hands_per_level;
    p->level_index = lvl > 11 ? 11 : (u8)lvl;
  } else {
    p->level_index = 0;
  }

  p->small_blind = BLIND_LEVELS[p->level_index].sb;
  p->big_blind = BLIND_LEVELS[p->level_index].bb;
  p->ante = (p->ante_mode == 2 || (p->ante_mode == 1 && p->level_index >= 3)) ? BLIND_LEVELS[p->level_index].ante : 0;

  p->button = next_seat_from(p, p->button, is_active_with_chips);
  ordered[ordered_n++] = p->button;
  cursor = p->button;
  while (ordered_n < playable_count) {
    cursor = next_seat_from(p, cursor, is_active_with_chips);
    ordered[ordered_n++] = cursor;
  }

  if (ordered_n == 2) {
    p->small_blind_seat = ordered[0];
    p->big_blind_seat = ordered[1];
  } else {
    p->small_blind_seat = ordered[1];
    p->big_blind_seat = ordered[2];
  }

  /* Deck mischen: 52 Karten in Standardreihenfolge */
  {
    u8 suit, rank, idx = 0;
    for (suit = 0; suit < 4; suit++) {
      for (rank = 1; rank <= 13; rank++) {
        u8 r = (rank == 1) ? 14 : rank;
        p->deck[idx++] = (r << 2) | suit;
      }
    }
    for (idx = 51; idx > 0; idx--) {
      u8 j = (u8)zufall_bis(&p->rng, idx + 1);
      u8 tmp = p->deck[idx];
      p->deck[idx] = p->deck[j];
      p->deck[j] = tmp;
    }
    p->deck_count = 52;
  }

  /* Karten austeilen */
  for (s = 0; s < p->seats_count; s++) {
    PokerSeat *seat = &p->seats[s];
    if (seat->status == STATUS_ACTIVE && seat->chips > 0) {
      seat->hand_start_chips = seat->chips;
      seat->in_hand = 1;
      seat->folded = 0;
      seat->all_in = 0;
      seat->street_bet = 0;
      seat->total_committed = 0;
      seat->acted = 0;
      u8 c0 = deal_card_from_deck(p);
      u8 c1 = deal_card_from_deck(p);
      seat->hole_cards[0] = c0;
      seat->hole_cards[1] = c1;
      seat->hole_card_count = 2;
    } else {
      seat->hand_start_chips = seat->chips;
      seat->in_hand = 0;
      seat->folded = 1;
      seat->all_in = 0;
      seat->street_bet = 0;
      seat->total_committed = 0;
      seat->acted = 0;
      seat->hole_card_count = 0;
    }
  }

  p->board_count = 0;
  p->street = STREET_PREFLOP;

  /* Ante buchen */
  if (p->ante > 0) {
    for (s = 0; s < ordered_n; s++) {
      post_chip_amount(&p->seats[ordered[s]], p->ante, 0);
    }
  }

  /* Blinds buchen */
  post_chip_amount(&p->seats[p->small_blind_seat], p->small_blind, 1);
  post_chip_amount(&p->seats[p->big_blind_seat], p->big_blind, 1);

  p->current_bet = p->seats[p->small_blind_seat].street_bet > p->seats[p->big_blind_seat].street_bet ?
                   p->seats[p->small_blind_seat].street_bet : p->seats[p->big_blind_seat].street_bet;
  p->min_raise = p->big_blind;
  p->raises_in_street = 0;
  p->last_aggressor = KEIN;

  p->actor = next_seat_from(p, p->big_blind_seat, is_in_hand_can_act);
  advance_if_round_complete(p, p->big_blind_seat);
}

/* ------------------------------------------------------------------ Einsatz-Grenzen */

typedef struct {
  u8 can_raise;
  u16 min_to;
  u16 max_to;
  u16 max_by_stack;
} RaiseBounds;

static RaiseBounds raise_bounds(const Poker *p, u8 seat) {
  RaiseBounds b;
  const PokerSeat *me = &p->seats[seat];
  u16 to_call;
  u8 s, others_can_act = 0;

  b.can_raise = 0;
  b.min_to = 0;
  b.max_to = 0;
  b.max_by_stack = 0;

  if (!me->in_hand || me->folded || me->all_in || me->chips == 0) return b;

  to_call = p->current_bet > me->street_bet ? (p->current_bet - me->street_bet) : 0;
  b.max_by_stack = me->street_bet + me->chips;

  if (me->chips <= to_call || p->raises_in_street >= 4) {
    b.min_to = b.max_by_stack;
    b.max_to = b.max_by_stack;
    return b;
  }

  for (s = 0; s < p->seats_count; s++) {
    if (s != seat && p->seats[s].in_hand && !p->seats[s].folded && !p->seats[s].all_in) {
      others_can_act = 1;
      break;
    }
  }
  if (!others_can_act) {
    b.min_to = b.max_by_stack;
    b.max_to = b.max_by_stack;
    return b;
  }

  if (p->structure == 2) { /* fl */
    u16 inc = (p->street == STREET_TURN || p->street == STREET_RIVER) ? p->big_blind * 2 : p->big_blind;
    u16 target = p->current_bet + inc;
    u16 clamped = target < b.max_by_stack ? target : b.max_by_stack;
    b.can_raise = clamped > p->current_bet;
    b.min_to = clamped;
    b.max_to = clamped;
    return b;
  }

  b.min_to = p->current_bet == 0 ? p->big_blind : (p->current_bet + p->min_raise);
  if (b.min_to > b.max_by_stack) b.min_to = b.max_by_stack;

  if (p->structure == 1) { /* pl */
    u32 pot_before = total_pot(p);
    u32 max_pot_to = (u32)p->current_bet + to_call + pot_before;
    u32 max_to = max_pot_to > (u32)b.min_to ? max_pot_to : (u32)b.min_to;
    if (max_to > (u32)b.max_by_stack) max_to = b.max_by_stack;
    b.max_to = (u16)max_to;
    b.can_raise = b.max_to > p->current_bet;
    return b;
  }

  /* nl */
  b.max_to = b.max_by_stack;
  b.can_raise = b.max_by_stack > p->current_bet;
  return b;
}

/* ------------------------------------------------------------------ Regeln */

static void poker_aufbauen(u8 *stand, const u8 *optionen, u8 plaetze, const char *seed) {
  Poker *p = (Poker *)stand;
  u8 s;

  p->seats_count = plaetze;
  if (p->seats_count < 2) p->seats_count = 2;
  if (p->seats_count > POKER_MAX_PLAETZE) p->seats_count = POKER_MAX_PLAETZE;

  /* Option 0: structure (0: nl, 1: pl, 2: fl) */
  p->structure = optionen[0] < 3 ? optionen[0] : 0;

  /* Option 1: mode (0: tournament, 1: hands20, 2: hands50) */
  p->mode = optionen[1] < 3 ? optionen[1] : 0;
  p->max_hands = (p->mode == 1) ? 20 : (p->mode == 2) ? 50 : 75;

  /* Option 2: stack (0: 50 BB, 1: 100 BB, 2: 200 BB) */
  p->start_chips = (optionen[2] == 0) ? 1000 : (optionen[2] == 2) ? 4000 : 2000;

  /* Option 3: speed (0: 10, 1: 6, 2: 4) */
  p->hands_per_level = (optionen[3] == 0) ? 10 : (optionen[3] == 2) ? 4 : 6;

  /* Option 4: ante (0: none, 1: level4, 2: always) */
  p->ante_mode = optionen[4] < 3 ? optionen[4] : 1;

  for (s = 0; s < p->seats_count; s++) {
    p->seats[s].status = STATUS_ACTIVE;
    p->seats[s].chips = p->start_chips;
    p->seats[s].hand_start_chips = p->start_chips;
    p->seats[s].in_hand = 0;
    p->seats[s].folded = 1;
    p->seats[s].all_in = 0;
    p->seats[s].street_bet = 0;
    p->seats[s].total_committed = 0;
    p->seats[s].acted = 0;
    p->seats[s].hole_card_count = 0;
    p->seats[s].place = 0;
  }

  p->hand_number = 0;
  p->level_index = 0;
  p->small_blind = 10;
  p->big_blind = 20;
  p->ante = 0;
  p->button = p->seats_count - 1;
  p->small_blind_seat = 0;
  p->big_blind_seat = 1 % p->seats_count;
  p->street = STREET_PREFLOP;
  p->board_count = 0;
  p->deck_count = 0;
  p->actor = KEIN;
  p->current_bet = 0;
  p->min_raise = 20;
  p->raises_in_street = 0;
  p->last_aggressor = KEIN;

  zufall_strom(&p->rng, seed, "poker");

  start_hand(p);
}

static u8 poker_am_zug(const u8 *stand) {
  const Poker *p = (const Poker *)stand;
  if (p->street == STREET_COMPLETE) return PLATZ_KEIN;
  return p->actor;
}

static u8 poker_ergebnis(const u8 *stand, u8 *sieger) {
  const Poker *p = (const Poker *)stand;
  u16 max_chips = 0;
  u8 s, mask = 0, count = 0;

  if (p->street != STREET_COMPLETE) return ERGEBNIS_LAEUFT;

  for (s = 0; s < p->seats_count; s++) {
    if (p->seats[s].status == STATUS_ACTIVE && p->seats[s].chips > 0) {
      if (p->seats[s].chips > max_chips) max_chips = p->seats[s].chips;
    }
  }

  if (max_chips == 0) {
    /* Keiner hat Chips übrig: Bestplatzierter */
    u8 best_place = 99, best_s = 0;
    for (s = 0; s < p->seats_count; s++) {
      if (p->seats[s].place > 0 && p->seats[s].place < best_place) {
        best_place = p->seats[s].place;
        best_s = s;
      }
    }
    *sieger = 1 << best_s;
    return ERGEBNIS_SIEG;
  }

  for (s = 0; s < p->seats_count; s++) {
    if (p->seats[s].status == STATUS_ACTIVE && p->seats[s].chips == max_chips) {
      mask |= (1 << s);
      count++;
    }
  }

  *sieger = mask;
  if (count == p->seats_count) return ERGEBNIS_REMIS;
  return ERGEBNIS_SIEG;
}

static u16 poker_zuege(const u8 *stand, Zug *liste) {
  const Poker *p = (const Poker *)stand;
  u8 actor = poker_am_zug(stand);
  const PokerSeat *me;
  u16 to_call, n = 0;
  RaiseBounds bounds;

  if (actor == PLATZ_KEIN || p->street == STREET_COMPLETE) return 0;
  me = &p->seats[actor];
  if (!me->in_hand || me->folded || me->all_in) return 0;

  to_call = p->current_bet > me->street_bet ? (p->current_bet - me->street_bet) : 0;

  if (to_call == 0) {
    liste[n].n = 4;
    liste[n].b[0] = actor;
    liste[n].b[1] = MOVE_CHECK;
    liste[n].b[2] = 0;
    liste[n].b[3] = 0;
    n++;
  } else {
    liste[n].n = 4;
    liste[n].b[0] = actor;
    liste[n].b[1] = MOVE_FOLD;
    liste[n].b[2] = 0;
    liste[n].b[3] = 0;
    n++;

    if (me->chips > to_call) {
      liste[n].n = 4;
      liste[n].b[0] = actor;
      liste[n].b[1] = MOVE_CALL;
      liste[n].b[2] = 0;
      liste[n].b[3] = 0;
      n++;
    } else {
      liste[n].n = 4;
      liste[n].b[0] = actor;
      liste[n].b[1] = MOVE_ALLIN;
      liste[n].b[2] = 0;
      liste[n].b[3] = 0;
      n++;
      return n;
    }
  }

  bounds = raise_bounds(p, actor);
  if (bounds.can_raise) {
    u32 pot_now = (u32)total_pot(p) + to_call;
    u16 candidates[4];
    u8 candidates_n = 0;
    u16 seen[4];
    u8 seen_n = 0;
    u8 i;

    if (p->structure == 2) { /* fl */
      candidates[candidates_n++] = bounds.min_to;
    } else {
      candidates[candidates_n++] = bounds.min_to;
      candidates[candidates_n++] = p->current_bet + (u16)((pot_now * 5 + 5) / 10);
      candidates[candidates_n++] = p->current_bet + (u16)((pot_now * 75 + 50) / 100);
      candidates[candidates_n++] = p->current_bet + (u16)pot_now;
    }

    for (i = 0; i < candidates_n; i++) {
      u16 raw = candidates[i];
      u16 target = raw < bounds.min_to ? bounds.min_to : (raw > bounds.max_to ? bounds.max_to : raw);
      u8 j, already = 0;

      if (target >= bounds.max_by_stack) continue;
      if (target <= p->current_bet) continue;

      for (j = 0; j < seen_n; j++) {
        if (seen[j] == target) { already = 1; break; }
      }
      if (already) continue;
      seen[seen_n++] = target;

      liste[n].n = 4;
      liste[n].b[0] = actor;
      liste[n].b[1] = (p->current_bet == 0) ? MOVE_BET : MOVE_RAISE;
      liste[n].b[2] = (u8)(target & 0xff);
      liste[n].b[3] = (u8)((target >> 8) & 0xff);
      n++;
    }

    if (bounds.max_to >= bounds.max_by_stack) {
      liste[n].n = 4;
      liste[n].b[0] = actor;
      liste[n].b[1] = MOVE_ALLIN;
      liste[n].b[2] = 0;
      liste[n].b[3] = 0;
      n++;
    }
  }

  return n;
}

static u8 poker_ziehen(u8 *stand, const Zug *zug) {
  Poker *p = (Poker *)stand;
  u8 actor = zug->b[0];
  u8 type = zug->b[1];
  u16 target = (u16)zug->b[2] | ((u16)zug->b[3] << 8);
  PokerSeat *me = &p->seats[actor];
  u16 to_call = p->current_bet > me->street_bet ? (p->current_bet - me->street_bet) : 0;
  u8 s;

  if (type == MOVE_FOLD) {
    me->folded = 1;
    me->acted = 1;
    advance_if_round_complete(p, actor);
    return KLANG_KLICK;
  }

  if (type == MOVE_CHECK) {
    me->acted = 1;
    advance_if_round_complete(p, actor);
    return KLANG_KLICK;
  }

  if (type == MOVE_CALL) {
    post_chip_amount(me, to_call, 1);
    me->acted = 1;
    advance_if_round_complete(p, actor);
    return KLANG_KARTE;
  }

  if (type == MOVE_BET) {
    u16 add = target > me->street_bet ? (target - me->street_bet) : 0;
    post_chip_amount(me, add, 1);
    me->acted = 1;
    p->current_bet = me->street_bet;
    p->min_raise = me->street_bet > p->big_blind ? me->street_bet : p->big_blind;
    p->raises_in_street++;
    p->last_aggressor = actor;
    for (s = 0; s < p->seats_count; s++) {
      if (s != actor && p->seats[s].in_hand && !p->seats[s].folded && !p->seats[s].all_in) {
        p->seats[s].acted = 0;
      }
    }
    advance_if_round_complete(p, actor);
    return KLANG_KARTE;
  }

  if (type == MOVE_RAISE) {
    u16 prev_bet = p->current_bet;
    u16 add = target > me->street_bet ? (target - me->street_bet) : 0;
    u16 diff;
    post_chip_amount(me, add, 1);
    me->acted = 1;
    diff = me->street_bet > prev_bet ? (me->street_bet - prev_bet) : 0;
    p->current_bet = me->street_bet;
    if (diff >= p->min_raise) p->min_raise = diff;
    p->raises_in_street++;
    p->last_aggressor = actor;
    for (s = 0; s < p->seats_count; s++) {
      if (s != actor && p->seats[s].in_hand && !p->seats[s].folded && !p->seats[s].all_in) {
        p->seats[s].acted = 0;
      }
    }
    advance_if_round_complete(p, actor);
    return KLANG_KARTE;
  }

  if (type == MOVE_ALLIN) {
    u16 prev_bet = p->current_bet;
    post_chip_amount(me, me->chips, 1);
    me->acted = 1;
    me->all_in = 1;
    if (me->street_bet > prev_bet) {
      u16 diff = me->street_bet - prev_bet;
      p->current_bet = me->street_bet;
      if (diff >= p->min_raise) {
        p->min_raise = diff;
        p->raises_in_street++;
        p->last_aggressor = actor;
        for (s = 0; s < p->seats_count; s++) {
          if (s != actor && p->seats[s].in_hand && !p->seats[s].folded && !p->seats[s].all_in) {
            p->seats[s].acted = 0;
          }
        }
      }
    }
    advance_if_round_complete(p, actor);
    return KLANG_KARTE;
  }

  return KLANG_KLICK;
}

/* ------------------------------------------------------------------ Bot */

static s16 chen_score(u8 a, u8 b) {
  s16 r1 = (s16)(a >> 2);
  s16 r2 = (s16)(b >> 2);
  s16 high = r1 > r2 ? r1 : r2;
  s16 low = r1 < r2 ? r1 : r2;
  s16 score = high == 14 ? 10 : (high == 13 ? 8 : (high == 12 ? 7 : (high == 11 ? 6 : high / 2)));
  s16 gap;
  if (high == low) {
    s16 p = score * 2;
    return p < 5 ? 5 : p;
  }
  if ((a & 3) == (b & 3)) score += 2;
  gap = high - low - 1;
  if (gap == 1) score -= 1;
  else if (gap == 2) score -= 2;
  else if (gap == 3) score -= 4;
  else if (gap >= 4) score -= 5;
  return score;
}

static void poker_bot(const u8 *stand, u8 stufe, Zufall *z, Zug *zug) {
  u16 n = poker_zuege(stand, zugliste);
  u16 i;

  if (n == 0) return;

  if (stufe == STUFE_LEICHT) {
    u16 idx = (u16)zufall_bis(z, n);
    *zug = zugliste[idx];
    return;
  }

  /* Stufe Mittel und Schwer: Überlegte Auswahl */
  {
    const Poker *p = (const Poker *)stand;
    u8 actor = poker_am_zug(stand);
    const PokerSeat *me = &p->seats[actor];
    u16 to_call = p->current_bet > me->street_bet ? (p->current_bet - me->street_bet) : 0;

    if (p->board_count == 0) {
      /* Preflop */
      u8 r0 = me->hole_cards[0] >> 2;
      u8 r1 = me->hole_cards[1] >> 2;
      s16 chen = chen_score(me->hole_cards[0], me->hole_cards[1]);
      if (r0 == r1 || r0 >= 14 || r1 >= 14 || chen >= 6) {
        /* Pocket Pair, Ass auf der Hand oder starke Karten: Erhöhen / Setzen */
        for (i = 0; i < n; i++) {
          if (zugliste[i].b[1] == MOVE_RAISE || zugliste[i].b[1] == MOVE_BET || zugliste[i].b[1] == MOVE_ALLIN) {
            *zug = zugliste[i];
            return;
          }
        }
      }
      if (r0 >= 11 || r1 >= 11 || chen >= 3 || to_call <= p->big_blind * 2) {
        /* Bildkarten oder günstiger Call: Mitgehen / Schieben */
        for (i = 0; i < n; i++) {
          if (zugliste[i].b[1] == MOVE_CALL || zugliste[i].b[1] == MOVE_CHECK) {
            *zug = zugliste[i];
            return;
          }
        }
      }
      /* Schwache Hand: Schieben falls möglich, sonst Passen */
      for (i = 0; i < n; i++) {
        if (zugliste[i].b[1] == MOVE_CHECK) {
          *zug = zugliste[i];
          return;
        }
      }
      for (i = 0; i < n; i++) {
        if (zugliste[i].b[1] == MOVE_FOLD) {
          *zug = zugliste[i];
          return;
        }
      }
    } else {
      /* Postflop: Handstärke */
      u8 all_cards[7];
      u32 score;
      u8 category;
      all_cards[0] = me->hole_cards[0];
      all_cards[1] = me->hole_cards[1];
      for (i = 0; i < p->board_count; i++) all_cards[2 + i] = p->board[i];
      score = evaluate_codes(all_cards, 2 + p->board_count);
      category = (u8)(score >> 20);

      if (category >= 1) {
        /* Paar oder besser: Setzen / Erhöhen / Allin */
        for (i = 0; i < n; i++) {
          if (zugliste[i].b[1] == MOVE_RAISE || zugliste[i].b[1] == MOVE_BET || zugliste[i].b[1] == MOVE_ALLIN) {
            *zug = zugliste[i];
            return;
          }
        }
        for (i = 0; i < n; i++) {
          if (zugliste[i].b[1] == MOVE_CALL || zugliste[i].b[1] == MOVE_CHECK) {
            *zug = zugliste[i];
            return;
          }
        }
      }

      /* Kein Paar (High Card): Erst Schieben probieren */
      for (i = 0; i < n; i++) {
        if (zugliste[i].b[1] == MOVE_CHECK) {
          *zug = zugliste[i];
          return;
        }
      }
      if (to_call <= p->big_blind || (me->hole_cards[0] >> 2) >= 13 || (me->hole_cards[1] >> 2) >= 13) {
        for (i = 0; i < n; i++) {
          if (zugliste[i].b[1] == MOVE_CALL) {
            *zug = zugliste[i];
            return;
          }
        }
      }
      for (i = 0; i < n; i++) {
        if (zugliste[i].b[1] == MOVE_FOLD) {
          *zug = zugliste[i];
          return;
        }
      }
    }
  }

  *zug = zugliste[0];
}

/* ------------------------------------------------------------------ Prüfmodus */

static u16 poker_ausgeben(const u8 *stand, u8 *puffer) {
  const Poker *p = (const Poker *)stand;
  u16 n = 0;
  u8 s, i;

  puffer[n++] = p->street;
  puffer[n++] = (u8)(p->hand_number & 0xff);
  puffer[n++] = (u8)((p->hand_number >> 8) & 0xff);
  puffer[n++] = p->level_index;
  puffer[n++] = p->button;
  puffer[n++] = p->actor;

  puffer[n++] = (u8)(p->current_bet & 0xff);
  puffer[n++] = (u8)((p->current_bet >> 8) & 0xff);
  puffer[n++] = (u8)(p->min_raise & 0xff);
  puffer[n++] = (u8)((p->min_raise >> 8) & 0xff);
  puffer[n++] = p->raises_in_street;

  puffer[n++] = p->board_count;
  for (i = 0; i < p->board_count; i++) puffer[n++] = p->board[i];

  puffer[n++] = p->deck_count;
  for (i = 0; i < p->deck_count; i++) puffer[n++] = p->deck[i];

  for (s = 0; s < p->seats_count; s++) {
    const PokerSeat *seat = &p->seats[s];
    puffer[n++] = seat->status;
    puffer[n++] = (u8)(seat->chips & 0xff);
    puffer[n++] = (u8)((seat->chips >> 8) & 0xff);
    puffer[n++] = seat->in_hand;
    puffer[n++] = seat->folded;
    puffer[n++] = seat->all_in;
    puffer[n++] = (u8)(seat->street_bet & 0xff);
    puffer[n++] = (u8)((seat->street_bet >> 8) & 0xff);
    puffer[n++] = (u8)(seat->total_committed & 0xff);
    puffer[n++] = (u8)((seat->total_committed >> 8) & 0xff);
    puffer[n++] = seat->acted;
    puffer[n++] = seat->hole_card_count;
    for (i = 0; i < seat->hole_card_count; i++) puffer[n++] = seat->hole_cards[i];
  }

  /* RNG: 4 x u32 */
  for (i = 0; i < 4; i++) {
    u32 v = p->rng.s[i];
    puffer[n++] = (u8)(v & 0xff);
    puffer[n++] = (u8)((v >> 8) & 0xff);
    puffer[n++] = (u8)((v >> 16) & 0xff);
    puffer[n++] = (u8)((v >> 24) & 0xff);
  }

  return n;
}

/* ------------------------------------------------------------------ Oberfläche */

enum {
  FELD_PASSEN = 0,
  FELD_SCHIEBEN = 1,
  FELD_MITGEHEN = 2,
  FELD_ERHOEHEN = 3,
  FELD_ALLIN = 4,
  POKER_FELDER_ANZAHL = 5
};

static void poker_gitter(const u8 *stand, u8 *breite, u8 *hoehe) {
  (void)stand;
  *breite = 5;
  *hoehe = 1;
}

static u8 poker_feld_an(const u8 *stand, u8 x, u8 y) {
  (void)stand;
  (void)y;
  return x < 5 ? x : FELD_PASSEN;
}

static u8 poker_felder(const u8 *stand, const Zug *zug, u8 *f) {
  (void)stand;
  u8 type = zug->b[1];
  if (type == MOVE_FOLD) f[0] = FELD_PASSEN;
  else if (type == MOVE_CHECK) f[0] = FELD_SCHIEBEN;
  else if (type == MOVE_CALL) f[0] = FELD_MITGEHEN;
  else if (type == MOVE_BET || type == MOVE_RAISE) f[0] = FELD_ERHOEHEN;
  else f[0] = FELD_ALLIN;
  return 1;
}

static void zeige_poker_karte(u8 x, u8 y, u8 code) {
  static const char FARBEN_SYMB[4] = { 'C', 'D', 'H', 'S' };
  static const u8 FARBEN_PAL[4] = { PAL_BRETT_MARKE, PAL_GELB, PAL_ROT, PAL_BLAU };
  u8 rank = code >> 2;
  u8 suit = code & 3;

  kachel(x, y, FARBEN_SYMB[suit], FARBEN_PAL[suit]);
  if (rank == 14) {
    kachel(x + 1, y, 'A', FARBEN_PAL[suit]);
    kachel(x + 2, y, ' ', FARBEN_PAL[suit]);
  } else if (rank == 13) {
    kachel(x + 1, y, 'K', FARBEN_PAL[suit]);
    kachel(x + 2, y, ' ', FARBEN_PAL[suit]);
  } else if (rank == 12) {
    kachel(x + 1, y, 'D', FARBEN_PAL[suit]);
    kachel(x + 2, y, ' ', FARBEN_PAL[suit]);
  } else if (rank == 11) {
    kachel(x + 1, y, 'B', FARBEN_PAL[suit]);
    kachel(x + 2, y, ' ', FARBEN_PAL[suit]);
  } else {
    zahl(x + 1, y, rank, 2, FARBEN_PAL[suit]);
  }
}

static void poker_zeichnen(const u8 *stand, const u8 *markierung, u8 aktiv) {
  const Poker *p = (const Poker *)stand;
  u8 i;
  const PokerSeat *ich = &p->seats[0];
  const PokerSeat *bot = &p->seats[1];

  bild_leeren();
  tafel(1, 3, 30, 22);

  /* Gegner (oben) */
  text(3, 4, "Gegner:", PAL_GRAU);
  zahl(11, 4, bot->chips, 5, PAL_TEXT);
  text(17, 4, "Chips", PAL_GRAU);
  if (p->button == 1) text(24, 4, "(D)", PAL_GELB);
  if (bot->street_bet > 0) {
    text(3, 5, "Einsatz:", PAL_GRAU);
    zahl(12, 5, bot->street_bet, 5, PAL_TEXT);
  }
  if (bot->folded) text(22, 5, "Gepasst", PAL_ROT);
  else if (bot->all_in) text(22, 5, "All-in", PAL_GELB);

  /* Tischmitte: Pot & Board */
  text(3, 8, "Pot:", PAL_GELB);
  zahl(8, 8, total_pot(p), 5, PAL_GELB);

  text(3, 10, "Board:", PAL_GRAU);
  for (i = 0; i < p->board_count; i++) {
    zeige_poker_karte(10 + i * 4, 10, p->board[i]);
  }

  /* Spieler (unten) */
  text(3, 14, "Du:", PAL_GELB);
  zahl(7, 14, ich->chips, 5, PAL_TEXT);
  text(13, 14, "Chips", PAL_GRAU);
  if (p->button == 0) text(20, 14, "(D)", PAL_GELB);

  text(3, 16, "Karten:", PAL_GRAU);
  if (ich->hole_card_count >= 2) {
    zeige_poker_karte(11, 16, ich->hole_cards[0]);
    zeige_poker_karte(16, 16, ich->hole_cards[1]);
  }
  if (ich->street_bet > 0) {
    text(22, 16, "Eins.:", PAL_GRAU);
    zahl(28, 16, ich->street_bet, 4, PAL_TEXT);
  }

  /* Aktionsknöpfe */
  text(3, 19, "[Passen]", PAL_TEXT);
  text(12, 19, "[Schieben/Mit]", PAL_TEXT);
  text(24, 19, "[Setzen]", PAL_TEXT);

  if (aktiv) {
    if (markierung[FELD_PASSEN] & MARK_CURSOR) kachel(2, 19, K_PFEIL, PAL_GELB);
    if ((markierung[FELD_SCHIEBEN] | markierung[FELD_MITGEHEN]) & MARK_CURSOR) kachel(11, 19, K_PFEIL, PAL_GELB);
    if ((markierung[FELD_ERHOEHEN] | markierung[FELD_ALLIN]) & MARK_CURSOR) kachel(23, 19, K_PFEIL, PAL_GELB);
  }

  /* Blinds / Runde */
  text(3, 22, "Blinds:", PAL_GRAU);
  zahl(11, 22, p->small_blind, 4, PAL_TEXT);
  text(15, 22, "/", PAL_GRAU);
  zahl(16, 22, p->big_blind, 4, PAL_TEXT);
  text(22, 22, "Hand", PAL_GRAU);
  zahl(27, 22, p->hand_number, 3, PAL_TEXT);
}

/* ------------------------------------------------------------------ Steckbrief */

static const char *const POKER_ANLEITUNG[] = {
  "Texas Hold'em: Jeder erhält zwei verdeckte Karten, dazu fünf offene Gemeinschaftskarten in der Mitte.",
  "Setzrunden vor dem Flop, nach dem Flop (3 Karten), Turn (1 Karte) und River (1 Karte).",
  "Bilde die beste 5-Karten-Kombination aus deinen 2 Handkarten und den 5 Tischkarten.",
  0,
};

static const char *const OPTION_STRUKTUR_WERTE[] = { "No Limit", "Pot Limit", "Fixed Limit" };
static const char *const OPTION_MODUS_WERTE[] = { "Turnier", "20 Hände", "50 Hände" };
static const char *const OPTION_STACK_WERTE[] = { "50 BB", "100 BB", "200 BB" };
static const char *const OPTION_TEMPO_WERTE[] = { "Alle 10", "Alle 6", "Alle 4" };
static const char *const OPTION_ANTE_WERTE[] = { "Aus", "Ab Stufe 4", "Immer" };

static const Option POKER_OPTIONEN[] = {
  { "Struktur", OPTION_STRUKTUR_WERTE, 3, 0 },
  { "Modus", OPTION_MODUS_WERTE, 3, 0 },
  { "Startchips", OPTION_STACK_WERTE, 3, 1 },
  { "Blinderhöhung", OPTION_TEMPO_WERTE, 3, 1 },
  { "Ante", OPTION_ANTE_WERTE, 3, 1 },
};

static const char *const PLATZ_NAMEN[] = { "Spieler 1", "Spieler 2", "Spieler 3", "Spieler 4" };
static const u8 PLATZ_PALETTEN[] = { PAL_ROT, PAL_BLAU, PAL_GELB, PAL_BRETT_MARKE };

const Spiel spiel_poker = {
  "Poker",
  POKER_ANLEITUNG,
  "✚ Wahl · A Zug",
  PLATZ_NAMEN,
  PLATZ_PALETTEN,
  2, 4,
  1, /* verdeckte Karten */
  POKER_OPTIONEN,
  5,
  FARBEN_KARTEN,
  poker_aufbauen,
  poker_am_zug,
  poker_zuege,
  poker_ziehen,
  poker_ergebnis,
  poker_bot,
  poker_ausgeben,
  poker_gitter,
  poker_feld_an,
  poker_felder,
  poker_zeichnen,
  0, 0,
  0,
  0,
  0,
};
