-- Draws (抽奖/抽签): a second content kind alongside polls.
--
-- Reuses the polls/poll_options/poll_votes tables — a draw IS a poll row with
-- kind='draw'. Existing poll rows keep working untouched through the defaults.
--
--   polls.kind          'poll' (default) | 'draw'
--   poll_options.slot_count  draw tickets available for this slot; -1 = 不限量;
--                       always 0 for poll options (meaningless there)
--   poll_options.taken  draw tickets already claimed. A counter, not a COUNT():
--                       claiming happens through a conditional
--                       `update ... set taken = taken + 1 where taken < slot_count`
--                       whose row lock makes it atomic under concurrency — a
--                       count-then-insert check would race and over-issue the
--                       last ticket. The poll_votes row inserted right after is
--                       the per-person record; on a unique conflict (this voter
--                       already drew) the claim is reverted.

alter table polls add column if not exists kind text not null default 'poll';
alter table poll_options add column if not exists slot_count int not null default 0;
alter table poll_options add column if not exists taken int not null default 0;

create index if not exists polls_kind_idx on polls (kind);
