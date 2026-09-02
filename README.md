# Pulse

现场投票。每人一票，结果条实时同步。

这是已发布版的源码快照。线上站点继续跑这一版；新功能请从 `main` 开分支。

## 本地运行

需要 Node.js 22+。

```bash
git clone https://github.com/GGX355/pulse.git
cd pulse
npm install
npm run dev
```

开发服务默认在 `http://localhost:8080`。

```bash
npm run typecheck
npm run build
```

## 功能

- 创建包含多个选项的问题(发起 / 结束需登录,邮箱密码注册;投票不需要登录)
- 每个浏览器一票(cookie `pulse_vk`),数据库唯一约束兜底
- 投票列表 `/polls`,单场详情 `/poll/:id`(带二维码与复制链接,现场扫码即达)
- 发起人可以结束投票,结束后不能再投
- 真实票数同步,结果条带动画
- 总票数、百分比、已选择 / 已锁定状态

## 分支建议

| 分支 | 用途 |
|---|---|
| `main` | 已发布快照,保持稳定 |
| `dev` | 本地继续加功能 |

```bash
git checkout -b dev
```
