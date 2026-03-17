# hamr-browser 技术方案设计

## 📋 提案信息

| 信息 | 内容 |
|-----|------|
| **提案标题** | hamr-browser：浏览器自动化 API 服务技术方案 |
| **提案人** | HamR Team |
| **创建时间** | 2026-03-17 |
| **最后更新** | 2026-03-17 |
| **状态** | 已批准 |
| **优先级** | 🔴 高 |
| **影响范围** | hamr-browser 全项目 |

## 📌 摘要

**TL;DR**：基于 Playwright 构建浏览器自动化 API 服务。全局维护一个持久化浏览器上下文，登录一次后复用 Cookie；通过 YAML 配置文件定义操作流程（导航 → 网络拦截 → 参数提取），FastAPI 将每个流程暴露为 HTTP 接口，调用方传参即得结果。

---

## 🎯 背景与问题

### Demo 案例分析

以 **SellerSprite 销量估算** 为例，拆解完整调用链路：

```
[调用方] POST /flows/sellersprite_sales/run
         { "asin": "B0D81C6WGH", "market": "UK" }
            │
            ▼
[hamr-browser] 检查 sellersprite.com 登录状态
            │  未登录 → 执行登录流程 → 保存 Cookie
            │  已登录 → 跳过
            ▼
[浏览器] 新开 Tab 导航至
         https://www.sellersprite.com/v2/tools/sales-estimator?market=UK&asin=B0D81C6WGH
            │
            ▼
[网络拦截] 监听 https://www.sellersprite.com/v2/tools/sales-estimator/asin.json
            │  捕获到响应 → 提取 Response Body
            ▼
[调用方] 返回 asin.json 的完整响应体
```

### 关键洞察：流程的三个阶段

| 阶段 | 描述 | 是否必须 |
|-----|------|---------|
| **认证阶段** | 一次性登录，Cookie 持久化 | 按需（检测到未登录时触发） |
| **执行阶段** | 导航页面、触发业务操作 | 必须 |
| **捕获阶段** | 拦截目标网络请求，提取返回值 | 必须 |

### 泛化模型

从 Demo 中抽象出**通用流程模型**：

```
Flow = {
  id,           # 流程唯一标识
  auth?,        # 可选：认证流程（如何判断是否已登录、如何登录）
  steps[],      # 执行步骤序列
  capture,      # 捕获目标：拦截哪个请求、如何提取数据
  params[]      # 调用时传入的参数
}
```

**步骤类型（Step Types）**：

| 类型 | 描述 | 示例 |
|-----|------|------|
| `navigate` | 导航到 URL（支持参数替换） | `https://example.com?asin={{ asin }}` |
| `wait_for_selector` | 等待 DOM 元素出现 | `#result-table` |
| `click` | 点击元素 | `.submit-btn` |
| `fill` | 填写表单 | `input[name=keyword]` ← `{{ keyword }}` |
| `wait_for_request` | 等待并捕获网络请求 | URL pattern + 响应体提取 |
| `wait_for_response` | 等待特定响应 | 同上，别名 |
| `select` | 下拉框选择 | `select#market` ← `{{ market }}` |
| `wait` | 等待固定时间 | `1000` ms |
| `close_tab` | 关闭当前 Tab | - |
| `evaluate` | 执行 JS 并获取结果 | `document.title` |

---

## 🛠 详细设计

### 1. 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                      调用方（外部系统）                        │
│   POST /flows/{id}/run  {"asin":"B0D8..","market":"UK"}      │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP
┌──────────────────────────▼──────────────────────────────────┐
│                    FastAPI 服务层                             │
│                                                             │
│  /flows              /flows/{id}/run    /browser/status     │
│  GET(列出)           POST(执行)          GET(浏览器状态)      │
│  POST(注册)          GET(流程详情)       POST /browser/login │
│  DELETE(删除)                                                │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    流程执行引擎 (FlowEngine)                   │
│                                                             │
│  1. 参数验证 & 模板渲染（Jinja2）                             │
│  2. 认证检查（调用 Auth Checker）                             │
│  3. 逐步执行 Steps（StepExecutor）                           │
│  4. 捕获目标请求（RequestInterceptor）                        │
│  5. 提取结果（JSONPath / 全量返回）                           │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                  浏览器管理器 (BrowserManager)                 │
│                                                             │
│  ┌─────────────────────────────────────────────────┐        │
│  │  Chromium 实例 (headless/headed 可配)            │        │
│  │                                                 │        │
│  │  BrowserContext（持久化 user_data_dir）           │        │
│  │  ├── Cookie 自动保存/恢复                         │        │
│  │  ├── Page Pool（Tab 复用池）                      │        │
│  │  └── 请求拦截注册表                               │        │
│  └─────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    持久化层                                   │
│  flows/                 browser_profile/      logs/          │
│  ├── sellersprite.yaml  ├── Default/          ├── run.log    │
│  ├── amazon_bsr.yaml    │   ├── Cookies        └── error.log │
│  └── ...                │   └── ...                          │
└─────────────────────────────────────────────────────────────┘
```

### 2. 流程配置 YAML 规范

#### 2.1 完整结构

```yaml
# flows/sellersprite_sales.yaml
id: sellersprite_sales
name: SellerSprite 销量估算
description: 查询指定 ASIN 在指定站点的月销量估算数据

# 参数定义
parameters:
  - name: asin
    type: string
    required: true
    description: 亚马逊 ASIN 编码
    example: B0D81C6WGH
  - name: market
    type: string
    required: true
    description: 站点代码
    enum: [US, UK, DE, JP, FR, CA, IT, ES]
    example: UK

# 认证配置（可选，不配置则跳过认证检查）
auth:
  check:
    # 判断是否已登录的方式
    type: navigate_and_check
    url: "https://www.sellersprite.com/cn/w/user/login"
    logged_in_indicator:
      type: url_not_contains  # 跳转后 URL 不含 /login 说明已登录
      value: "/login"
  login:
    # 登录流程步骤
    steps:
      - type: navigate
        url: "https://www.sellersprite.com/cn/w/user/login"
      - type: wait_for_selector
        selector: "input[name='account']"
      - type: fill
        selector: "input[name='account']"
        value: "{{ _auth.username }}"      # 从 secrets 读取
      - type: fill
        selector: "input[name='password']"
        value: "{{ _auth.password }}"
      - type: click
        selector: "button[type='submit']"
      - type: wait_for_url
        url_pattern: "**/dashboard**"       # 等待跳转到仪表盘
        timeout: 15000
  secrets_key: sellersprite                 # 对应 secrets.yaml 中的 key

# 执行步骤
steps:
  - type: new_tab                           # 新开 Tab 执行，完成后关闭
  - type: navigate
    url: "https://www.sellersprite.com/v2/tools/sales-estimator?market={{ market }}&asin={{ asin }}"
    wait_until: domcontentloaded

# 捕获配置
capture:
  type: wait_for_response                   # 等待特定响应
  url_pattern: "**/tools/sales-estimator/asin.json**"
  method: GET                               # 可选，不指定则匹配所有方法
  timeout: 30000                            # 超时 30s
  extract:                                  # 可选，不填则返回完整响应体
    type: jsonpath
    path: "$"                               # "$" = 全量，"$.data" = 取 data 字段
  on_timeout: error                         # error | return_null
```

#### 2.2 不需要登录的简单流程

```yaml
id: public_query
name: 公开接口查询（无需登录）
parameters:
  - name: keyword
    type: string
    required: true

steps:
  - type: new_tab
  - type: navigate
    url: "https://example.com/search?q={{ keyword }}"

capture:
  type: wait_for_response
  url_pattern: "**/api/search**"
  timeout: 10000
```

#### 2.3 需要交互触发的流程

```yaml
id: amazon_bsr
name: Amazon BSR 查询
parameters:
  - name: asin
    type: string
    required: true
  - name: market
    type: string
    required: true

auth:
  check:
    type: cookie_exists
    domain: ".amazon.com"
    cookie_name: "session-id"

steps:
  - type: new_tab
  - type: navigate
    url: "https://www.amazon.{{ market_domain }}/dp/{{ asin }}"
  - type: wait_for_selector
    selector: "#detailBullets_feature_div"
    timeout: 10000

capture:
  type: page_evaluate           # 从 DOM 提取数据
  script: |
    const bsr = document.querySelector('#detailBullets_feature_div')?.innerText;
    return { bsr_text: bsr };
```

### 3. API 接口设计

#### 3.1 执行流程

```
POST /flows/{flow_id}/run
Content-Type: application/json

{
  "asin": "B0D81C6WGH",
  "market": "UK"
}
```

**响应**：
```json
{
  "flow_id": "sellersprite_sales",
  "status": "success",
  "duration_ms": 3420,
  "data": {
    "asin": "B0D81C6WGH",
    "market": "UK",
    "monthly_sales": 1850,
    "monthly_revenue": 46250,
    ...
  }
}
```

**错误响应**：
```json
{
  "flow_id": "sellersprite_sales",
  "status": "error",
  "error_code": "CAPTURE_TIMEOUT",
  "error_message": "等待响应超时（30s）：**/tools/sales-estimator/asin.json**",
  "duration_ms": 30210
}
```

#### 3.2 流程管理

```
GET  /flows                    # 列出所有已注册流程
GET  /flows/{id}               # 获取流程详情（含 YAML 内容）
POST /flows                    # 注册新流程（上传 YAML）
PUT  /flows/{id}               # 更新流程配置
DELETE /flows/{id}             # 删除流程

GET  /browser/status           # 浏览器状态（运行中/已停止/登录状态）
POST /browser/restart          # 重启浏览器
POST /browser/{site}/login     # 手动触发某站点登录（弹出有头浏览器）
GET  /browser/{site}/cookies   # 查看某站点 Cookie 状态

GET  /health                   # 健康检查
GET  /logs?flow_id=xxx&limit=20  # 执行日志查询
```

### 4. 核心模块实现

#### 4.1 BrowserManager（单例）

```python
# 关键设计要点

class BrowserManager:
    _instance = None
    
    # 使用 persistent context，user_data_dir 持久化所有 Cookie/Storage
    async def get_context(self) -> BrowserContext:
        if not self._context:
            self._browser = await playwright.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage"]
            )
            self._context = await self._browser.new_context(
                user_data_dir="./browser_profile",   # 持久化目录
                viewport={"width": 1920, "height": 1080},
                user_agent="Mozilla/5.0 ..."
            )
        return self._context
    
    # 每次流程执行获取一个独立 Page，执行完关闭
    async def new_page(self) -> Page:
        context = await self.get_context()
        return await context.new_page()
```

**注意**：Playwright 的 `launch_persistent_context` 直接支持持久化，更推荐使用该 API。

#### 4.2 RequestInterceptor（网络捕获核心）

```python
async def capture_response(page: Page, url_pattern: str, timeout: int) -> dict:
    future = asyncio.Future()
    
    async def on_response(response: Response):
        if fnmatch(response.url, url_pattern):
            try:
                body = await response.json()
                if not future.done():
                    future.set_result(body)
            except Exception as e:
                future.set_exception(e)
    
    page.on("response", on_response)
    
    try:
        return await asyncio.wait_for(future, timeout=timeout/1000)
    except asyncio.TimeoutError:
        raise CaptureTimeoutError(f"超时：{url_pattern}")
    finally:
        page.remove_listener("response", on_response)
```

#### 4.3 模板渲染（参数替换）

使用 Jinja2 渲染 URL 和选择器中的 `{{ param }}`：

```python
from jinja2 import Template

def render(template_str: str, params: dict) -> str:
    return Template(template_str).render(**params)

# 示例
url = render(
    "https://www.sellersprite.com/v2/tools/sales-estimator?market={{ market }}&asin={{ asin }}",
    {"market": "UK", "asin": "B0D81C6WGH"}
)
# → https://www.sellersprite.com/v2/tools/sales-estimator?market=UK&asin=B0D81C6WGH
```

#### 4.4 Secrets 管理

```yaml
# secrets.yaml（不提交 Git，.gitignore 排除）
sellersprite:
  username: "SGSH5552"
  password: "856mg77"

amazon_us:
  username: "xxx@email.com"
  password: "xxx"
```

### 5. 项目目录结构

```
repos/hamr-browser/
├── main.py                      # FastAPI 入口
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── .gitignore
│
├── app/
│   ├── __init__.py
│   ├── config.py                # 应用配置
│   ├── browser/
│   │   ├── __init__.py
│   │   ├── manager.py           # BrowserManager 单例
│   │   └── interceptor.py       # 网络请求拦截器
│   ├── engine/
│   │   ├── __init__.py
│   │   ├── flow_engine.py       # 流程执行引擎
│   │   ├── step_executor.py     # 步骤执行器
│   │   └── auth_checker.py      # 认证检查器
│   ├── models/
│   │   ├── __init__.py
│   │   ├── flow.py              # Flow / Step Pydantic 模型
│   │   └── result.py            # 执行结果模型
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── flows.py             # /flows 路由
│   │   └── browser.py           # /browser 路由
│   ├── storage/
│   │   ├── __init__.py
│   │   └── flow_store.py        # 流程配置 CRUD（基于文件系统）
│   └── utils/
│       ├── __init__.py
│       ├── template.py          # Jinja2 模板渲染
│       ├── secrets.py           # Secrets 读取
│       └── logger.py            # 日志工具
│
├── flows/                       # 流程配置文件目录
│   ├── sellersprite_sales.yaml  # SellerSprite 销量估算（Demo）
│   └── ...
│
├── browser_profile/             # 浏览器持久化目录（.gitignore）
│   └── Default/
│       └── ...
│
├── secrets.yaml                 # 账号密码（.gitignore，不提交）
├── secrets.example.yaml         # 示例（提交）
└── logs/
    ├── run.log
    └── error.log
```

### 6. 并发与锁机制

由于全局共享单 BrowserContext，需要处理并发：

```
策略：请求级别 asyncio.Lock

同一时刻只允许一个流程在执行（Page 操作是有状态的）。
后续可升级为：
  - 多 Tab 并行（同一 Context 下多 Page）
  - 请求队列（asyncio.Queue）+ 限流
```

初版（MVP）：单并发，串行执行，超时 60s 则报错。

### 7. 登录状态保活

```
检测策略：
  1. 每次执行流程前，运行 auth.check 步骤
  2. 如果检测到未登录（URL 包含 /login、或特定元素出现）
  3. 自动执行 auth.login 步骤
  4. 登录成功后继续执行原流程

Cookie 持久化：
  - 使用 launch_persistent_context(user_data_dir=...)
  - Playwright 自动管理所有 Cookie/LocalStorage/SessionStorage
  - 重启服务后 Cookie 自动恢复
```

---

## 📅 实施计划

### 阶段1：核心引擎 MVP（2周）

- [ ] 项目骨架搭建（FastAPI + Playwright 集成）
- [ ] BrowserManager 单例（持久化 Context）
- [ ] 基础步骤执行器（navigate / wait_for_response）
- [ ] 网络请求拦截器
- [ ] YAML 流程解析器
- [ ] 实现 sellersprite_sales 流程跑通

### 阶段2：完整 API 服务（1周）

- [ ] 完整 RESTful API（流程 CRUD + 执行）
- [ ] 参数验证（Pydantic）
- [ ] 错误处理与日志
- [ ] 认证检查 + 自动登录
- [ ] Secrets 管理

### 阶段3：健壮化（1周）

- [ ] 所有步骤类型支持（click / fill / select / evaluate 等）
- [ ] 并发锁 + 超时处理
- [ ] 浏览器崩溃自动重启
- [ ] 执行历史记录

### 阶段4：部署与管理界面（2周）

- [ ] Docker 镜像（含 Playwright 浏览器依赖）
- [ ] docker-compose.yml
- [ ] 轻量级 Web 管理界面（Vue 3）
- [ ] 流程可视化调试（截图支持）

---

## ⚠️ 风险与应对

| 风险 | 概率 | 影响 | 应对 |
|-----|------|------|------|
| 目标网站检测自动化（Cloudflare/reCAPTCHA） | 中 | 高 | 使用 playwright-stealth；必要时 headed 模式手动过验证 |
| Cookie 在会话中过期（非浏览器关闭导致） | 中 | 高 | 每次执行前主动 check，失败自动重新登录 |
| Docker 中 headless 浏览器资源占用 | 高 | 中 | 限制内存（--shm-size=2g）；定期重启 Context |
| 目标网站 URL/选择器变更 | 低 | 中 | YAML 配置可热更新；版本化管理 |
| 并发请求时 Cookie 污染 | 低 | 高 | MVP 单并发；后续用独立 Context 隔离 |

---

## 🔗 参考资料

- [Playwright Python 文档](https://playwright.dev/python/)
- [FastAPI 异步文档](https://fastapi.tiangolo.com/)
- [Playwright 持久化 Context](https://playwright.dev/python/docs/api/class-browsertype#browser-type-launch-persistent-context)
- [项目文档](../../projects/active/hamr-browser-20260317.md)
