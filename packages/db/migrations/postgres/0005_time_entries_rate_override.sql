-- ttf-005: per-entry hourly rate override on time_entries
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS hourly_rate_cents_override integer;
