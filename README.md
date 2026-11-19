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
├── repos/             # 子项目仓库（git submodule）
├── scripts/           # 知识库自动化检查与修复脚本
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

## 🔍 自动化检查

知识库的规范（见 `AGENTS.md`《文档质量检查清单》）已经做成可执行检查，
不再依赖人工记忆：

```bash
# 一致性检查（注册表格式 / ID 唯一性 / 文档路径 / MD↔JSON 状态 /
#             updated_date / 子模块指针新鲜度）
python3 scripts/check-kb-consistency.py

# 元信息修复（把残留的模板 front matter 换成规范元信息，
#             并以注册表 JSON 为准同步状态 / 负责人 / 优先级）
python3 scripts/repair-kb-metadata.py --dry-run   # 先看会改什么
python3 scripts/repair-kb-metadata.py             # 确认后执行
```

两项检查都已接入 CI（`.github/workflows/kb-consistency.yml`）。

### 关于子模块指针

`repos/` 下的 15 个子仓库以 git submodule 形式挂载（其中 hamr-catch
固定在 `v0.1.0` tag，其余跟随 `main`）。**指针长期不更新会让
"仓库里看到的代码"与上游实际代码相差数月**，任何基于仓库现状的分析结论
都会失真 —— 2026-10-20 的全面审计正是因此差点重做上游已经修好的工作。

因此：

- 审计与分析一律以各子仓库的 `origin/main` 为准；
- 一致性检查比对的是**超级项目索引记录的 gitlink 指针**：落后
  `origin/main` 超过 20 个提交直接失败；工作区 HEAD 与索引漂移、
  或指针领先上游（疑似子仓库提交未推送）会告警；
- 同步指针的常规操作（排除固定 tag 的 hamr-catch）：

```bash
git submodule update --init --recursive
for d in repos/hamr-*; do
  [ "$(basename "$d")" = "hamr-catch" ] && continue
  git -C "$d" fetch origin && git -C "$d" checkout -B main origin/main
done
git add repos/ && git commit -m "chore(submodules): bump pointers"
```

## 🔧 工具集成

本知识库可与以下工具配合使用：
- AI 助手 (codeflicker) 辅助文档生成
- Git 版本管理
- Markdown 编辑器

---

最后更新：2026-10-20
