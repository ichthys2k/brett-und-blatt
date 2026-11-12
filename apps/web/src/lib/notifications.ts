/**
 * Browser-Benachrichtigungen für Züge (insb. bei Fernpartien und asynchronem Spiel).
 */

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission !== 'denied') {
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch {
      return false;
    }
  }
  return false;
}

/** Allgemeiner Hinweis, nur wenn die Seite im Hintergrund liegt (z. B. Schwarzes Brett). */
export function notifyHidden(title: string, body: string): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted' || !document.hidden) return;
  try {
    new Notification(title, { body, icon: '/favicon.ico' });
  } catch {
    // Ignorieren, falls Benachrichtigungen nicht erlaubt sind.
  }
}

export function notifyTurn(gameName: string, detail?: string): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  // Nur benachrichtigen, wenn die Seite im Hintergrund liegt
  if (!document.hidden) return;

  try {
    new Notification(`Du bist am Zug (${gameName})!`, {
      body: detail ?? 'Es ist dein Zug in der Partie.',
      icon: '/favicon.ico',
    });
  } catch {
    // Ignorieren falls Notifications im Browser nicht erlaubt sind
  }
}
