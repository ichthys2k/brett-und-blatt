; Große Puffer in der zweiten RAM-Bank $7F.
; Die Variablen aus C landen in Bank $7E ab $2000; ab $8000 liegen dort feste Bereiche von PVSnesLib
; (Sprite-Tabelle, Konsole). Wird es in $7E zu voll, legt der Linker C-Variablen darüber – darum
; stehen die großen Puffer hier. Die Größen müssen zu den Deklarationen in C passen.
.include "hdr.asm"

.RAMSECTION ".ram7f" BANK $7F SLOT 3
spielstand      DSB 4096        ; u8 spielstand[SPIELSTAND_GROESSE] (spiel.h)
zugliste        DSB 6144        ; Zug zugliste[ZUEGE_MAX], 256 × 24 Bytes
muehle_suche    DSB 9600        ; Zug [4][100] (muehle.c)
dame_suche      DSB 5760        ; Zug [5][48] (dame.c)
.ENDS
