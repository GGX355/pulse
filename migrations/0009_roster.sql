-- 名单核对:创建时可以贴一份人员名单,仅名单内的人可参与(以参与登记填写的
-- 姓名匹配),发起人在后台实时看到谁已参与、谁还没参与。
--
-- 匹配键是 poll_votes.voter_note(参与登记填写的内容),不与浏览器 Cookie
-- 绑定 —— 换设备填同一个名字,后台依然归到同一个人;同名的第二台设备会被
-- 应用层拒绝(每个姓名限参与一次)。

create table if not exists poll_roster (
  id text primary key,
  poll_id text not null references polls (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  unique (poll_id, name)
);

create index if not exists poll_roster_poll_id_idx on poll_roster (poll_id);
