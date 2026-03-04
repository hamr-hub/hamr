# 工作流程指南

## 核心工作流

### 1. 创建新项目

**流程步骤**：
```bash
1. 创建项目主文档
   cp templates/project-template.md projects/active/项目名称-YYYYMMDD.md

2. 创建项目注册表
   cp projects/registry/PROJ-000-template.json projects/registry/PROJ-NNN-项目简称.json

3. 填写项目信息
   - 编辑 Markdown 文档：标题、目标、范围、里程碑
   - 编辑 JSON 注册表：id, name, status, owner, documents

4. (可选) 创建关联文档
   - 路线图：planning/roadmaps/
   - 提案：planning/proposals/

5. 提交到 Git
   git add .
   git commit -m "feat: 创建新项目 - 项目名称"
```

**AI 助手职责**：
- 询问项目基本信息
- 从模板创建文档
- 自动填写元信息
- 同步创建 Markdown 和 JSON
- 验证文档格式
- 提示下一步行动

### 2. 更新项目进度

**流程步骤**：
```bash
1. 更新项目主文档
   - 修改进度百分比
   - 标记完成的里程碑
   - 添加本周进展

2. 同步更新注册表
   - 更新 updated_date
   - 更新 milestones 状态

3. 提交变更
   git add .
   git commit -m "update: 完成里程碑 - XXX"
```

**AI 助手职责**：
- 读取当前项目状态
- 同时更新 Markdown 和 JSON
- 更新时间戳
- 建议下一步工作

### 3. 查找项目信息

**查找策略**（优先级排序）：
```bash
优先级 1: 读取项目注册表
   - 快速获取项目元信息
   - 定位文档路径

优先级 2: 读取项目主文档
   - 获取详细信息
   - 查看完整计划

优先级 3: 搜索关联文档
   - 路线图、提案、回顾等
   - 历史决策和讨论
```

**AI 助手职责**：
- 优先读取 JSON 注册表
- 根据路径定位文档
- 提取关键信息
- 按需深入读取详细内容

### 4. 项目归档

**流程步骤**：
```bash
1. 移动文档到归档目录
   mv projects/active/项目名-YYYYMMDD.md \
      projects/archived/项目名-YYYYMMDD-completed.md

2. 更新注册表
   - status: "active" → "completed"
   - updated_date: 更新为归档日期
   - documents.project: 更新为 archived/ 路径

3. (可选) 创建回顾文档
   cp templates/retrospective-template.md \
      execution/retrospectives/retro-项目名-YYYYMMDD.md

4. 提交变更
   git add .
   git commit -m "archive: 归档项目 - 项目名称"
```

**AI 助手职责**：
- 确认归档意图
- 移动文档到正确位置
- 更新注册表状态
- 询问是否需要回顾文档
- 生成项目总结（可选）

## Git 提交规范

### 提交消息格式
```
类型: 简短描述

详细说明（可选）
```

### 提交类型
- `feat:` - 新功能/新项目
- `update:` - 更新进度/内容
- `docs:` - 文档优化/修正
- `fix:` - 修复错误
- `archive:` - 归档项目
- `refactor:` - 重构文档结构

### 示例
```bash
git commit -m "feat: 创建新项目 - 用户认证系统"
git commit -m "update: 完成里程碑 - 域名注册"
git commit -m "docs: 优化项目模板格式"
git commit -m "archive: 归档项目 - 原型开发"
```

## 协作约定

### 并行工作
- ✅ 不同项目可并行编辑
- ✅ 同项目不同文档可并行编辑
- ⚠️ 同一文档避免并行编辑（易冲突）

### 冲突解决
1. 拉取最新变更：`git pull`
2. 手动解决冲突（Markdown 格式化差异）
3. 验证 JSON 格式正确性
4. 重新提交

### 文档审查
- 重要项目立项需团队评审
- 项目归档前需确认完成状态
- 定期检查文档质量和一致性

---

**参考文档**：
- [AGENTS.md](../../AGENTS.md) - AI 助手工作流详细说明
- [docs/agent/workflows.md](../../docs/agent/workflows.md) - 工作流详细文档
