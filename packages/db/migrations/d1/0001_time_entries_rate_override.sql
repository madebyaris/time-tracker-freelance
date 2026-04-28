-- ttf-005: per-entry hourly rate override on time_entries
-- D1 lacks ADD COLUMN IF NOT EXISTS; this migration is safe to run once on
-- existing deployments that already have the initial schema.
ALTER TABLE time_entries ADD COLUMN hourly_rate_cents_override INTEGER;
