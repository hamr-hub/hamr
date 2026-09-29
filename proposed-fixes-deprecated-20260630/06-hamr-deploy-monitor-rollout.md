# P0-6: hamr-deploy monitorRollout 永远成功（生产误报）

**子项目**: `hamr-deploy`
**严重度**: P0 ship-blocker (Cluster 4)
**审计来源**: `.iter-skill/runs/2026-06-30/04-go-tools.md` Top 1

## 背景

```go
// hamr-deploy/internal/orchestrator/orchestrator.go:164-187
func monitorRollout(ctx context.Context, name string, deadline time.Duration) error {
    ticker := time.NewTicker(30 * time.Second)
    defer ticker.Stop()
    timeout := time.After(deadline)  // 10min 硬编码
    for {
        select {
        case <-timeout:
            return nil  // ← 即使超时也返回成功！
        case <-ticker.C:
            if err := argocdClient.Sync(ctx, name); err != nil {
                log.Printf("sync error: %v", err)  // ← 仅 log，continue
                continue
            }
            return nil  // ← Sync 成功就返回
        }
    }
}

// hamr-deploy/internal/argocd/client.go:78-82
func (c *Client) GetRolloutStatus(ctx context.Context, app string) (string, error) {
    return "Healthy", nil  // ← 假数据，永远 Healthy
}
```

## 修复方案

### 用真实 K8s Rollout CR 状态

```go
// hamr-deploy/internal/argocd/client.go
import (
    argoproj "github.com/argoproj/argo-rollouts/pkg/client/clientset/versioned"
    metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type RolloutClient struct {
    argo argoproj.Interface
    ns   string
}

func NewRolloutClient(kubeConfig *rest.Config, namespace string) (*RolloutClient, error) {
    argo, err := argoproj.NewForConfig(kubeConfig)
    if err != nil {
        return nil, err
    }
    return &RolloutClient{argo: argo, ns: namespace}, nil
}

// Status 映射
var rolloutPhaseMap = map[string]string{
    "Healthy":   "Healthy",
    "Degraded":  "Failed",
    "Progressing": "InProgress",
    "Paused":    "Paused",
    "Invalid":   "Failed",
}

func (c *RolloutClient) GetRolloutStatus(ctx context.Context, name string) (string, error) {
    r, err := c.argo.ArgoprojV1alpha1().Rollouts(c.ns).Get(ctx, name, metav1.GetOptions{})
    if err != nil {
        return "", fmt.Errorf("get rollout: %w", err)
    }
    status, ok := rolloutPhaseMap[string(r.Status.Phase)]
    if !ok {
        status = "Unknown"
    }
    return status, nil
}
```

### monitorRollout 改用真实状态

```go
// hamr-deploy/internal/orchestrator/orchestrator.go
func (o *Orchestrator) MonitorRollout(ctx context.Context, name string, deadline time.Duration) error {
    ctx, cancel := context.WithTimeout(ctx, deadline)
    defer cancel()

    ticker := time.NewTicker(15 * time.Second)
    defer ticker.Stop()

    for {
        select {
        case <-ctx.Done():
            return fmt.Errorf("rollout monitoring deadline exceeded: %w", ctx.Err())
        case <-ticker.C:
            status, err := o.rolloutClient.GetRolloutStatus(ctx, name)
            if err != nil {
                log.Printf("rollout status error (will retry): %v", err)
                continue  // 真正的网络/权限错误才重试
            }

            switch status {
            case "Healthy":
                return nil  // 真成功
            case "Failed", "Invalid":
                return fmt.Errorf("rollout %s failed: phase=%s", name, status)
            case "InProgress", "Paused":
                log.Printf("rollout %s: phase=%s, continuing...", name, status)
                continue
            default:
                log.Printf("rollout %s: unknown phase=%s", name, status)
                continue
            }
        }
    }
}
```

## 验证

```go
func TestMonitorRollout_Healthy(t *testing.T) {
    fake := &fakeRolloutClient{phase: "Healthy"}
    o := &Orchestrator{rolloutClient: fake}
    err := o.MonitorRollout(context.Background(), "test", 5*time.Second)
    require.NoError(t, err)
}

func TestMonitorRollout_Failed(t *testing.T) {
    fake := &fakeRolloutClient{phase: "Degraded"}
    o := &Orchestrator{rolloutClient: fake}
    err := o.MonitorRollout(context.Background(), "test", 5*time.Second)
    require.Error(t, err)
    require.Contains(t, err.Error(), "failed")
}

func TestMonitorRollout_Timeout(t *testing.T) {
    fake := &fakeRolloutClient{phase: "Progressing"}  // 永远 InProgress
    o := &Orchestrator{rolloutClient: fake}
    err := o.MonitorRollout(context.Background(), "test", 1*time.Second)
    require.Error(t, err)
    require.ErrorIs(t, err, context.DeadlineExceeded)
}
```

## 集成测试

需要一个真 Argo Rollouts 测试环境：

```bash
# kind + argo-rollouts controller
kind create cluster --name hamr-test
kubectl apply -n argo-rollouts -f https://github.com/argoproj/argo-rollouts/releases/latest/download/install.yaml

# 跑 e2e
cd hamr-deploy
go test -tags=e2e ./test/e2e/...
```

## 回退

紧急：如果真实 Argo client 接入阻塞，临时加 strict mode 开关：
```go
HAMR_DEPLOY_STRICT_ROLLOUT=true  # 真状态；=false → 旧 stub 行为
```
**仅作为临时回退**，P0 修复完后必须删。

## 关联

- P0-7: precheck 同样问题（prod 跳过 + 并发 cap 不触发）
- P0-12: 给 monitorRollout 加 metrics（deploy_started_total / deploy_status_changed{from,to}）