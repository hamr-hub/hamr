# 项目规则快速参考

## 🚀 快速链接

### 我想...

| 场景 | 查看文档 |
|-----|---------|
| 了解规则体系 | [00-overview.md](.claude/rules/00-overview.md) |
| 理解项目背景 | [01-project-context.md](.claude/rules/01-project-context.md) |
| 创建新文档 | [02-documentation-standards.md](.claude/rules/02-documentation-standards.md) |
| 执行工作流程 | [03-workflow-guidelines.md](.claude/rules/03-workflow-guidelines.md) |
| 检查文档质量 | [04-quality-checklist.md](.claude/rules/04-quality-checklist.md) |
| 了解团队约定 | [05-team-conventions.md](.claude/rules/05-team-conventions.md) |

## 📖 新成员必读

1. [README.md](README.md) - 项目总览（5分钟）
2. [.claude/rules/01-project-context.md](.claude/rules/01-project-context.md) - 项目背景（5分钟）
3. [.claude/rules/02-documentation-standards.md](.claude/rules/02-documentation-standards.md) - 文档规范（10分钟）
4. [AGENTS.md](AGENTS.md) - AI 助手使用指南（15分钟）

## 🤖 AI 助手指令

### 创建新项目
```
帮我创建一个新项目：[项目名称]
目标：[项目目标]
负责人：[姓名]
```

### 查询项目
```
[项目名]的进展如何？
有哪些活跃项目？
```

### 更新进度
```
[项目名]完成了[里程碑名称]
```

### 项目归档
```
归档项目：[项目名]
```

## 📂 目录结构

```
hamr/
├── .claude/
│   └── rules/              # 项目规则（本目录）
├── projects/
│   ├── active/            # 活跃项目
│   ├── archived/          # 已归档项目
│   └── registry/          # 项目注册表（JSON）
├── planning/
│   ├── roadmaps/          # 产品路线图
│   ├── proposals/         # 项目提案
│   └── reviews/           # 评审文档
├── execution/
│   ├── sprints/           # 迭代记录
│   ├── retrospectives/    # 回顾会议
│   └── reports/           # 进度报告
├── templates/             # 文档模板
├── resources/             # 参考资料
├── docs/                  # 其他文档
├── README.md              # 项目总览
└── AGENTS.md              # AI 助手详细指南
```

## ✅ 常用操作清单

### 创建新项目
- [ ] 从模板创建 Markdown 文档
- [ ] 创建项目注册表 JSON
- [ ] 填写项目基本信息
- [ ] 提交到 Git

### 更新项目
- [ ] 更新 Markdown 文档
- [ ] 同步更新 JSON 注册表
- [ ] 更新 `updated_date`
- [ ] 提交到 Git

### 项目归档
- [ ] 移动文档到 `archived/`
- [ ] 更新注册表状态
- [ ] 创建回顾文档（可选）
- [ ] 提交到 Git

---

**提示**：此文件是快速参考索引，详细规则请查看 `.claude/rules/` 目录。

**最后更新**：2026-03-04
