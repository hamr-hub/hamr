# CLAUDE.md - HamR 项目规划知识库

> 团队共享的项目内存文件 - 项目架构、编码标准、常见工作流

## 📋 项目概述

**项目名称**：HamR 项目规划知识库  
**项目类型**：文档管理系统  
**技术栈**：Markdown + Git + JSON  
**主要语言**：中文  
**维护方式**：Git 版本控制

**核心价值**：
- 结构化管理项目文档，避免信息散落
- 追踪项目进度和里程碑
- 积累项目经验，形成知识沉淀
- 支持 AI 助手快速定位和检索信息

---

## 🏗️ 项目架构

### 目录结构

```
hamr/
├── AGENTS.md              # AI 助手工作指南
├── CLAUDE.md              # 本文件 - 团队共享说明
├── README.md              # 项目概览
│
├── docs/                  # 项目文档
│   └── agent/             # AI 助手详细文档
│       ├── organization.md    # 文档组织规范
│       └── templates.md       # 模板使用指南
│
├── templates/             # 文档模板（6个）
│   ├── project-template.md
│   ├── sprint-template.md
│   ├── proposal-template.md
│   ├── roadmap-template.md
│   ├── retrospective-template.md
│   └── report-template.md
│
├── projects/              # 项目文档
│   ├── active/            # 活跃项目
│   ├── archived/          # 已归档项目
│   └── registry/          # 项目注册表（JSON 索引）
│
├── planning/              # 规划文档
│   ├── roadmaps/          # 产品路线图
│   ├── proposals/         # 项目提案
│   └── reviews/           # 评审记录
│
├── execution/             # 执行文档
│   ├── sprints/           # 迭代计划
│   ├── retrospectives/    # 回顾复盘
│   └── reports/           # 进度报告
│
└── resources/             # 参考资料
```

### 核心组件

1. **文档模板系统** (`templates/`)
   - 6 个标准化模板
   - 覆盖项目全生命周期
   - 支持自定义和扩展

2. **项目注册表** (`projects/registry/`)
   - JSON 格式的项目索引
   - 机器可读，支持 AI 快速检索
   - 包含项目元信息和文档路径

3. **文档组织规范** (`docs/agent/`)
   - 命名约定
   - 生命周期管理
   - 最佳实践

---

## 📝 编码标准（文档标准）

### 文件命名规范

```bash
# 项目文档
项目名称-YYYYMMDD.md
示例: 用户认证系统-20260304.md

# 迭代计划
sprint-NN-YYYYMMDD.md
示例: sprint-01-20260304.md

# 产品路线图
产品名-roadmap-YYYYQ.md
示例: HamR-roadmap-2026Q2.md

# 项目提案
提案主题-YYYYMMDD.md
示例: 域名分配详细清单-20260304.md

# 回顾文档
retro-项目名-YYYYMMDD.md
示例: retro-用户认证-20260304.md

# 进度报告
report-YYYY-WNN.md 或 report-YYYY-MM.md
示例: report-2026-W10.md, report-2026-03.md
```

### 文档格式规范

#### 元信息模板
```markdown
---
标题: 项目名称
创建时间: 2026-03-04
负责人: 姓名
状态: 🟢 进行中
优先级: P0
标签: #项目 #规划 #技术
---
```

#### 标题层级
- 使用 `#` `##` `###` 三级标题足够
- 避免过深的嵌套
- 保持层级清晰

#### 任务列表
```markdown
- [ ] 未完成任务
- [x] 已完成任务
```

#### 状态指示器
- 🟢 活跃/进行中
- 🟡 有风险/需关注
- 🔴 严重/已完成
- ✅ 完成
- ⏳ 未开始
- ⏸️ 暂停

#### 表格格式
```markdown
| 列1 | 列2 | 列3 |
|-----|-----|-----|
| 内容 | 内容 | 内容 |
```

### 项目注册表规范

```json
{
  "id": "PROJ-NNN",
  "name": "项目名称",
  "status": "active|completed|cancelled|paused",
  "priority": "high|medium|low",
  "created_date": "2026-03-04",
  "updated_date": "2026-03-04",
  "owner": "负责人姓名",
  "tags": ["标签1", "标签2"],
  "documents": {
    "project": "projects/active/项目名-20260304.md",
    "roadmap": "planning/roadmaps/项目名-roadmap-2026Q2.md",
    "proposal": "planning/proposals/提案名-20260304.md"
  },
  "milestones": [
    {
      "name": "里程碑名称",
      "status": "pending|in_progress|completed",
      "due_date": "2026-03-31",
      "completion_date": null
    }
  ]
}
```

---

## 🔄 常见工作流

### 1. 创建新项目

```bash
# 1. 从模板创建项目文档
cp templates/project-template.md projects/active/新项目-20260304.md

# 2. 编辑项目文档，填写基本信息

# 3. 创建项目注册表
cp projects/registry/PROJ-000-template.json projects/registry/PROJ-002-项目简称.json

# 4. 编辑 JSON 文件，填写项目元信息

# 5. 提交到 Git
git add .
git commit -m "feat: 创建新项目 - 项目名称"
git push
```

### 2. 更新项目进度

```bash
# 1. 编辑项目主文档
# - 更新进度百分比
# - 标记里程碑状态
# - 添加本周进展

# 2. 更新项目注册表
# - 更新 updated_date
# - 更新里程碑状态

# 3. 提交变更
git add .
git commit -m "update: 完成里程碑 - XXX"
git push
```

### 3. 创建迭代计划

```bash
# 1. 从模板创建迭代文档
cp templates/sprint-template.md execution/sprints/sprint-01-20260304.md

# 2. 填写迭代目标和任务列表

# 3. 提交
git add .
git commit -m "feat: 创建 Sprint 01 迭代计划"
git push
```

### 4. 项目归档

```bash
# 1. 移动项目文档到归档目录
mv projects/active/项目名-20260304.md projects/archived/项目名-20260304-completed.md

# 2. 更新项目注册表状态
# status: "active" → "completed"
# updated_date: 更新为当前日期

# 3. 创建回顾文档（可选）
cp templates/retrospective-template.md execution/retrospectives/retro-项目名-20260304.md

# 4. 提交
git add .
git commit -m "archive: 归档项目 - 项目名称"
git push
```

### 5. 定期回顾

```bash
# 1. 创建回顾文档
cp templates/retrospective-template.md execution/retrospectives/retro-2026Q1-20260331.md

# 2. 填写回顾内容
# - 做得好的方面
# - 需要改进的地方
# - 行动计划

# 3. 提交
git add .
git commit -m "docs: 2026Q1 季度回顾"
git push
```

---

## 👥 团队协作规范

### Git 提交规范

**提交类型**：
- `feat:` - 新功能/新项目
- `update:` - 更新进度/内容
- `docs:` - 文档优化
- `fix:` - 修复错误
- `archive:` - 归档项目
- `refactor:` - 重构文档结构

**提交格式**：
```bash
类型: 简短描述（50字符以内）

详细说明（可选）
- 变更点1
- 变更点2
```

**示例**：
```bash
git commit -m "feat: 创建用户认证系统项目文档"
git commit -m "update: 完成域名注册里程碑"
git commit -m "archive: 归档已完成项目 - XXX"
```

### 分支管理

- `main` - 主分支，保持稳定
- 直接在 `main` 分支工作（文档项目）
- 重大变更可创建临时分支

### Code Review

- 重要项目文档创建后，建议团队 Review
- 使用 GitHub Pull Request 进行讨论
- 通过后合并到主分支

### 文档同步

- 每天下班前提交本地变更
- 每天上班先拉取最新版本
- 避免长时间不同步导致冲突

```bash
# 开始工作前
git pull

# 结束工作后
git add .
git commit -m "update: 今日工作进展"
git push
```

---

## 🤖 AI 助手集成

### 使用场景

1. **文档创建** - AI 根据模板快速生成项目文档
2. **信息检索** - AI 通过注册表快速定位项目
3. **进度提醒** - AI 检查里程碑和截止日期
4. **格式检查** - AI 验证文档格式一致性
5. **总结报告** - AI 生成项目总结和复盘

### AI 工作流程

详见 `AGENTS.md` 文件，包含：
- AI 角色定位
- 核心工作流
- 信息检索策略
- 文档质量检查清单
- 行为准则

---

## 📚 参考文档

- `AGENTS.md` - AI 助手工作指南
- `README.md` - 项目概览和快速开始
- `docs/agent/organization.md` - 文档组织规范
- `docs/agent/templates.md` - 模板使用说明
- `projects/registry/README.md` - 项目注册表指南

---

## 🔧 常见问题

### Q: 如何选择合适的模板？
A: 参考 `docs/agent/templates.md`，根据文档类型选择：
- 项目文档 → `project-template.md`
- 迭代计划 → `sprint-template.md`
- 产品规划 → `roadmap-template.md`
- 技术方案 → `proposal-template.md`
- 项目复盘 → `retrospective-template.md`
- 进度汇报 → `report-template.md`

### Q: 项目注册表是否必须创建？
A: 建议创建。注册表提供结构化索引，方便 AI 和团队成员快速检索。

### Q: 如何处理文档冲突？
A: 
1. 避免多人同时编辑同一文档
2. 及时拉取最新版本
3. 遇到冲突手动解决，保留有价值的内容

### Q: 文档更新频率建议？
A:
- 活跃项目：每周更新进度
- 迭代计划：每日更新任务状态
- 项目注册表：里程碑变更时更新
- 回顾文档：迭代结束或项目完成时创建

---

**最后更新**：2026-03-04  
**维护者**：HamR 项目团队  
**版本**：v1.0
