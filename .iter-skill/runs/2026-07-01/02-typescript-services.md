# Cluster 2: TypeScript/Node Services — Optimization Report (2026-07-01 round 2)

Replaces: round-1 reports `01-astro-frontends.md` + `02-vite-frontends.md` (those cited the pre-submodule monorepo state and are now stale).

## Methodology

All 7 repos are real submodules under `repos/<repo>/` (init via `git submodule status`; commit hashes verified). Stack confirmed by reading `package.json` + `vite.config.ts` + `tsconfig.app.json` for each. Frontends are all React 19 + Vite 7 + TypeScript 5.9 SPAs. Mood-calender is the odd one out: React 18 + Vite 5 + Antd. Everything is shipped as a static SPA behind nginx:alpine (Dockerfile identical across the 6 nginx-fronted repos). No backend services in this cluster.

## Executive Summary

- **All 7 repos are React 19 Vite SPAs** with a one-size-fits-all nginx Docker image. Bundle-size optimization is the highest-leverage cluster-wide win — only `hamr-website` configures `manualChunks`, and its `chunkSizeWarningLimit: 1000` is suppressing real warnings.
- **Zero automated tests** across the cluster. No `*.test.*`, no `*.spec.*`, no `vitest.config*`, no Playwright. This is a P0 risk for any code change.
- **hamr-status ships hard-coded mock data** (`MOCK_INCIDENTS`, `INITIAL_SERVICES` in `App.tsx:46-68`) — its UptimeBar uses `Math.random()` for the bars (`App.tsx:85`), and the "live refresh" just re-renders the same constant (`App.tsx:147-154`). The page is a visual mock, not a status page.
- **Nginx config is unhardened across the board** — no gzip_types includes `image/svg+xml`, no `text/css`, no `application/wasm`, no `application/font-woff2`; no security headers (HSTS, CSP, X-Frame-Options); no `brotli on;`; no SPA-fallback for nested routes.
- **Migrations/breaking-types in `hamr-mood-calender`** — `src/types/mood.ts` (unused except in storage) defines a different `MoodType` (Chinese strings) than `src/utils/moodStorage.ts` (English keys). Two definitions, one used — the `types/mood.ts` file is dead code.
- **Web Vitals beacon points at `/api/vitals`** in `hamr-website/src/utils/webVitals.ts:21` — no backend exists in this cluster to receive it. Same with `hamr-status`'s mock "subscribe" form: there is no POST handler.

## Per-repo findings

### hamr-website
- [P0] **Build/bundle** vendor-three chunk will be enormous — `vite.config.ts:13` lumps `three + @react-three/fiber + @react-three/drei` together and sets `chunkSizeWarningLimit: 1000` (KB) to silence the warning. With drei on the import graph, this is likely 500KB+ gzipped. — `repos/hamr-website/vite.config.ts:7-13` — XS — high
- [P0] **Build/performance** Three.js, framer-motion and the heavy Hero scene are imported eagerly. `src/pages/Home.tsx:14` lazy-loads `HeroScene` but the rest of the hooks (`useFaceTracking`, `useGestureControl`, `useMicrophone`) and `framer-motion` + `lucide-react` are all in the entry chunk. — `src/pages/Home.tsx:1-14` — M — high
- [P0] **Performance/UX** `useFaceTracking` runs a hand-rolled pixel scan on every animation frame (`src/hooks/useFaceTracking.ts:31-41`) on a 320×240 stream — O(w·h/16) per frame. On a low-end phone this will peg the CPU and drain battery. The "face detected" claim is also questionable: any red-ish skin will pass the heuristic. — `src/hooks/useFaceTracking.ts:31-46` — M — high
- [P0] **Privacy/security** Camera and mic are opened by the InteractiveControls in the user's default browser, but there's no visible "recording" indicator beyond a tiny dot (`src/pages/Home.tsx:163-168`) and the controls are tucked in a floating panel. Many users will toggle them on without understanding the stream is on. — `src/pages/Home.tsx:148-168`, `src/components/InteractiveControls.tsx:64-146` — S — high
- [P0] **Observability** `measureWebVitals()` `sendBeacon`s to `/api/vitals` but no service in this cluster serves that path — silent 404 on every page load. — `src/utils/webVitals.ts:13-22` — XS — med
- [P1] **Performance** `useGestureControl.ts:14-74` re-uploads 160×120 RGBA from canvas to JS every other frame and does a full O(N) diff with previous frame. No WebWorker, no `createImageBitmap`. — `src/hooks/useGestureControl.ts:14-74` — M — med
- [P1] **SEO** robots/sitemap are present, but `<link rel="icon">` in `index.html:5` still points to the default Vite logo — branding inconsistency. — `index.html:5` — XS — low
- [P1] **DX** No Prettier, no Vitest, no Playwright. The `dist/` directory will be committed if someone forgets `.gitignore` (currently `.gitignore:11` is correct, but there is no `.dockerignore` so build context ships the full repo to Docker). — `Dockerfile:1-12` — XS — med
- [P1] **A11y** `<div onClick>` for navigation on motion cards (`Home.tsx:267`), no keyboard focus. Multiple decorative emoji used as labels (`Home.tsx:124`). — `src/pages/Home.tsx:267-278` — S — med
- [P2] **Build** `vite.config.ts:7` sets `chunkSizeWarningLimit: 1000` to 1MB; better: fix the chunks, don't silence the warning. — `vite.config.ts:7` — XS — med
- [P2] **DX** `tsconfig.app.json` enables `noUnusedLocals/Parameters` (line 21-22) but the codebase has dead exports (e.g. `src/utils/webVitals.ts` is imported only in `main.tsx:5`). Hooks like `useSwipe` are imported but never used. — `src/pages/Home.tsx:10` (useSwipe used), `tsconfig.app.json:21-22` — XS — low
- [P2] **SEO** `index.html:9` sets a proper title but `useSEO()` in `src/hooks/useSEO.ts:11-60` rewrites it client-side. Crawlers that don't run JS will only see the home page title. — `index.html:9` + `src/hooks/useSEO.ts:12-14` — M — low

### hamr-deploy
- [P0] **Build/bundle** Zero `manualChunks` config — `vite.config.ts:5-7` is the bare default. lucide-react and react will end up in one big chunk. — `vite.config.ts:1-7` — XS — med
- [P0] **Content/maintenance** `App.tsx:58-352` is one giant 350-line JSX literal with all deployment content inlined. There is no Markdown content collection, so any copy edit requires a redeploy. The README documents a `docs/` directory with sub-pages that don't exist. — `src/App.tsx:58-352` vs `README.md:99-126` — M — med
- [P0] **SEO** `index.html:7-8` only sets a basic title and description. No OG, no canonical, no Twitter card. The site exists to be linked from docs.hamr.top / status.hamr.top — link previews will look bad. — `index.html:1-14` — XS — med
- [P0] **Security** Deploy instructions in `App.tsx:160` mention `POSTGRES_PASSWORD=必填` (placeholder). The site has a copy button that copies placeholder text into the user's clipboard (`App.tsx:36-40`) — a footgun. — `src/App.tsx:155-200` — S — high
- [P1] **DX** No tests. The "deploy" topic is the highest-stakes one in the cluster (it teaches the user to run install scripts as root). Zero validation. — `src/App.tsx` — M — high
- [P1] **A11y** Sidebar nav uses `<button onClick>` with no anchors — no deep-link, no URL sync. The active section is a `useState` only (`App.tsx:355`). Bookmarking a section is impossible. — `src/App.tsx:377-396` — S — med
- [P1] **Content** Hard-coded URLs to `https://api.hamr.top/v1` and `https://app.hamr.store` — there is no env-var indirection for staging vs prod. — `src/App.tsx:62-86` — S — med
- [P2] **Performance** All sections are eagerly mounted in a single `CONTENT` record. The page weighs 1+ MB of React tree from the start. Trivial `React.lazy` would fix it. — `src/App.tsx:58-352` — S — low
- [P2] **DX** `eslint.config.js` (line 15) uses `reactHooks.configs.flat.recommended` — works, but the rest of the cluster is on the same config; no opportunity to share via a workspace package. — `eslint.config.js:1-23` — L — low

### hamr-developer
- [P0] **Build/bundle** `vite.config.ts:11-13` splits `vendor-react` and `vendor-motion` but no `vendor-icons` (lucide-react is significant — counted 8 imports in the developer's pages alone). — `vite.config.ts:7-15` — XS — med
- [P0] **DX** `dist/` is committed (`repos/hamr-developer/dist/index.html` + `dist/vite.svg` exist in the working tree). This will bloat the repo and cause confusion. — `repos/hamr-developer/dist/` — XS — high
- [P0] **Observability/Auth** `src/pages/Docs.tsx:168-192` has a complete fake "rate-limit" example with header values. Developers will copy this into their code. There is no real API. — `src/pages/Docs.tsx:168-192` — S — high
- [P1] **Content drift** `src/pages/Projects.tsx:5-114` hard-codes 10 projects with hard-coded `stars: 0, forks: 0`. The page will be wrong on day one. — `src/pages/Projects.tsx:5-114` — S — med
- [P1] **A11y** Multiple `<motion.div>` without semantic roles, `Hero.tsx` is an `<h1>` inside a `motion.h1` (good), but the Search button (`src/components/Header.tsx:18-22`) is decorative (no `onClick`). — `src/components/Header.tsx:18-22` — S — med
- [P1] **SEO** `index.html:32-36` does `preconnect` to Google Fonts but only loads one weight — fine. However, the OG image (`og-image.png`) referenced at `index.html:19` is not in `public/`. — `index.html:19`, `public/` — XS — med
- [P1] **DX** No tests. No code sample formatter (raw `<pre>` is used; Shiki is mentioned in README but not installed). — `package.json:12-19` — M — med
- [P1] **Build** `package.json:7-10` is missing a `typecheck` script. `tsc -b` only runs in `build`. The dev loop can ship type errors. — `package.json:7-10` — XS — med
- [P2] **UX** `useLocation().pathname.startsWith(to)` (Header.tsx:20) means `/sdk` would also highlight `/sdk-typescript` if it existed — works, but `/docs` highlights both `/docs` and `/docs/something`. Minor. — `src/components/Header.tsx:18-21` — XS — low
- [P2] **A11y** Color contrast: many `text-gray-400` on dark backgrounds. Not WCAG AA. — global — S — med
- [P2] **Build** `eslint.config.js:9` uses `globalIgnores(['dist'])` which is good — the committed `dist/` is the only issue, and the ignore list won't help if it gets re-committed. — `eslint.config.js:9` — XS — low

### hamr-docs
- [P0] **Content drift** `src/App.tsx:18-32` defines 8 routes but `src/components/Sidebar.tsx:14-51` defines 13 nav items, several of which (`/getting-started/concepts`, `/api/chat`, `/api/devices`, `/api/automation`, `/architecture/data-model`, `/sdk/typescript`, `/sdk/rust`, `/sdk/python`) link to routes that return `NotFound`. The whole sidebar is broken. — `src/App.tsx:18-32` vs `src/components/Sidebar.tsx:14-51` — M — high
- [P0] **SEO** No OG image (`og-image.png` referenced in `index.html:19`), no `twitter-image.png` (`index.html:26`), no JSON-LD on the index. Worse: `index.html:14` has `<title>HamR Docs - 技术文档 | API 参考与开发指南</title>` which is good, but the page does not call `useSEO` (no `useSEO` hook in this project). So routing between docs sections all show the same title. — `index.html:1-42` — S — high
- [P0] **Build/bundle** `vite.config.ts:5-7` is the bare default — no `manualChunks`, no `chunkSizeWarningLimit`. — `vite.config.ts:1-7` — XS — med
- [P0] **Content drift** `src/pages/APIOverview.tsx:183-198` deep-links to `/api/authentication`, `/api/chat`, `/api/devices`, `/api/errors` — `chat` and `devices` don't exist as routes. — `src/pages/APIOverview.tsx:183-198` — S — high
- [P1] **DX** README describes a "content collection" with `src/content/{getting-started,guides,faq,troubleshooting}` directories — none exist. — `README.md:127-135` vs filesystem — M — med
- [P1] **Build** `package.json:7-10` is missing `typecheck` and `test` scripts. — `package.json:7-10` — XS — med
- [P1] **A11y** Sidebar toggle is a `<button>` that uses `aria-expanded` only in spirit (no actual attribute). — `src/components/Sidebar.tsx:62-74` — S — low
- [P2] **SEO** No `robots.txt` and no `sitemap.xml` in `public/`. — `public/` — XS — med
- [P2] **DX** `.gitignore:11` excludes `dist`, but there is no `.dockerignore` so the Docker build context will include `node_modules` if it ever gets created locally. — `Dockerfile:1-12` — XS — low

### hamr-help
- [P0] **Content drift** `src/App.tsx:13-30` defines 8 routes but every `<Route>` except `/`, `/getting-started`, `/faq`, `/troubleshooting`, `/contact` would 404. The `*` patterns (`/getting-started/*`, `/faq/*`, `/troubleshooting/*`) all map to the same component. There is no article-detail view, despite `README.md:124-129` describing one. — `src/App.tsx:13-30` vs `README.md:124-129` — M — high
- [P0] **Build/bundle** Bare `vite.config.ts:5-7`. No chunks. — `vite.config.ts:1-7` — XS — med
- [P0] **Search/UX** `src/pages/Home.tsx:91-98` shows a search input but the `searchQuery` state (line 7) is never used to filter anything. Pure decoration. — `src/pages/Home.tsx:7,91-98` — S — high
- [P0] **Content drift** `src/pages/Home.tsx:54-60` lists "popular articles" that link to `/getting-started/quickstart`, `/faq/devices/add-device`, `/faq/account/reset-password`, `/troubleshooting/device-offline`, `/guides/automation` — only `/guides/*` is in the route table; the rest 404. — `src/pages/Home.tsx:54-60` — S — high
- [P1] **Content drift** README describes Algolia search integration (`README.md:148-160`) — not present in `package.json`. — `README.md:148-160` vs `package.json:12-18` — M — med
- [P1] **Build** `package.json:7-10` missing `typecheck` and `test`. — `package.json:7-10` — XS — med
- [P1] **SEO** `index.html:8-26` has decent meta tags, but no `robots.txt` or `sitemap.xml`. The Help site is a knowledge base — sitemap matters more here than for the marketing site. — `public/` — S — med
- [P2] **A11y** Search input has no `<form>` wrapper, no submit button, no `aria-label` (just `placeholder`). — `src/pages/Home.tsx:91-98` — XS — med
- [P2] **DX** `eslint.config.js:9` only ignores `dist`. No `build`, no `coverage`, no `node_modules` (well, `.gitignore` covers that). Trivial. — `eslint.config.js:9` — XS — low

### hamr-mood-calender
- [P0] **Stack mismatch** This repo is React 18 + Vite 5 + Antd (`package.json:13-17`); the rest of the cluster is React 19 + Vite 7 + Tailwind. Cross-repo shared component migration is blocked by this. — `package.json:13-17` — M — high
- [P0] **Type confusion** Two `MoodType` definitions: `src/utils/moodStorage.ts:7` (English: `'cry' | 'sad' | ...`) and `src/types/mood.ts:2` (Chinese: `'狂喜' | '开心' | ...`). Only the storage one is used (`MoodCalendar.tsx:8`). `types/mood.ts` is dead code and `moodEmoji`/`moodColor` exports (`types/mood.ts:10-25`) are unused. — `src/types/mood.ts:1-26` vs `src/utils/moodStorage.ts:1-60` — S — high
- [P0] **Storage schema** `moodStorage.saveMood()` (`moodStorage.ts:24-41`) reads the whole array, mutates, then writes the whole array back. If two tabs are open, the second tab's write wipes the first. The data is also unencrypted in `localStorage` — fine for moods, but the README does not warn about it. — `src/utils/moodStorage.ts:24-41` — S — med
- [P0] **Vercel config** `vercel.json:8` runs `rm -rf node_modules package-lock.json && npm install --legacy-peer-deps && npm run build` on every Vercel build. This is 5+ minutes of waste per deploy and a "works by accident" pattern (will break the moment Vercel caches). — `vercel.json:8` — S — high
- [P0] **Build/bundle** `vite.config.ts:5-7` is bare default. Antd 5 + dayjs will produce a large chunk; Antd's `Modal` is imported from the full bundle (`MoodSelector.tsx:2`), not from `antd/es/modal`. — `src/components/MoodSelector.tsx:2` — S — med
- [P0] **DX** `.npmrc:1` forces `legacy-peer-deps=true` — usually a sign of a broken dep tree. The README doesn't mention this. — `.npmrc:1` — S — med
- [P1] **Testing** No tests for the date-math in `MoodCalendar.tsx:54-64` (calendar generation, month boundary handling). — `src/components/MoodCalendar.tsx:54-64` — M — high
- [P1] **Build** `package.json:7-10` missing `typecheck` and `test`. — `package.json:7-10` — XS — med
- [P1] **A11y** `<div className="mood-option" onClick>` (`MoodSelector.tsx:55-65`) is not keyboard-focusable. — `src/components/MoodSelector.tsx:55-65` — S — med
- [P1] **Accessibility** `index.html:2` has `lang="en"` but the entire UI is Chinese. Should be `lang="zh-CN"`. — `index.html:2` — XS — med
- [P1] **SEO** No `<meta name="description">` in `index.html`. — `index.html:1-17` — XS — low
- [P2] **UX** Mood chart uses fixed 232×49 SVG dimensions (`MoodChart.tsx:73-75`) — won't scale. — `src/components/MoodChart.tsx:73-75` — S — low
- [P2] **DX** `eslint.config.js:15` uses `reactHooks.configs['recommended-latest']` while everyone else uses `.flat.recommended`. Inconsistency. — `eslint.config.js:15` — XS — low

### hamr-status
- [P0] **Mock data** The whole "status" UI is fake. `App.tsx:46-56` declares `INITIAL_SERVICES` with hard-coded uptime numbers (99.95%, 99.99%, etc.) and `App.tsx:85` uses `Math.random()` to draw the UptimeBar dots. The "refresh" button (`App.tsx:147-154`) just re-applies the same constants. This is not a status page, it's a screenshot. — `src/App.tsx:46-56, 85, 147-154` — M — high
- [P0] **Privacy/UX** The "subscribe to status" form at the bottom (`App.tsx:285-294`) has a `type="email"` and a "订阅" button but no `onSubmit` — the form does nothing. — `src/App.tsx:284-294` — S — high
- [P0] **Build/bundle** Bare `vite.config.ts:5-7`. — `vite.config.ts:1-7` — XS — med
- [P0] **Content drift** README describes a 9-service monitoring list with UptimeRobot integration (`README.md:20-31, 73-87`) — not in the code. The README also documents RSS feed (`README.md:222-232`) and `src/api/uptime.ts` (`README.md:131-132`) — neither exist. — `README.md:20-31, 73-87, 131-132, 222-232` — M — high
- [P0] **DX/Status reporting** A status page that lies about its own status is a credibility problem. If a user lands here during an outage and sees "所有系统正常运行" they will lose trust forever. — `src/App.tsx:106-127` — M — high
- [P1] **Build** `package.json:7-10` missing `typecheck` and `test`. — `package.json:7-10` — XS — med
- [P1] **A11y** `useEffect(() => { const timer = setInterval(refresh, 60000) }, [])` (`App.tsx:156-159`) — the interval never pauses when the tab is hidden; wasted CPU. — `src/App.tsx:156-159` — S — low
- [P1] **SEO** `index.html:7-8` minimal — no OG, no canonical. — `index.html:1-14` — XS — low
- [P1] **Performance** `App.tsx:80-97` renders 90 bars per service × 9 services = 810 divs with `Math.random()` called on each render. The whole bar grid should be a CSS gradient. — `src/App.tsx:80-97` — S — med
- [P2] **DX** `useState(INITIAL_SERVICES)` is declared but the setter (`setServices`) is only ever called with the same constant — could be a `const`. — `src/App.tsx:143-154` — XS — low
- [P2] **A11y** "刷新" button (`App.tsx:178-185`) does not have `aria-live` for screen readers when content updates. — `src/App.tsx:178-185` — XS — low

## Cross-repo opportunities

- **Shared design tokens / components** — All 6 Vite-7+ repos have a `tailwind.config.js` that defines a `primary` color ramp from scratch (`hamr-website/tailwind.config.js:9-21` is purple, `hamr-developer/tailwind.config.js:9-21` is sky, `hamr-help/tailwind.config.js` similar). A shared `@hamr/ui` package with the brand tokens, plus shared `<Header>`/`<Footer>`/`<Seo>` components, would prevent the silent drift we're already seeing (e.g. `hamr-docs` sidebar links to routes that don't exist).
- **Shared eslint config** — All 6 repos have a near-identical `eslint.config.js` (`hamr-website/eslint.config.js:1-23` ≡ `hamr-deploy/eslint.config.js:1-23` ≡ `hamr-developer/eslint.config.js:1-23` etc.). Should be extracted into a shared config or `eslint-config-hamr` package.
- **Shared `nginx.conf`** — All 6 nginx-fronted repos have byte-identical `nginx.conf` (`hamr-website/nginx.conf:1-13` ≡ `hamr-deploy/nginx.conf:1-11` ≡ `hamr-developer/nginx.conf:1-11` etc.). A common base image `hamr-nginx-base` would let us fix the security/header issues once.
- **Shared `Dockerfile`** — All 6 nginx-fronted repos have byte-identical `Dockerfile` (`hamr-website/Dockerfile:1-12` ≡ `hamr-deploy/Dockerfile:1-12` etc.). Same fix.
- **Cluster-wide test setup** — Zero repos have any test runner. Adding `vitest` + `@testing-library/react` to a shared dev-deps package, plus a couple of smoke tests per repo, would close the gap in one PR.
- **Cluster-wide SEO starter** — `hamr-website` has the best meta setup (OG, Twitter, canonical, JSON-LD via `useSEO`). `hamr-help`/`hamr-status`/`hamr-docs` are weaker. A shared `useSEO` (or server-side rendering via Vite SSG for the marketing sites) would unify this.
- **Cluster-wide observability** — `webVitals` exists only in `hamr-website` and points at a non-existent endpoint. Either ship a tiny `/api/vitals` collector in the API gateway (hamr-api, separate cluster) or use a SaaS like Plausible/Umami.
- **Cluster-wide i18n** — UI is 100% Chinese. `index.html` mixes `lang="zh-CN"` and `lang="en"` (`hamr-mood-calender/index.html:2`). `react-i18next` would prevent the `lang` mismatch bug.
- **Cluster-wide `.dockerignore`** — None of the repos have one. The Docker build context includes `node_modules`, `.git`, `dist`, README, etc. Easy +1MB savings per image.
- **Cluster-wide mock data leak** — `hamr-status` is the only one that ships mocked-but-disguised-as-real data, but `hamr-developer/src/pages/Projects.tsx:5-114` and `hamr-developer/src/pages/Community.tsx:5-46` have hard-coded stats ("0 GitHub Stars", "1 注册开发者") that will look embarrassing in 6 months.
- **Migrate hamr-mood-calender to React 19** — Required for any cross-repo component sharing. The Antd 5 + React 19 incompatibility is the only blocker.

## Top 5 recommended next actions

1. **(P0, M effort, high impact) Make `hamr-status` honest.** Replace `INITIAL_SERVICES` / `MOCK_INCIDENTS` with a real data source. Easiest path: read from a JSON file generated by the existing `hamr-infra` Prometheus + JSON exporter stack (`repos/hamr-infra/monitoring/prometheus.yml` already exists). Until then, label the page "preview" so users aren't misled during an outage.
2. **(P0, M effort, high impact) Add a shared `@hamr/ui` workspace** with eslint config, nginx config, Dockerfile, Tailwind tokens, and a `<Seo>` / `<Header>` / `<Footer>` kit. Single PR fixes ~12 of the 30+ findings (drift between docs/help/deploy, identical Dockerfiles, identical nginx.conf, missing typecheck scripts).
3. **(P0, S effort, high impact) Set up Vitest in one repo, copy to the other 6.** A 5-line `vitest.config.ts` + one smoke test per repo would unblock every future change. Highest-leverage DX win in the cluster.
4. **(P0, S effort, med impact) Replace the 7 identical `nginx.conf` files with one that has `gzip_types text/css application/javascript application/wasm application/font-woff2 image/svg+xml` and a baseline `add_header` set (HSTS, X-Content-Type-Options, Referrer-Policy, X-Frame-Options DENY, basic CSP). One-line change, immediate SEO + perf + security win.**
5. **(P0, M effort, high impact) Remove the dead `dist/` from `hamr-developer`** (committed) and add a CI check that runs `git ls-files | grep -E '^repos/[^/]+/dist/'` and fails. Same for any future `dist/` commits. While there: add `.dockerignore` to all 6 nginx-fronted repos.
