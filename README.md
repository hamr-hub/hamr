# HAMR - 项目规划知识库

项目管理与实施文档的集中存储库。

## 📁 目录结构

```
hamr/
├── projects/           # 项目文档
│   ├── active/        # 进行中的项目
│   ├── archived/      # 已完成/已归档的项目
│   └── registry/      # 项目注册表（JSON索引文件）
├── planning/          # 规划文档
│   ├── roadmaps/      # 产品路线图
│   ├── proposals/     # 项目提案
│   └── reviews/       # 评审文档
├── execution/         # 执行文档
│   ├── sprints/       # 迭代/冲刺记录
│   ├── retrospectives/ # 回顾会议记录
│   └── reports/       # 进度报告
├── templates/         # 文档模板
└── resources/         # 参考资料
```

## 🚀 快速开始

### 创建新项目
```bash
# 1. 从模板创建新项目文档
cp templates/project-template.md projects/active/项目名称-YYYYMMDD.md

# 2. 创建项目注册表
cp projects/registry/PROJ-000-template.json projects/registry/PROJ-NNN-项目简称.json
# 编辑JSON文件，填写项目信息和文档路径
```

### 查找项目
```bash
# 查看所有活跃项目
cat projects/registry/PROJ-*.json | jq 'select(.status == "active")'

# 查找特定项目的所有文档
cat projects/registry/PROJ-001-域名规划.json | jq '.documents'
```

### 开始新迭代
```bash
# 创建迭代计划
cp templates/sprint-template.md execution/sprints/sprint-NN.md
```

## 📝 文档规范

- 项目文档命名：`项目名称-YYYYMMDD.md`
- 迭代文档命名：`sprint-NN-YYYYMMDD.md`
- 使用中文编写，保持格式统一
- 完成的项目及时归档到 `archived/`

## 🔧 工具集成

本知识库可与以下工具配合使用：
- AI 助手 (codeflicker) 辅助文档生成
- Git 版本管理
- Markdown 编辑器

---

最后更新：2026-03-04
