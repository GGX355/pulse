-- Per-vote text note (name / place / time / whatever the creator asked for).
-- voter_note_label is the prompt shown before options; default keeps existing
-- polls asking for a name. Empty voter_note is only for votes cast before this
-- migration — new votes are rejected in the data layer if the note is blank.
alter table polls
  add column if not exists voter_note_label text not null default '名字';

alter table poll_votes
  add column if not exists voter_note text not null default '';
