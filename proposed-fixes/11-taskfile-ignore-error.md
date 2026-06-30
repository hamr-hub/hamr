# P0-11: Taskfile.yaml CI 永不失败

**子项目**: `hamr-developer`
**严重度**: P0 ship-blocker (Cluster 6)
**审计来源**: `.iter-skill/runs/2026-06-30/06-dev-infra.md` Top 2

## 背景

```yaml
# hamr-developer/Taskfile.yaml
tasks:
  lint:
    cmds:
      - cmd: golangci-lint run
        ignore_error: true   # ← lint 失败被吞
  doc:
    cmds:
      - cmd: redocly lint docs/openapi.yaml
        ignore_error: true   # ← doc 失败被吞
```

任何 lint / doc 错误不会阻断 CI。

## 修复

### 拆 `Taskfile.lib.yaml` + `Taskfile.local.yaml`

```yaml
# hamr-developer/Taskfile.lib.yaml (共享 lib)
version: '3'
includes:
  go: ./Taskfile-go.yaml
  doc: ./Taskfile-doc.yaml
  deploy: ./Taskfile-deploy.yaml
```

```yaml
# hamr-developer/Taskfile-go.yaml
version: '3'
tasks:
  lint:
    desc: Run golangci-lint
    cmds:
      - golangci-lint run --timeout=5m ./...
      # ignore_error 已删：失败 → exit non-zero → CI fail
  test:
    desc: Run go test with race + coverage
    cmds:
      - go test -race -coverprofile=coverage.out -covermode=atomic ./...
  vuln:
    desc: Run govulncheck
    cmds:
      - govulncheck ./...
```

```yaml
# hamr-developer/Taskfile.local.yaml (子项目覆盖)
version: '3'
includes:
  lib: ./Taskfile.lib.yaml
tasks:
  build:
    desc: Local build override
    cmds:
      - go build -o bin/{{.SERVICE}} ./cmd/{{.SERVICE}}
```

### CI 跑 lint 不带 ignore_error

```yaml
# .github/workflows/go.yaml (从模板复制)
- name: Lint
  run: task go:lint  # exit code 直接传，不吞
```

## 验证

```bash
# 1. 故意引入 lint 错误
echo "package main\nfunc X() {" > /tmp/lint-test/main.go  # 缺右括号
cd hamr-developer
task go:lint
echo "exit code: $?"
# 期望：exit 1（不是 0）

# 2. 修好后再跑
task go:lint
echo "exit code: $?"
# 期望：exit 0
```

## 不要做的

- ❌ 别用 `|| true` 绕过
- ❌ 别用 `ignore_error: true` 抑制
- ❌ 别在 CI 里 `set +e` 之后不恢复

正确做法是修代码让 lint 通过。