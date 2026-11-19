# proposed-fixes-v2/ — P0 patches（2026-07-01 round 2）

> 基于 round 2 真实文件扫描（submodule 全部 init 后）。
> **全部 file:line 已 `Read` 验证**，可直接 apply。
> round 1 的 `proposed-fixes-deprecated-20260630/` 已存档，**不要** 用。

> ## ⚠️ 2026-10-20 复核：本目录的 10 条 P0 已有 5 条被上游修复、2 条已过时
>
> 本目录的补丁是按 **2026-07-03 的代码**写的。此后各子仓库的 `origin/main`
> 推进到 2026-09-02（每个落后 18～26 个提交），部分补丁所描述的问题
> **在上游已经修好了**。直接照本目录 apply 会重做上游的工作，甚至做出
> 冲突的改动。
>
> **以 `.iter-skill/runs/2026-10-20/00-master-synthesis.md` 的逐条复核结论
> 为准**，本目录保留作历史记录与背景参考。

## 复核状态（2026-10-20）

| Patch | 子项目 | 原始严重度 | 复核结论 | 处理 |
|-------|--------|-----------|---------|------|
| 01 | hamr-app | blocker | ⚪ **已过时** —— `middleware.rs` 已是真 JWT 校验 | 上游 `a54528b` 三模式认证硬化，本轮不需要 |
| 02 | hamr-api | blocker | ✅ **上游已修** —— CORS 白名单 | 上游 `1042941`，本轮不需要 |
| 03 | hamr-api | blocker | ✅ **上游已修** —— 限流键 | 上游 `89d44fb`，本轮不需要 |
| 04 | hamr-status | blocker | 🔴 **仍成立** | **本轮已修**：确定性渲染 + 9 项验证 |
| 05 | hamr-browser | blocker | 🔴 **仍成立** | **本轮已修**：全局 Bearer 鉴权（fail-closed）+ 14 项测试 |
| 06 | hamr-browser | blocker | 🔴 **仍成立**（但成因与原文描述不同，见下） | **本轮已修**：锁内原子化 + 上下文身份校验 |
| 07 | hamr-browser | blocker | ⚪ **不适用** —— 代码里没有 upload 端点 | 无需处理 |
| 08 | hamr-infra | blocker | 🔴 **仍成立** | **本轮已修**：端口单一真源 + 一致性检查 + CI 门禁 |
| 09 | hamr-infra | blocker | 🟡 **部分成立** | **本轮未改**：方向依赖真实部署，已记录并给核对方法 |
| 10 | hamr-account | blocker | ✅ **上游已修** —— SHA-256 索引查询 | 上游 `ec01fdf` + `20260310000002_refresh_token_index.sql` |

### 关于 #06 的技术更正

原文描述的"并发双启动"在当前代码里**复现不出来**：`initialize()` 内部已有
锁内二次检查，足以阻止重复启动。真实存在的是三个别的缺陷：

1. `_ensure_healthy()` 在**锁外**写 `_initialized`（共享状态的锁外写入）；
2. `restart()` 锁内清理、**锁外**调用 `initialize()` —— 并发的
   `_ensure_healthy()` 抢先启动浏览器，restart 自己的 `initialize()` 看到
   `_initialized=True` 直接返回，**restart 悄悄退化成「不重启」**；
3. `_on_context_close` 不校验上下文身份 —— 旧上下文的**延迟** close 事件
   会把新上下文的状态一起清空。

### 关于 #09 的处置说明

`status.hamr.top` 的 DNS 指向 `39.103.188.33`，而 nginx 该站点需要的
`grafana` 与 `hamr-status` 两个容器**只有 `services/proxy/` 同时具备**。
同时 `services/ali/` 与 `services/tx/` 的目录名相对真实主机是**反的**
（`services/ali/` 里装的是 DNS 指向 `43.133.224.11` 的 hamr.store 系服务）。

改 A 记录的方向取决于真实部署情况，**改错会直接打挂状态页**，因此本轮
只记录事实并给出核对方法，不擅改 DNS。详见 `hamr-infra/README.md`
的「部署拓扑与一个待确认项」。

## 原 round 2 文件清单

### P0 ship-blocker (10 项)

| Patch | 子项目 | 严重度 | 文件 |
|-------|--------|--------|------|
| 01 | hamr-app | blocker | `01-hamr-app-auth-middleware.md` |
| 02 | hamr-api | blocker | `02-hamr-api-cors-allowlist.md` |
| 03 | hamr-api | blocker | `03-hamr-api-ratelimit-key.md` |
| 04 | hamr-status | blocker | `04-hamr-status-no-math-random.md` |
| 05 | hamr-browser | blocker | `05-hamr-browser-cookies-auth.md` |
| 06 | hamr-browser | blocker | `06-hamr-browser-manager-race.md` |
| 07 | hamr-browser | blocker | `07-hamr-browser-flow-upload-auth.md` |
| 08 | hamr-infra | blocker | `08-hamr-infra-port-drift.md` |
| 09 | hamr-infra | blocker | `09-hamr-infra-dns-mispoint.md` |
| 10 | hamr-account | blocker | `10-hamr-account-refresh-dos.md` |

> 原 README 还列了 P1 的 11～15 号补丁，但这些文件从未产出到仓库里 ——
> 属于 round 2 未完成的遗留登记。

## 与 round 1 报告的对比

| round 1 P0 | round 1 引用 | 真实位置（round 2） |
|------------|--------------|----------------------|
| P0-1 hamr-help Search.astro build break | Search.astro + BaseLayout.astro | hamr-help 是 Vite TS，不是 Astro。需重测 |
| P0-2 hamr-browser PWA 全坏 | oauth.ts:29-40 + sw.js + icons | hamr-browser 是 Python FastAPI，**不是 PWA**。真 P0 在 `/browser/cookies` 未鉴权 |
| P0-3 hamr-demo chart.js 静态 import | router.ts:1-7 | hamr-demo 是 Rust + TS fullstack，需重测 |
| P0-4 hamr-account auth 永远 200 OK | cmd/login-app/main.go:146-174 | **不存在此文件**。hamr-account 是 Rust + TS。auth.rs 是完整实现，但 refresh_token 有 DoS |
| P0-5 hamr-api CORS \* + credentials | cors.go:34 | **不是 Go**。hamr-api 是 Rust axum。CORS `AllowOrigin::Any` 无 credentials，但作为 public gateway 仍 P0 |
| P0-6 hamr-deploy monitorRollout 假成功 | orchestrator.go:164-187 | **hamr-deploy 是 React Vite SPA**，不是 Go 部署工具 |
| P0-7 hamr-deploy precheck prod 跳过 | precheck.go:34-40 | 不存在 Go 代码 |
| P0-8 hamr-jiabu privacy default 反了 | events.go:65-67 | hamr-jiabu 是 Rust，无 events.go |
| P0-9 hamr-app jsonReader.Read + 明文 cookie | client/api.go:98-105 | **不是 Go**。hamr-app 是 Rust + TS。真 P0 在 middleware.rs:37-46 placeholder auth |
| P0-10 helm lib-common 空目录 | helm-charts/lib-common/ | hamr-infra 无此路径（无 IaC，纯 bash + compose） |
| P0-11 Taskfile lint 永不 fail | Taskfile.yaml | hamr-developer 是 Vite TS，无 Taskfile |
| P0-12 12 alert + 4 dashboard | alerts.yml + grafana | **实际 5 alert + 0 dashboard**。仍 P0 因为 scrape config 只覆盖 2/14 服务 |
| P0-13 SOPS placeholder + Grafana admin | .sops.yaml + grafana admin | 无 .sops.yaml。但 Grafana admin = "admin" 在 2/3 compose 中确认 |

**round 1 的发现有几条碰巧方向对（CORS 偏宽、Prometheus 覆盖不全、Grafana admin 默认密码），但 file:line 多数不可用。**
