-- Poll ownership and lifecycle: who created a poll, and when it was closed.
-- creator_id is a Better Auth user id (text, from the auth schema) and is null
-- for polls created before sign-in existed.
alter table polls add column if not exists creator_id text;
alter table polls add column if not exists closed_at timestamptz;

create index if not exists polls_creator_id_idx on polls (creator_id);
