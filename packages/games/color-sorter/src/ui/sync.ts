import {
  clearSyncError,
  connectSync as connectBlock,
  connectWithPasskey as passkeyBlock,
  createPasskey as createPasskeyFor,
  createSync as createBlock,
  disconnectSync,
  NARRENHOF_SALT,
  passkeySupport,
  registerPassBlock,
  requestPassSync,
  scheduleSync as scheduleBlock,
  syncAvailable as available,
  syncLink as linkFor,
  syncNow as syncBlock,
  takeLinkCode,
  useSyncState,
  type SyncBlock,
} from '@brett-und-blatt/ui/sync';
import { syncServerUrl } from '../server';
import { getProgress, mergeProgress, replaceProgress, sameProgress, sanitize, type Progress } from './progress';

/** Der Narrenhof-Block in der gemeinsamen Sicherung (W-018, W-050); Salt und Feldname bleiben wie sie waren. */
const block: SyncBlock<Progress> = {
  salt: NARRENHOF_SALT,
  field: 'progress',
  serverUrl: syncServerUrl,
  read: getProgress,
  sanitize,
  merge: mergeProgress,
  write: replaceProgress,
  same: sameProgress,
};

/**
 * Seit dem Spielerpass (#141) liegt der Narrenhof-Stand zusätzlich als Block `narrenhof` hinter dem Passschlüssel des Passes.
 * Beide Wege führen mit derselben Logik zusammen (Zählerbuch je Gerät), ein Stand geht also bei keinem verloren.
 */
registerPassBlock<Progress>({ name: 'narrenhof', read: getProgress, sanitize, merge: mergeProgress, write: replaceProgress, same: sameProgress });

export { clearSyncError, disconnectSync, passkeySupport, takeLinkCode, useSyncState };
export const syncAvailable = () => available(block);
export const createSync = () => createBlock(block);
export const connectSync = (input: string) => connectBlock(block, input);
export const syncNow = () => syncBlock(block);
export const scheduleSync = (delayMs = 1500) => {
  scheduleBlock(block, delayMs);
  requestPassSync();
};
export const syncLink = (code: string) => linkFor(code, 'color-sorter');
export const createPasskey = () => createPasskeyFor(syncServerUrl);
export const connectWithPasskey = () => passkeyBlock(block);
