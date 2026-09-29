# P0-12: Prometheus metrics 全家族没人 emit（告警全哑）

**子项目**: 全 14 个子项目
**严重度**: P0 ship-blocker (Cluster 6)
**审计来源**: `.iter-skill/runs/2026-06-30/06-dev-infra.md` Top 5

## 背景

`hamr-infra/grafana/` 里：
- 12 条 alert rule（如 `HighErrorRate`, `SlowP99Response`）
- 4 张 dashboard（如 `ServiceOverview`, `FamilyAppLatency`）
- **全部** PromQL 形如：
  ```promql
  sum(rate(http_requests_total{service=~"hamr-.+"}[5m])) by (service)
  histogram_quantile(0.99, sum by (le, service) (rate(http_request_duration_seconds_bucket{service=~"hamr-.+"}[5m])))
  ```

实际：6 个 Go 服务 + 5 个前端 + hamr-app **0 个** emit `http_requests_total`。

dashboard 是漂亮的截图，alert rule 是 yaml 文件，全空跑。

## 修复方案

### 用 templates/shared/pkg-hamr/ 已经写好的 Metrics 中间件

```go
// 子项目 main.go (例: hamr-api/cmd/api/main.go)
import (
    "github.com/gin-gonic/gin"
    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promhttp"

    hamr "github.com/hamr-hub/hamr-go/pkg/hamr"
)

func main() {
    r := gin.New()

    // 标准中间件
    r.Use(gin.Recovery())
    r.Use(requestIDMiddleware())
    r.Use(loggingMiddleware())

    // === 新增：metrics middleware ===
    m := hamr.NewMetrics("hamr-api", prometheus.DefaultRegisterer)
    r.Use(m.Middleware)  // gin adapter

    // 业务路由
    registerRoutes(r)

    // === 新增：/metrics endpoint ===
    r.GET("/metrics", gin.WrapH(m.Handler()))

    // 健康检查
    r.GET("/healthz", func(c *gin.Context) { c.JSON(200, gin.H{"ok": true}) })
    r.GET("/readyz", readyzHandler)  // 下游感知

    srv := hamr.NewServer(":"+hamr.Env("PORT", "8080"), r)
    go func() { _ = srv.ListenAndServe() }()
    hamr.GracefulShutdown(srv, 25*time.Second)
}
```

### gin adapter（每服务需要一行）

```go
// hamr-go/pkg/hamr/adapters/gin/middleware.go
func MetricsMiddleware(m *hamr.Metrics) gin.HandlerFunc {
    return func(c *gin.Context) {
        start := time.Now()
        c.Next()

        path := c.FullPath()  // 路由模板，如 "/users/:id"
        if path == "" {
            path = "unmatched"  // 防止 404 路径污染
        }
        status := strconv.Itoa(c.Writer.Status())

        m.HTTPRequestsTotal.WithLabelValues(
            m.Service, c.Request.Method, path, status,
        ).Inc()
        m.HTTPRequestDuration.WithLabelValues(
            m.Service, c.Request.Method, path,
        ).Observe(time.Since(start).Seconds())
    }
}
```

### 前端 nginx 加 /metrics 反向代理

```nginx
# 子项目 nginx.conf
location = /metrics {
    # 仅内网访问；生产应绑 internal LB
    allow 10.0.0.0/8;
    allow 172.16.0.0/12;
    allow 192.168.0.0/16;
    deny all;

    proxy_pass http://backend:8080/metrics;
}
```

或者用 nginx_exporter + prometheus 直接抓 nginx access_log（成本更高）。

### Astro/Vite SPA — 用 Browser RUM 替代 server metrics

Astro/Vite 是静态资源，无法 emit server metrics。改用 Browser RUM（Real User Monitoring）：

```ts
// hamr-website/src/lib/rum.ts
import { onLCP, onINP, onCLS, onFID } from 'web-vitals';

function sendMetric(name: string, value: number, rating: 'good'|'needs-improvement'|'poor') {
  navigator.sendBeacon('/api/rum', JSON.stringify({
    name, value, rating,
    url: location.href,
    ua: navigator.userAgent,
    ts: Date.now(),
  }));
}

onLCP(m => sendMetric('LCP', m.value, m.rating));
onINP(m => sendMetric('INP', m.value, m.rating));
onCLS(m => sendMetric('CLS', m.value, m.rating));
```

后端 `/api/rum` 把 RUM 数据汇总成 `web_vitals_total{metric, rating}` 暴露给 Prometheus。

### ServiceMonitor (Prometheus Operator)

```yaml
# hamr-infra/charts/lib-common/templates/_servicemonitor.tpl
{{- define "hamr.serviceMonitor" -}}
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: {{ .service }}
  labels:
    {{- include "hamr.commonLabels" . | nindent 4 }}
    release: kube-prometheus-stack
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: {{ .service }}
      app.kubernetes.io/instance: {{ .Release.Name }}
  endpoints:
    - port: http
      path: /metrics
      interval: 30s
{{- end }}
```

子项目 helm chart 引用：
```yaml
# hamr-api/charts/hamr-api/templates/servicemonitor.yaml
{{- include "hamr.serviceMonitor" (dict "service" "hamr-api" "Release" .Release) }}
```

## 验证

### 单元测试

```go
func TestMetricsMiddleware_RecordsRequest(t *testing.T) {
    reg := prometheus.NewRegistry()
    m := hamr.NewMetrics("test", reg)

    h := m.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(200)
    }))

    req := httptest.NewRequest("GET", "/foo", nil)
    h.ServeHTTP(httptest.NewRecorder(), req)

    // 抓 /metrics 验证
    body := dumpRegistry(t, reg)
    require.Contains(t, body, `http_requests_total{method="GET",path="/foo",service="test",status="200"} 1`)
}
```

### e2e

```bash
# 1. 起服务
cd hamr-api && go run cmd/api/main.go &
sleep 2

# 2. 触发请求
curl http://localhost:8080/healthz

# 3. 抓 metrics
curl http://localhost:8080/metrics | grep http_requests_total
# 期望：# HELP http_requests_total Total HTTP requests ...
#       http_requests_total{method="GET",path="/healthz",service="hamr-api",status="200"} 1
```

### Grafana dashboard 验证

```bash
# 启动 prom + grafana
docker run -d --name prom -p 9090:9090 -v $PWD/test/prometheus.yml:/etc/prometheus/prometheus.yml prom/prometheus

# 抓 hamr-api metrics
docker run -d --name hamr-api -l service=hamr-api your-registry/hamr-api:latest

# 访问 http://localhost:9090/alerts
# 期望：HighErrorRate 规则状态: active (有数据) 而不是 no data
```

## 一次性接入脚本

```bash
#!/bin/bash
# scripts/adopt-shared-pkg.sh
# 给所有 Go 子项目加 pkg-hamr + metrics middleware

set -e
SUBS=(hamr-account hamr-api hamr-status hamr-deploy hamr-jiabu hamr-mood-calender hamr-app)
for repo in "${SUBS[@]}"; do
    echo "=== $repo ==="
    cd "$repo"
    # 1. 加 go.mod replace
    if ! grep -q 'hamr-hub/hamr-go' go.mod; then
        echo 'require github.com/hamr-hub/hamr-go v0.0.0' >> go.mod
        echo 'replace github.com/hamr-hub/hamr-go => ../templates/shared/pkg-hamr' >> go.mod
        go mod tidy
    fi

    # 2. main.go 加 middleware（手工 patch）
    echo "TODO: manually patch cmd/*/main.go to add m := hamr.NewMetrics(...); r.Use(m.Middleware); r.GET('/metrics', ...)"
    cd ..
done
```

## 关联

- P0-6 (hamr-deploy monitorRollout) — 加 `deploy_started_total / deploy_status_changed`
- P0-11 (Taskfile.yaml ignore_error) — CI 应包含 metrics 存在性检查
- Cluster 6 #1 (helm lib-common) — 抽 _servicemonitor.tpl