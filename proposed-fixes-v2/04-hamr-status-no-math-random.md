# P0: hamr-status Math.random() 生成 uptime bar（公信力危机）

**子项目**: `hamr-status` (Vite + React SPA)
**严重度**: P0 ship-blocker (公信力)
**真实位置**: `repos/hamr-status/src/App.tsx:80-95`
**审计来源**: `.iter-skill/runs/2026-07-01/02-typescript-services.md`

## 背景

```tsx
// repos/hamr-status/src/App.tsx:80-95
function UptimeBar({ uptime }: { uptime: number }) {
  const bars = 90
  return (
    <div className="flex gap-0.5 items-end">
      {Array.from({ length: bars }).map((_, i) => {
        const isDown = Math.random() < (1 - uptime / 100) * 0.3
        return (
          <div
            key={i}
            className={`w-1 rounded-sm ${isDown ? 'bg-red-400' : 'bg-green-400'}`}
            style={{ height: isDown ? '8px' : '16px' }}
            title={isDown ? '故障' : '正常'}
          />
        )
      })}
    </div>
  )
}
```

每次渲染 UptimeBar 都用 `Math.random()` 决定每根 bar 颜色 — **状态页是假的**。

这是 status 页最关键的视觉：**用户看到 90 根彩色条**代表过去 90 天每天的状态。但当前实现每根条独立掷骰子（受 `uptime` 数字影响概率），且**每个 reload 都重新洗牌**。

用户从同一 status 页面刷新两次，看到的 90 根 bar 颜色不同 → 立刻识别为 fake。

## 修复（最小）

```diff
-function UptimeBar({ uptime }: { uptime: number }) {
-  const bars = 90
+interface UptimeBarProps {
+  uptime: number              // 0..100, 当前周期聚合
+  history?: number[]          // 90 天历史，每元素 0=up, 1=degraded, 2=down
+}
+
+function UptimeBar({ uptime, history }: UptimeBarProps) {
+  const bars = history?.length ?? 90
+
+  // 无 history 时降级为基于 uptime 的"概率性"渲染（但用 useMemo 稳定）
+  const seed = useMemo(() => {
+    if (history) return null
+    return Array.from({ length: bars }, (_, i) => {
+      const seedVal = (i * 9301 + 49297) % 233280
+      const rand = seedVal / 233280
+      return rand < (1 - uptime / 100) * 0.3
+    })
+  }, [uptime, history, bars])
+
   return (
     <div className="flex gap-0.5 items-end">
-      {Array.from({ length: bars }).map((_, i) => {
-        const isDown = Math.random() < (1 - uptime / 100) * 0.3
+      {Array.from({ length: bars }).map((_, i) => {
+        const isDown = history
+          ? history[i] >= 2
+          : seed![i]
+
         return (
           <div
             key={i}
             className={`w-1 rounded-sm ${isDown ? 'bg-red-400' : isDegraded ? 'bg-yellow-400' : 'bg-green-400'}`}
-            style={{ height: isDown ? '8px' : '16px' }}
-            title={isDown ? '故障' : '正常'}
+            style={{ height: isDown ? '8px' : isDegraded ? '12px' : '16px' }}
+            title={`${daysAgo(bars - i - 1)}: ${statusText}`}
           />
         )
       })}
     </div>
   )
 }
```

## 真正的修复（接 Prometheus）

```tsx
// 拉 hamr-status API（已有 endpoint 应在 hamr-api-gateway 加）
const { data: status } = useQuery({
  queryKey: ['status'],
  queryFn: () => fetch('/api/status').then(r => r.json()),
  refetchInterval: 60_000,
});

<ServiceCard service={s} history={status?.uptime_history_90d?.[s.id]} />
```

后端在 `hamr-status` 或 `hamr-api` 加：
```rust
// GET /api/status/uptime?service=X&days=90
// 查 Prometheus: 100 - (avg_over_time(up{job="X"}[1d]) * 100)
```

## 验证

```bash
# 1. 视觉对比 — 同一 service 刷新两次，bar 颜色应一致
# 旧代码: 每次都不同
# 新代码: history 模式下完全一致；useMemo 降级模式也稳定

# 2. Vitest 测 seed 稳定性
```

```tsx
test('UptimeBar history-mode stable across renders', () => {
  const { rerender } = render(<UptimeBar uptime={99} history={Array(90).fill(0)} />);
  const first = screen.getAllByTitle(/正常/);
  rerender(<UptimeBar uptime={99} history={Array(90).fill(0)} />);
  const second = screen.getAllByTitle(/正常/);
  expect(first.length).toBe(second.length);
});
```

## 不要

- ❌ 别用 `useEffect(() => setX(Math.random()))` — 同问题
- ❌ 别用 `Date.now()` 当 seed — 仍每次不同
- ✅ 用 history（真数据）或稳定 PRNG seed（降级）

## 关联

- hamr-infra/monitoring/alerts.yml 已定义 `up{job="X"}` — 接 Prometheus 历史
- hamr-api/metrics.rs 已安装 prometheus recorder — 数据管道已就位