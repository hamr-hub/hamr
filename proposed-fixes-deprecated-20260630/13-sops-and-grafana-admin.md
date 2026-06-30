# P0-13: SOPS placeholder + Grafana admin 硬编码

**子项目**: `hamr-infra`
**严重度**: P0 ship-blocker (Cluster 6)
**审计来源**: `.iter-skill/runs/2026-06-30/06-dev-infra.md` Top 3, Top 4

## 背景

```yaml
# hamr-infra/.sops.yaml — placeholder recipients
creation_rules:
  - path_regex: secrets/.*\.yaml$
    key_groups:
      - age:
          - *key_1   # ← 引用 .sops.yaml 但 age keygen 从未跑
```

```yaml
# hamr-infra/grafana/values.yaml
adminPassword: "admin"   # ← 硬编码明文密码
```

## 修复

### A. 生成真 Age keys

```bash
# 1. 本地生成（团队每位成员一份）
age-keygen -o keys/age-<your-name>.key
# 输出:
# Public key: age1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# Private key: AGE-SECRET-KEY-1xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 2. 把公钥填入 .sops.yaml
cat > hamr-infra/.sops.yaml <<'EOF'
creation_rules:
  - path_regex: secrets/prod/.*
    key_groups:
      - age:
          - age1alice...   # alice 公钥
          - age1bob...     # bob 公钥
          - age1ci...      # CI 机器人公钥
  - path_regex: secrets/dev/.*
    key_groups:
      - age:
          - age1alice...
EOF
```

### B. 给 Grafana admin 走 SOPS

```bash
# 1. 生成强密码
PASSWORD=$(openssl rand -base64 32)
echo "Generated admin password: $PASSWORD"

# 2. 加密到 SOPS
cat > secrets/prod/grafana-admin.yaml <<EOF
grafanaAdminPassword: $(echo -n "$PASSWORD" | base64)
EOF
sops --encrypt --in-place secrets/prod/grafana-admin.yaml

# 3. helm chart 引用
# helm/grafana/values-prod.yaml
grafanaAdminPassword: ""  # 留空
# 加 initContainer 或 external-secrets 拉取
```

或者用 ExternalSecret（参考 P0-10 `_externalsecret.tpl`）：

```yaml
# hamr-infra/secrets/prod/grafana-admin-externalsecret.yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: grafana-admin
spec:
  secretStoreRef: { name: hamr-vault, kind: ClusterSecretStore }
  target:
    name: grafana-admin
    template:
      data:
        admin-password: "{{ .grafanaAdminPassword }}"
  data:
    - secretKey: admin-password
      remoteRef:
        key: secret/prod/grafana
        property: admin-password
```

### C. 加 sops pre-commit 钩子

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.6.0
    hooks:
      - id: detect-private-key
      - id: detect-aws-credentials
      - id: end-of-file-fixer

  - repo: https://github.com/getsops/sops-pre-commit
    rev: v0.1.2
    hooks:
      - id: sops-check  # 检查 .sops.yaml 存在 + 拒绝明文 secret 文件
```

## 验证

```bash
# 1. 列出所有 SOPS 加密文件
find . -name '*.yaml' -exec sh -c 'sops -d "$1" 2>/dev/null | grep -q "BEGIN" && echo "$1"' _ {} \;

# 2. 验证 .sops.yaml recipients 是真公钥（44 字符 age1xxxxx）
grep '^ *- age1' .sops.yaml | awk '{print $2}' | awk '{ if (length($1) != 62) print "INVALID:", $1 }'
# 期望：无 INVALID 输出

# 3. Grafana 部署
helm upgrade grafana grafana/grafana -f values-prod.yaml
kubectl get secret grafana-admin -o jsonpath='{.data.admin-password}' | base64 -d
# 期望：与最初 openssl rand 生成的密码一致
```

## 不要做的

- ❌ 别把私钥 commit
- ❌ 别把 `keys/` 加进 git（`.gitignore` 必须排除）
- ❌ 别在多环境共用 admin 密码