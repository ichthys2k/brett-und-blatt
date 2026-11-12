import { createPushSender, type PushSender } from '@brett-und-blatt/online';

/** Web Push (#242): Einstellungen des Servers. Fehlt eines, ignoriert der Server Abos und die Oberfläche bleibt unsichtbar. */
export interface PushEnv {
  VAPID_PRIVATE_KEY?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_SUBJECT?: string;
  ROOM_JURISDICTION: string;
}

export function pushConfigured(env: PushEnv): boolean {
  return Boolean(env.VAPID_PRIVATE_KEY && env.VAPID_PUBLIC_KEY && env.VAPID_SUBJECT);
}

export function makePushSender(env: PushEnv): PushSender | null {
  if (!pushConfigured(env)) return null;
  return createPushSender({ publicKey: env.VAPID_PUBLIC_KEY!, privateKey: env.VAPID_PRIVATE_KEY!, subject: env.VAPID_SUBJECT! });
}

/** Nur der lokale Testserver erlaubt Abos auf Loopback-Adressen (für den Rauchtest mit einer Attrappe als Push-Dienst). */
export function allowLocalPush(env: PushEnv): boolean {
  return env.ROOM_JURISDICTION === 'none';
}
