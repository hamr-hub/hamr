# proposed-fixes/ — v0.2 P0 PR-ready patches

> 来源：2026-06-30 全家族 deep-research 合成报告 `.iter-skill/runs/2026-06-30/00-master-synthesis.md`。
>
> 这里每个文件是**给子项目 reviewer 看的 patch 草稿**，可直接复制为 PR diff。
> 一旦子模块 `.git/` 修复（见 master synthesis §6），这些 patch 可一键 apply。

## 文件清单（13 项 P0）

| Patch | 子项目 | 严重度 | 文件 |
|-------|--------|--------|------|
| P0-1 | hamr-help | blocker | `01-hamr-help-search-and-base-layout.md` |
| P0-2 | hamr-browser | blocker | `02-hamr-browser-pwa-bootstrap.md` |
| P0-3 | hamr-demo | high | `03-hamr-demo-lazy-import.md` |
| P0-4 | hamr-account | blocker | `04-hamr-account-auth-stub.md` |
| P0-5 | hamr-api | blocker | `05-hamr-api-cors.md` |
| P0-6 | hamr-deploy | blocker | `06-hamr-deploy-monitor-rollout.md` |
| P0-7 | hamr-deploy | blocker | `07-hamr-deploy-precheck.md` |
| P0-8 | hamr-jiabu | blocker | `08-hamr-jiabu-privacy-default.md` |
| P0-9 | hamr-app | blocker | `09-hamr-app-cookie-csrf.md` |
| P0-10 | hamr-infra | blocker | `10-helm-lib-common.md` |
| P0-11 | hamr-developer | blocker | `11-taskfile-ignore-error.md` |
| P0-12 | 全家族 | blocker | `12-prometheus-metrics-emit.md` |
| P0-13 | hamr-infra | blocker | `13-sops-and-grafana-admin.md` |

每个 patch 文件结构：
1. **背景**：审计发现的具体行号 / 症状
2. **修复方案**：patch diff（git apply 可直接应用）
3. **验证**：单元测试 + 集成测试建议
4. **回退**：紧急回退步骤

## 修复优先级（团队 review 后开工）

1. P0-4 (hamr-account auth) — 任何信任缺陷第一时间
2. P0-6 (hamr-deploy monitorRollout) — 生产误报风险
3. P0-8 (hamr-jiabu privacy) — PII 法务风险
4. P0-12 (metrics emit) — 解锁 12 条告警
5. 其余 blocker 并行修

## 不在本目录范围

- 跨切抽取（pkg-hamr / nginx-hardened / astro-config）已在 `templates/shared/` 完成
- 子项目 CI workflow 已在 `.github/workflows-template/` 完成
- 架构决策 D-1/D-2 待用户/团队拍板