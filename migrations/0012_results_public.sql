-- 抽签结果公示开关:发起人可在后台一键公布结果;公布后所有访问者
-- (无论是否已抽)都能看到各签抽取情况与公示名单。
alter table polls
  add column if not exists results_public boolean not null default false;
