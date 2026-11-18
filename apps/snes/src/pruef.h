#ifndef PRUEF_H
#define PRUEF_H

#include <snes.h>

/** Beim Start: Postfach leeren. */
void pruef_start(void);
/** Hat der Prüf-Emulator die Kennung ins Postfach geschrieben? */
u8 pruef_angefordert(void);
/** Bearbeitet Befehle aus dem Postfach; kehrt nicht zurück. */
void pruef_schleife(void);

#endif
