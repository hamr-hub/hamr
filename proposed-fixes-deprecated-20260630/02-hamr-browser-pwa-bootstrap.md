# P0-2: hamr-browser PWA 端到端坏掉

**子项目**: `hamr-browser`
**严重度**: P0 ship-blocker (Cluster 2)
**审计来源**: `.iter-skill/runs/2026-06-30/02-vite-frontends.md` Top 1

## 三个独立失败点

### A. `captureTokenFromHash` 未挂到 bootstrap

```ts
// src/auth/oauth.ts:29-40
export function captureTokenFromHash() {
  const m = location.hash.match(/token=([^&]+)/);
  if (m) localStorage.setItem('hamr_token', decodeURIComponent(m[1]));
}
// 但 src/main.ts 的 bootstrap() 里从未 import / 调用它
```

**修复**：在 `bootstrap()` 最顶部加 `captureTokenFromHash()`。

### B. `public/sw.js` 不存在

`scripts/smoke.sh` 引用 `curl /sw.js`，文件缺失。

**修复**：

```bash
mkdir -p public
cat > public/sw.js <<'EOF'
// HamR PWA Service Worker — v0.2 起由 vite-plugin-pwa 生成
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
EOF
```

或者用 `vite-plugin-pwa` 自动生成（推荐）。

### C. manifest icons 缺失

`public/manifest.json` 引用 `/icons/icon-192.png` 和 `/icons/icon-512.png`，文件不存在。

**修复**：

```bash
# 占位 PNG（192x192 + 512x512）
mkdir -p public/icons
# 用 ImageMagick 或 ffmpeg 生成：
convert -size 192x192 xc:#0066cc -fill white -gravity center \
  -font DejaVu-Sans-Bold -pointsize 60 -annotate +0+0 'H' \
  public/icons/icon-192.png
convert -size 512x512 xc:#0066cc -fill white -gravity center \
  -font DejaVu-Sans-Bold -pointsize 160 -annotate +0+0 'H' \
  public/icons/icon-512.png
```

或者换 `vite-plugin-pwa` 配 `pwaAssets` 自动生成。

## 验证

```bash
# 1. 装 vite-plugin-pwa
npm install -D vite-plugin-pwa

# 2. vite.config.ts 加 plugin
import { VitePWA } from 'vite-plugin-pwa'
plugins: [VitePWA({ registerType: 'autoUpdate', manifest: {...} })]

# 3. 跑 build + preview
npm run build && npm run preview

# 4. Chrome DevTools → Application → Service Worker → 应为 activated
# 5. Chrome DevTools → Application → Manifest → icons 应可见
```