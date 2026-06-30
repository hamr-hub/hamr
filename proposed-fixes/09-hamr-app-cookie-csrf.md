# P0-9: hamr-app 会话可劫持

**子项目**: `hamr-app`
**严重度**: P0 ship-blocker (Cluster 5)
**审计来源**: `.iter-skill/runs/2026-06-30/05-mobile-app.md` Top 2

## 两个独立缺陷

### A. `jsonReader.Read` 不返 EOF

`internal/client/api.go:98-105`：

```go
func (r *jsonReader) Read(p []byte) (int, error) {
    n, err := r.resp.Body.Read(p)
    if err == io.EOF {
        return n, nil  // ← 应该是 n, io.EOF
    }
    return n, err
}
```

后果：`io.ReadAll` 不知道流结束，永远阻塞 / OOM。

### B. 明文 cookie 无 CSRF

`internal/handlers/dashboard.go:16-18`：

```go
http.SetCookie(w, &http.Cookie{
    Name: "hamr_session", Value: token,
    // 缺 HttpOnly / Secure / SameSite
})
```

## 修复

### A. Read

```diff
 func (r *jsonReader) Read(p []byte) (int, error) {
     n, err := r.resp.Body.Read(p)
-    if err == io.EOF {
-        return n, nil
-    }
-    return n, err
+    if err != nil {
+        if err == io.EOF {
+            return n, io.EOF  // 让 ReadAll 知道结束
+        }
+        return n, err
+    }
+    return n, nil
 }
```

### B. Sealed cookie + CSRF

```go
import (
    "github.com/gorilla/securecookie"
    "github.com/justinas/nosurf"
)

var sc = securecookie.New(
    []byte(hamr.MustEnv("COOKIE_HASH_KEY")),     // 32 bytes
    []byte(hamr.MustEnv("COOKIE_BLOCK_KEY")),    // 32 bytes
)

func SetSessionCookie(w http.ResponseWriter, userID string) error {
    encoded, err := sc.Encode("hamr_session", map[string]string{
        "uid":      userID,
        "issued":   strconv.FormatInt(time.Now().Unix(), 10),
        "rotation": "0",
    })
    if err != nil {
        return err
    }
    http.SetCookie(w, &http.Cookie{
        Name:     "hamr_session",
        Value:    encoded,
        Path:     "/",
        HttpOnly: true,
        Secure:   true,
        SameSite: http.SameSiteLaxMode,
        MaxAge:   3600 * 24 * 7,
    })
    return nil
}

// CSRF middleware
func CSRFMiddleware(next http.Handler) http.Handler {
    csrf := nosurf.New(next)
    csrf.SetFailureHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        http.Error(w, "CSRF token mismatch", http.StatusForbidden)
    }))
    return csrf
}

// 在 main.go 注册时序：CSRF middleware 在 cookie set 之后
```

## 验证

```bash
# 1. cookie 必须 HttpOnly + Secure + SameSite=Lax
curl -i -X POST http://localhost:8080/login -d '{"username":"alice","password":"x"}'
# 期望 Set-Cookie: hamr_session=...; HttpOnly; Secure; SameSite=Lax

# 2. CSRF 保护
curl -i -X POST http://localhost:8080/api/profile \
  -H 'Cookie: hamr_session=xxx' \
  -d '{"name":"hack"}'
# 期望 403 (无 CSRF token)

# 3. 正确请求
curl -i -X POST http://localhost:8080/api/profile \
  -H 'Cookie: hamr_session=xxx' \
  -H 'X-CSRF-Token: <from GET /csrf-token>' \
  -d '{"name":"alice"}'
# 期望 200
```