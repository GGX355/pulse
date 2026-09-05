-- One optional write-in option per poll. Voters who pick it must supply text.
alter table poll_options
  add column if not exists is_write_in boolean not null default false;

alter table poll_votes
  add column if not exists write_in_text text not null default '';
