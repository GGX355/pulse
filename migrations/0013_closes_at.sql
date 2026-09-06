-- 投票截止时间:可选设定;到点自动截止(不再接受投票),详情页展示倒计时。
alter table polls
  add column if not exists closes_at timestamptz;
