# P0: hamr-browser /browser/cookies 端点未鉴权 → cookie exfil

**子项目**: `hamr-browser` (Python FastAPI + Playwright)
**严重度**: P0 ship-blocker
**真实位置**: `repos/hamr-browser/app/routes/browser.py`
**审计来源**: `.iter-skill/runs/2026-07-01/03-python-browser.md`

## 背景

`hamr-browser` 用 Playwright 跑自动化流程（如 `sellersprite_sales`），登录一次复用 cookie 持久化在 `browser_profile/`。

`/browser/cookies` 端点**未鉴权**（按 agent 报告）。任何能访问该服务的人可拉所有已登录的 session cookie（hamr.store / account.hamr.store / sellersprite 等）— 等于绕过所有依赖 cookie 的 SSO。

## 修复

### 1. 加全局 bearer token 依赖

```python
# repos/hamr-browser/app/auth.py (新文件)
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os

bearer = HTTPBearer(auto_error=False)

async def require_auth(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> str:
    expected = os.environ.get("HAMR_BROWSER_API_TOKEN")
    if not expected:
        raise RuntimeError("HAMR_BROWSER_API_TOKEN not set")
    if creds is None or creds.credentials != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="missing or invalid bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return creds.credentials
```

### 2. 给所有 router 加 Depends

```python
# repos/hamr-browser/app/routes/browser.py
from app.auth import require_auth

router = APIRouter(
    prefix="/browser",
    tags=["browser"],
    dependencies=[Depends(require_auth)],   # ← 应用到所有 endpoint
)

@router.get("/cookies")
async def get_cookies():
    ...
```

同理改 `routes/flows.py` + `routes/logs.py`。

### 3. main.py 加 CORSMiddleware（deny by default）

```python
# repos/hamr-browser/main.py
from fastapi.middleware.cors import CORSMiddleware

# 默认拒绝所有跨域；前端同源不需要 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[],                      # ← 空 list
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
```

如果需要跨域，加显式 allow-list：
```python
allow_origins=os.environ.get("HAMR_BROWSER_ALLOWED_ORIGINS", "").split(","),
```

## 验证

```bash
# 1. 无 token → 401
curl -i http://localhost:8000/browser/cookies
# 期望: 401 + WWW-Authenticate: Bearer

# 2. 错 token → 401
curl -i -H 'Authorization: Bearer wrong' http://localhost:8000/browser/cookies
# 期望: 401

# 3. 对 token → 200
TOKEN=$(grep HAMR_BROWSER_API_TOKEN .env | cut -d= -f2)
curl -i -H "Authorization: Bearer $TOKEN" http://localhost:8000/browser/cookies
# 期望: 200 + JSON

# 4. 跨域被拒
curl -i -H 'Origin: https://evil.com' http://localhost:8000/browser/cookies
# 期望: 无 ACAO 头
```

## pytest

```python
# tests/test_auth.py
import pytest
from fastapi.testclient import TestClient

@pytest.fixture
def token():
    os.environ["HAMR_BROWSER_API_TOKEN"] = "test-secret-123"
    return "test-secret-123"

def test_cookies_no_token(client):
    r = client.get("/browser/cookies")
    assert r.status_code == 401
    assert r.headers.get("WWW-Authenticate") == "Bearer"

def test_cookies_wrong_token(client):
    r = client.get("/browser/cookies", headers={"Authorization": "Bearer wrong"})
    assert r.status_code == 401

def test_cookies_correct_token(client, token):
    r = client.get("/browser/cookies", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
```

## 部署注意

`HAMR_BROWSER_API_TOKEN` 通过 docker-compose `secrets:` 注入，**不要** 在 env 文件里 commit。生产用 SOPS 加密（参见 hamr-infra 待补 SOPS）。

## 关联

- P0 #6 (BrowserManager double-launch) — 加 auth 后更安全
- P0 #7 (flow upload JS injection) — 同 auth 修复