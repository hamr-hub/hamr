# HamR v0.2 增强（2026-06-30 全家族审计）

| 项目信息 | 内容 |
|---------|------|
| **项目名称** | HamR v0.2 增强 |
| **创建时间** | 2026-06-30 |
| **负责人** | HamR Team |
| **当前状态** | 🟢 进行中 |
| **优先级** | P1（高） |
| **预计完成** | 2026-09-30 |
| **标签** | #v0.2 #enhancement #audit #cross-repo |

## 项目背景

2026-06-30 `/loop 5h` 第一轮触发，6 个 deep-research agent 并行审计了 14 个 v0.1 子项目 + 跨切基础设施。审计报告位于 `.iter-skill/runs/2026-06-30/`：

- `00-master-synthesis.md` — 合成报告（本文源头）
- `01-astro-frontends.md` — Astro 集群（website/docs/help）
- `02-vite-frontends.md` — Vite 集群（browser/demo）
- `03-go-core-services.md` — Go 核心服务（account/api/status）
- `04-go-tools.md` — Go 工具/Agent（deploy/jiabu/mood-calender）
- `05-mobile-app.md` — hamr-app
- `06-dev-infra.md` — 开发者门户 + 基础设施

总计发现 200+ 项，其中 **P0 信任/可用性缺陷 13 项**，**架构决策项 4 项**，**跨切 P1 抽取工作 7 项**。

## v0.2 必须修复的 P0 清单

> 这些是 ship-blocker。任何不修都意味着 v0.2 不应投产。

### P0-1 hamr-help 构建失败
- **位置**：`hamr-help/src/pages/Search.astro` + `src/layouts/BaseLayout.astro`
- **症状**：`Search.astro` 从不存在的端点拉 `/index.json`；`BaseLayout.astro` 引用了缺失的 `global.css`
- **影响**：构建失败，帮助中心搜索全 dead
- **来源**：Cluster 1 (#1)

### P0-2 hamr-browser PWA 端到端坏掉
- **位置**：`src/auth/oauth.ts:29-40` + `public/sw.js` + manifest icons
- **症状**：`captureTokenFromHash` 在 `bootstrap()` 未挂；`public/sw.js` smoke test 引用但不存在；`/icons/icon-192.png` 缺失
- **影响**：PWA 无法安装 / Chrome Web Store 必拒
- **来源**：Cluster 2 (#1)

### P0-3 hamr-demo 初始 bundle 大 80%
- **位置**：`src/router.ts:1-7` + `src/widgets/mood-demo.ts:73`
- **症状**：所有 widget（含 `chart.js/auto` ~70KB gz）静态 import；切成员走 `location.reload()`
- **影响**：首屏 80% 流量是死代码；切成员整页重载
- **来源**：Cluster 2 (#3)

### P0-4 hamr-account 鉴权永远 200 OK
- **位置**：`hamr-account/cmd/login-app/main.go:146-174`
- **症状**：login/register/2FA 是 TODO stub，永远返回 200
- **影响**：任何人都能登任何账号 — **家庭产品的致命信任缺陷**
- **来源**：Cluster 3 (#1)

### P0-5 hamr-api CORS 配错
- **位置**：`hamr-api/internal/middleware/cors.go:34`
- **症状**：`Access-Control-Allow-Origin: *` 配 `Allow-Credentials: true`
- **影响**：浏览器拒收所有跨域带 cookie 请求；也是 OWASP 列出的危险反模式
- **来源**：Cluster 3 (#2)

### P0-6 hamr-deploy 永远报告部署成功
- **位置**：`internal/orchestrator/orchestrator.go:164-187` + `internal/argocd/client.go:78-82`
- **症状**：`monitorRollout` 10 分钟盲 poll + `GetRolloutStatus` 永远返 `"Healthy"`
- **影响**：生产部署失败也会被标记 success，告警全哑
- **来源**：Cluster 4 (#1)

### P0-7 hamr-deploy precheck 不生效
- **位置**：`internal/precheck/precheck.go:34-40`
- **症状**：prod 跳过 user-role 校验；`maxConcurrentPerEnv:3` 字段定义了但永不触发
- **影响**：prod 可并发无上限；权限校验失效
- **来源**：Cluster 4 (per-repo 段)

### P0-8 hamr-jiabu 隐私默认反了
- **位置**：`internal/handlers/events.go:24,65-67`
- **症状**：依赖一个从未 set 的 gin context key `"privacy-store-content"`；默认情况下 `event.Content` **驻留内存**
- **影响**：与 `PRIVACY.md` 声称"默认丢弃"矛盾；PII 风险；GDPR/PIPL 暴露
- **来源**：Cluster 4 (#3)

### P0-9 hamr-app 会话可劫持
- **位置**：`internal/client/api.go:98-105` + `handlers/dashboard.go:16-18`
- **症状**：`jsonReader.Read` 不返 EOF；明文 cookie auth 无 CSRF
- **影响**：登录会话可被中间人或跨站请求伪造
- **来源**：Cluster 5 (#2)

### P0-10 helm-charts/lib-common 空目录
- **位置**：`hamr-infra/charts/lib-common/`
- **症状**：声明了但 0 个模板文件
- **影响**：所有依赖此 lib chart 的子项目 chart 渲染失败
- **来源**：Cluster 6 (#1)

### P0-11 Taskfile.yaml CI 永不失败
- **位置**：`hamr-developer/Taskfile.yaml`
- **症状**：lint/doc 命令带 `ignore_error: true`
- **影响**：任何代码回归不会阻断流水线
- **来源**：Cluster 6 (#2)

### P0-12 Prometheus 告警全哑
- **位置**：12 alert rules + 4 Grafana dashboards
- **症状**：所有规则/dashboard 假设 `http_requests_total{service=~"hamr-.+"}`，但全家族**没人 emit**
- **影响**：监控空跑，告警全哑
- **来源**：Cluster 6 (#5)

### P0-13 SOPS + Grafana admin 密码是空壳
- **位置**：`.sops.yaml` + grafana values
- **症状**：`.sops.yaml` 的 recipients 是 placeholder；`grafana_admin_password="admin"`
- **影响**：secret 加密是空壳；admin 密码明文暴露在 git
- **来源**：Cluster 6 (#3, #4)

## 架构决策项（需用户/团队拍板）

| ID | 问题 | 候选方案 | 影响范围 |
|----|------|----------|----------|
| D-1 | hamr-app 是 333 LoC Gin SSR Dashboard，但标"mobile" + 留有未启动的 P2P 提案（Rust + libp2p + Web3 DID） | A) 删 P2P 提案 + 改 repo 名为 `hamr-dashboard`；B) 启动 Rust 重构（4-6 人月） | hamr-app / 路线图 / 注册表 |
| D-2 | hamr-browser repo 是 PWA 客户端，但 `hamr-browser-技术方案-20260317.md` 写 Playwright 自动化 API — 名字冲突 | A) 拆分 `hamr-browser-client` + `hamr-browser-automation`；B) 废弃 proposal；C) 废弃 client | 命名空间 / 部署 |
| D-3 | 8 个 PROJ 用 `in_progress`（不在 `02-documentation-standards.md` 枚举里） | 全部统一为 `active`（已本轮批量执行） | ✅ done |
| D-4 | HamR-roadmap-2026.md 附录 Phase 1/2 列表与 16 个 PROJ 对不上 | 更新 roadmap 附录 | HamR-roadmap-2026.md |

## 跨切抽取（P1，高 ROI）

| ID | 抽取 | 落地位置 | 重复 repo 数 |
|----|------|----------|--------------|
| X-1 | `pkg/hamr`（env / shutdown / JSON error / Prometheus middleware） | `templates/shared/pkg-hamr/` | 6 Go repos |
| X-2 | `@hamr/astro-config`（astro.config + base layout + i18n） | `templates/shared/astro-config/` | 3 Astro |
| X-3 | `Dockerfile.base`（golang:1.22-alpine → distroless/static + HEALTHCHECK） | `templates/shared/Dockerfile.base` | 6 Go |
| X-4 | `nginx-hardened.conf`（CSP/HSTS/Referrer-Policy + gzip + 缓存头） | `templates/shared/nginx-hardened.conf` | 5 前端 + hamr-app |
| X-5 | `helm-common` lib chart | 后续迁入 `hamr-infra/charts/lib-common/` | 14 子项目 charts |
| X-6 | CI workflow 模板（go / vite / astro） | `.github/workflows-template/` | 全部 14（当前 0/14 有 CI） |
| X-7 | 共享 webhook notifier（Slack + email + retry/backoff） | `templates/shared/pkg-hamr/notifier/` | jiabu + deploy |

## 实施计划

**本轮（2026-06-30）— 父仓库可落地部分**：
- ✅ 合成报告（本文）
- ✅ 8 个 PROJ 状态统一
- ✅ PROJ-017 注册
- ⏳ 共享模板：Dockerfile.base / nginx-hardened / pkg-hamr / astro-config
- ⏳ CI workflow 模板
- ⏳ 给 9 个 P0 子项目写 PR-ready patch 放到 `proposed-fixes/`
- ⏳ 更新 HamR-roadmap-2026.md

**下轮（5h 后）/loop 5h 触发时**：
- 修 submodule `.git/` 缺失（`git submodule update --init` + 验证）
- 把 `proposed-fixes/` 里的 patch 推到子项目仓库
- 起 regression-test agent 验 P0 修复
- 把跨集群模板迁入 `hamr-infra/`

**后续**：
- 起 e2e 测试 agent
- 处理 D-1/D-2 决策
- v0.2 验收

## 不在本项目范围

- 子项目实际代码修改（submodule `.git/` 缺失，待修复）
- 真机/线上验证
- 新功能开发（仅修复 v0.1 缺陷 + 抽取）
- 跨子项目 PR 同步

## 相关文档

- `.iter-skill/runs/2026-06-30/` — 本轮全部报告
- `.iter-skill/runs/2026-06-30/00-master-synthesis.md` — 跨集群合成
- `.claude/rules/02-documentation-standards.md` — 注册表状态枚举（已反映本次修复）

---

**最后更新**：2026-06-30
**维护者**：HamR Team
**版本**：v0.2-enhancement-r1