-- How many options one voter may pick: 1 = single choice (default),
-- N >= 2 = up to N (they may pick fewer), 0 = unlimited (up to every option).
-- Ballots keep one submission per voter even when they pick several options.
alter table polls
  add column if not exists max_choices integer not null default 1;

alter table poll_votes drop constraint if exists poll_votes_poll_id_voter_key_key;

create unique index if not exists poll_votes_poll_voter_option_uidx
  on poll_votes (poll_id, voter_key, option_id);

create table if not exists poll_ballots (
  poll_id text not null references polls (id) on delete cascade,
  voter_key text not null,
  created_at timestamptz not null default now(),
  primary key (poll_id, voter_key)
);
