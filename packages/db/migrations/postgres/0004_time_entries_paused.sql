-- ttf-002: real pause semantics on time_entries
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS paused_at bigint;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS paused_seconds integer NOT NULL DEFAULT 0;
