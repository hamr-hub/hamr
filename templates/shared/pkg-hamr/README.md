# pkg/hamr — HamR Go 共用工具包

> 来源：2026-06-30 全家族 deep-research 跨集群 P1 — 6 个 Go 服务（hamr-account/api/status/deploy/jiabu/mood-calender）都在重复造 env / shutdown / JSON error / Prometheus 轮子。

## 文件清单

| 文件 | 内容 | 替代子项目内代码 |
|------|------|-----------------|
| `env.go` | `MustEnv` / `EnvInt` / `EnvDuration` / `EnvBool` / `RedactURL` | `getEnv` in `cmd/*/main.go` (3 处) |
| `shutdown.go` | `GracefulShutdown` / `NewServer` | 自实现的 10s/30s 硬编码 |
| `errors.go` | `ErrorEnvelope` / `WriteError` + 5 个常用错误 | `gin.H{"error": ...}` 各自实现 |
| `metrics.go` | `Metrics` struct + middleware + `/metrics` handler | placeholder `promhttp()` (P0-12) |
| `go.mod` | module 声明 | — |

## 接入指南

### 1. 子项目 go.mod 加 replace

```go
// hamr-account/go.mod 末尾
require github.com/hamr-hub/hamr-go v0.0.0
replace github.com/hamr-hub/hamr-go => ../../templates/shared/pkg-hamr
```

### 2. main.go 改造（示例 hamr-api）

之前：
```go
func getEnv(k, def string) string { ... }   // 重复 6 处
func main() {
    port := getEnv("PORT", "8080")
    srv := &http.Server{Addr: ":" + port, Handler: r}
    // ... 没有 metrics middleware
    // ... 没有 graceful shutdown
}
```

之后：
```go
import "github.com/hamr-hub/hamr-go/pkg/hamr"

func main() {
    port := hamr.Env("PORT", "8080")
    m := hamr.NewMetrics("hamr-api", prometheus.DefaultRegisterer)
    r.Use(m.Middleware)                  // gin router
    r.GET("/metrics", gin.WrapH(m.Handler()))

    srv := hamr.NewServer(":"+port, r)
    go func() { _ = srv.ListenAndServe() }()
    hamr.GracefulShutdown(srv, 25*time.Second)
}
```

## 未来工作

- [ ] 把 `pkg/hamr` 迁出 `templates/shared/`，放到独立仓库 `hamr-hub/hamr-go`，发 v0.1.0
- [ ] 加 `notifier` 子包（Slack + email + retry/backoff，对应 X-7）
- [ ] 加 `auth` middleware（JWT 验证 + X-HamR-Household-Id header，对应 Cluster 4 cross-repo #5）
- [ ] 加 `migrate` cmd（sql migrations runner）
- [ ] 接 OpenTelemetry tracing

## 验收

- 子项目接入后 /metrics 必须出现 `http_requests_total{service="hamr-api"}` 系列（**P0-12 修复前提**）
- 子项目接入后 stdout 应只有结构化日志，无 env var 明文 leak（修 P0 #4 ARGOCD_TOKEN 风险）
- `go test ./...` 在所有子项目应通过

## 已知 limitations

- `metrics.go` 的 `routeTemplate` 期望 chi-style context key；接入 gin / echo 需要适配
- `errors.go` 没有 i18n（保持英文，避免子项目自己翻）
- 没有 retry/backoff（留 notifier 子包处理）