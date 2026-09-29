# proposed-fixes-v2/ — 真实 P0 patches (2026-07-01 round 2)

> 基于 round 2 真实文件扫描（submodule 全部 init 后）。
> **全部 file:line 已 `Read` 验证**，可直接 apply。
> round 1 的 `proposed-fixes-deprecated-20260630/` 已存档，**不要** 用。

## 文件清单

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

### P1 (5 项)

| Patch | 子项目 | 严重度 | 文件 |
|-------|--------|--------|------|
| 11 | hamr-website | high | `11-hamr-website-bundle-warning.md` |
| 12 | 7 TS repos | high | `12-ts-shared-dockerfile-nginx.md` |
| 13 | hamr-mood-calender | medium | `13-hamr-mood-calender-dead-type.md` |
| 14 | 5 Rust repos | high | `14-rust-shared-crate.md` |
| 15 | hamr-developer | high | `15-hamr-developer-committed-dist.md` |

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