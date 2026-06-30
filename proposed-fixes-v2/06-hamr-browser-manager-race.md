# P0: hamr-browser BrowserManager._ensure_healthy 双启动 race

**子项目**: `hamr-browser` (Python FastAPI + Playwright)
**严重度**: P0 ship-blocker (concurrency)
**真实位置**: `repos/hamr-browser/app/browser/manager.py:_ensure_healthy`
**审计来源**: `.iter-skill/runs/2026-07-01/03-python-browser.md`

## 背景

健康检查触发重启时，`_ensure_healthy` 检查 → 关闭 → 重启浏览器。但**没有锁**，并发请求都会触发同一个序列 — 多个 caller 同时启动多个 browser instance → 端口冲突、profile 锁竞争、内存泄漏。

## 修复

```python
# repos/hamr-browser/app/browser/manager.py
import asyncio
from contextlib import asynccontextmanager

class BrowserManager:
    def __init__(self):
        self._browser = None
        self._lock = asyncio.Lock()
        self._launch_timeout = 30.0  # 新增
    
    async def _ensure_healthy(self):
        # 双重检查 + lock
        async with self._lock:
            if self._browser is None or not self._browser.is_connected():
                await self._restart_locked()
    
    async def _restart_locked(self):
        # 调用方必须持 _lock
        if self._browser:
            try:
                await asyncio.wait_for(self._browser.close(), timeout=5.0)
            except (asyncio.TimeoutError, Exception):
                pass  # CancelledError 等
        self._browser = await asyncio.wait_for(
            self._launch_browser(),
            timeout=self._launch_timeout,
        )
```

关键改动：
1. `_lock` 保护整个 restart 序列
2. 拆 `_ensure_healthy`（持锁） + `_restart_locked`（持锁调用）
3. `asyncio.wait_for` 加 launch timeout（防卡死）
4. close 用 `wait_for` 防 cancelledError 卡

## 验证

```python
import asyncio
import pytest

@pytest.mark.asyncio
async def test_concurrent_ensure_healthy_no_double_launch():
    mgr = BrowserManager()
    launch_count = 0
    original_launch = mgr._launch_browser
    async def counting_launch():
        nonlocal launch_count
        launch_count += 1
        return await original_launch()
    mgr._launch_browser = counting_launch
    
    # 20 个并发调用
    await asyncio.gather(*[mgr._ensure_healthy() for _ in range(20)])
    
    assert launch_count == 1, f"expected 1 launch, got {launch_count}"

@pytest.mark.asyncio
async def test_ensure_healthy_timeout():
    mgr = BrowserManager()
    mgr._launch_timeout = 0.1
    async def slow_launch():
        await asyncio.sleep(10)
        return None
    mgr._launch_browser = slow_launch
    
    with pytest.raises(asyncio.TimeoutError):
        await mgr._ensure_healthy()
```

## 关联

- P0 #7 (flow upload auth) — 加锁后整个 manager 更安全
- hamr-infra services/proxy + ali + tx 多部署 → 多实例并发风险更大