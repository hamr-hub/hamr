# P0: hamr-app placeholder auth_middleware（整个 app 未鉴权）

**子项目**: `hamr-app` (Rust + TS fullstack)
**严重度**: P0 ship-blocker
**真实位置**: `repos/hamr-app/backend/src/middleware.rs:37-46`
**审计来源**: `.iter-skill/runs/2026-07-01/01-rust-backends.md`

## 背景

```rust
// repos/hamr-app/backend/src/middleware.rs:23-46
impl Default for Claims {
    fn default() -> Self {
        Self {
            sub: "local-device".to_string(),
            device_id: "local".to_string(),
            exp: 4070908800,
        }
    }
}

pub async fn auth_middleware(
    State(_state): State<AppState>,
    mut req: Request,
    next: Next,
) -> Result<Response, AppError> {
    // TODO Phase2: 从 Authorization 头解析并验证 DID Bearer token
    // 当前使用默认 Claims，允许局域网内所有请求通过
    req.extensions_mut().insert(Claims::default());
    Ok(next.run(req).await)
}
```

每个请求都拿到 `device_id="local"`，整个后端**等于无鉴权**。注释说"P2P 本地化架构默认信任" — 但 Phase2 DID 验证从未实现。

## 修复（最小可信）

```rust
// repos/hamr-app/backend/src/middleware.rs:37-46
use jsonwebtoken::{decode, DecodingKey, Validation};

pub async fn auth_middleware(
    State(state): State<AppState>,
    mut req: Request,
    next: Next,
) -> Result<Response, AppError> {
    // 提取 Bearer token
    let token = req
        .headers()
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or_else(|| AppError::Unauthorized("missing bearer token".into()))?;

    // 验证 JWT
    let claims = decode::<Claims>(
        token,
        &DecodingKey::from_secret(state.config.jwt_secret.as_bytes()),
        &Validation::default(),
    )
    .map_err(|_| AppError::Unauthorized("invalid token".into()))?
    .claims;

    req.extensions_mut().insert(claims);
    Ok(next.run(req).await)
}
```

需要在 `config.rs` 加 `jwt_secret: String`（从 env 读）。

## 验证

```bash
# 1. 缺 token → 401
curl -i http://localhost:8080/api/dashboard
# 期望: 401

# 2. 错 token → 401
curl -i -H 'Authorization: Bearer wrong' http://localhost:8080/api/dashboard
# 期望: 401

# 3. 对 token → 200 + claims 正确
TOKEN=$(/path/to/get-token)
curl -i -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/dashboard
# 期望: 200

# 4. 单元测试
cargo test --package hamr-app-backend auth_middleware
```

## 单元测试

```rust
#[tokio::test]
async fn test_auth_middleware_no_token() {
    let req = Request::new(Body::empty());
    let res = auth_middleware(State(test_state()), req, mock_next()).await;
    assert!(matches!(res, Err(AppError::Unauthorized(_))));
}

#[tokio::test]
async fn test_auth_middleware_valid_token() {
    let token = issue_test_token("user-1", &test_jwt_secret());
    let req = Request::builder()
        .header("authorization", format!("Bearer {}", token))
        .body(Body::empty())
        .unwrap();
    let res = auth_middleware(State(test_state()), req, mock_next()).await;
    assert!(res.is_ok());
}
```

## 回退

如果实施周期长，加 strict toggle：
```rust
HAMR_APP_AUTH_MODE=strict   # 新行为
HAMR_APP_AUTH_MODE=open     # 旧 placeholder
```
**默认应是 strict**。