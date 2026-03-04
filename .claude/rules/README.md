# .claude/rules - 项目规则目录

## 📋 规则文件列表

| 文件 | 说明 | 适用对象 |
|-----|------|---------|
| `00-overview.md` | 规则体系概述 | 所有人 |
| `01-project-context.md` | 项目背景与核心理念 | 新成员、AI 助手 |
| `02-documentation-standards.md` | 文档规范与格式要求 | 文档编写者、AI 助手 |
| `03-workflow-guidelines.md` | 工作流程与操作规范 | 所有人 |
| `04-quality-checklist.md` | 质量检查清单 | 文档审查者、AI 助手 |
| `05-team-conventions.md` | 团队协作约定 | 所有团队成员 |

## 🎯 使用指南

### 对 AI 助手（如 codeflicker）
```
优先级：.claude/rules/*.md > AGENTS.md > 默认行为
```

AI 助手应当：
1. **启动时读取**：首次与项目交互时读取所有规则文件
2. **遵循规范**：严格按照规则执行操作
3. **检查质量**：使用 `04-quality-checklist.md` 验证输出
4. **冲突解决**：规则优先级 - 项目规则 > 根目录规则 > 默认行为

### 对团队成员

#### 新成员入职
```bash
# 1. 阅读规则体系
cat .claude/rules/00-overview.md

# 2. 理解项目背景
cat .claude/rules/01-project-context.md

# 3. 学习文档规范
cat .claude/rules/02-documentation-standards.md

# 4. 熟悉工作流程
cat .claude/rules/03-workflow-guidelines.md

# 5. 了解协作约定
cat .claude/rules/05-team-conventions.md
```

#### 日常工作
- **创建文档**：参考 `02-documentation-standards.md` 和 `templates/`
- **更新文档**：遵循 `03-workflow-guidelines.md` 流程
- **质量检查**：使用 `04-quality-checklist.md` 清单

## 🔄 规则更新流程

### 1. 识别需求
- 发现现有规则不足
- 团队实践发生变化
- 工具或流程升级

### 2. 提出修改
```bash
# 创建分支
git checkout -b update-rules-YYYYMMDD

# 编辑规则文件
vim .claude/rules/XX-topic.md

# 提交变更
git add .claude/rules/
git commit -m "docs: 更新 XX 规则 - 原因说明"
```

### 3. 团队评审
- 发起 PR 或讨论
- 说明修改理由和影响
- 达成团队共识

### 4. 合并与通知
```bash
# 合并到主分支
git merge update-rules-YYYYMMDD

# 通知团队成员
# 通过 Slack/邮件/会议告知规则变更
```

## 📌 规则原则

### 简洁性
- 规则应简洁明确，避免冗长
- 使用清单和示例说明

### 可执行性
- 规则应具体可操作
- 避免模糊或主观描述

### 一致性
- 规则之间不应冲突
- 术语和约定保持统一

### 演进性
- 规则随项目发展而演进
- 定期回顾和优化

## 🔗 相关文档

- [../../README.md](../../README.md) - 项目总览
- [../../AGENTS.md](../../AGENTS.md) - AI 助手详细工作指南
- [../../templates/](../../templates/) - 文档模板
- [../../docs/agent/](../../docs/agent/) - Agent 详细文档

---

**维护者**：项目团队  
**最后更新**：2026-03-04  
**版本**：v1.0
