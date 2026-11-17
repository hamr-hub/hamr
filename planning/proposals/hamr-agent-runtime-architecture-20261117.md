---
模板名称: 技术提案模板
适用场景: Agent 运行时架构设计
最后更新: 2026-11-17
---

# HamR 管家 Agent 运行时技术提案

## 📋 提案信息

| 信息 | 内容 |
|-----|------|
| **提案标题** | HamR 管家 Agent 运行时架构设计 |
| **提案人** | AI 助手 |
| **创建时间** | 2026-11-17 |
| **最后更新** | 2026-11-17 |
| **状态** | 已批准（v1 已实现） |
| **优先级** | 🔴 高 |
| **影响范围** | hamr-app 后端、新增 /api/v1/agent/* 端点 |
| **决策截止日期** | 2026-11-17 |

## 📌 摘要 (Executive Summary)

**TL;DR**：在 `hamr-app` 现有 Rust 后端内新增 `src/agent/` 模块，实现一个
**本地优先、模型可插拔、默认只读、出网必脱敏**的 Agent 运行时。
模型层用单一 `LlmProvider` trait 抽象，本地 Ollama 与云端 API 共用 OpenAI
Chat Completions 协议；工具层把五维数据以只读函数暴露给模型；脱敏层在
provider 之前统一拦截 PII。v1 已实现并通过单元测试。

## 🎯 背景与问题

### 业务背景

HamR 管家已经能完整地**存**家庭数据（五维 CRUD + P2P 同步 + DID 身份），
但还不能**用**这些数据。2026-11-17 全家族盘点确认：15 个子仓库中
**没有任何 LLM 或 Agent 代码** —— `hamr-jiabu` 是 if-then 规则引擎，
`hamr-browser` 是无状态自动化，不具备推理、工具调用、记忆三要素。

### 核心矛盾

产品定位是「数据本地化 / 数据主权」，而 Agent 能力通常依赖云端 LLM。
若直接接云端 API，家庭成员档案、健康信息、资产清单会随提示词上云，
最核心的承诺失效。

### 不解决的后果

1. **管家只是数据库的前端** —— 用户仍要自己翻列表、看条件筛选，「助手」名不副实
2. **JiaBu 与管家之间断层** —— 管家有数据，JiaBu 有算法，中间没有交互层
3. **场景化 Agent 无处生长** —— `PROJ-016` 家庭关系修复 Agent 缺一个可复用的运行时底座
4. **隐私叙事空转** —— 全部价值主张建立在「数据不出设备」上，而没有任何能力真正用上这份数据

## 🎯 目标与非目标

### 目标 (Goals)

- ✅ 在既有后端内实现 Agent 运行时，复用五维数据与鉴权中间件
- ✅ 模型来源可插拔，本地优先
- ✅ 出网数据默认脱敏，且脱敏不损害本地推理质量
- ✅ 工具只读，`family_id` 服务端注入
- ✅ 会话记忆 + 长期记忆，且记忆每轮回灌
- ✅ 失败关闭：未启用即不可用，不静默降级

### 非目标 (Non-Goals)

- ❌ 模型训练 / 微调
- ❌ 向量检索 / RAG（v1 工具直查更准也更易审计）
- ❌ 多 Agent 编排 / 子 Agent
- ❌ 语音交互
- ❌ Agent 会话参与 P2P 同步
- ❌ 替换或重写 JiaBu 的幸福指数模型

## 🔍 方案对比

### 方案一：进程内 Agent 运行时（采纳）

**概述**：在 `hamr-app` 的 axum 服务内新增 `src/agent/` 模块，工具直查同一
PostgreSQL 连接池，模型调用走 HTTP 客户端。

**优点**：
- ✅ 零新增部署单元，零跨进程调用
- ✅ 复用现有鉴权中间件、连接池、迁移机制
- ✅ 工具直查 SQL，比走 HTTP 自调用更快且少一跳鉴权
- ✅ 与既有部署形态解耦（无论家用机还是 Docker 部署都成立）

**缺点**：
- ❌ Agent 与业务 API 共享进程，一个慢模型调用会占用连接（已用超时 + 步数上限缓解）
- ❌ 增大 hamr-app 二进制体积

**成本估算**：开发 2 人周（已完成）｜维护 0.5 人周

---

### 方案二：独立 `hamr-butler` 服务

**概述**：新建仓库与独立服务，通过 HTTP 调用 `hamr-app` 的五维 API。

**优点**：
- ✅ 故障隔离更彻底，可独立扩缩
- ✅ 未来可独立部署到家庭 NAS / 树莓派

**缺点**：
- ❌ 为调自己的服务再搭一套鉴权与网络层
- ❌ 多一跳网络延迟与失败模式
- ❌ 新增仓库需处理 submodule、CI、发布链路

**成本估算**：开发 3 人周｜维护 1 人周

---

### 方案三：纯前端 Agent（浏览器内直连模型）

**概述**：把 Agent 循环放进前端，浏览器直连模型 API。

**优点**：
- ✅ 后端零改动
- ✅ 本地模型天然不出设备

**缺点**：
- ❌ 前端 JS 模型端点暴露密钥（本地还好，云端就是明文泄露）
- ❌ 工具调用需前端访问数据库 → 必须开后端接口 → 绕回方案一
- ❌ 桌面端/移动端各写一遍运行时逻辑

**成本估算**：开发 2.5 人周｜维护 2 人周（多端重复）

---

### 对比矩阵

| 维度 | 方案一：进程内 | 方案二：独立服务 | 方案三：前端 |
|------|------------|----------------|------------|
| 部署复杂度 | 低 | 中 | 低 |
| 密钥安全 | 高（服务端持有） | 高 | **低（前端可见）** |
| 工具调用效率 | 高（直查 SQL） | 中（HTTP 自调用） | 低 |
| 故障隔离 | 中 | 高 | 高 |
| 多端复用 | 高 | 高 | **低（重复实现）** |
| 开发成本 | 2 人周 | 3 人周 | 2.5 人周 |
| 维护成本 | 低 | 中 | 高 |

## 🏆 推荐方案

**选择**：方案一 —— 进程内 Agent 运行时

**理由**：
1. **核心价值对齐**：Agent 要的就是「立刻拿到五维数据」，同进程直查是最短路径
2. **安全**：密钥留在服务端，前端永远拿不到
3. **不制造新债**：不新增仓库、不新增部署单元、不新增鉴权体系
4. **可演进**：后续要把 Agent 拆成独立服务，模块边界已经按 trait 划好了

**权衡说明**：
- 接受 Agent 与业务 API 共享进程 —— 用超时与步数上限控制影响面
- 接受二进制体积增大 —— 换来零运维成本

## 🛠 详细设计

### 分层架构

```
┌────────────────────────────────────────────────────────────────┐
│  接入层  handlers/agent.rs                                       │
│  chat / status / sessions / memories                            │
└───────────────────────────┬────────────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────────────┐
│  编排层  agent/runner.rs                                         │
│  system prompt → history → user msg → [think → tool → observe]* │
│  max_steps 有界 · 工具失败不中断 · 出网前脱敏                     │
└──┬───────────────┬───────────────┬───────────────┬─────────────┘
   │               │               │               │
┌──▼────────┐ ┌────▼─────────┐ ┌───▼──────────┐ ┌─▼────────────┐
│ 工具层     │ │ 模型层        │ │ 脱敏层        │ │ 存储层        │
│ tools.rs   │ │ provider.rs  │ │ privacy.rs   │ │ store.rs     │
│ 只读函数   │ │ LlmProvider  │ │ 一致性别名    │ │ trait +      │
│ +remember  │ │ OpenAI 兼容  │ │ + 正则屏蔽    │ │ Pg/Mem 双实现 │
└──┬────────┘ └────┬─────────┘ └───┬──────────┘ └─┬────────────┘
   │               │               │               │
┌──▼────────┐ ┌────▼─────────┐     │        ┌──────▼─────────┐
│ 五维数据    │ │ 本地模型      │     │        │ agent_sessions │
│ (PG 同池)  │ │ Ollama 等     │     │        │ agent_messages │
│ people/…   │ │ 云端 API      │     │        │ agent_memories │
└────────────┘ └──────────────┘     │        └────────────────┘
                                    │
                            出网前统一拦截
```

### 关键技术点

#### 技术点 1：Provider 抽象 —— 一套协议通吃本地与云端

Ollama 的 `/v1/chat/completions` 与云端 OpenAI 兼容 API **协议完全一致**，
因此「可插拔」不需要多套实现，换 `base_url + model + api_key` 即可换模型。

```rust
pub type ProviderFuture<'a> =
    Pin<Box<dyn Future<Output = Result<ChatResponse, ProviderError>> + Send + 'a>>;

pub trait LlmProvider: Send + Sync {
    fn chat<'a>(&'a self, req: ChatRequest) -> ProviderFuture<'a>;
    fn describe(&self) -> ProviderInfo;
}
```

**为什么不引入 `async-trait`**：trait 的 `async fn` 不满足 dyn 兼容，而本项目
需要 `Arc<dyn LlmProvider>` 以便运行时替换实现。手写 `BoxFuture` 零额外依赖，
且满足 Dockerfile 的 Rust 1.82 MSRV 约束。

**协议解析单独抽成纯函数**（`parse_chat_response`）—— 这是最容易出错的地方：
`content` 可能为 `null`、`tool_calls` 可能缺失、`arguments` 可能是空串或对象。
抽出来才能用单测逐个钉住。

#### 技术点 2：脱敏层 —— 出网前的强制关卡

核心设计：**一致性替换**而非随机替换。

```
「张伟今天加班，李娜要接孩子。张伟会晚到。」
        ↓
「成员A今天加班，成员B要接孩子。成员A会晚到。」
```

同一个人始终映射到同一个别名 —— Agent 仍能区分是谁，隐私却保住了。
若改成随机替换，「张伟生日快到了」会变成「成员A/成员B 生日快到了」，建议就废了。

三层防护：

| 层级 | 手段 | 覆盖 |
|------|------|------|
| 姓名 | 一致性别名映射（长名优先，避免「张伟伟」被「张伟」抢先命中） | people.name |
| 模式 | 正则屏蔽 | 邮箱、手机号、固话、18 位证件号、16-19 位卡号 |
| 时机 | provider 调用**之前**统一执行 | 出网链路上唯一入口 |

**幂等保证**：脱敏两次与脱敏一次结果相同 —— 因为别名本身不匹配任何 PII 模式。
这一点有单测钉住。

**本地路径不做脱敏**：数据根本没出设备，脱敏只会损害推理质量而不增加任何安全性。
判断依据是 `provider == Cloud && !allow_pii`，不是「是否联网」。

#### 技术点 3：工具层 —— `family_id` 服务端注入

工具 schema 中**不存在** `family_id` 参数。运行时由 `ToolContext` 提供。

```rust
pub struct ToolContext {
    pub db: PgPool,
    pub store: Arc<dyn ConversationStore>,
    pub family_id: Uuid,   // ← 服务端固定，模型无法影响
    ...
}
```

这样把越权边界从「模型是否听话」变成「接口结构上就不可能」。

**参数校验**：工具参数来自模型，会被塞进 SQL。虽然用的是绑定参数（`$1` 占位符，
无注入风险），但状态值这类会参与 `WHERE` 语义的字段仍做白名单校验
（`todo` / `in_progress` / `done` / `cancelled`），避免语义被模型带偏。

#### 技术点 4：主循环的有界性

```
for step in 1..=max_steps:
    resp = provider.chat(...)
    if resp.tool_calls.is_empty(): → 得出结论，退出
    for tc in resp.tool_calls: → 执行工具，结果回灌上下文
```

- `max_steps` 默认 8，上限 32 —— 模型执着调工具时必须能掐断
- 步数耗尽仍未出结论 → 返回兜底回复，**绝不返回空串**
- 工具执行失败 → 把失败原因回喂给模型，让它自己换路，而不是整轮崩掉

#### 技术点 5：存储抽象 —— 让主循环能脱离数据库单测

```rust
pub trait ConversationStore: Send + Sync {
    fn ensure_session<'a>(&'a self, family_id: Uuid, session_id: Option<Uuid>) -> StoreFuture<'a, Uuid>;
    fn history<'a>(&'a self, session_id: Uuid, limit: i64) -> StoreFuture<'a, Vec<ChatMessage>>;
    fn append<'a>(&'a self, session_id: Uuid, msg: &'a ChatMessage) -> StoreFuture<'a, ()>;
    fn list_sessions<'a>(&'a self, family_id: Uuid, limit: i64) -> StoreFuture<'a, Vec<AgentSession>>;
    fn memories<'a>(&'a self, family_id: Uuid, limit: i64) -> StoreFuture<'a, Vec<AgentMemory>>;
    fn add_memory<'a>(&'a self, family_id: Uuid, content: &'a str, source: &'a str) -> StoreFuture<'a, Uuid>;
    fn delete_session<'a>(&'a self, session_id: Uuid) -> StoreFuture<'a, bool>;
}
```

主循环是最容易写错的逻辑（循环终止、消息回灌顺序、脱敏时机），
而它依赖数据库。抽出 trait 后，生产用 `PgStore`、测试用 `MemStore`，
**全部主循环行为都能脱离 Postgres 单测**。

### 数据模型

```sql
-- 会话
CREATE TABLE IF NOT EXISTS agent_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL,
    title TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 消息（含工具调用与工具结果）
CREATE TABLE IF NOT EXISTS agent_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool')),
    content TEXT NOT NULL DEFAULT '',
    tool_calls JSONB,
    tool_call_id VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 长期记忆
CREATE TABLE IF NOT EXISTS agent_memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL,
    content TEXT NOT NULL,
    source VARCHAR(32) NOT NULL DEFAULT 'agent',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

> 这三张表**不参与 P2P 同步** —— 会话是设备本地的对话上下文，
> 不该在家庭设备之间漫游。

### 接口设计

```
POST   /api/v1/agent/chat              与管家对话
GET    /api/v1/agent/status            运行状态（provider / model / 脱敏策略，不含密钥）
GET    /api/v1/agent/sessions          会话列表
GET    /api/v1/agent/sessions/:id/messages   会话消息
DELETE /api/v1/agent/sessions/:id      删除会话
GET    /api/v1/agent/memories          长期记忆列表
POST   /api/v1/agent/memories          手动写入长期记忆
```

全部挂在 `auth_middleware` 之后 —— **Agent 能读到的家庭数据不比直接调 API 少，
鉴权级别必须一致**。

### 配置

```bash
# 总开关（默认关闭）
HAMR_AGENT_ENABLED=true

# 模型来源：local（默认）| cloud
HAMR_AGENT_PROVIDER=local
HAMR_AGENT_BASE_URL=http://127.0.0.1:11434/v1
HAMR_AGENT_MODEL=qwen2.5:7b

# 云端专用（切 cloud 时必填，缺则 Agent 降级为不可用）
HAMR_AGENT_API_KEY=sk-...

# 是否允许原始 PII 出网（云端默认脱敏）
HAMR_AGENT_ALLOW_PII=false

# 行为上限
HAMR_AGENT_MAX_STEPS=8
HAMR_AGENT_TIMEOUT_SECS=60
HAMR_AGENT_MAX_HISTORY=20

# 可选：JiaBu 地址（配置后才暴露 jiabu_score 工具）
HAMR_JIABU_URL=http://jiabu:3003
```

### 性能考虑

- **预期数据量**：3-5 人家庭，约 1000 条记录/年；会话与记忆为家庭量级
- **响应时间**：工具直查 PG < 50ms；整体延迟取决于模型（本地 7B 约 2-10s，云端约 1-3s）
- **连接池**：Agent 与业务 API 共享 `PgPool`（max_connections=10）
- **优化策略**：
  - 工具查询 LIMIT 200，避免一次拉爆上下文
  - 历史消息条数上限（默认 20）
  - 单次模型调用超时上限（默认 60s）
  - 步数上限（默认 8）

### 安全性考虑

| 面向 | 措施 |
|------|------|
| 认证 | 与业务路由共用 `auth_middleware`（open / shared-secret / did 三档） |
| 越权 | `family_id` 服务端注入，工具 schema 中不存在该参数 |
| 写入 | v1 工具只读，唯一可写的是 Agent 自身记忆表 |
| 出网 | provider 之前统一脱敏；本地路径天然不出网 |
| 凭据 | API Key 不进 Debug 输出、不进日志、不进错误响应体 |
| 提示词注入 | 家庭数据只作为**数据**回灌；模型不生成可执行代码；无外呼工具 |
| 资源耗尽 | `max_steps` + 调用超时 + 会话历史上限 |

## 📅 实施计划

### 实施阶段

**阶段 1：运行时内核**（✅ 2026-11-17 完成）

| 交付物 | 状态 |
|--------|------|
| `config.rs` 环境变量配置与校验 | ✅ |
| `provider.rs` LlmProvider trait + OpenAI 兼容实现 | ✅ |
| `privacy.rs` PII 脱敏器 | ✅ |
| `prompt.rs` 管家人格提示词 | ✅ |
| `tools.rs` 只读工具集 | ✅ |
| `store.rs` ConversationStore trait + 双实现 | ✅ |
| `runner.rs` 主循环 | ✅ |

**阶段 2：接入层**（✅ 2026-11-17 完成）

| 交付物 | 状态 |
|--------|------|
| `handlers/agent.rs` 七个端点 | ✅ |
| `migrations/20261117000004_agent_runtime.sql` | ✅ |
| `AppState` 注入 + 失败关闭接线 | ✅ |
| 单元测试（cargo test 全绿） | ✅ |

**阶段 3：端到端联调**（🟢 2026-12 进行中）

| 交付物 | 计划时间 |
|--------|---------|
| 接真实 Ollama 跑通端到端对话 | 2026-12-05 |
| 家庭问题评测集（20-30 题） | 2026-12-10 |
| 本地小模型工具调用准确率基线 | 2026-12-15 |

**阶段 4：产品化**（⏳ 2026-12 ~ 2027-01）

| 交付物 | 计划时间 |
|--------|---------|
| 前端对话面板 + 工具轨迹可视化 | 2026-12-20 |
| 主动提醒（定时巡检 + 推送） | 2027-01-10 |
| 评测回归接入 CI | 2027-01-31 |

## ⚠️ 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| 本地小模型不调工具 / 调错工具 | 高 | 提示词强化工具边界；评测集量化；必要时推荐更大模型或云端 |
| 脱敏损害推理质量 | 中 | 一致性别名保留区分度；提供 `ALLOW_PII` 逃生阀 |
| 脱敏不彻底 | 高 | 脱敏集中在 provider 之前唯一入口；正则全覆盖 + 单测 |
| 慢模型调用拖累 API | 中 | 超时 + 步数上限；对话端点与数据端点分离 |
| 提示词注入 | 中 | 工具只读 + family_id 注入 + 无代码执行 |

## 📊 验证结果

`cargo test` 覆盖的关键行为：

| 行为 | 测试 |
|------|------|
| 配置默认关闭、非法值拒绝、API Key 不进 Debug 输出 | `agent/config.rs` 9 项 |
| OpenAI 协议解析（文本 / 工具调用 / null content / 对象 arguments / 畸形输入） | `agent/provider.rs` 9 项 |
| 脱敏（一致性替换 / 长名优先 / 电话邮箱证件卡号 / 幂等 / 结构保持） | `agent/privacy.rs` 7 项 |
| 存储（会话复用 / 历史顺序与条数 / 家庭隔离 / 删除级联 / 消息往返） | `agent/store.rs` 7 项 |
| 主循环（空输入拒绝 / 直接出结论 / 调工具后出结论 / 工具失败不中断 / 步数上限 / 脱敏标记） | `agent/runner.rs` 10 项 |
| 工具（schema 合法 / 名称唯一 / 无 family_id 参数 / 未知工具报错） | `agent/tools.rs` 6 项 |
| 错误映射（422 / 503） | `handlers/agent.rs` 3 项 |

## 🔗 相关文档

- [项目主文档](../../projects/active/HamR管家Agent系统-20261117.md)
- [路线图](../../planning/roadmaps/HamR-Agent系统-roadmap-2026Q4.md)
- [HamR 管家应用（P2P 底座）](../../projects/active/HamR管家应用-20260305.md)
