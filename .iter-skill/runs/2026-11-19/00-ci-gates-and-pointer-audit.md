---
run_id: 2026-11-19-001
trigger: 继续完善本项目（/goal：阶段 C 门禁推进 + 指针审计）
mode: 本地验证（lint/build/回归脚本/npm ci 干跑）+ 门禁落地 + 元数据收敛
status: completed（推送待网络恢复）
predecessor: .iter-skill/runs/2026-10-20/00-master-synthesis.md（round 3）
network: ❌ 离线 —— github.com 经 127.0.0.1:7890 代理不可达，全部基于本地缓存的 origin 引用
---

# HamR 阶段 C 门禁推进 — 2026-11-19 第四轮

> 本轮目标直接来自 v0.2 路线图：今天处于**阶段 C（2026-11，建立门禁）**。
> 三块工作：把排期的 5 个仓库门禁全部落地（C1–C5）、修掉一致性检查器
> 自身的盲点、把上一轮遗留的未提交/未 bump 状态收敛干净。

## 1. 起点状态

- 工作区有一整批 2026-10-20 轮次的**已暂存未提交**变更（检查器、CI 工作流、
  知识库整改、子模块指针），超级项目领先 origin 1 个提交（PROJ-019）。
- `check-kb-consistency.py` 本地 PASS，但它比对的是子模块**工作区 HEAD**。
- 本轮无法 `git fetch`（本地代理未运行），所有"上游"指本地缓存的
  `origin/main` 引用。

## 2. 指针审计：发现一个检查器盲点 + 一个未推送提交

以**超级项目索引记录的 gitlink**（CI 全新 checkout / 他人 clone 实际拿到的
提交）逐个比对缓存 origin/main：

| 子仓库 | 索引指针 | origin/main（缓存） | 结论 |
|--------|---------|--------------------|----|
| hamr-mood-calender | `dbab8d1` | `1b07572` | 🔴 索引落后 1 个提交；工作区其实已在 `1b07572`，只是没 `git add` 回超级项目 |
| hamr-app | `7e06700` | `4e690c4` | 🟡 领先 1 个提交 —— 即 2026-11-17 的 PROJ-019 Agent 运行时（108 测试），**尚未推送** |
| 其余 13 个 | — | — | 一致 |

mood-calender 漏报的根因：旧检查器在子模块目录里跑 `git rev-parse HEAD`，
读到的是工作区当前 checkout（已是新提交），而不是索引记录的旧指针。

## 3. 检查器加固（C8）

`scripts/check-kb-consistency.py` 第 5 节重写：

1. 主比对对象改为索引 gitlink（`git ls-files -s` 解析 `160000 <sha>`），
   与 CI/克隆的实际行为一致；
2. 新增**工作区 ↔ 索引漂移**告警（checkout 了别的提交却忘记 bump）；
3. 新增**指针领先上游**告警（子仓库本地提交未推送时，超级项目若先推送，
   他人 clone 取不到 gitlink 对象会直接失败）；
4. 落后阈值维持 20 个提交（FAIL），1–19 为提示。

加固后首次运行即准确报出第 2 节的两处状态，证明检测有效。

## 4. C1–C5：五个排期仓库全部接入 CI

动手前先在本地把门禁真实跑一遍（沿用 round 3"先让对象可运行再审计"的教训），
Node v24.12.0 / npm 11：

| 仓库 | 编号 | lint | 回归 | build | 落地提交 |
|------|------|------|------|-------|---------|
| hamr-status | C1 | ✅ | ✅ 确定性脚本 9/9 | ✅ | `776aca6` |
| hamr-website | C2 | ✅ | — 无测试框架 | ✅ | `5d5a82f` |
| hamr-help | C3 | ✅ | — | ✅ | `11e6a3d` |
| hamr-developer | C4 | ✅ | — | ✅ | `341ac71` |
| hamr-deploy | C5 | ✅ | — | ✅ | `3ab1aee` |

关键差异处理：

- status 的确定性回归脚本直接 `import '../src/utils/uptime.ts'`，依赖
  Node 原生 TypeScript 支持，CI 固定 **Node 24**（22.x 需实验开关）；
  其余四个 Vite 仓库与家族既有前端一致用 Node 20。
- help / developer / website 都**没有 test 脚本**，没有照抄 mood-calender
  的 `npm test`（否则门禁第一天就必红 —— 与 mood-calender 当初
  lockfile/CI 顺序颠倒是同一类教训）。
- **deploy 的 lockfile 问题**：仓库跟踪了 package.json，却从未提交
  package-lock.json（在磁盘上、未被 ignore），`npm ci` 在任何环境都会
  直接失败。补齐时发现 265 条 resolved 全部指向本地 npmmirror，统一改写
  为 `registry.npmjs.org`（镜像地址不固化进仓库，同 mood-calender 修法）。
  `npm ci --offline --dry-run` 退出 0 确认 lockfile 完整一致。
- website 的 three.js chunk >1MB 为 vite 非阻断告警，代码分割列入阶段 D。

结果：15 个子仓库中 **13 个已有 ci.yml**（更早轮次 8 个 + 本轮 5 个）；
demo 未排期；hamr-catch 是固定 v0.1.0 tag 的 release workflow。

## 5. 知识库文档收敛

- 2026-10-20 整批已暂存工作作为独立提交归档（`3c6dce4`）。
- 路线图阶段 C：C1–C5 / C7 / C8 标 ✅ 并附提交证据；补各仓库门禁现状。
- PROJ-017 注册表：CI 铺开里程碑置 `completed`（completion 2026-11-19），
  `updated_date` → 2026-11-19，tags 增 `round-4`。
- v0.2 主文档：加第四轮进展引用块，版本 r3 → r4。
- README：子仓库数 14 → **15**（含 hamr-catch，固定 v0.1.0 tag）；
  同步指针的示例循环排除 hamr-catch（旧示例会把它从 tag 强制切到 main）；
  补充新告警类型说明。
- mood-calender 索引指针 bump 到 `1b07572`（该提交已在 origin）。

## 6. 推送顺序（网络恢复后执行）

当前六个子仓库各有本地未推送提交，**必须先推子仓库、再推超级项目**，
否则超级项目的 gitlink 在远端取不到对象：

```bash
# 1. 子仓库（本轮 C1–C5 + 既有 PROJ-019）
git -C repos/hamr-status    push origin main   # 776aca6
git -C repos/hamr-website   push origin main   # 5d5a82f
git -C repos/hamr-help      push origin main   # 11e6a3d
git -C repos/hamr-developer push origin main   # 341ac71
git -C repos/hamr-deploy    push origin main   # 3ab1aee
git -C repos/hamr-app       push origin main   # 7e06700（PROJ-019，2026-11-17 起未推送）
# 2. 超级项目（含本轮两个提交、2026-10-20 批次与 PROJ-019，共领先 3 个提交）
git push origin main
# 3. 推送后检查器对上述仓库的"领先上游"告警应全部消失；GitHub 上 5 个新门禁应转绿
python3 scripts/check-kb-consistency.py
```

M3（门禁落地）以推送后 GitHub 实际绿灯为准关闭。

## 7. 下一轮建议

1. **C6**：`cargo audit` / `npm audit` 入 CI，建议先只告警不阻断，
   清完存量问题再升为门禁。
2. demo 仓库是否需要门禁（当前未排期；其 backend 是 Rust）。
3. 阶段 D 的 P0：DNS/部署拓扑登机核对（含 services/ali 与 services/tx
   目录名与真实主机反向的问题），核对前不动 A 记录。
4. website three.js vendor chunk 代码分割（build 非阻断告警）。
5. 阶段 D 其余：状态页接真实 Prometheus 历史、跨语言 shared 模板、
   指标命名统一、v0.2 复盘归档。

---

**最后更新**：2026-11-19
**维护者**：HamR 项目团队
