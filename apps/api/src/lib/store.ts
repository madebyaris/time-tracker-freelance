import type { SyncableTableName } from '@ttf/shared';

export interface UserRecord {
  id: string;
  email: string;
  name: string | null;
  password_hash: string | null;
  created_at: number;
  updated_at: number;
}

export interface CreateUserInput {
  email: string;
  name: string | null;
  password_hash: string;
}

export interface TokenPayload {
  sub: string;
  email?: string;
}

export interface ApiStore {
  ensureReady?(): Promise<void>;
  getUserByEmail(email: string): Promise<UserRecord | null>;
  getUserById(id: string): Promise<UserRecord | null>;
  createUser(input: CreateUserInput): Promise<UserRecord>;
  upsertSyncRow(
    table: SyncableTableName,
    row: Record<string, unknown>,
    userId: string,
  ): Promise<void>;
  listSyncRows(
    table: SyncableTableName,
    userId: string,
    since: number,
  ): Promise<Record<string, unknown>[]>;
}

export interface ApiRuntime {
  runtime: 'node' | 'cloudflare';
  corsOrigins: string[];
  store: ApiStore;
  signAccessToken(userId: string, email: string): Promise<string>;
  verifyAccessToken(token: string): Promise<TokenPayload>;
}
