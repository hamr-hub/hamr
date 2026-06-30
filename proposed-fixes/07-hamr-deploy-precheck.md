# P0-7: hamr-deploy precheck 不生效（prod 可并发无上限）

**子项目**: `hamr-deploy`
**严重度**: P0 ship-blocker (Cluster 4)
**审计来源**: `.iter-skill/runs/2026-06-30/04-go-tools.md`

## 背景

`internal/precheck/precheck.go:34-40`：

```go
func (p *Prechecker) Check(ctx context.Context, req DeployRequest) error {
    if req.Env == "prod" {
        // TODO: 校验用户角色，需要 hamr-account introspection
        return nil  // ← 直接放行
    }
    if p.cfg.MaxConcurrentPerEnv > 0 {
        // TODO: 数据库查并发数
        return nil  // ← 直接放行
    }
    return nil
}
```

两个 TODO 都是直接 return nil。

## 修复

### 用户角色校验

```go
func (p *Prechecker) Check(ctx context.Context, req DeployRequest) error {
    if req.Env == "prod" {
        user, err := p.accountClient.GetUser(ctx, req.UserID)
        if err != nil {
            return fmt.Errorf("get user: %w", err)
        }
        if !slices.Contains(user.Roles, "deployer") && !slices.Contains(user.Roles, "admin") {
            return hamr.NewError(
                "auth.forbidden",
                "prod deploy requires 'deployer' or 'admin' role",
                http.StatusForbidden,
            )
        }
    }

    // 并发 cap
    if p.cfg.MaxConcurrentPerEnv > 0 {
        inFlight, err := p.store.CountInFlight(ctx, req.Env)
        if err != nil {
            return fmt.Errorf("count in-flight: %w", err)
        }
        if inFlight >= p.cfg.MaxConcurrentPerEnv {
            return hamr.NewError(
                "deploy.capacity",
                fmt.Sprintf("env %s has %d/%d in-flight deploys",
                    req.Env, inFlight, p.cfg.MaxConcurrentPerEnv),
                http.StatusTooManyRequests,
            )
        }
    }

    return nil
}
```

### Store 层（row lock 防 race）

```go
func (s *Store) CountInFlight(ctx context.Context, env string) (int, error) {
    var n int
    err := s.db.QueryRow(ctx, `
        SELECT COUNT(*) FROM deployments
        WHERE env = $1 AND status IN ('pending', 'in_progress')
        FOR UPDATE
    `, env).Scan(&n)
    return n, err
}
```

## 验证

```go
func TestPrecheck_ProdRequiresRole(t *testing.T) {
    p := setupPrechecker(t, &Config{MaxConcurrentPerEnv: 3})
    fakeAccount := &fakeAccountClient{user: User{Roles: []string{"viewer"}}}

    err := p.Check(context.Background(), DeployRequest{
        Env: "prod", UserID: "u1",
    })
    require.Error(t, err)
    require.Contains(t, err.Error(), "deployer")
}

func TestPrecheck_ConcurrentCap(t *testing.T) {
    p := setupPrechecker(t, &Config{MaxConcurrentPerEnv: 2})
    fakeStore := &fakeStore{count: 2}

    err := p.Check(context.Background(), DeployRequest{Env: "prod", UserID: "u1"})
    require.Error(t, err)
    require.Contains(t, err.Error(), "2/2 in-flight")
}
```