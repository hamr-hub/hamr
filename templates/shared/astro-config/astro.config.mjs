// templates/shared/astro-config/astro.config.mjs
//
// HamR Astro 共用配置 — 由 3 个 Astro 子项目（hamr-website / hamr-docs /
// hamr-help）共用，减少 drift。
//
// 来源：2026-06-30 Cluster 1 跨集群建议 — 抽 @hamr/astro-config。
//
// 用法（子项目 astro.config.mjs）：
//
//   import { sharedConfig } from '../../templates/shared/astro-config/astro.config.mjs';
//   import { defineConfig } from 'astro/config';
//
//   export default defineConfig(sharedConfig({
//     site: 'https://docs.hamr.top',
//     title: 'HamR 技术文档',
//     integrations: [redocly()],  // 子项目特有
//   }));

export function sharedConfig(opts = {}) {
  const {
    site = 'https://hamr.top',
    integrations = [],
    i18n = { defaultLocale: 'zh-CN', locales: ['zh-CN', 'en'] },
    compressHTML = true,
  } = opts;

  return {
    site,
    trailingSlash: 'never',
    compressHTML,

    // 性能：按需 Island hydration
    output: 'static',

    // 构建优化
    build: {
      inlineStylesheets: 'auto',
      assets: '_astro',
    },

    // 图片优化
    image: {
      domains: [],
      remotePatterns: [{ protocol: 'https' }],
    },

    // i18n
    i18n,

    // 集成：sitemap + mdx 默认开；子项目可追加
    integrations: [
      '@astrojs/sitemap',
      '@astrojs/mdx',
      ...integrations,
    ],

    // 预览服务器（开发用）
    server: {
      port: 4321,
      host: true, // 监听 0.0.0.0 方便 docker/k8s
    },

    // Vite 优化
    vite: {
      build: {
        cssMinify: 'lightningcss',
        rollupOptions: {
          output: {
            manualChunks: undefined, // 子项目按需拆分
          },
        },
      },
      ssr: {
        noExternal: ['bootstrap'],
      },
    },

    // 实验性：CSS Layers + View Transitions
    experimental: {},
  };
}

// 默认 export 让子项目能 `import sharedConfig from '...'`
export default sharedConfig;