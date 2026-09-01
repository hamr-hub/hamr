# execution/ 目录说明

> 说明：与 `README.md` / `CLAUDE.md` / `AGENTS.md` 中描述的"标准三件套"存在偏差。
> 本文档登记**当前真实结构**与文档预期之间的差异，方便后续维护时对齐。

## 当前子目录

| 子目录 | 状态 | 说明 |
|--------|------|------|
| `emergency/` | ✅ 实际存在 | 应急响应预案（如 `应急响应预案-20260310.md`），仅 1 份文档 |
| `sprints/` | ❌ 未建立 | 顶层 README 引用，但本仓库未使用该结构 |
| `retrospectives/` | ❌ 未建立 | 顶层 README 引用，但本仓库未使用该结构 |
| `reports/` | ❌ 未建立 | 顶层 README 引用，但本仓库未使用该结构 |

## 为什么没有 sprints/retrospectives/reports/

实践过程中，迭代记录与进度报告走了其他路径：

- **迭代报告 / master 合成** → `.iter-skill/runs/YYYY-MM-DD/{00-master-synthesis.md, run.log.md}`
- **进度评估** → 在项目主文档 `projects/active/<name>-YYYYMMDD.md` 中随项目里程碑更新
- **回顾复盘** → 暂未沉淀独立子目录；如有需要可直接创建 `execution/retrospectives/`

`projects/registry/PROJ-000-template.json` 的 `documents.sprint` / `report` / `retrospective`
字段目前都为 `[]` 或 `null`，是预留位，不强制依赖子目录存在。

## 维护建议

- 新建迭代记录：直接放 `.iter-skill/runs/<日期>/`，并在 `projects/active/` 对应项目文档里交叉引用
- 需要正式 sprint 流程时：先在本目录建立 `sprints/`、`retrospectives/`、`reports/` 子目录，再迁移模板
- 顶层 README 描述的结构是**目标态**，不是**当前态**——以本 README 为准