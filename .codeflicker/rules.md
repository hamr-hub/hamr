# Codeflicker 开发规范 - HamR 知识库

## 项目类型
**知识管理项目** - 使用 Markdown + JSON + Git 管理项目文档

## 目录结构

```
hamr/
├── .codeflicker/           # Codeflicker 配置
│   ├── codeflicker.json    # 项目配置
│   └── snippets/           # 代码片段
├── docs/                   # 文档
│   └── agent/              # AI 助手开发规范
├── projects/               # 项目文档
│   ├── active/             # 活跃项目
│   ├── archived/           # 已归档项目
│   └── registry/           # 项目注册表 (JSON)
├── planning/               # 规划文档
│   ├── proposals/          # 技术提案
│   ├── reviews/            # 项目评审
│   └── roadmaps/           # 路线图
├── execution/              # 执行文档
│   ├── reports/            # 进度报告
│   ├── retrospectives/     # 回顾会议
│   └── sprints/            # 迭代计划
├── templates/              # 文档模板
└── resources/             # 资源文件
```

## 文档命名规范

### 项目文档
- 活跃项目: `项目名称-YYYYMMDD.md`
- 已归档项目: `项目名称-YYYYMMDD-completed.md`

### JSON 注册表
- 格式: `PROJ-NNN-项目简称.json`
- 示例: `PROJ-001-域名规划.json`

### 日期格式
- 文件名: `YYYYMMDD`
- 文档内: `YYYY-MM-DD`

## AI 助手工作流程

### 创建新项目
1. 创建项目主文档: `projects/active/项目名称-YYYYMMDD.md`
2. 创建项目注册表: `projects/registry/PROJ-NNN-项目简称.json`
3. 更新注册表中的文档路径
4. 提交变更

### 更新项目进度
1. 更新项目主文档中的进度百分比
2. 标记里程碑为已完成
3. 更新 JSON 注册表中的 `updated_date`
4. 提交变更

### 项目归档
1. 移动项目文档到 `projects/archived/`
2. 更新注册表状态: `active` → `completed`
3. 提交变更

## 质量检查清单

### Markdown 文档
- [ ] 文件命名符合规范
- [ ] 包含元信息（标题、创建时间、负责人、状态）
- [ ] 标题层级正确（# ## ### 不超过三级）
- [ ] 任务列表格式正确（`- [ ]` 未完成，`- [x]` 已完成）
- [ ] 表格格式完整
- [ ] 日期格式一致
- [ ] 链接有效

### JSON 注册表
- [ ] 文件命名符合规范
- [ ] JSON 格式正确
- [ ] 必填字段完整
- [ ] 文档路径存在且正确
- [ ] `updated_date` 与最新修改日期一致

## Git 提交规范

| 类型 | 说明 |
|------|------|
| feat | 新功能/新项目 |
| update | 更新进度/内容 |
| docs | 文档优化 |
| fix | 修复错误 |
| archive | 归档项目 |
