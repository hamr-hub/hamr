# P0: hamr-api CORS AllowOrigin::Any（public gateway）

**子项目**: `hamr-api` (Rust axum 0.7 gateway)
**严重度**: P0 ship-blocker
**真实位置**: `repos/hamr-api/src/main.rs:29-32`
**审计来源**: `.iter-skill/runs/2026-07-01/01-rust-backends.md`

## 背景

```rust
// repos/hamr-api/src/main.rs:29-32
let cors = CorsLayer::new()
    .allow_origin(Any)
    .allow_methods(Any)
    .allow_headers(Any);
```

`Any` 通配所有 origin。作为 public API gateway，任意网站可代其用户调 API。

注：round 1 误以为"\* + Allow-Credentials" — 实际是 `Any` 无 credentials。但仍是 P0。

## 修复

```rust
// repos/hamr-api/src/main.rs
use axum::http::HeaderValue;
use tower_http::cors::AllowOrigin;

let allowed_origins: Vec<String> = std::env::var("HAMR_ALLOWED_ORIGINS")
    .unwrap_or_default()
    .split(',')
    .map(|s| s.trim().to_string())
    .filter(|s| !s.is_empty())
    .collect();

let allow_origin = if allowed_origins.is_empty() {
    // 默认 deny all — 无配置就拒绝跨域
    return Err(anyhow::anyhow!("HAMR_ALLOWED_ORIGINS not set"));
} else {
    AllowOrigin::list(allowed_origins.iter().map(|o| {
        o.parse::<HeaderValue>().expect("invalid origin in HAMR_ALLOWED_ORIGINS")
    }))
};

let cors = CorsLayer::new()
    .allow_origin(allow_origin)
    .allow_methods([Method::GET, Method::POST, Method::PUT, Method::PATCH, Method::DELETE, Method::OPTIONS])
    .allow_headers([header::AUTHORIZATION, header::CONTENT_TYPE, HeaderName::from_static("x-hamr-household-id"), HeaderName::from_static("x-request-id")])
    .max_age(Duration::from_secs(600));
```

## 验证

```bash
# 1. 允许 origin → ACAO echo back
curl -i -H 'Origin: https://app.hamr.top' http://localhost:8090/healthz
# 期望: Access-Control-Allow-Origin: https://app.hamr.top

# 2. 未允许 origin → 没有 ACAO
curl -i -H 'Origin: https://evil.com' http://localhost:8090/healthz
# 期望: 没有 ACAO 头 → 浏览器拦截

# 3. 预检 OPTIONS
curl -i -X OPTIONS -H 'Origin: https://app.hamr.top' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: Authorization' \
  http://localhost:8090/api/v1/profile
# 期望: 204 + 完整 CORS 头 + 限制的方法/header
```

## 不要

- ❌ 别用正则匹配 origin（subdomain 劫持风险）
- ❌ 别写 `Any` 即使不带 credentials
- ❌ 别在 prod 留 `*`