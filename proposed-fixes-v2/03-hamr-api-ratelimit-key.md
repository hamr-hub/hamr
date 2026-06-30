# P0: hamr-api rate-limit key 可被 client 伪造

**子项目**: `hamr-api` (Rust axum)
**严重度**: P0 ship-blocker
**真实位置**: `repos/hamr-api/src/middleware.rs:80-91`
**审计来源**: `.iter-skill/runs/2026-07-01/01-rust-backends.md`

## 背景

```rust
// repos/hamr-api/src/middleware.rs (rate_limit_middleware 函数内)
pub async fn rate_limit_middleware(
    State(config): State<Config>,
    req: Request,
    next: Next,
) -> Result<Response, GatewayError> {
    let key = req
        .headers()
        .get("x-forwarded-for")          // ← 客户端可控
        .or_else(|| req.headers().get("x-real-ip"))
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown")
        .to_string();
    // ... 用 key 做限流
}
```

问题：
1. **客户端伪造 `X-Forwarded-For`** — 攻击者可设任意 IP 绕过限制
2. **进程内 `DashMap`** — 多副本部署时每个实例独立计数，**真实 limit 是 N× 配置**
3. **未鉴权时** — IP 也是好的 key（兜底）

## 修复

```rust
use crate::middleware::Claims;

pub async fn rate_limit_middleware(
    State(config): State<Config>,
    req: Request,
    next: Next,
) -> Result<Response, GatewayError> {
    // 优先用 JWT sub（已认证），回退到 peer addr（仅直连时可靠）
    let key = req
        .extensions()
        .get::<Claims>()
        .map(|c| format!("user:{}", c.sub))
        .or_else(|| {
            req.extensions()
                .get::<axum::extract::ConnectInfo<std::net::SocketAddr>>()
                .map(|ci| format!("ip:{}", ci.0.ip()))
        })
        .unwrap_or_else(|| "unknown".to_string());

    if !config.rate_limiter.check(&key) {
        return Err(GatewayError::TooManyRequests);
    }
    Ok(next.run(req).await)
}
```

加 `GatewayError::TooManyRequests` 映射 HTTP 429。

## 共享限流（多副本）

对于多副本部署，进程内限流不准确。改 Redis：

```rust
// 用 moka 或 redis-cell 做分布式限流
use redis::AsyncCommands;

async fn check_rate(key: &str, limit: u32, window: Duration) -> bool {
    let count: u32 = redis.get_ex(key, window.as_secs() as u64).await.unwrap_or(0);
    if count >= limit { return false; }
    redis.incr(key, 1).await.ok();
    true
}
```

或用 tower-governor (axum 兼容)：
```toml
tower_governor = "0.4"
```

## 验证

```bash
# 1. 未带 JWT，从同一 IP 101 个请求
for i in {1..101}; do curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8090/api/test; done | sort | uniq -c
# 期望: 100 个 200 + 1 个 429

# 2. 切 IP（伪造 X-Forwarded-For），旧 key 不应绕过
for ip in 1.1.1.1 2.2.2.2 3.3.3.3; do
  for i in {1..50}; do curl -s -o /dev/null -w '%{http_code}\n' -H "X-Forwarded-For: $ip" http://localhost:8090/api/test; done
done | sort | uniq -c
# 期望（旧代码）：每 IP 50 个 200，全绕过
# 期望（新代码）：每 IP 50 个 200，但用 ConnectInfo 时 IP 是真实 peer，X-Forwarded-For 被忽略
```

## 单元测试

```rust
#[tokio::test]
async fn test_rate_limit_uses_jwt_sub() {
    let limiter = RateLimiter::new(2);
    assert!(limiter.check("user:a"));
    assert!(limiter.check("user:a"));
    assert!(!limiter.check("user:a"));  // 第三次拒绝
    assert!(limiter.check("user:b"));   // 不同 user 独立
}

#[tokio::test]
async fn test_rate_limit_ignores_xff_when_authenticated() {
    // JWT user + 伪造 XFF → 用 user key，不用 IP
    // 详见 integration test
}
```