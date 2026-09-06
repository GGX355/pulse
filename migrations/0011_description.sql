-- 标题下的可选备注(副标题):发起时可填,展示为小于标题的一行小字;
-- 不填则与旧版完全一致(不渲染)。
alter table polls
  add column if not exists description text not null default '';
