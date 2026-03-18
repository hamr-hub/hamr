# hamr-browser

## 📋 项目信息

| 项目信息 | 内容 |
|---------|------|
| **项目名称** | hamr-browser |
| **创建时间** | 2026-03-17 |
| **项目负责人** | HamR Team |
| **当前状态** | 🟢 进行中 |
| **优先级** | 高 |
| **预计完成时间** | 2026-05-31 |
| **标签** | #浏览器自动化 #Playwright #API服务 #Python |

## 🎯 项目概述

### 项目背景

很多业务系统没有开放 API，但有 Web 界面。通过 Playwright 浏览器自动化，可以模拟用户操作（登录、点击、等待、拦截网络请求），将这些操作流程包装成标准 HTTP API 接口对外暴露。

核心理念：**全局共享一个浏览器实例**，浏览器保持登录态（Cookie/Session 持久化），外部调用只需传入业务参数，无需关心登录过程，直接获取目标数据。

典型场景：某系统需要登录后才能查询数据 → 手动登录一次 → 将查询流程包装为接口 → 调用方传参直接获取返回值。

### 项目目标

- 目标1：实现基于 Playwright 的浏览器自动化引擎，支持全局单实例浏览器管理
- 目标2：支持通过 YAML/JSON 配置文件定义自动化流程（步骤、选择器、网络拦截）
- 目标3：将自动化流程包装为 RESTful API，支持传参调用并返回结构化数据
- 目标4：支持 Cookie/Session 持久化，登录一次后长期复用
- 目标5：提供流程管理界面，支持流程的创建、编辑、调试、启用/禁用

### 项目价值

- **用户价值**：无需重复登录，一次配置长期使用；非技术用户也能调用复杂流程
- **业务价值**：打通无 API 的第三方系统，实现数据互通；降低对接成本
- **技术价值**：可复用的自动化基础设施；积累自动化流程配置库

## 📐 项目范围

### 包含的功能

- [x] 浏览器引擎模块（全局单实例，`launch_persistent_context` 持久化 Profile）
- [x] Cookie/Session 持久化管理（Playwright 自动管理，重启服务后恢复）
- [x] 流程配置引擎（YAML 定义步骤：navigate/click/fill/select/wait/evaluate）
- [x] 网络请求拦截器（异步监听 Response，fnmatch URL 模式匹配）
- [x] RESTful API 服务（`POST /flows/{id}/run` 执行流程）
- [x] 流程参数化（Jinja2 模板渲染，`{{ param }}` 变量替换）
- [x] 流程管理 API（CRUD：注册/更新/删除/列出流程）
- [x] 健康检查与浏览器状态接口
- [x] 自动认证检查（检测未登录 → 自动执行登录步骤 → 继续流程）
- [x] Secrets 管理（secrets.yaml，不入 Git）
- [ ] Web 管理界面（流程调试、日志查看）
- [x] Docker 部署支持（Dockerfile + docker-compose.yml）

### 明确不包含

- 不包含：分布式多浏览器实例（MVP 阶段）
- 不包含：完整的任务队列系统（初版同步执行）
- 不包含：多用户权限管理（初版单用户）

## 🗓 关键里程碑

| 里程碑 | 交付物 | 计划时间 | 状态 |
|-------|--------|----------|------|
| 技术方案设计 | 架构文档、接口设计 | 2026-03-24 | ✅ |
| MVP：浏览器引擎 + 基础流程执行 | 可运行的核心引擎 | 2026-04-07 | ✅ |
| API 服务封装 | RESTful API 可调用 | 2026-04-21 | ✅ |
| 流程配置化 + 参数化 | YAML 配置驱动 | 2026-05-05 | ✅ |
| Web 管理界面 | 可视化管理流程 | 2026-05-19 | ⏳ |
| 上线部署 | Docker 生产部署 | 2026-05-31 | ⏳ |

图例：✅ 已完成 | 🟢 进行中 | ⏳ 未开始 | 🔴 有风险

## 👥 团队与职责

| 角色 | 姓名 | 职责 |
|-----|------|------|
| 项目负责人 | HamR Team | 整体协调、需求把控 |
| 技术负责人 | HamR Team | 架构设计、核心开发 |

## 🛠 技术方案

### 技术栈

- **后端运行时**：Python 3.11+
- **Web 框架**：FastAPI（异步，高性能）
- **浏览器自动化**：Playwright for Python（支持 Chromium/Firefox/WebKit）
- **配置格式**：YAML（流程定义）、JSON（API 请求/响应）
- **持久化存储**：SQLite（流程配置存储）+ 文件系统（浏览器 Profile）
- **部署**：Docker + Docker Compose
- **管理界面**：Vue 3 + Vite（轻量级）

### 架构设计

```
┌─────────────────────────────────────────────────────┐
│                    API 层 (FastAPI)                  │
│  POST /flows/{flow_id}/run   GET /flows   ...        │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│               流程执行引擎                            │
│  参数解析 → 步骤执行 → 网络拦截 → 结果提取            │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│          浏览器管理器 (单例)                           │
│  全局 Browser + BrowserContext (持久化 Profile)       │
│  Cookie 自动保存/恢复                                 │
└─────────────────────────────────────────────────────┘
```

**流程配置示例（YAML）**：
```yaml
id: query_order
name: 查询订单
description: 登录后查询指定订单信息
parameters:
  - name: order_id
    type: string
    required: true
steps:
  - type: navigate
    url: "https://example.com/orders?id={{ order_id }}"
  - type: wait_for_request
    url_pattern: "/api/orders/*"
    method: GET
    capture_as: order_response
result:
  source: order_response
  extract: "$.data"
```

### 技术依赖

- Playwright：浏览器自动化核心
- FastAPI + Uvicorn：API 服务
- SQLite / aiosqlite：流程配置持久化
- Pydantic：数据校验与序列化
- PyYAML / jsonpath-ng：配置解析与结果提取

## 📊 资源需求

### 人力资源

- 开发：约 8 人周
- 测试：约 2 人周

### 其他资源

- 服务器：1 台，≥2 核 4G（运行浏览器实例）
- 子域名：`browser.hamr.app`（规划中）

## ⚠️ 风险与依赖

### 主要风险

| 风险描述 | 影响程度 | 应对措施 | 负责人 |
|---------|---------|---------|-------|
| 目标网站反爬检测 | 中 | 使用 stealth 模式，模拟真实用户行为 | HamR Team |
| 浏览器内存占用高 | 中 | 定期重启浏览器上下文，限制并发 | HamR Team |
| Cookie 过期导致失效 | 高 | 检测登录态，自动触发重新登录流程 | HamR Team |
| 目标网站 DOM 变化 | 中 | 流程版本化，提供快速更新机制 | HamR Team |

### 外部依赖

- 依赖项1：hamr-api（API 网关，用于统一鉴权）
- 依赖项2：hamr-infra（部署基础设施）

## 📈 进度跟踪

### 当前进度

- 整体进度：80%
- 最后更新：2026-03-18

### 本周进展

- 完成：项目立项、技术方案设计（含 Demo 案例分析）、完整代码骨架开发
- 完成：核心模块实现（BrowserManager / FlowEngine / StepExecutor / AuthChecker / RequestInterceptor）
- 完成：sellersprite_sales 流程配置文件（Demo 场景）
- 完成：Docker 部署配置
- 完成：浏览器崩溃自动重启机制（context close 事件监听 + 健康检查重初始化）
- 完成：流程执行失败自动重试（最多1次，重启浏览器后重试）
- 完成：page 异常后必然关闭保障（finally try/except）
- 完成：`try_selectors` 步骤类型（多选择器容错轮询）
- 完成：`fill` 步骤支持 `selectors` 列表（多候选选择器）
- 完成：新增 `press_key` / `scroll_to` 步骤类型
- 完成：登录流程加入调试截图（login_page / login_before_submit / login_success）
- 完成：修复登录选择器 Bug（移除不支持的 `:visible` 伪类）
- 完成：本地环境联调（浏览器初始化、服务启动正常）
- 进行中：sellersprite_sales 全流程跑通验证

### 下周计划

- 完成 sellersprite_sales 全流程跑通验证
- Web 管理界面开发启动（Vue 3）

## 📝 关键决策记录

### [2026-03-17] 选择 Python + FastAPI 作为技术栈

- **背景**：需要选择后端语言和框架
- **决策内容**：使用 Python + FastAPI
- **决策原因**：Playwright 的 Python SDK 最为成熟；FastAPI 异步性能好，与 Playwright 异步 API 天然契合
- **影响范围**：整个后端实现

### [2026-03-17] 全局共享单浏览器实例

- **背景**：需要决定浏览器实例管理策略
- **决策内容**：全局维护一个 BrowserContext，共享 Cookie/Session
- **决策原因**：保持登录态，避免重复登录；降低资源消耗
- **影响范围**：并发处理需要串行化或使用独立 Page

## 🔗 相关文档

- [项目注册表](../registry/PROJ-014-hamr-browser.json)
- [技术方案设计](../../planning/proposals/hamr-browser-技术方案-20260317.md)
- [代码仓库](../../repos/hamr-browser/)

## 📌 备注

项目代码仓库：`repos/hamr-browser`（待创建）
