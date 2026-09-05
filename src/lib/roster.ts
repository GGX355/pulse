/**
 * 名单核对(投票/抽签通用):创建时贴一份名单,参与时以「参与登记」填写的
 * 姓名匹配。三层规则都在这里,由 poll-repo / draw-repo 在写入前调用:
 *   1. rosterExists —— 这场内容有没有配名单;
 *   2. rosterHas    —— 这个姓名在不在名单上;
 *   3. rosterTaken  —— 这个姓名是否已经参与过(每姓名限一次)。
 * 纯数据层,不碰 Cookie 和框架 —— 与 poll-repo/draw-repo 同一约定。
 */
export type RosterEntry = {
  name: string;
  /** 已参与(票面登记的姓名匹配到该名单项)。 */
  done: boolean;
  /** 参与结果:抽签为中签文案;投票为所选项(多项用「、」连接)。 */
  result: string | null;
  /** 参与时间;未参与为 null。 */
  atMs: number | null;
};

export type Sql = {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<T[]>;
};

/** 覆写名单:先清后插,创建与(潜在的)重放都安全。 */
export async function setRoster(
  sql: Sql,
  pollId: string,
  names: string[],
): Promise<void> {
  await sql.query(`delete from poll_roster where poll_id = $1`, [pollId]);
  const seen = new Set<string>();
  let order = 0;
  for (const raw of names) {
    const name = raw.trim().slice(0, 40);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    await sql.query(
      `insert into poll_roster (id, poll_id, name, sort_order)
       values ($1, $2, $3, $4)`,
      [crypto.randomUUID(), pollId, name, order],
    );
    order += 1;
  }
}

export async function rosterExists(sql: Sql, pollId: string): Promise<boolean> {
  const rows = await sql.query<{ n: number }>(
    `select count(*)::int as n from poll_roster where poll_id = $1`,
    [pollId],
  );
  return (rows[0]?.n ?? 0) > 0;
}

export async function rosterHas(
  sql: Sql,
  pollId: string,
  name: string,
): Promise<boolean> {
  const rows = await sql.query<{ n: number }>(
    `select count(*)::int as n from poll_roster where poll_id = $1 and name = $2`,
    [pollId, name],
  );
  return (rows[0]?.n ?? 0) > 0;
}

export async function rosterTaken(
  sql: Sql,
  pollId: string,
  name: string,
): Promise<boolean> {
  const rows = await sql.query<{ n: number }>(
    `select count(*)::int as n from poll_votes where poll_id = $1 and voter_note = $2`,
    [pollId, name],
  );
  return (rows[0]?.n ?? 0) > 0;
}

export type RosterStatus = {
  hasRoster: boolean;
  total: number;
  doneCount: number;
  entries: RosterEntry[];
};

/** 后台核对视图:名单每个人 + 参与/结果/时间,按名单原顺序。 */
export async function rosterStatus(
  sql: Sql,
  pollId: string,
): Promise<RosterStatus> {
  const roster = await sql.query<{ name: string }>(
    `select name from poll_roster where poll_id = $1 order by sort_order asc`,
    [pollId],
  );
  if (roster.length === 0) {
    return { hasRoster: false, total: 0, doneCount: 0, entries: [] };
  }

  const votes = await sql.query<{
    voter_note: string;
    result: string;
    at_ms: number;
  }>(
    `select v.voter_note,
            string_agg(o.label, '、' order by v.created_at asc) as result,
            (extract(epoch from min(v.created_at)) * 1000)::bigint as at_ms
     from poll_votes v
     join poll_options o on o.id = v.option_id
     where v.poll_id = $1 and v.voter_note <> ''
     group by v.voter_note`,
    [pollId],
  );

  const byName = new Map(
    votes.map((row) => [
      row.voter_note,
      { result: row.result, atMs: Number(row.at_ms) },
    ]),
  );

  const entries: RosterEntry[] = roster.map((row) => {
    const hit = byName.get(row.name);
    return {
      name: row.name,
      done: Boolean(hit),
      result: hit?.result ?? null,
      atMs: hit?.atMs ?? null,
    };
  });
  const doneCount = entries.filter((entry) => entry.done).length;
  return { hasRoster: true, total: entries.length, doneCount, entries };
}
