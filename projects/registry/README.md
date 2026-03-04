# 项目注册表 (Project Registry)

## 📋 说明

本目录用于存放项目索引文件，每个项目一个JSON文件，记录项目的基本信息和关联文档路径。

## 🎯 用途

- 快速查找项目及其相关文档
- 追踪项目文档的完整性
- 自动化工具（脚本、CI/CD）的数据源
- AI助手快速定位项目信息

## 📄 文件格式

### 命名规范
`项目ID.json`

**示例**：
- `PROJ-001-域名规划.json`
- `PROJ-002-用户系统.json`

### JSON结构
```json
{
  "id": "PROJ-001",
  "name": "域名规划与基础设施建设",
  "status": "active",
  "priority": "high",
  "created_date": "2026-03-04",
  "updated_date": "2026-03-04",
  "owner": "待定",
  "tags": ["基础设施", "域名规划", "品牌建设"],
  "documents": {
    "project": "projects/active/域名规划与基础设施-20260304.md",
    "proposal": "planning/proposals/域名分配详细清单-20260304.md",
    "roadmap": "planning/roadmaps/域名基础设施-roadmap-2026Q2.md",
    "review": null,
    "sprint": [],
    "report": [],
    "retrospective": null
  },
  "milestones": [
    {
      "name": "域名规划方案完成",
      "date": "2026-03-04",
      "status": "completed"
    },
    {
      "name": "Phase 1 子域名注册",
      "date": "2026-03-15",
      "status": "in_progress"
    },
    {
      "name": "官网+文档站上线",
      "date": "2026-04-15",
      "status": "pending"
    }
  ],
  "description": "建立HamR双域名体系（hamr.store + hamr.top），规划55个子域名，支撑家庭用户服务和开发者生态"
}
```

## 🔧 字段说明

### 基础信息
| 字段 | 类型 | 说明 | 必填 |
|-----|------|------|------|
| `id` | string | 项目唯一标识，格式：PROJ-NNN-简称 | ✅ |
| `name` | string | 项目完整名称 | ✅ |
| `status` | string | 项目状态：active/paused/completed/cancelled | ✅ |
| `priority` | string | 优先级：high/medium/low | ✅ |
| `created_date` | string | 创建日期，格式：YYYY-MM-DD | ✅ |
| `updated_date` | string | 最后更新日期 | ✅ |
| `owner` | string | 项目负责人 | ✅ |
| `tags` | array | 标签数组，用于分类和检索 | ❌ |
| `description` | string | 项目简介（1-2句话） | ✅ |

### 文档路径 (documents)
| 字段 | 类型 | 说明 |
|-----|------|------|
| `project` | string | 项目主文档路径 |
| `proposal` | string/array | 技术提案文档路径（可多个） |
| `roadmap` | string/array | 产品路线图路径（可多个） |
| `review` | string/array | 评审文档路径（可多个） |
| `sprint` | array | 迭代文档路径数组 |
| `report` | array | 报告文档路径数组 |
| `retrospective` | string/array | 回顾文档路径（可多个） |

**注意**：路径均为相对于仓库根目录的相对路径

### 里程碑 (milestones)
| 字段 | 类型 | 说明 |
|-----|------|------|
| `name` | string | 里程碑名称 |
| `date` | string | 计划日期，格式：YYYY-MM-DD |
| `status` | string | 状态：pending/in_progress/completed |

## 📌 使用示例

### 创建新项目注册
```bash
# 复制模板
cp PROJ-000-template.json PROJ-002-用户系统.json

# 编辑内容
vim PROJ-002-用户系统.json
```

### 查询所有活跃项目
```bash
# 使用jq工具
find . -name "*.json" -exec jq 'select(.status == "active")' {} \;
```

### 更新项目状态
```bash
# 编辑JSON文件，更新status和updated_date字段
```

## 🤖 自动化集成

### AI助手使用
AI助手可以通过读取注册表快速定位项目：
```
用户：帮我查看域名规划项目的所有文档
AI：读取 PROJ-001-域名规划.json → 获取所有文档路径 → 依次读取文档
```

### Git Hook
可设置Git钩子，在项目文档变更时自动更新注册表的`updated_date`。

### CI/CD
构建文档网站时，可通过注册表生成项目导航页面。

## 📂 目录结构
```
registry/
├── README.md                    # 本文件
├── PROJ-000-template.json       # 模板文件
├── PROJ-001-域名规划.json
├── PROJ-002-用户系统.json
└── ...
```

## ✅ 最佳实践

1. **及时更新**：项目文档变更后，同步更新注册表
2. **保持一致**：确保JSON中的路径与实际文件路径一致
3. **定期检查**：每月检查一次注册表与实际文档的对应关系
4. **状态转换**：项目状态变更时，及时更新JSON文件
5. **归档处理**：项目归档时，更新status为completed或cancelled

---

**维护责任人**：项目负责人  
**最后更新**：2026-03-04
