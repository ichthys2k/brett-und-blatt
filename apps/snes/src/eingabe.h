/*
 * Knöpfe der Controller. `eingabe_lesen` läuft einmal je Bild (aus bild_warten).
 * `tasten_neu` meldet frisch gedrückte Knöpfe; das Steuerkreuz wiederholt beim Festhalten.
 */
#ifndef EINGABE_H
#define EINGABE_H

#include <snes.h>

#define CONTROLLER 2

/** Beim Start: Zustand löschen (der Startcode von PVSnesLib löscht nicht alle Variablen). */
void eingabe_start(void);
void eingabe_lesen(void);
/** Frisch gedrückte Knöpfe (mit Wiederholung des Steuerkreuzes) an `port`. */
u16 tasten_neu(u8 port);
/** Frisch gedrückte Knöpfe an allen Controllern zusammen. */
u16 tasten_alle(void);
/** Wartet, bis an keinem Controller mehr ein Knopf gedrückt ist. */
void tasten_loslassen(void);
/** Zählt Bilder seit dem Einschalten und mischt Knopfdrücke hinein – Startwert für den Zufall. */
extern u16 eingabe_unruhe;

#define STEUERKREUZ (KEY_UP | KEY_DOWN | KEY_LEFT | KEY_RIGHT)

#endif
