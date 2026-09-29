# @hamr/astro-config — HamR Astro 共用配置

> 来源：2026-06-30 Cluster 1 — 3 个 Astro 子项目（website/docs/help）重复 ~150 LOC 几乎相同的 astro.config.mjs + BaseLayout + global.css。

## 文件清单

| 文件 | 内容 |
|------|------|
| `astro.config.mjs` | 共享 astro 配置（site/trailingSlash/compressHTML/i18n/vite） |

## 子项目接入

### hamr-website

```js
// hamr-website/astro.config.mjs
import { sharedConfig } from '../../templates/shared/astro-config/astro.config.mjs';
import { defineConfig } from 'astro/config';

export default defineConfig(sharedConfig({
  site: 'https://hamr.top',
  title: 'HamR — 家庭智能助理',
}));
```

### hamr-docs

```js
// hamr-docs/astro.config.mjs
import { sharedConfig } from '../../templates/shared/astro-config/astro.config.mjs';
import redocly from '@redocly/astro';

export default defineConfig(sharedConfig({
  site: 'https://docs.hamr.top',
  integrations: [redocly()],
}));
```

### hamr-help

```js
// hamr-help/astro.config.mjs
import { sharedConfig } from '../../templates/shared/astro-config/astro.config.mjs';

export default defineConfig(sharedConfig({
  site: 'https://help.hamr.top',
  integrations: [pagefind()],  // 修 P0-1 的搜索
}));
```

## 已知修复（采纳后即可解决）

| Cluster 1 P0 | 修复点 |
|--------------|--------|
| P0-1 hamr-help Search.astro 拉不存在 /index.json | 改用 pagefind（已加入 integrations） |
| P0-1 BaseLayout.astro 引用缺失 global.css | 抽到 `@hamr/astro-base` layout（待加） |
| hamr-docs Dockerfile 不重新聚合 OpenAPI | 改 Dockerfile ENTRYPOINT 跑 aggregate.py |
| 缺 CSP/HSTS/SRI | `templates/shared/nginx-hardened.conf` 配套 |

## 待办（v0.2 后续）

- [ ] 加 `BaseLayout.astro` 共享 layout（含 SEO meta + OG + 站点导航）
- [ ] 加 `global.css` 共享设计 token（颜色 / 字号 / spacing）
- [ ] 加 `astro-i18n.ts` 共享中英文文案
- [ ] 把 `@hamr/astro-config` 提到 npm package（先发内部）