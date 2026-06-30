# P0-8: hamr-jiabu 隐私默认反了（PII 风险）

**子项目**: `hamr-jiabu`
**严重度**: P0 ship-blocker (Cluster 4)
**审计来源**: `.iter-skill/runs/2026-06-30/04-go-tools.md` Top 3
**法务风险**: GDPR / PIPL — 家庭产品尤其敏感

## 背景

`PRIVACY.md` 写：

> 默认情况下，事件 `content` 字段**不会被持久化**，仅在内存中临时存在用于处理；用户可通过 `?store=1` 参数显式开启存储。

**实际代码**（`internal/handlers/events.go:24,65-67`）：

```go
func (h *Handler) PostEvent(c *gin.Context) {
    var e Event
    if err := c.ShouldBindJSON(&e); err != nil { ... }

    // 隐私逻辑
    shouldStore := c.GetBool("privacy-store-content")  // ← gin context key 从未 set
    if shouldStore {
        h.store.Save(c.Request.Context(), e)
    } else {
        // 期望：丢弃 content
        // 实际：h.memCache 仍然保留完整 e
    }

    h.memCache.Add(c.Request.Context(), e)  // ← 默认就驻留内存
    // ...
}
```

PRIVACY.md 声称"默认丢弃"，代码实际"默认驻留"。`GetBool` 返回 false（key 未设），但 `memCache.Add` 不论 privacy 标志都执行。

## 修复方案

### 改 privacy 默认 → 默认丢弃

```diff
 // internal/handlers/events.go:24
 func (h *Handler) PostEvent(c *gin.Context) {
     var e Event
     if err := c.ShouldBindJSON(&e); err != nil {
         c.JSON(400, gin.H{"error": err.Error()})
         return
     }

-    shouldStore := c.GetBool("privacy-store-content")
-    if shouldStore {
+    // 隐私默认：不存储；只有显式 opt-in 才存
+    //   query: ?store=1 (透明，用户可见)
+    //   header: X-HamR-Store-Content: true (API 集成)
+    //   用户设置: settings.privacy_store_content = true
+    shouldStore := c.Query("store") == "1" ||
+                   c.GetHeader("X-HamR-Store-Content") == "true" ||
+                   h.userPrefStore.Get(c, e.UserID).StoreContent

-        h.store.Save(c.Request.Context(), e)
+    if shouldStore {
+        // 用户显式 opt-in：完整存储
+        if err := h.store.Save(c.Request.Context(), e); err != nil {
+            log.Printf("event store error: %v", err)
+            // 不阻断响应 — 内存里仍可处理
+        }
+        h.memCache.Add(c.Request.Context(), e)
+    } else {
+        // 默认隐私模式：内存只存去敏感化的事件
+        sanitized := e.Sanitize()  // 剥离 content, 保留 type/level/timestamp
+        h.memCache.Add(c.Request.Context(), sanitized)
     }
-
-    h.memCache.Add(c.Request.Context(), e)  // ← 默认就驻留内存
 }
```

### 加 Sanitize 方法

```go
// internal/models/event.go
func (e Event) Sanitize() Event {
    return Event{
        ID:        e.ID,
        UserID:    e.UserID,
        Type:      e.Type,
        Level:     e.Level,
        Timestamp: e.Timestamp,
        Metadata:  e.Metadata,
        // Content: 留空
        // Internal: 留空（不要泄露中间状态）
    }
}
```

### memCache 加 TTL（即使驻留也别 forever）

```go
// internal/cache/memcache.go
const DefaultEventTTL = 30 * time.Minute

func (m *MemCache) Add(ctx context.Context, e Event) {
    m.mu.Lock()
    defer m.mu.Unlock()
    m.data[e.ID] = cacheEntry{
        event:     e,
        expiresAt: time.Now().Add(DefaultEventTTL),
    }
}

func (m *MemCache) Get(ctx context.Context, id string) (Event, bool) {
    m.mu.Lock()
    defer m.mu.Unlock()
    e, ok := m.data[id]
    if !ok {
        return Event{}, false
    }
    if time.Now().After(e.expiresAt) {
        delete(m.data, id)
        return Event{}, false
    }
    return e.event, true
}

// 加 GC ticker
func (m *MemCache) RunGC(ctx context.Context) {
    ticker := time.NewTicker(5 * time.Minute)
    defer ticker.Stop()
    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            m.gc()
        }
    }
}
```

### 更新 PRIVACY.md

```diff
-## 事件 content 字段存储
-
-默认情况下，事件 `content` 字段不会被持久化，仅在内存中临时存在用于处理；
-用户可通过 `?store=1` 参数显式开启存储。
+## 事件 content 字段存储
+
+**默认（v0.2 起）**：事件 `content` 字段**既不持久化也不在内存保留超过 30 分钟**。
+事件其他字段（type / level / timestamp / metadata）正常处理。
+
+**显式 opt-in**（用户主动选择保留 content 用于历史回顾）：
+- 设置：`设置 > 隐私 > 保留事件内容` 开关
+- 单次：`POST /events?store=1`
+- API：`POST /events` 带 header `X-HamR-Store-Content: true`
+
+**用户关闭后**：已驻留的内容会在下次 GC（5 分钟）时被清空。
+
+**审计**：所有 `?store=1` 调用记录到 audit log，保留 90 天，用户可在 `设置 > 隐私 > 审计` 查看。
```

## 验证

### 单元测试

```go
func TestPostEvent_DefaultStripsContent(t *testing.T) {
    h := setupTestHandler(t)
    e := Event{Type: "user_msg", Content: "hello", UserID: "u1"}
    body, _ := json.Marshal(e)
    req := httptest.NewRequest("POST", "/events", bytes.NewReader(body))
    rec := httptest.NewRecorder()
    h.PostEvent(rec, req)

    require.Equal(t, 200, rec.Code)

    stored, ok := h.memCache.Get(context.Background(), e.ID)
    require.True(t, ok)
    assert.Empty(t, stored.Content, "default should strip content")
}

func TestPostEvent_OptInStoresContent(t *testing.T) {
    h := setupTestHandler(t)
    e := Event{Type: "user_msg", Content: "hello", UserID: "u1"}
    body, _ := json.Marshal(e)
    req := httptest.NewRequest("POST", "/events?store=1", bytes.NewReader(body))
    req.Header.Set("X-HamR-Store-Content", "true")
    rec := httptest.NewRecorder()
    h.PostEvent(rec, req)

    stored, _ := h.store.Get(context.Background(), e.ID)
    assert.Equal(t, "hello", stored.Content, "opt-in should persist content")
}

func TestMemCache_TTLEvicts(t *testing.T) {
    m := cache.NewMemCache()
    m.Add(context.Background(), Event{ID: "x", Content: "secret"})

    // 立即取：有
    e, ok := m.Get(context.Background(), "x")
    require.True(t, ok)
    assert.Equal(t, "secret", e.Content)

    // 等过期（测试用 100ms TTL）
    m.SetTTLForTest(100 * time.Millisecond)
    time.Sleep(150 * time.Millisecond)
    _, ok = m.Get(context.Background(), "x")
    assert.False(t, ok, "should evict after TTL")
}
```

## 回退

紧急：如果事件处理在某些场景依赖 content（历史分析等），临时：
```go
HAMR_JIABU_PRIVACY_DEFAULT=store  // 旧行为
HAMR_JIABU_PRIVACY_DEFAULT=discard  // 新行为（默认）
```
**默认应是 discard**。

## 关联

- Cluster 3 P0-5 (CORS) — 配合 cookie 策略，避免 opt-in 状态被跨站改写
- Cluster 6 P0-13 (SOPS) — store 加密密钥走 SOPS 管理