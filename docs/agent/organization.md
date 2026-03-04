# 文档组织规范

## 目录结构说明

### 📂 projects/ - 项目文档

存放具体项目的完整文档。

#### active/ - 活跃项目
- 当前正在进行的项目
- 命名规范：`项目名称-YYYYMMDD.md`
- 示例：`用户认证系统-20260304.md`

#### archived/ - 归档项目
- 已完成、已取消或已暂停的项目
- 完成项目后从 `active/` 移至此处
- 保持原有命名，可添加状态后缀：`-completed`, `-cancelled`, `-paused`

### 📂 planning/ - 规划文档

存放项目规划和决策相关文档。

#### roadmaps/ - 产品路线图
- 产品方向和长期规划
- 季度/年度路线图
- 命名：`产品名-roadmap-2026Q1.md`

#### proposals/ - 项目提案
- 新项目立项建议
- 技术方案选型文档
- 命名：`提案主题-proposal-YYYYMMDD.md`

#### reviews/ - 评审文档
- 设计评审记录
- 技术评审纪要
- 命名：`评审主题-review-YYYYMMDD.md`

### 📂 execution/ - 执行文档

存放项目执行过程中的记录。

#### sprints/ - 迭代记录
- 敏捷开发的迭代/冲刺计划
- 包含目标、任务、进度
- 命名：`sprint-NN-YYYYMMDD.md` (NN 为迭代编号)

#### retrospectives/ - 回顾会议
- 迭代回顾
- 项目复盘
- 命名：`retro-项目名-YYYYMMDD.md`

#### reports/ - 进度报告
- 周报、月报
- 里程碑报告
- 命名：`report-YYYY-WNN.md` 或 `report-YYYY-MM.md`

### 📂 templates/ - 模板文件

存放可复用的文档模板，详见 `templates.md`。

### 📂 resources/ - 参考资料

存放通用参考资料：
- 最佳实践文档
- 流程规范
- 外部资源链接汇总

## 文档命名约定

### 基本规则
- 使用中文命名，语义清晰
- 日期格式：`YYYYMMDD`
- 多个单词用短横线连接：`-`
- 避免空格和特殊字符

### 状态标记
在文件名末尾可添加状态标识：
- `-draft` - 草稿
- `-review` - 评审中
- `-approved` - 已批准
- `-completed` - 已完成
- `-cancelled` - 已取消

### 版本管理
- 重大更新创建新文件，保留日期
- 小修改直接覆盖，通过 Git 管理历史
- 示例：`项目A-20260304.md` → `项目A-20260310.md`

## 文档生命周期

```
1. 创建 (templates/) → 草稿编写
2. 评审 (planning/reviews/) → 讨论修改
3. 执行 (projects/active/) → 进行中
4. 完成 → 归档 (projects/archived/)
5. 定期回顾 (execution/retrospectives/)
```

## 最佳实践

### 文档内容
- 使用 Markdown 格式
- 包含标准的元信息（创建日期、负责人、状态）
- 清晰的标题层级（# ## ### 三级足够）
- 使用任务列表跟踪进度

### 元信息模板
```markdown
---
标题: 项目名称
创建时间: 2026-03-04
负责人: 姓名
状态: 进行中
标签: #项目 #规划
---
```

### 文档维护
- 定期清理归档不需要的文档
- 重要变更及时提交 Git
- 每季度回顾文档结构是否合理
