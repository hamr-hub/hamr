---
run_id: 2026-10-20-001
trigger: 全面分析与改进（子仓库指针同步 + 复核 + 修复）
mode: 全仓库构建/测试 + 逐条复核 + 修复
status: completed
predecessor: .iter-skill/runs/2026-07-01/ (round 2)
clusters: 1（一次性全家族扫描）
submodule_state: ✅ FIXED — 15 个子仓库全部同步到 origin/main
real_tech_stack: Rust (axum) + TypeScript (Vite/React/Vue) + Python (FastAPI)
---

# HamR 全家族复核与修复 — 2026-10-20 第三轮

> 第三轮与前两轮最大的不同：**第一次真正执行了构建和测试**。
> Round 1 与 Round 2 都只做静态文件扫描，因此都漏掉了"根本编译不过"这一类
> 最致命的阻塞缺陷。

## 0. 最重要的发现：主仓库的子模块指针全部过期

审计开始时，主仓库锁定的子模块指针停在 **2026-07-03**，而各子仓库的
`origin/main` 已经推进到 **2026-09-02**：

| 子仓库 | 锁定指针 | origin/main | 落后 |
|--------|---------|-------------|------|
| hamr-account | f6824b0 | 16ced59 | +24 |
| hamr-api | d24774e | e5cf99e | +24 |
| hamr-app | 038de48 | 4e690c4 | +26 |
| hamr-browser | 26bccec | ffbf8b0 | +18 |
| hamr-demo | f27e654 | 45313ab | +18 |
| hamr-deploy | 3797ee3 | 6fd4cd2 | +18 |
| hamr-developer | f30bf99 | 4d76b2c | +18 |
| hamr-docs | c1eb3d3 | 6206557 | +26 |
| hamr-help | 4cb4163 | c7117d6 | +18 |
| hamr-infra | 7a83e2d | de19aae | +18 |
| hamr-jiabu | a01c6cb | 416f48c | +26 |
| hamr-mood-calender | 2e07187 | dbab8d1 | +25 |
| hamr-status | b015b2d | 3576d31 | +18 |
| hamr-website | ea6e5fb | 0c042d4 | +18 |
| hamr-catch | 4cc3731 | 4cc3731 | 0（已是最新） |

**后果**：任何基于"仓库当前状态"的分析，看到的都是三个月前的代码。
Round 2 的 10 条 P0 里，有 5 条在上游早已修复 —— 如果不先同步就动手，
会把上游已经做对的事情重做一遍，甚至做出冲突的改动。

**处置**：先把 15 个子仓库全部同步到 `origin/main`，再逐条复核。

## 1. Round 2 的 10 条 P0 逐条复核

复核基准：`origin/main`（2026-09-02），而非主仓库锁定的旧指针。

| # | 条目 | 结论 | 依据 |
|---|------|------|------|
| 01 | hamr-app 占位鉴权 | ⚪ **已过时** | `middleware.rs` 已是真 JWT 校验；上游 `a54528b` 三模式认证硬化 |
| 02 | hamr-api CORS `AllowOrigin::Any` | ✅ **上游已修** | `1042941` CORS 白名单（`CORS_ALLOWED_ORIGINS`） |
| 03 | hamr-api 限流键用客户端可控 XFF | ✅ **上游已修** | `89d44fb` 改为 JWT sub → ConnectInfo → XFF |
| 04 | hamr-status `Math.random()` 伪造 uptime | 🔴 **仍成立** | `src/App.tsx:85` 逐根掷骰子 |
| 05 | hamr-browser 完全无鉴权 | 🔴 **仍成立** | 全仓库 grep `Depends\|HTTPBearer` 无任何命中 |
| 06 | hamr-browser BrowserManager 重启竞态 | 🔴 **仍成立** | `manager.py:70-74` 锁外写 `_initialized` |
| 07 | hamr-browser flow upload 鉴权 | ⚪ **不适用** | 代码里根本没有 upload 端点 |
| 08 | hamr-infra jiabu 端口漂移 | 🔴 **仍成立** | nginx `:8082` vs compose `PORT: 3003` |
| 09 | hamr-infra DNS 错指 | 🟡 **部分成立** | 上游 `42f5147` 修过 hamr.store A 记录，但 status.hamr.top 仍存疑 |
| 10 | hamr-account refresh_token DoS | ✅ **上游已修** | `ec01fdf`，SHA-256 索引查询 + `20260310000002_refresh_token_index.sql` |

### 关于 #06 的技术更正

Round 2 描述的"并发双启动"在**当前代码里复现不出来** —— `initialize()` 内部
已有锁内二次检查（`async with self._lock: if self._initialized: return`），
足以阻止重复启动。真正存在的是三个别的缺陷：

1. `_ensure_healthy()` 在**锁外**把 `_initialized` 置 False，是共享状态的
   锁外写入；
2. `restart()` 在锁内清理、**锁外**调用 `initialize()` —— 并发的
   `_ensure_healthy()` 会抢先启动浏览器，而 restart 自己的 `initialize()`
   看到 `_initialized=True` 就直接返回，**restart 悄悄退化成「不重启」**；
3. `_on_context_close` 不校验上下文身份，旧上下文的**延迟** close 事件会
   把新上下文的状态一起清空。

修复按这三点的真实形态来做，而不是照抄"加个锁就行"。

## 2. 本轮新发现：三个仓库根本构建不出来

前两轮只做静态扫描，**从未跑过构建**。本轮跑了 `cargo check` 与
`npm run build`，结果：

| 仓库 | 症状 | 根因 |
|------|------|------|
| hamr-api | `E0599: no method named json` | `Cargo.toml` 的 `tracing-subscriber` 只开了 `env-filter`，没开 `json` |
| hamr-account/backend | 14 个错误 | `Family` 缺 `sqlx::Type`/`Decode` 派生；`Claims` 缺 `Clone`，级联出 9 个 `Handler` bound 失败 |
| hamr-website | 3 × `TS6133` | `About.tsx` / `Features.tsx` / `Terms.tsx` 里有未使用的 import |

这三项在上游 2026-09-01 的 iter-skill 轮次中已修复（`ec01fdf` 明确写了
"修复编译阻塞"），再次印证了指针过期的影响。

另外本轮还发现两个上游遗留问题：

- **hamr-browser 前端缺 `tsconfig.json`** → `npm run build` 里的 `vue-tsc`
  以退出码 1 失败（打印帮助信息）。上游从引入 Web 管理界面起就没这个文件。
- **hamr-jiabu 的 metrics 测试随机失败**。注册表是进程全局的，而测试 harness
  默认并行跑用例，每个用例开头都 `reset_for_tests()` 清空注册表，于是并行的
  另一个用例可能在断言前把计数器清零。**每次失败的用例都不一样**，单独跑却
  全过。已用 `git stash` 在原始上游提交上复现，确认与本轮改动无关。
  这条会让上游 r4 加的 CI 门禁变成"薛定谔的绿灯"。

## 3. 本轮实施的修复

### 3.1 hamr-status —— 状态页公信力（P0 #04）

`UptimeBar` 在渲染时用 `Math.random()` 逐根决定颜色，刷新页面 90 根柱子
重新洗牌，刷新两次就能看出状态页是假的。

- 新增 `src/utils/uptime.ts`：把种子派生与分布生成拆成纯函数
  （`hashSeed` FNV-1a、`seededRandom` mulberry32、`buildUptimeSlots`）
- `UptimeBar` 改为消费该模块：同一服务每次渲染完全一致，不同服务分布不同
- 新增降级档位（黄），支持传入真实 `history`
- 数值旁显式标注「（示意分布）」—— 没有真实历史数据源之前，不把示意
  伪装成真实采样
- 新增 `scripts/verify-uptime-determinism.mjs`（Node 原生 TS 支持，无需框架），
  9 项检查

### 3.2 hamr-browser —— 零鉴权（P0 #05）

服务用 Playwright 长期持有 hamr.store / account.hamr.store 等站点的
**已登录 session cookie**，而 `/browser/cookies` 等端点没有任何鉴权 ——
任何能访问服务的人都能拉走全部登录态 cookie。

- 新增 `app/auth.py`：Bearer Token 依赖，`secrets.compare_digest` 常数时间
  比较，**未配置 token 时服务拒绝启动**（fail-closed）
- 三个 router 全部挂 `Depends(require_auth)`；`/health` 与 `/` 保持公开
- 前端新增 `TokenBar.vue` 运行期输入 Token（存 localStorage，不打进产物）
- `.env.example` / `docker-compose.yml` 补齐 Token（compose 中必填）

### 3.3 hamr-browser —— BrowserManager 竞态（P0 #06）

按 §1 的三点真实缺陷修复：检查与启动整段持锁、`restart()` 锁内完成
「清理 + 重启」、`_on_context_close` 校验上下文身份、启动/关闭加超时。

### 3.4 hamr-infra —— 端口漂移（P0 #08）

`hamr-jiabu-api` 在 ali 栈是 3003、proxy 栈是 8082、nginx 反代 8082 ——
线上 `jiabu.hamr.store` 的 `/api/` 是 **502**。同一文件里还有第二处漂移：
`HAMR_APP_URL` 指向 `hamr-app-api:8081`，而该容器监听 3002。

- 新增 `services/ports.env` —— 端口的**唯一真源**
- 两个 compose 统一改用 `${VAR:-canonical}`，默认值即真源值
- 修复两处实际漂移
- 新增 `scripts/check-port-consistency.sh`：校验「真源 ↔ compose 默认值 ↔
  nginx 反代 ↔ 各服务 `.env.example`」四处一致
- 新增 CI 工作流把该检查变成门禁

### 3.5 hamr-infra —— Grafana 弱口令（P0 #13）

`${GRAFANA_ADMIN_PASSWORD:-admin}` 的兜底值就是 `admin`。改为
`${GRAFANA_ADMIN_PASSWORD:?...}`，未提供时 compose 直接拒绝启动。

### 3.6 hamr-jiabu —— 测试竞态（P1）

metrics 测试模块加全局锁串行化。`cargo test` 连跑 8 次全部 `59 passed`。

### 3.7 hamr-api / hamr-jiabu —— 下游地址默认值

`config.rs` 里 account/app 的默认地址是 8080/8081，实际容器监听 3001/3002。
compose 会显式注入环境变量所以生产不受影响，但任何不注入的启动方式
（本地直跑、单元测试、CI）都会连到没人监听的端口。

### 3.8 hamr-browser 前端 —— 补 `tsconfig.json`

顺带修掉 `api.ts` 里 headers 合并顺序的问题：`...options` 写在 `headers`
之前会被 `options.headers` 覆盖整个对象，导致 Content-Type 与
Authorization 全丢。

## 4. 知识库整改

新增 `scripts/check-kb-consistency.py`，把 AGENTS.md《文档质量检查清单》
里可自动化的部分变成可执行检查。首轮跑出 **26 项错误 + 27 项警告**：

| 问题 | 数量 | 处置 |
|------|------|------|
| 项目文档残留未替换的模板 front matter | 14 | 全部重写为规范元信息 |
| Markdown 与 JSON 的状态/负责人/优先级冲突 | 10 | 以注册表 JSON 为准，同步回文档 |
| 项目 ID 重复（`PROJ-016`） | 1 | hamr-catch 顺延为 `PROJ-018` |
| 注册表文档路径断链（PROJ-017） | 2 | 补齐 v0.2 技术方案与路线图 |
| `updated_date` 过期 | 27 | 全部刷新为 2026-10-20 |
| 报告类文档错放在 `projects/active/` | 1 | 移入 `execution/reports/` |

现在检查器输出 **PASS**。

## 5. 仍然开放的事项

| # | 事项 | 为什么没动 | 建议 |
|---|------|-----------|------|
| 1 | `status.hamr.top` 的 DNS 指向 | 方向依赖真实部署情况；且 `services/ali/` 与 `services/tx/` 的目录名相对真实主机是**反的** | 登机核对后再改，核对命令见 `scripts/health-check.sh` |
| 2 | 状态页接真实 Prometheus 历史 | 需要 hamr-api 增加历史查询端点 | v0.2 阶段 D2 |
| 3 | 8 个仓库的 CI 门禁 | 一次性铺开会有仓库因历史问题变红 | v0.2 阶段 C，逐仓库推进 |
| 4 | 子模块指针新鲜度检查 | 本轮已 bump，但缺自动检查 | v0.2 阶段 C8 |
| 5 | `templates/shared/` 跨语言模板 | 与本轮 P0 修复无直接关系 | v0.2 阶段 D3 |

## 6. 本轮改动汇总

| 仓库 | 改动 | 推送 |
|------|------|------|
| hamr-status | 确定性 uptime 柱状条 + 9 项验证 | ✅ |
| hamr-browser | 全局鉴权 + 竞态修复 + tsconfig + CI + 14 项测试 | ✅ |
| hamr-infra | 端口契约 + Grafana 密码 + 拓扑文档 + CI | ✅ |
| hamr-jiabu | metrics 测试竞态 + 端口默认值 | ✅ |
| hamr-api | 下游地址默认值 | ✅ |
| hamr（主） | 15 个子模块指针 + 知识库整改 + 本报告 | ✅ |

## 7. 方法论教训

前两轮审计的共同问题是**只读不跑**：

1. Round 1 连 submodule 都没初始化，扫的是陈旧缓存 —— 13 条 P0 里大部分
   引用不存在的文件；
2. Round 2 submodule 初始化了，但仍然只读文件 —— file:line 准确了，
   却漏掉"编译不过"这种最基础的阻塞；
3. 本轮先跑构建与测试，再读代码 —— 立刻发现三个仓库根本构建不出来，
   并且因为先同步了指针而避免了重做上游已经修好的工作。

**结论**：审计的第一步应该是"让被审计对象处于真实可运行状态"，而不是
直接开始读代码。子模块指针这类"元数据漂移"，其危害不亚于代码缺陷 ——
它会让整个分析建立在错误的前提上。

---

**最后更新**：2026-10-20
**维护者**：HamR 项目团队
