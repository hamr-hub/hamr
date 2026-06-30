# P0-3: hamr-demo 初始 bundle 大 80%

**子项目**: `hamr-demo`
**严重度**: P0 high (Cluster 2)
**审计来源**: `.iter-skill/runs/2026-06-30/02-vite-frontends.md` Top 3

## 背景

`src/router.ts:1-7` 静态 import 每个 widget：

```ts
import { moodWidget } from './widgets/mood-demo'
import { budgetWidget } from './widgets/budget-demo'
import { chartWidget } from './widgets/chart-demo'  // ← 含 chart.js/auto ~70KB gz
import { calendarWidget } from './widgets/calendar-demo'
// 所有 widget 在每页加载
```

`src/widgets/mood-demo.ts:73` 切成员走 `location.reload()`：

```ts
function switchMember(id: string) {
  localStorage.setItem('current_member', id)
  location.reload()  // ← 全页重载
}
```

## 修复

### 改 lazy import

```ts
// src/router.ts
const routes = {
  '/': () => import('./widgets/overview-demo'),
  '/mood': () => import('./widgets/mood-demo'),
  '/budget': () => import('./widgets/budget-demo'),
  '/chart': () => import('./widgets/chart-demo'),     // 70KB 仅 chart 页加载
  '/calendar': () => import('./widgets/calendar-demo'),
}

export async function navigate(path: string) {
  const loader = routes[path] || routes['/']
  const mod = await loader()
  mod.mount(document.getElementById('app')!)
}
```

### 修 location.reload

```ts
// src/widgets/mood-demo.ts
function switchMember(id: string) {
  localStorage.setItem('current_member', id)
  // 触发自定义事件，让 router 重新挂载当前页
  window.dispatchEvent(new CustomEvent('member-changed', { detail: { id } }))
}

// 在 widget 里监听
window.addEventListener('member-changed', async (e) => {
  await loadMemberData((e as CustomEvent).detail.id)
  renderChart()
})
```

### chart.js 改用 tree-shakable

```ts
// 之前
import Chart from 'chart.js/auto'  // 全量 ~70KB gz

// 之后
import { Chart, registerables } from 'chart.js'
Chart.register(...registerables)
// 或者只注册需要的：
import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale } from 'chart.js'
Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale)
```

## 验证

```bash
npm run build
# 看 dist/assets/*.js 的 gzip 大小
gzip -k dist/assets/*.js
ls -la dist/assets/*.js.gz | sort -k5 -rn | head
# 期望最大 chunk < 200KB gz
```

CI 已加 bundle size 检查（`.github/workflows-template/vite.yaml`），>200KB 直接 fail。