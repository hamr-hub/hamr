# P0-5: hamr-api CORS 配错（浏览器拒收所有跨域带 cookie 请求）

**子项目**: `hamr-api`
**严重度**: P0 ship-blocker (Cluster 3)
**审计来源**: `.iter-skill/runs/2026-06-30/03-go-core-services.md` Top 2

## 背景

`hamr-api/internal/middleware/cors.go:34`：

```go
w.Header().Set("Access-Control-Allow-Origin", "*")
w.Header().Set("Access-Control-Allow-Credentials", "true")  // ← 与 * 冲突
```

浏览器会拒收：spec 禁止 `Allow-Credentials: true` + 通配 origin。

## 修复

```go
// hamr-api/internal/middleware/cors.go
package middleware

import (
    "net/http"
    "os"
    "strings"
)

var allowedOrigins = strings.Split(os.Getenv("HAMR_ALLOWED_ORIGINS"), ",")
// 默认: ["https://hamr.top", "https://app.hamr.top", "https://docs.hamr.top"]

func CORS(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        origin := r.Header.Get("Origin")
        if origin != "" && isAllowedOrigin(origin) {
            w.Header().Set("Access-Control-Allow-Origin", origin)
            w.Header().Set("Vary", "Origin")
            w.Header().Set("Access-Control-Allow-Credentials", "true")
            w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
            w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-HamR-Household-Id, X-Request-ID")
            w.Header().Set("Access-Control-Max-Age", "600")
        }

        if r.Method == http.MethodOptions {
            w.WriteHeader(http.StatusNoContent)
            return
        }
        next.ServeHTTP(w, r)
    })
}

func isAllowedOrigin(origin string) bool {
    for _, allowed := range allowedOrigins {
        if strings.EqualFold(origin, strings.TrimSpace(allowed)) {
            return true
        }
    }
    return false
}
```

## 验证

```bash
# 1. 带 Origin + credentials 的 GET
curl -i -H 'Origin: https://app.hamr.top' \
  -H 'Cookie: hamr_session=xxx' \
  http://localhost:8080/api/v1/profile
# 期望响应头: Access-Control-Allow-Origin: https://app.hamr.top (echo back)

# 2. 未允许 origin
curl -i -H 'Origin: https://evil.com' \
  -H 'Cookie: hamr_session=xxx' \
  http://localhost:8080/api/v1/profile
# 期望响应头: 没有 ACAO 头 → 浏览器拦截

# 3. 预检 OPTIONS
curl -i -X OPTIONS -H 'Origin: https://app.hamr.top' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: Content-Type' \
  http://localhost:8080/api/v1/profile
# 期望: 204 + 完整 CORS 头
```

## 注意

- 配置：所有生产 origin 必须列在 `HAMR_ALLOWED_ORIGINS`
- 别用正则匹配 origin（防 subdomain 劫持）
- 不要在生产写 `*` 即使不带 credentials（也是 anti-pattern）