import { nanoid } from '@ttf/shared';
import { Settings } from '../db/repos';

let _deviceId: string | null = null;

/**
 * Stable per-install device id. Used by the sync engine to attribute
 * writes and break LWW ties. Persisted in the local `settings` table.
 */
export async function getDeviceId(): Promise<string> {
  if (_deviceId) return _deviceId;
  let id = await Settings.get('device_id');
  if (!id) {
    id = nanoid();
    await Settings.set('device_id', id);
  }
  _deviceId = id;
  return id;
}
