# Cluster 5: hamr-app Mobile — Optimization Report
Date: 2026-06-30

> Repository: `/mnt/ssd/codespace/ai/hamr/repos/hamr-app`
> Module name: `github.com/hamr/hamr-app` (v0.1.0)
> Code size: 333 lines of Go across 5 files (+ 2 HTML templates + 6 Playwright specs + Helm chart + CI)

## Executive Summary

- **`hamr-app` is not a mobile app.** It is a server-side rendered (SSR) Go web frontend for HamR's Dashboard, not a gomobile/Fyne/Gio/mobile-native binary. Despite the cluster name and the recent commit "重构 HamR 管家应用为 P2P 本地化架构" (commit `f494c8e` — March 19, 2026), the actual Go code (`cmd/app/main.go`, `internal/client/api.go`, etc.) remained a thin Gin + html/template fanout aggregator. The P2P rewrite was committed only as a planning proposal (`planning/proposals/hamr-butler-p2p-architecture-20260318.md`); the production code path is unchanged. **Reality and naming diverge — the largest single decision risk in this cluster.**
- **Code is tiny but architecturally misleading.** 5 Go files, 333 LOC, 1 external dep (`gin-gonic/gin v1.10.0`); no `go.sum`. The notifications endpoint aggregates `hamr-status` from the browser context — single client, no connection pool, no retry, no circuit breaker.
- **Critical gaps vs the "Mobile" brief**: no iOS/Android/Web build matrix, no code-signing, no native binding, no offline queue, no P2P / STUN / TURN / DHT / libp2p code path, no `gomobile` package, no Fyne/Gio entry. The repo has only a Helm chart and a Docker image — both targeting a container, not a device.
- **Top P0 risks**: hardcoded credential/token relay via cookies (`Dashboard.go:16-18` reads `user_id`/`user_name`/`household_id` from cookies in plaintext, never signed/encrypted); single hardcoded `HAMR_API_URL` per pod with no fallback; `internal/client/api.go:88-104` ships a hand-rolled `jsonReader` that returns `EOF` as a `fmt.Errorf` error rather than `io.EOF` — every successful read will fail in any consumer that checks `errors.Is(err, io.EOF)`.
- **Observability is zero**: no Prometheus, no OpenTelemetry, no `/metrics`, no request logging, no peer/latency instrumentation. Health endpoint is shallow and exposes `version` but no uptime, build sha, or downstream liveness.

---

## Architecture analysis

### What `hamr-app` actually is (derived from code, not commit messages)

| Layer | Finding | Evidence |
|-------|---------|----------|
| Module type | Go server binary, HTTP only | `go.mod:1`, `cmd/app/main.go:59` (`srv := &http.Server`) |
| Web framework | Gin (`v1.10.0`) — only runtime dep | `go.mod:6` |
| Rendering | Server-Side Rendering via stdlib `html/template` (NOT a SPA, NOT PWA, NOT mobile binding) | `cmd/app/main.go:7,79-88`, `internal/handlers/dashboard.go:31-33` |
| Templates | 2 HTML files + inline `<style>`; Bootstrap 5 + Bootstrap Icons via jsDelivr CDN | `web/templates/dashboard.html:6-7,74` |
| API surface | 3 routes: `GET /`, `GET /settings`, `GET /health`, `GET /api/notifications` | `cmd/app/main.go:43-57` |
| Downstream client | Hand-rolled `net/http` client targeting a single `hamr-api` URL | `internal/client/api.go:13-104` |
| Auth | Cookie-based: `user_id`, `user_name`, `household_id` read directly; OAuth2 token forwarded as `Authorization: Bearer` to hamr-api | `internal/handlers/dashboard.go:16-18`, `cmd/app/main.go:55`, `internal/client/api.go:38-40` |
| Tests | 1 Go test file (`TestDefaultTiles`/`TestByCategory`/`TestTileColor`) + 6 Playwright E2E specs | `tests/tiles_test.go`, `e2e/tests/*.spec.ts` |
| Container | Multi-stage distroless, nonroot, port 8080 — server container, not mobile binary | `Dockerfile:1-13` |
| Deployment | Helm chart (`apps/v1/Deployment`, `Service`, `Ingress`, readinessProbe on `/health`) — **k8s, not mobile** | `charts/Chart.yaml`, `charts/templates/deployment.yaml` |
| CI | `.github/workflows/e2e.yaml` — runs Playwright against `https://staging.hamr.top`; **no Go build/test workflow, no mobile signing** | `.github/workflows/e2e.yaml` |

### What the cluster brief assumed vs what is in the tree

The brief anticipated a P2P mobile app with STUN/TURN/CRDTs/`libp2p` etc. **None of these primitives exist in `hamr-app`.** They were specified in the March 18 2026 proposal `planning/proposals/hamr-butler-p2p-architecture-20260318.md` (Rust + libp2p + SQLite + Web3 DID), which was committed but never implemented in the repo. As of the audit date (2026-06-30) the runtime path is still `Browser → hamr-app (gin SSR) → hamr-api → 13 sub-services`.

This means **the entire P2P/mesh/STUN/DHT/security/observability findings below are conditional**: they only apply **after** the team decides whether to actually port `hamr-app` to the P2P-native design (Rust + libp2p + mobile) or to keep it as the SSR aggregator. Each finding below is tagged accordingly.

---

## Findings

### Architecture (re-scoped for the actual code path)

- **[P0] [architecture] hamr-app is mis-classified as "mobile"** — `cmd/app/main.go:1-94` + `go.mod:6` + `Dockerfile:1-13` — The repo is a Gin SSR web app served at `app.hamr.top` (`charts/values.yaml:9`). It has no mobile platform (iOS/Android/JS Webview binding), no `gomobile`/`Fyne`/`Gio`, no native shell. Treating it as a "mobile app" causes every brief deliverable (P2P, libp2p, mesh, CRDT, signing, distribution) to be impossible from the current code. **Decision needed: rename the cluster, or commit to the P2P rewrite.** — **effort M** — **impact high**
- **[P0] [architecture] The P2P rewrite is dormant** — `repos/hamr-app/cmd/app/main.go:1-94` (production code unchanged since initial scaffold) vs `planning/proposals/hamr-butler-p2p-architecture-20260318.md:71-79` (approved proposal). The March 19 commit `f494c8e` only updated the proposal document; no Rust toolchain, no `Cargo.toml`, no libp2p, no mobile shell exists. Drift between approved architecture and shipped code is itself a P0 risk: docs lie about reality. — **effort L** (the actual rewrite) — **impact high**

### Performance & reliability (current code path)

- **[P0] [perf] `jsonReader.Read` returns `fmt.Errorf("EOF")` not `io.EOF`** — `internal/client/api.go:98-105` — Standard contract: `io.Reader.Read` must return `io.EOF` (or wrap it) when no more data. Returning `fmt.Errorf("EOF")` breaks `io.Copy`, `io.ReadAll`, `bufio.Scanner`, and the standard library loop in `cmd/app/main.go` if used. Right now only `json.NewDecoder` consumes it (which tolerates non-EOF errors), but any future reader swap (compression, SSE, gRPC) will silently truncate or panic. — **effort XS** — **impact high** (latent — easy to fix, hard to hit in test)
- **[P0] [perf] `http.Client` is a single instance with hard timeout + no circuit breaker** — `internal/client/api.go:14-24` — `Timeout: 10s`, no `Transport.MaxIdleConns`, no per-host pool tuning, no retry/backoff, no circuit breaker on `/api/notifications` (called on every Dashboard load at `cmd/app/main.go:50-57`). When `hamr-api` is degraded, this goroutine blocks 5s (its own `context.WithTimeout`) **on every notification fetch**, holding the http handler. — **effort XS** — **impact med**
- **[P1] [perf] No template caching across requests — partial** — `cmd/app/main.go:79-88` — `loadTemplates` parses once at startup (good) but there is no template-set versioning and `c.Writer` is used directly (`internal/handlers/dashboard.go:31-33`) with no buffering. If `ExecuteTemplate` errors mid-stream, the response is already partially written and Go will not unwind — clients see a torn HTML page with HTTP 200. — **effort S** — **impact med**
- **[P1] [perf] No static asset caching headers** — `cmd/app/main.go:40` (`r.Static("/static", "web/static")`) — uses Gin's `Static`, which sets no `Cache-Control`, no `ETag`, no content-hash versioning in the template (`web/templates/dashboard.html:6-7` uses CDN, local CSS in `web/static/css/` has no version param). Every Dashboard load re-downloads bootstrap, icons. — **effort XS** — **impact low**
- **[P2] [perf] Dashboard renders 13 tiles from hardcoded slice — no DB cache** — `internal/tiles/tiles.go:17-33` — acceptable for v0.1, but `tiles.ByCategory()` rebuilds the map on every call, three times per request (`dashboard.go:25-27`). For a SSR app this is negligible; flag for future. — **effort XS** — **impact low**

### Security (current code path)

- **[P0] [security] Cookie-based identity with no signing/sealing** — `internal/handlers/dashboard.go:16-18` reads `c.Cookie("user_id")`, `c.Cookie("user_name")`, `c.Cookie("household_id")` as plaintext. The Handlers never verify they were issued by `hamr-account` — an attacker can set `user_id=admin; household_id=any-victim-uuid` and the SSR will render their UI under that identity in logs, but more importantly the `Authorization: Bearer` header at `cmd/app/main.go:55` is set from `c.GetHeader("Authorization")` directly — **token forwarding without integrity check** is a classic token-relay SSRF/oracle risk. — **effort S** (use signed JWT or sealed cookie) — **impact high**
- **[P0] [security] No CSRF protection on any endpoint** — `cmd/app/main.go:36-47` registers routes with only `gin.Recovery()` middleware. No CSRF token, no SameSite cookie policy, no Origin/Referer checks. Any 3rd-party site can `POST` to `/api/notifications` (currently GET, but the pattern invites future regressions). — **effort XS** — **impact med**
- **[P1] [security] No rate limiting / no middleware stack** — `cmd/app/main.go:36-37` — `gin.Recovery()` is the only global middleware. The Playwright spec `e2e/tests/06-api-gateway.spec.ts:11-19` already anticipates `X-RateLimit-*` headers "v0.2 启用后" — implying they are not present. `app.hamr.top` is exposed via Ingress (`charts/templates/deployment.yaml:33-46`); without rate limits it's an open proxy for downstream `hamr-api`. — **effort S** — **impact med**
- **[P1] [security] Secrets via env var** — `cmd/app/main.go:24-25` — `HAMR_API_URL` is fine, but there is no `OAUTH_CLIENT_SECRET`, no signing key, no per-pod secret rotation. The chart `values.yaml:13-14` doesn't expose any. — **effort XS** — **impact low**
- **[P2] [security] Template autoescape is on but `text/template` import alias is `_/html/template`** — `cmd/app/main.go:7` — `template` is imported from `html/template`, which is correct. **No XSS found** in the templates (verified `web/templates/dashboard.html`, `settings.html`). Keep this when adding more fields. — **effort XS** — **impact low**

### Reliability (current code path)

- **[P0] [reliability] Graceful shutdown only the server, not the http client** — `cmd/app/main.go:68-75` — `srv.Shutdown(ctx)` waits up to 10s, good, but `apiClient.httpClient` connections (`internal/client/api.go:14`) are never drained. With `replicaCount: 2` and rolling deploys, in-flight requests to `hamr-api` can RST during the shutdown. — **effort XS** — **impact med**
- **[P1] [reliability] `/api/notifications` returns `200` + empty `data` on partial failure** — `cmd/app/main.go:50-57` — On error the code ignores it (`notifs, _ := apiClient…`) and still responds `gin.H{"data": notifs, "ts": time.Now().Unix()}`. The UI cannot distinguish "all services healthy" from "hamr-api is down". Compare with spec `e2e/tests/04-status.spec.ts:10-14` which explicitly tests "13 services"; this endpoint lies. — **effort XS** — **impact med**
- **[P1] [reliability] Readiness probe is `/health` which is always 200** — `charts/templates/deployment.yaml:20-21` — `/health` (`cmd/app/main.go:45-47`) returns `{"status":"ok"}` immediately, regardless of template load success or `hamr-api` reachability. Pod will pass readiness while broken. — **effort XS** — **impact med**
- **[P2] [reliability] No Liveness probe at all** — `charts/templates/deployment.yaml:14-23` — readiness only, no `livenessProbe`. Combined with the above, a wedged `ExecuteTemplate` goroutine never restarts. — **effort XS** — **impact low**

### Observability (current code path)

- **[P0] [observability] Zero metrics: no `/metrics`, no Prometheus client, no OTel, no logging framework** — `cmd/app/main.go:59-66` — `log.Printf("🚀 hamr-app on :%s", port)` is the only log line. No request logging, no error counts, no upstream latency. The "smoke test" `scripts/smoke.sh:1-72` does NOT touch observability. — **effort S** (add `prometheus/client_golang`, structured `slog`, `metrics-server`) — **impact med-high** (depends on alert SLO)
- **[P0] [observability] `/health` body does not include downstream liveness** — `cmd/app/main.go:45-47` — only `status/service/version`. Kubernetes `readinessProbe` will pass even when `hamr-api` is hard-down. Should probe `hamr-api` with short timeout and report per-dependency. — **effort XS** — **impact med**
- **[P2] [observability] Version is hardcoded `"0.1.0"`** — `cmd/app/main.go:46` — never matches real Git SHA, image tag in `charts/values.yaml:3` says `latest`. Tracing incidents to a commit is impossible. — **effort XS** — **impact med**

### Testing (current code path)

- **[P0] [testing] Unit-test coverage is on Tiles only — handlers, client, main are untested** — `tests/tiles_test.go:1-49` (49 lines, 3 tests). `internal/handlers/dashboard.go`, `internal/client/api.go`, `cmd/app/main.go` have **zero** Go tests. CI `e2e.yaml` does not even run `go test ./...`. `scripts/smoke.sh:34-37` runs `gofmt -e` but never `go test`. — **effort S** — **impact high**
- **[P1] [testing] E2E CI does not build or test Go code** — `.github/workflows/e2e.yaml:14-46` — no Go setup, no `go build`, no `go vet`. The Playwright suite (`e2e/tests/*.spec.ts`) hits `https://staging.hamr.top` only; it's a smoke probe of the deployed service, not a real test of `hamr-app`. — **effort S** — **impact med**
- **[P1] [testing] E2E specs hardcode production URLs** — `e2e/tests/01-account.spec.ts:11,16`, `e2e/tests/02-mood.spec.ts:6`, etc. — `https://account.hamr.top`, `https://api.hamr.top`, `https://app.hamr.top` are not parametrized except via `BASE_URL` for the dashboard. Mixing prod URLs in CI means flakiness from unrelated services breaking the "hamr-app" pipeline. — **effort S** — **impact med**
- **[P2] [testing] No chaos / network-partition / fuzz tests** — no evidence in tree. Acceptable for v0.1 — flag for v0.2. — **effort L** — **impact low-med**

### Developer experience (DX) / build matrix / distribution

- **[P0] [dx] No `go.sum`, no lock-step dependency pinning beyond `gin v1.10.0`** — `go.mod:1-7` — 1 dep, 0 hashes. `Dockerfile:4` runs `go mod download` which will fail or fetch unsigned versions on CI without `go.sum` committed. Add `go.sum` from `go mod tidy`. — **effort XS** — **impact med**
- **[P1] [dx] No Go CI workflow** — `.github/workflows/e2e.yaml` only. There is no `go test`, no `go vet`, no `golangci-lint`, no `govulncheck`. A 1-file breakage in `internal/client/api.go` ships unnoticed. — **effort S** — **impact med**
- **[P1] [dx] No build matrix for targets (Linux/amd64, Linux/arm64, Alpine, distroless variant)** — `Dockerfile:1-13` builds only `GOOS=linux` (no GOARCH specified → amd64), no multi-arch manifest. Chart `values.yaml:3` pushes only `latest` tag. — **effort XS** — **impact low-med**
- **[P1] [dx] No release / signing / SBOM step** — no `goreleaser`, no `cosign`, no `slsa` provenance. Image `ghcr.io/hamr/app:latest` is unsigned, untagged. — **effort S** — **impact med**
- **[P2] [dx] Helm `Chart.yaml` lacks `appVersion`, `maintainers`, `keywords`, `icon`, `annotations`** — `charts/Chart.yaml:1-5` — minimal metadata. Won't affect runtime but blocks `helm hub` discoverability and linting. — **effort XS** — **impact low**
- **[P2] [dx] No OpenAPI / API contract for `/api/notifications`** — `cmd/app/main.go:50-57` — single endpoint, no schema. Spec `e2e/tests/04-status.spec.ts:10-14` expects 13 services but no JSON shape is documented. — **effort XS** — **impact low**

### Deploy (current code path)

- **[P1] [deploy] Distroless container: no shell, no debug — but no `HEALTHCHECK` either** — `Dockerfile:8-13` — distroless is great for security; however k8s `readinessProbe` is the only health gate. Container has no exec entrypoint for ad-hoc debug (acceptable trade-off but document). — **effort XS** — **impact low**
- **[P1] [deploy] No `lifecycle.preStop` hook in chart** — `charts/templates/deployment.yaml:1-24` — combined with `srv.Shutdown` only on SIGTERM, k8s rolling restarts can hit the LoadBalancer before in-flight requests drain. — **effort XS** — **impact med**
- **[P2] [deploy] No HPA / no PDB / no NetworkPolicy** — `charts/values.yaml:4-12` (`replicaCount: 2`, no autoscaling) — acceptable for v0.1, flag when traffic grows. — **effort S** — **impact low**
- **[P2] [deploy] No `ServiceAccount`, no `SecurityContext` in chart** — `charts/templates/deployment.yaml:14-23` — relies on default SA; no `runAsNonRoot: true`, no `readOnlyRootFilesystem`, no `capabilities.drop: [ALL]` at pod level. — **effort XS** — **impact med**

### P2P / mobile-native (only relevant if architecture decision is to port the proposal — flagged for completeness)

- **[P1] [p2p] Discovery mechanism unspecified** — `planning/proposals/hamr-butler-p2p-architecture-20260318.md` mentions "libp2p" but does not specify mDNS vs DHT vs bootstrap list. — **effort M** — **impact high** (post-decision)
- **[P1] [p2p] NAT traversal not specified** — proposal says "局域网内多设备同步"; if that ever extends to cross-NAT households, need STUN + TURN (or hole-punching via libp2p's relay). — **effort M** — **impact high** (post-decision)
- **[P2] [p2p] No CRDT or OT referenced** — proposal relies on SQLite per device; conflict resolution across 3-5 devices is unsolved. Yjs/Automerge/sqlite-crdt are options. — **effort L** — **impact high** (post-decision)
- **[P2] [p2p] No Ed25519 / X25519 / ChaCha20-Poly1305 code** — proposal lists these primitives but no key management, no device-pairing UX, no rotation. — **effort L** — **impact high** (post-decision)
- **[P2] [p2p] Build matrix missing for iOS/Android bindings** — no gomobile/IPC path defined. — **effort L** — **impact high** (post-decision)

---

## Top 5 recommended next actions

1. **[P0 / architecture]** **Decide the cluster's truth.** Either (a) rename "Cluster 5: hamr-app Mobile" to "Cluster 5: hamr-app Dashboard SSR" and audit it as a web service (Gateway, rate limiting, OTel, health), OR (b) commit to the P2P rewrite in `planning/proposals/hamr-butler-p2p-architecture-20260318.md` (Rust + libp2p + SQLite + Web3 DID), create a sibling repo `hamr-butler-p2p`, link from `hamr-app` via 301, and stop pretending this Go code base is mobile. Without this decision the rest of the audit is research, not engineering.

2. **[P0 / bug]** **Fix `jsonReader.Read` in `internal/client/api.go:98-105`** to return `io.EOF` (wrapped) instead of `fmt.Errorf("EOF")`. Add a Go unit test in `tests/api_test.go` that round-trips via `io.ReadAll` to lock the contract. ~15 LoC.

3. **[P0 / security]** **Replace plaintext cookie auth with sealed/signed cookies** (e.g. `gorilla/securecookie` or a JWT signed by `hamr-account`'s JWKS). Read tokens from the verified cookie in `internal/handlers/dashboard.go:16-18`, not from raw cookie values. Add CSRF middleware to `cmd/app/main.go:36`.

4. **[P0 / observability]** **Wire `/metrics` + downstream health probe.** Add `github.com/prometheus/client_golang/prometheus/promhttp`, structured `log/slog`, and a Gin middleware to log per-request status + duration + upstream latency (the `apiClient` call in `cmd/app/main.go:55`). Update `charts/templates/deployment.yaml` to mount `ServiceMonitor` and split readiness into `/readyz` (downstream-aware) vs `/livez` (process-only).

5. **[P0 / testing]** **Stand up Go CI and handler tests.** Add `.github/workflows/go.yaml` running `gofmt -l`, `go vet ./...`, `golangci-lint run`, `go test ./...`, and `govulncheck ./...`. Author at minimum: `internal/client/api_test.go` (Token forwarding, retry on 5xx, JSON round-trip with `io.ReadAll`), `internal/handlers/dashboard_test.go` (cookie parse, template failure → 500), and `cmd/app/main.go` health endpoint test. This is the cheapest way to prevent regressions in 333 LoC that ships to a public Ingress.
