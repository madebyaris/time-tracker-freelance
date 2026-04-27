import type { SyncableTableName } from '@ttf/shared';

export interface UserRecord {
  id: string;
  email: string;
  name: string | null;
  password_hash: string | null;
  created_at: number;
  updated_at: number;
}

export interface SessionRecord {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: number;
  device_label: string | null;
  created_at: number;
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
  countUsers(): Promise<number>;
  getUserByEmail(email: string): Promise<UserRecord | null>;
  getUserById(id: string): Promise<UserRecord | null>;
  createUser(input: CreateUserInput): Promise<UserRecord>;
  createSession(input: {
    userId: string;
    tokenHash: string;
    expiresAt: number;
    deviceLabel: string | null;
  }): Promise<SessionRecord>;
  getSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  deleteSessionByTokenHash(tokenHash: string): Promise<void>;
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
  registrationMode: 'open' | 'first-user' | 'disabled';
  store: ApiStore;
  signAccessToken(userId: string, email: string): Promise<string>;
  verifyAccessToken(token: string): Promise<TokenPayload>;
}
