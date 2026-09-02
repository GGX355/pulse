create table if not exists polls (
  id text primary key,
  question text not null,
  created_at timestamptz not null default now()
);

create table if not exists poll_options (
  id text primary key,
  poll_id text not null references polls (id) on delete cascade,
  label text not null,
  sort_order integer not null default 0
);

create table if not exists poll_votes (
  id text primary key,
  poll_id text not null references polls (id) on delete cascade,
  option_id text not null references poll_options (id) on delete cascade,
  voter_key text not null,
  created_at timestamptz not null default now(),
  unique (poll_id, voter_key)
);

create index if not exists poll_options_poll_id_idx on poll_options (poll_id);
create index if not exists poll_votes_poll_id_idx on poll_votes (poll_id);
create index if not exists poll_votes_option_id_idx on poll_votes (option_id);
create index if not exists polls_created_at_idx on polls (created_at desc);
