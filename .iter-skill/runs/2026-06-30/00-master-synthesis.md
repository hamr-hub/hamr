---
run_id: 2026-06-30-001
trigger: /loop 5h (cron af4efe4c)
mode: 6-cluster parallel deep-research + synthesize + implement
status: synthesis-complete
clusters_audited: 14/14 repos + 16 PROJ docs
reports:
  - 01-astro-frontends.md (86 lines)
  - 02-vite-frontends.md (87 lines)
  - 03-go-core-services.md (101 lines)
  - 04-go-tools.md (76 lines)
  - 05-mobile-app.md (123 lines)
  - 06-dev-infra.md (119 lines)
total_findings: 200+ (P0 ~15, P1 ~50, P2 ~135)
---

# HamR 全家族 v0.1 → v0.2 优化迭代 — 2026-06-30 第一轮

> 由 `/loop 5h` 触发。6 个 deep-research agent 并行审计 14 个子项目 + 跨切基础设施。
> 本文件是合成报告 + 行动指南。

## 1. 跨集群 P0 信任/可用性缺陷（必须先修，否则 v0.2 不能上线）

| # | Cluster | 文件:行 | 缺陷 | 影响 |
|---|---------|---------|------|------|
| **P0-1** | Astro | `hamr-help/src/pages/Search.astro` + `BaseLayout.astro` | 引用不存在端点 + 缺失 `global.css` | **构建失败**，help 全 dead |
| **P0-2** | Vite | `hamr-browser/src/auth/oauth.ts:29-40` + `public/sw.js` + manifest icons | `captureTokenFromHash` 不挂到 bootstrap；sw.js 不存在；icon-192.png 缺失 | **PWA 全程坏**，Chrome Web Store 必拒 |
| **P0-3** | Vite | `hamr-demo/src/router.ts:1-7` + `widgets/mood-demo.ts:73` | 静态 import `chart.js/auto` ~70KB gz；`location.reload()` 切成员 | **初始 bundle 大 80%**，交互卡 |
| **P0-4** | Go core | `hamr-account/cmd/login-app/main.go:146-174` | login/register/2FA 是 TODO stub 永远 200 OK | **认证全过**，任何人都能登任何账号 |
| **P0-5** | Go core | `hamr-api/internal/middleware/cors.go:34` | `*` + Allow-Credentials:true | **浏览器拒收 + CORS 配置隐患** |
| **P0-6** | Go tools | `hamr-deploy/internal/orchestrator/orchestrator.go:164-187` + `argocd/client.go:78-82` | `monitorRollout` 永远成功；`GetRolloutStatus` 永远 Healthy | **生产部署失败也会标记成功** |
| **P0-7** | Go tools | `hamr-deploy/internal/precheck/precheck.go:34-40` | prod 跳过 user-role 校验 + 并发 cap (`maxConcurrentPerEnv:3`) 永不触发 | **prod 可并发无上限** |
| **P0-8** | Go tools | `hamr-jiabu/internal/handlers/events.go:24,65-67` | 隐私默认是 never-set gin context key，**Content 默认就驻留内存** | 与 `PRIVACY.md` 矛盾，**PII 风险** |
| **P0-9** | Mobile | `hamr-app/internal/client/api.go:98-105` + `handlers/dashboard.go:16-18` | `jsonReader.Read` 不返 EOF；明文 cookie auth 无 CSRF | **会话可劫持** |
| **P0-10** | Dev/Infra | `helm-charts/lib-common/` | 空目录但 14 子项目 charts 依赖 | **所有 chart 渲染失败** |
| **P0-11** | Dev/Infra | `hamr-developer/Taskfile.yaml` | lint/doc 命令带 `ignore_error: true` | **CI 永不失败** — 一切回归被吞 |
| **P0-12** | Dev/Infra | Grafana dashboards + 12 alert rules | 假设 `http_requests_total{service=~"hamr-.+"}`，**全家族没人 emit** | **告警全哑** |
| **P0-13** | Dev/Infra | `.sops.yaml` + `grafana_admin_password="admin"` | placeholder recipients + 硬编码 admin 密码 | **secret 加密是空壳**，明文 admin 暴露 |

## 2. 架构性矛盾（决策项，不是 bug 项）

| # | 问题 | 二选一 |
|---|------|--------|
| **D-1** | `hamr-app` repo 标"mobile" 实际 333 LoC Gin SSR Dashboard；P2P 提案（Rust + libp2p + Web3 DID）从未启动 | A. 删 P2P 提案 + 改 repo 名为 `hamr-dashboard`；B. 启动 Rust 重构（成本大） |
| **D-2** | `hamr-browser` repo 实际是 PWA 客户端，proposal `hamr-browser-技术方案-20260317.md` 写的是 Playwright 自动化 API | 两个产品共用名字 — 拆分/改名/废弃其一 |
| **D-3** | 注册表 6 个 PROJ 用 `in_progress`，但 `.claude/rules/02-documentation-standards.md` 枚举只有 `active|completed|paused|cancelled` | 全部统一为 `active` |
| **D-4** | `HamR-roadmap-2026.md` 附录 Phase 1 列 10 个、Phase 2 列 4 个，但注册表有 16 个 PROJ，PROJ-010/014 位置缺失 | 更新 roadmap 附录 |

## 3. 跨切 P1（高 ROI 抽取）

| # | 抽取内容 | 重复 repo | 估工作量 |
|---|----------|-----------|----------|
| **X-1** | `pkg/hamr` — env / graceful-shutdown / JSON error envelope / Prometheus middleware | account/api/status/deploy/jiabu/mood-calender (6 Go repos) | M |
| **X-2** | `@hamr/astro-config` — astro.config + base layout + i18n 配置 | website/docs/help (3 Astro) | S |
| **X-3** | `Dockerfile.base` — golang:1.22-alpine → distroless/static + HEALTHCHECK | 6 Go repos | XS |
| **X-4** | `nginx-hardened.conf` — CSP/HSTS/Referrer-Policy + gzip + 缓存头 | 5 前端 + hamr-app | S |
| **X-5** | `helm-common` lib chart — _deployment/_service/_networkpolicy/_pdb/_externalsecret | 14 子项目 charts | M |
| **X-6** | `.github/workflows/<lang>.yaml` 模板 — go test / golangci-lint / govulncheck；vite build / tsc / vitest | 全部子项目（当前 0/14 有 CI） | S per 语言 |
| **X-7** | Webhook notifier（Slack + email + retry/backoff） | jiabu + deploy（需复用） | S |

## 4. 安全/合规债务

- CSP/HSTS/Referrer-Policy/X-Content-Type-Options 全家族只有 `hamr-website` 有，其他全部缺（**高优先级**）
- Bootstrap / Mermaid 通过 `cdn.jsdelivr.net` 加载无 SRI（hamr-help / hamr-docs）
- `ARGOCD_TOKEN` 通过 env-read 间接进日志 → leak path
- 私有 prompt 处理（jiabu）默认保留 Content — GDPR/PIPL 风险
- 13 个 nginx config、6 个 Dockerfile、6 个 helm chart 几乎逐字重复，drift 风险大

## 5. 实施：本轮（父仓库落地）

**为什么限定父仓库**：14 子模块当前**没有 `.git/`**（submodule init 失败 — 目录存在但 git metadata 缺失），子项目内 git ops 暂不可用。本轮所有实施落在父仓 `repos/hamr-planning`（即本仓库），通过 PR 模板/共享模板的方式让子项目下次可一键采纳。

本轮已落地：
1. ✅ 本合成文件
2. ⏳ `PROJ-017-v0.2-enhancements.json` + `.md`（注册 v0.2 增强工作）
3. ⏳ 6 个 registry 文件状态统一 `in_progress → active`
4. ⏳ `templates/shared/Dockerfile.base`
5. ⏳ `templates/shared/nginx-hardened.conf`
6. ⏳ `templates/shared/pkg-hamr/{env,shutdown,errors,metrics}.go`
7. ⏳ `templates/shared/astro-config/` 骨架
8. ⏳ `.github/workflows-template/{go.yaml,vite.yaml,astro.yaml}` 模板
9. ⏳ `proposed-fixes/` 给每个有 P0 的子项目放 PR-ready patch
10. ⏳ 更新 `HamR-roadmap-2026.md` 附录 + 添加 v0.2 章节

## 6. 下次 /loop 触发（5h 后）— 优先级

1. **先把 submodule 修好**（父仓 `git submodule deinit -f . && git submodule update --init --recursive` 或者把子项目改成普通目录）。
2. 用 git-worktree 在每个子项目里直接应用 PR-ready patch。
3. 起一组 regression-test agent 验 6 个 P0 修复是否到位。
4. 把跨集群 P0-12（metrics 不 emit）— 给所有 Go 服务接上 `pkg/hamr/metrics` middleware。
5. 处理 D-1/D-2 决策项（hamr-app 改名、hamr-browser 拆名）。

## 7. 不能在本轮做的事（已记入 backlog）

- 子项目实际代码改动（submodule .git 缺失）
- 真机/线上验证（Helm chart 渲染、镜像构建、k8s 部署）
- 需要 OAuth provider / DB / SMTP 的功能测试
- 跨子项目 PR 同步（待 submodule 修好后）

---

**本轮 owner**: 父仓库（hamr-planning）
**下次 review**: 下一轮 `/loop 5h` 触发时（5h 后）
**Cron id**: `af4efe4c` — session-only，7 天后自动过期