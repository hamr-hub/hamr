# P0: hamr-account refresh_token bcrypt-on-100-rows DoS

**子项目**: `hamr-account` (Rust axum)
**严重度**: P0 ship-blocker (DoS)
**真实位置**: `repos/hamr-account/backend/src/handlers/auth.rs:90-100` 和 `:127-141`
**审计来源**: `.iter-skill/runs/2026-07-01/01-rust-backends.md`

## 背景

```rust
// repos/hamr-account/backend/src/handlers/auth.rs:90-100
let tokens = sqlx::query_as::<_, crate::models::RefreshToken>(
    "SELECT * FROM refresh_tokens WHERE revoked = false AND expires_at > NOW() LIMIT 100",
)
.fetch_all(&state.db)
.await?;

let matched = tokens
    .into_iter()
    .find(|t| verify(&req.refresh_token, &t.token_hash).unwrap_or(false));
```

每请求 bcrypt-verify 最多 100 个 token hash。bcrypt 默认 cost 12 ≈ 250ms / verify。**最坏情况：100 × 250ms = 25 秒** / 请求。

攻击者 1 个并发请求就能让 worker 卡 25 秒；10 个并发 = 250 秒 CPU 占用。极简 DoS。

## 修复

### 1. refresh_token 表加 SHA-256 indexed 列

```sql
-- migrations/20260701000001_add_token_hash_sha.sql
ALTER TABLE refresh_tokens ADD COLUMN token_sha256 CHAR(64) NOT NULL DEFAULT '';
CREATE INDEX idx_refresh_tokens_sha ON refresh_tokens(token_sha256) WHERE revoked = false AND expires_at > NOW();
```

### 2. Issue token 时写 sha256

```rust
// repos/hamr-account/backend/src/handlers/auth.rs (修改 generate_auth_response)
use sha2::{Sha256, Digest};

fn issue_refresh_token() -> (String, RefreshTokenRecord) {
    let raw = uuid::Uuid::new_v4().to_string();
    let sha = {
        let mut h = Sha256::new();
        h.update(raw.as_bytes());
        format!("{:x}", h.finalize())
    };
    (raw, RefreshTokenRecord { token_sha256: sha, .. })
}
```

### 3. refresh 端点用 sha256 索引

```rust
pub async fn refresh_token(
    State(state): State<AppState>,
    Json(req): Json<RefreshTokenRequest>,
) -> AppResult<Json<AuthResponse>> {
    if req.refresh_token.is_empty() {
        return Err(AppError::Unauthorized);
    }

    let sha = {
        let mut h = Sha256::new();
        h.update(req.refresh_token.as_bytes());
        format!("{:x}", h.finalize())
    };

    let token_record = sqlx::query_as::<_, RefreshToken>(
        "SELECT * FROM refresh_tokens WHERE token_sha256 = $1 AND revoked = false AND expires_at > NOW() LIMIT 1",
    )
    .bind(&sha)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::Unauthorized)?;

    // 然后再 verify bcrypt 作为防御深度（sha256 已找到，但保留 bcrypt 验证）
    // 可选：完全省掉 bcrypt verify（sha256 已是 secret）
    // 推荐：保留 bcrypt 但仅 1 次（O(1) lookup）
    let valid = bcrypt::verify(&req.refresh_token, &token_record.token_hash)?;
    if !valid {
        return Err(AppError::Unauthorized);
    }

    // ... 颁发新 token
}
```

## 验证

```bash
# 1. EXPLAIN 看索引生效
psql -c "EXPLAIN SELECT * FROM refresh_tokens WHERE token_sha256 = 'abc...' AND revoked = false AND expires_at > NOW();"
# 期望: Index Scan using idx_refresh_tokens_sha

# 2. perf: 老代码 100 token = 25s，新代码 1 token = 0.3s
cargo bench --bench auth_bench
```

```rust
#[tokio::test]
async fn test_refresh_token_uses_sha_lookup() {
    let state = test_state().await;
    let user = create_test_user(&state.db).await;
    let (raw_token, _) = issue_refresh_token(&state, user.id).await;

    let start = std::time::Instant::now();
    let res = refresh_token(State(state), Json(RefreshTokenRequest {
        refresh_token: raw_token.clone(),
    })).await;
    let elapsed = start.elapsed();

    assert!(res.is_ok());
    assert!(elapsed.as_secs() < 1, "took too long: {:?}", elapsed);
}

#[tokio::test]
async fn test_refresh_token_100_seed_users_still_fast() {
    // 100 个用户 refresh_token 数据库里有 100 行
    for i in 0..100 { seed_refresh_token(&state, format!("user-{}", i)).await; }
    
    let start = std::time::Instant::now();
    let res = refresh_token(State(state.clone()), Json(RefreshTokenRequest {
        refresh_token: "user-50".into(),
    })).await;
    let elapsed = start.elapsed();
    
    assert!(res.is_ok());
    assert!(elapsed.as_millis() < 500);  // sha lookup + 1 bcrypt verify
}
```

## 关联

- P0 #01 (hamr-app placeholder auth) — 同 service 但不同 file
- cluster 1 round 1 P0-4 (auth stub) — 错的；真问题是 refresh_token DoS