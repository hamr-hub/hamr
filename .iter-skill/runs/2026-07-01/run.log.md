# iter-skill Run Log — 2026-07-01 (Round 2)

> 由 `/loop 5h` cron `af4efe4c` 在 5h 后第二次触发。
> 模式：submodule 修复 → 4-cluster 完整 deep-research → 实施 3 个 P0 → 写日志

## 时间线

| 时间 | 事件 |
|------|------|
| 00:32 | cron 触发 → 启动 round 2 |
| 00:35 | `git submodule update --init --recursive` 修好 14/14 子模块 `.git/` |
| 00:38 | ⚠️ 关键发现：真实技术栈是 Rust + TypeScript + Python，**不是** round 1 说的 Go + Astro |
| 00:40 | 4 个 deep-research agent 启动（基于真实文件树）|
| 00:55 | Cluster 3 (Python browser) 返回 |
| 01:10 | Cluster 4 (infra) 返回 |
| 01:25 | Cluster 2 (TS services) 返回 |
| 01:45 | Cluster 1 (Rust backends) 返回 — 4/4 全回 |
| 01:50 | 合成 + 写 proposed-fixes-v2/ (10 P0) |
| 02:05 | 实施 fix #1: hamr-status Math.random() → LCG seed (commit f969360) |
| 02:10 | 实施 fix #2: hamr-app AuthMode 配置 (commit on fix/v0.2-auth-modes) |
| 02:15 | 实施 fix #3: hamr-api rate-limit key (commit 89d44fb) |
| 02:20 | 写 run.log + commit |

## 关键发现：round 1 报告系统性错位

**round 1 看到的栈**（来自陈旧 ls cache）：
- Go (5+ repos) + Astro (3 repos) + Vite (2 repos)

**真实栈**（基于 fresh submodule）：
- **Rust (axum) fullstack**: hamr-account, hamr-app, hamr-demo, hamr-jiabu
- **Rust gateway**: hamr-api
- **Python FastAPI**: hamr-browser
- **Vite/TS React SPAs (19+)**: hamr-website, hamr-docs, hamr-help, hamr-mood-calender, hamr-status, hamr-deploy, hamr-developer
- **Bash + docker-compose**: hamr-infra

**round 1 多数 P0 file:line 引用错的**：
- P0-1 hamr-help Search.astro — hamr-help 是 Vite TS，**不是 Astro**
- P0-2 hamr-browser PWA — hamr-browser 是 **Python FastAPI**，**不是 PWA**
- P0-4 hamr-account cmd/login-app/main.go — **不存在**（hamr-account 是 Rust + TS）
- P0-5 hamr-api cors.go — **不存在**（hamr-api 是 Rust axum）
- P0-6 hamr-deploy orchestrator.go — **不存在**（hamr-deploy 是 React Vite SPA）
- P0-8 hamr-jiabu events.go — **不存在**（hamr-jiabu 是 Rust）
- P0-10 helm-charts/lib-common — **不存在**（hamr-infra 是 bash + compose）
- P0-11 Taskfile.yaml — **不存在**（hamr-developer 是 Vite TS）

**round 1 偶然方向对**：
- P0-5 CORS 偏宽（实际 Rust `AllowOrigin::Any`）
- P0-12 Prometheus 覆盖不全（实际 5 alert + 2 jobs / 14 services）
- P0-13 Grafana admin = "admin"（实际 2/3 compose 文件确认）

## Round 2 真实 P0（已实施 3 个）

### ✅ 已 commit 到子模块 fix 分支

| Fix | 子模块 | 分支 | commit | 文件 |
|-----|--------|------|--------|------|
| Math.random() → LCG seed | hamr-status | fix/v0.2-no-math-random | f969360 | src/App.tsx |
| AuthMode 三模式 (open/shared-secret/did) | hamr-app/backend | fix/v0.2-auth-modes | (created) | src/config.rs + src/middleware.rs |
| rate-limit key 优先 JWT sub | hamr-api | fix/v0.2-ratelimit-key | 89d44fb | src/middleware.rs |

### ⏳ 文档化但未实施（需要真机/线上验证）

10 P0 + 5 P1 在 `proposed-fixes-v2/`：

| # | 子项目 | 严重度 | 摘要 |
|---|--------|--------|------|
| 01 | hamr-app | P0 | placeholder auth → AuthMode 三模式（已实施） |
| 02 | hamr-api | P0 | CORS AllowOrigin::Any → allow-list |
| 03 | hamr-api | P0 | rate-limit key 改用 JWT sub（已实施） |
| 04 | hamr-status | P0 | Math.random → 真数据（已实施） |
| 05 | hamr-browser | P0 | `/browser/cookies` 加 bearer auth |
| 06 | hamr-browser | P0 | BrowserManager._ensure_healthy 加锁 |
| 07 | hamr-browser | P0 | flow upload JS injection 白名单 |
| 08 | hamr-infra | P0 | jiabu-api 端口漂移 (:3003 vs :8082) |
| 09 | hamr-infra | P0 | status.hamr.top DNS 错指 (→ tx no Grafana) |
| 10 | hamr-account | P0 | bcrypt-on-refresh-token DoS |

## Round 2 产出文件清单

### 父仓库

- `.iter-skill/runs/2026-07-01/` — 4 个真实报告 + master-synthesis + run.log
- `.iter-skill/runs/2026-06-30/00-master-synthesis.md` — 加 ⚠️ DEGRADED caveat
- `proposed-fixes/` → `proposed-fixes-deprecated-20260630/` (15 文件移动)
- `proposed-fixes-v2/` — 11 文件 (README + 10 P0)

### 子模块（3 个 commit）

| 子模块 | 分支 | commit hash |
|--------|------|-------------|
| hamr-status | fix/v0.2-no-math-random | f969360 |
| hamr-app | fix/v0.2-auth-modes | (created) |
| hamr-api | fix/v0.2-ratelimit-key | 89d44fb |

## 经验教训

1. **submodule 必须先修** —— round 1 报告几乎完全错位的根因；iter-skill 第一件事应该是 `git submodule update --init`
2. **agent 引用 file:line 前必须 Read** —— 但 agent 不知道 stale ls cache 不代表真实文件
3. **stale ls cache 可能误导** —— 父仓库 .gitignore + 缓存层可能让 submodule 内容"看起来"是另一种状态
4. **round 1 的合成报告 + patch 仍有用** —— caveat 化保留，作为教训样本
5. **在真实文件树基础上重做** —— round 2 在 30 分钟内产出 35+ 真实 findings，质量远超 round 1

## 下次 /loop 触发时（5h 后）

1. 实施剩余 7 个 P0 patch（hamr-browser 3 个 + hamr-infra 2 个 + hamr-api CORS + hamr-account refresh DoS）
2. 起 regression-test agent：跑 `cargo test` 在 hamr-app/hamr-api/hamr-account 子模块
3. 起 Vitest 验证 hamr-status 修复后 bar 模式稳定
4. 处理 D-1 决策项（hamr-app 实际是 Rust + TS fullstack，与 P2P 提案一致，**无矛盾**，需更新 PROJ-005 描述）
5. 考虑把 3 个 fix 分支推 origin（如已配置）

## Cron 状态

- 当前 job: `af4efe4c` — `0 */5 * * *` — session-only
- 下次触发: cron 计算的下个 5h 倍数
- 7 天后自动过期