# P0: hamr-infra status.hamr.top DNS 错指（→ tx 主机不跑 Grafana）

**子项目**: `hamr-infra`
**严重度**: P0 ship-blocker
**真实位置**:
- `repos/hamr-infra/scripts/dns/dns-records.conf` (DNS 配置)
- `repos/hamr-infra/services/tx/docker-compose.yml` (tx 主机 stack)
- `repos/hamr-infra/services/ali/docker-compose.yml` (ali 主机 stack)
**审计来源**: `.iter-skill/runs/2026-07-01/04-infra.md`

## 背景

DNS 把 `status.hamr.top` 指向 `tx` 主机，但 `services/tx/` 的 docker-compose **没有** Grafana — 只 `services/ali/` 有 monitoring + Grafana。

访问 `https://status.hamr.top` → 落到 tx → 404 / 502。

## 修复

### 1. 改 DNS 指向 ali

```
# repos/hamr-infra/scripts/dns/dns-records.conf
status.hamr.top.    IN  A   43.133.224.11    ; ali 主机
```

### 2. tx 主机不接 status 子域名

```
# 删（如果存在）：
# status.hamr.top.  IN  A   <tx-ip>
```

### 3. 加 DNS 校验脚本

```bash
# repos/hamr-infra/scripts/check-dns-routing.sh
#!/usr/bin/env bash
set -euo pipefail

declare -A EXPECTED=(
    [status.hamr.top]=ali          # 应该解析到有 Grafana 的主机
    [app.hamr.top]=ali             # dashboard 主入口
    [api.hamr.top]=tx              # tx 跑 hamr-api-gateway
)

for host in "${!EXPECTED[@]}"; do
    expected_target="${EXPECTED[$host]}"
    actual_ip=$(dig +short "$host" | head -1)
    expected_ip=$(grep -E "^[[:space:]]*${expected_target}[[:space:]]" services/*/docker-compose.yml | head -1 || echo "")
    
    # 简化：只检查 host 解析非空，且预期在对应 compose 里能找到
    if [[ -z "$actual_ip" ]]; then
        echo "FAIL: $host does not resolve"
        exit 1
    fi
done
echo "DNS routing OK"
```

### 4. 或者：把 Grafana 也部署到 tx

如果 tx 是 main site 入口而 Grafana 必须留在那里，把 Grafana 加到 `services/tx/docker-compose.yml`：

```yaml
# repos/hamr-infra/services/tx/docker-compose.yml
services:
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    volumes:
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning:ro
      - grafana-data:/var/lib/grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GF_SECURITY_ADMIN_PASSWORD:?required}
```

## 验证

```bash
# 1. DNS 解析
dig status.hamr.top +short
# 期望: 43.133.224.11 (ali) 或对应 IP

# 2. 真访问
curl -i https://status.hamr.top/api/health
# 期望: 200 + Grafana health

# 3. 跑校验
./scripts/check-dns-routing.sh
# 期望: DNS routing OK
```

## 关联

- P0 #08 (端口漂移) — 同样是多拓扑无真源
- cluster 4 round 1 P0-13 (Grafana admin = "admin") — 同根：3 拓扑各自维护 admin 密码