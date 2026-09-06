-- 抽签揭晓方式:发起人在后台创建时选择参与者用哪种动画揭晓,可多选
-- (翻牌 flip / 刮奖 scratch / 九宫格 grid)。逗号分隔存储;默认三种全开,
-- 存量抽签行为不变。只选一种时参与者页不显示切换条。
alter table polls
  add column if not exists reveal_modes text not null default 'flip,scratch,grid';
