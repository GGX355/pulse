# Pulse · 现场投票与抽签

现场扫码即用的投票 + 抽签工具：每人一票、结果条实时同步、盲选抽签带三种揭晓动画。液态玻璃 UI，亮暗双主题。

> 当前最新代码在 **`dev`** 分支（含全部修复与新功能）；`main` 为上一发布快照。

## 功能

**投票与抽签**
- 标题下可选**备注行**（小字副标题，不填则不显示）
- 多选项投票：单选 / 多选（限 N 项 / 不限）/ 填写项（"其他"自填）
- 参与登记：可要求投票前填写姓名等信息；支持**名单核对**（仅名单内可投，后台实时看谁已投谁没投）
- 实时结果条 + 票数动画，1.2 秒轮询全场同步
- 发起人可结束投票；列表 / 详情页带二维码，现场扫码即达

**抽签**
- 自定义签位与数量，支持"未中"兜底签与不限量签
- **盲选**：抽之前看不到任何数字，抽完或结束后公开
- **三种揭晓动画**（发起人可配置其中一种或多种组合）：🂠 翻牌 · ✦ 刮奖 · ▦ 九宫格跑灯
  - 动画只是演出：三种方式的中奖概率完全一致，结果由服务端按剩余签数加权随机
- 发起人后台：全量签位数字、兑奖名单（可复制导出）、实时刷新
- 名单核对（同投票），每姓名限参与一次

**账号与管理**
- 参与无需登录；发起 / 结束 / 删除历史需登录（邮箱密码，开放注册）
- 可选管理员邮箱锁（`VITE_ADMIN_EMAIL`，设置后仅指定邮箱可注册/登录）
- 管理员可删除历史投票 / 抽签（列表叉号，级联删除，确认弹窗防误删）

**界面**
- 苹果液态玻璃设计系统：薄膜材质 + 棱边高光 + 镜面眩光 + Aurora 背景 + 阻尼弹簧动效
- 亮 / 暗 / 跟随系统三态主题，一键切换（尊重 `prefers-reduced-motion`）
- 移动端适配：现场手机扫码是第一公民

## 技术栈

TanStack Start / Router / Query · React 19 · Tailwind CSS v4 · Better Auth · PGlite（本地/预览）或 Neon Postgres（生产）+ Kysely · Vite 8 + Nitro

## 本地运行

需要 Node.js 22+。

```bash
git clone https://github.com/GGX355/pulse.git
cd pulse
git checkout dev          # 最新代码在 dev
npm install
npm run dev               # http://localhost:8080
```

```bash
npm run typecheck         # 类型检查
npm run lint              # ESLint
npm test                  # 数据层/认证/迁移测试
npm run build             # 生产构建（自动执行数据库迁移）
```

## 部署

应用支持三种部署形态（详见下表）。无论哪种，登录相关需要：
`BETTER_AUTH_SECRET`（随机串）、`BETTER_AUTH_URL`（部署域名）；
隧道 / 自托管预览可加 `BETTER_AUTH_EXTRA_ORIGINS`（逗号分隔的额外信任来源）。

| 目标 | 说明 |
|---|---|
| **Vercel + Neon** | 仓库导入 Vercel，配 `DATABASE_URL`（Neon 免费库）等环境变量；构建时自动执行 `migrations/` |
| **任意 Node 主机（腾讯云等）** | `npm ci && npm run build && npm start`；数据库可用同机 Postgres（`DATABASE_URL`）或内置 PGLite 文件库 |
| **Grok 应用平台** | 应用生成于 Grok 沙箱，平台会注入 `GROK_AUTH_*` 等配置；从 GitHub 拉取 dev 分支后按平台流程部署 |

## 项目结构

```
app/                    # TanStack Start 入口与路由级配置
src/routes/             # 文件路由（/ /vote /polls /poll/:id /draw/* /new /login）
src/components/poll/    # 投票与抽签组件（选项行、揭晓舞台、后台面板…）
src/lib/poll-repo.ts    # 投票纯数据层（配套集成测试）
src/lib/draw-repo.ts    # 抽签纯数据层（并发安全的签位认领）
src/lib/auth/           # Better Auth 配置与会话
migrations/             # 数据库迁移（唯一 schema 来源，构建时自动应用）
scripts/                # 迁移 / 环境合并 / 质量检查脚本
```

## 相关仓库

- [`GGX355/pulse-ui-templates`](https://github.com/GGX355/pulse-ui-templates) — 10 套 UI 模板候选的可交互预览站（本项目界面风格的来源）
- [`GGX355/liquid-glass-template`](https://github.com/GGX355/liquid-glass-template) — 液态玻璃设计规范模板（MIT，本项目 UI 的设计基础）

## 分支

| 分支 | 用途 |
|---|---|
| `main` | 已发布快照，保持稳定 |
| `dev` | 开发主线，最新功能与修复先落这里 |
