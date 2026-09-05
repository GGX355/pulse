-- Per-device (cookie) display name for the admin roster only.
-- Public vote payloads do not include this table.
create table if not exists voter_profiles (
  voter_key text primary key,
  display_name text not null,
  updated_at timestamptz not null default now()
);
