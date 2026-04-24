import {
  syncableTableNames,
  SYNC_PROTOCOL_VERSION,
  type SyncBatch,
  type SyncPullResponse,
  type SyncPushResponse,
} from '@ttf/shared';
import { exec, query } from '../db';
import { Settings } from '../db/repos';
import { getDeviceId } from '../lib/device';

/**
 * Push-then-pull sync pass.
 *  1. Read every row updated since `last_synced_at` from each syncable table
 *  2. POST /sync/push — server upserts using last-write-wins
 *  3. GET /sync/pull?since=last_synced — receive remote changes
 *  4. Apply remote changes (LWW locally), advance `last_synced_at` to server_now
 */
export async function runSync(): Promise<void> {
  const url = await Settings.get('backend_url');
  const token = await Settings.get('backend_token');
  if (!url || !token) throw new Error('Backend not configured');

  const deviceId = await getDeviceId();
  const since = Number((await Settings.get('last_synced_at')) ?? '0');

  // ---- PUSH ----
  const batches: SyncBatch[] = [];
  for (const table of syncableTableNames) {
    const rows = await query(`SELECT * FROM ${table} WHERE updated_at > ?`, [since]);
    if (rows.length > 0) batches.push({ table, rows: rows as never[] });
  }

  let serverNow = since;
  if (batches.length > 0) {
    const pushRes = await fetch(`${url}/sync/push`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        protocol: SYNC_PROTOCOL_VERSION,
        device_id: deviceId,
        since,
        batches,
      }),
    });
    if (!pushRes.ok) throw new Error(`push failed ${pushRes.status}`);
    const pushed = (await pushRes.json()) as SyncPushResponse;
    serverNow = pushed.server_now;
  }

  // ---- PULL ----
  const pullRes = await fetch(
    `${url}/sync/pull?since=${since}&device_id=${encodeURIComponent(deviceId)}&protocol=${SYNC_PROTOCOL_VERSION}`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  if (!pullRes.ok) throw new Error(`pull failed ${pullRes.status}`);
  const pulled = (await pullRes.json()) as SyncPullResponse;

  for (const batch of pulled.batches) {
    await applyBatch(batch);
  }

  await Settings.set(
    'last_synced_at',
    String(Math.max(serverNow, pulled.server_now)),
  );
}

/**
 * Apply remote rows with last-write-wins on `updated_at`.
 * Uses INSERT … ON CONFLICT(id) DO UPDATE WHERE excluded.updated_at > existing.updated_at.
 */
async function applyBatch(batch: SyncBatch): Promise<void> {
  if (batch.rows.length === 0) return;
  for (const row of batch.rows) {
    const cols = Object.keys(row);
    const placeholders = cols.map(() => '?').join(', ');
    const updates = cols
      .filter((c) => !batch.table.startsWith('entry_tags') ? c !== 'id' : true)
      .map((c) => `${c} = excluded.${c}`)
      .join(', ');
    const conflict = batch.table === 'entry_tags' ? 'entry_id, tag_id' : 'id';
    const sql = `
      INSERT INTO ${batch.table} (${cols.join(', ')}) VALUES (${placeholders})
      ON CONFLICT(${conflict}) DO UPDATE SET ${updates}
        WHERE excluded.updated_at > ${batch.table}.updated_at
    `;
    await exec(sql, cols.map((c) => (row as Record<string, unknown>)[c]));
  }
}
