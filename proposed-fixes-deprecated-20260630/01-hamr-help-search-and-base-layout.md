# P0-1: hamr-help build break + 死搜索

**子项目**: `hamr-help`
**严重度**: P0 blocker (Cluster 1)
**审计来源**: `.iter-skill/runs/2026-06-30/01-astro-frontends.md` Top 1

## 背景

```
hamr-help/src/pages/Search.astro  → fetch('/index.json')
hamr-help/src/layouts/BaseLayout.astro → import '../styles/global.css'
```

两个引用都指向不存在的端点 / 文件：
- `/index.json` 没有 API 端点提供
- `../styles/global.css` 文件本身缺失

## 修复方案

### Search.astro 改用 pagefind

```diff
- <script>
-   const res = await fetch('/index.json');
-   const data = await res.json();
- </script>
+ ---
+ // 在 frontmatter 里：
+ import Search from 'astro:pagefind';
+ ---
+ <Search id="search" className="pagefind-ui" />
```

`astro.config.mjs` 加 pagefind integration：
```js
import pagefind from 'astro-pagefind';
export default defineConfig(sharedConfig({
  site: 'https://help.hamr.top',
  integrations: [pagefind()],
}));
```

### BaseLayout.astro 抽 global.css

新增 `src/styles/global.css`：
```css
/* HamR 帮助中心共用样式 */
:root {
  --color-bg: #ffffff;
  --color-text: #1a1a1a;
  --color-accent: #0066cc;
  --space-1: 0.5rem;
  --space-2: 1rem;
  --radius: 6px;
}
body { font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif; }
```

或者直接放进 `templates/shared/astro-config/global.css`，3 个 Astro 子项目共用。

## 验证

```bash
cd hamr-help
npm run build   # 应该成功
npm run dev     # 浏览器访问 /search 应该有结果
```

## 回退

如果 pagefind 集成复杂度过高，临时方案：删除 Search.astro 页面 + 从导航隐藏入口。