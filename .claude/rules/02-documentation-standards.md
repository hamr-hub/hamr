# 文档规范与标准

## 文件命名规范

### Markdown 文档
```
项目文档：项目名称-YYYYMMDD.md
路线图：  项目名-roadmap-YYYYQN.md
提案：    提案名-YYYYMMDD.md
迭代：    sprint-NN-YYYYMMDD.md
回顾：    retro-项目名-YYYYMMDD.md
报告：    report-项目名-YYYYMMDD.md
```

### JSON 注册表
```
格式：PROJ-NNN-项目简称.json
示例：PROJ-001-域名规划.json
     PROJ-002-用户认证.json
```

## 文档格式要求

### Markdown 结构
```markdown
# 文档标题

**元信息**
- 创建时间：YYYY-MM-DD
- 负责人：[姓名]
- 状态：[进行中/已完成/暂停/取消]

## 一级标题

### 二级标题

#### 三级标题（最多到三级）

内容...
```

### 必要元素
- ✅ 标题（一级标题，唯一）
- ✅ 元信息（时间、负责人、状态）
- ✅ 最后更新时间（文档底部）
- ✅ 清晰的章节结构（二级、三级标题）

### 格式约定
- **日期格式**：统一使用 `YYYY-MM-DD`
- **任务列表**：`- [ ]` 未完成，`- [x]` 已完成
- **表格**：必须包含表头和分隔线
- **链接**：使用相对路径，确保可访问

## JSON 注册表格式

### 必填字段
```json
{
  "id": "PROJ-001",
  "name": "项目名称",
  "status": "active",
  "priority": "high",
  "created_date": "2026-03-04",
  "updated_date": "2026-03-04",
  "owner": "负责人姓名",
  "documents": {
    "project": "projects/active/项目名称-20260304.md"
  }
}
```

### 可选字段
```json
{
  "description": "项目简要描述",
  "tags": ["标签1", "标签2"],
  "documents": {
    "roadmap": "planning/roadmaps/...",
    "proposal": "planning/proposals/...",
    "retrospective": "execution/retrospectives/..."
  },
  "milestones": [
    {
      "name": "里程碑名称",
      "due_date": "2026-03-15",
      "status": "pending"
    }
  ]
}
```

## 语言规范

- **主要语言**：中文
- **技术术语**：可使用英文原文，加中文注释
- **代码/命令**：使用代码块标记
- **强调**：使用加粗 `**文本**` 或列表

## 模板使用

### 何时使用模板
- ✅ 创建新项目时，从 `templates/project-template.md` 开始
- ✅ 创建路线图时，从 `templates/roadmap-template.md` 开始
- ✅ 创建提案时，从 `templates/proposal-template.md` 开始
- ✅ 创建注册表时，从 `projects/registry/PROJ-000-template.json` 开始

### 模板定制
- 保留必填字段
- 根据实际需求添加或删除可选字段
- 保持格式一致性

---

**参考文档**：
- [templates/](../../templates/) - 所有可用模板
- [docs/agent/organization.md](../../docs/agent/organization.md) - 文档组织详细说明
