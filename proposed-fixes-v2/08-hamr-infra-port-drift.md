# P0: hamr-infra jiabu-api 端口漂移（:3003 vs :8082）

**子项目**: `hamr-infra` (bash + docker-compose)
**严重度**: P0 ship-blocker
**真实位置**:
- `repos/hamr-infra/services/ali/docker-compose.yml` (jiabu-api 端口)
- `repos/hamr-infra/services/proxy/nginx.conf:207`
**审计来源**: `.iter-skill/runs/2026-07-01/04-infra.md`

## 背景

`services/ali/` 把 `hamr-jiabu-api` 映射到 `:3003`。
`services/proxy/nginx.conf:207` 反代 `hamr-jiabu-api` 到 `:8082`。

两处不一致 → 任一拓扑要么 proxy 找不到后端，要么后端端口暴露错。

## 修复

### 1. 选单一真源

```bash
# repos/hamr-infra/services/CONTRACT.sh (新文件 — 端口真源)
declare -A SERVICE_PORT=(
    [hamr-account]=8081
    [hamr-api-gateway]=8090
    [hamr-jiabu-api]=8082      # ← 单一真源
    [hamr-status]=8083
    [hamr-mood-calender]=8084
    [hamr-browser]=8000
)
```

### 2. 所有 docker-compose 引 CONTRACT

```yaml
# repos/hamr-infra/services/ali/docker-compose.yml
services:
  hamr-jiabu-api:
    image: ghcr.io/hamr-hub/hamr-jiabu-backend:latest
    ports:
      - "${HAMR_JIABU_API_PORT:-8082}:8082"   # ← 默认 8082
```

### 3. nginx.conf 引同变量

```nginx
# repos/hamr-infra/services/proxy/nginx.conf
upstream hamr_jiabu_api {
    server ${HAMR_JIABU_API_UPSTREAM:-hamr-jiabu-api:8082};
}

location /jiabu/ {
    proxy_pass http://hamr_jiabu_api;
}
```

### 4. 加一致性测试

```bash
# repos/hamr-infra/scripts/check-port-consistency.sh
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# 提取所有 compose 中提到的 jiabu 端口
COMPOSE_PORTS=$(grep -rh 'hamr-jiabu-api' services/*/docker-compose.yml | grep -oE '[0-9]{4,5}:[0-9]{4,5}' | sort -u)

# 提取 nginx.conf 中提到的 jiabu 端口
NGINX_PORTS=$(grep -E 'hamr-jiabu|jiabu' services/proxy/nginx.conf | grep -oE ':[0-9]{4,5}' | sort -u)

if [[ "$COMPOSE_PORTS" != "$NGINX_PORTS" ]]; then
    echo "FAIL: jiabi port drift between compose and nginx"
    echo "compose: $COMPOSE_PORTS"
    echo "nginx:   $NGINX_PORTS"
    exit 1
fi
echo "OK"
```

挂到 CI：

```yaml
# .github/workflows/infra-check.yaml (新)
name: infra consistency
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: ./scripts/check-port-consistency.sh
```

## 验证

```bash
# 1. 跑一致性检查
./scripts/check-port-consistency.sh
# 旧代码: FAIL
# 新代码: OK

# 2. 真启动
cd services/ali && docker compose up -d hamr-jiabu-api
curl http://localhost:8082/healthz
# 期望: 200

# 3. 真代理
cd services/proxy && docker compose up -d nginx
curl -H 'Host: jiabu.hamr.top' http://localhost/jiabu/healthz
# 期望: 200
```

## 关联

- P0 #09 (DNS mis-point status.hamr.top → tx) — 同根问题：多拓扑无真源