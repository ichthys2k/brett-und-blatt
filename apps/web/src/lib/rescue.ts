/*
 * Hinweis „Rettungskarte sichern“ (Wunsch von Cornelius, 8.11.2026): Der Rettungscode ist der einzige Weg zurück, wenn das Gerät
 * verloren geht oder die PIN gesperrt ist. Darum erinnert der Pass daran, bis die Karte gedruckt und sicher weggelegt ist.
 */

export type RescueState =
  /** Es gibt noch keinen Ausweis; nichts zu sagen. */
  | 'none'
  /** Spielercode da, aber noch kein Rettungscode. */
  | 'create'
  /** Rettungscode da, Karte noch nicht gedruckt oder nicht als weggelegt abgehakt. */
  | 'secure'
  /** Alles erledigt. */
  | 'ok';

export function rescueState(hasPlayerCode: boolean, hasRescueCode: boolean, marked: 'gedruckt' | 'gesichert' | null): RescueState {
  if (!hasPlayerCode && !hasRescueCode) return 'none';
  if (!hasRescueCode) return 'create';
  return marked === 'gesichert' ? 'ok' : 'secure';
}
