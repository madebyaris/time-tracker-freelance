-- ttf-002: richer client profile
ALTER TABLE clients ADD COLUMN IF NOT EXISTS logo_data text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS tax_id text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS default_hourly_rate_cents integer;
