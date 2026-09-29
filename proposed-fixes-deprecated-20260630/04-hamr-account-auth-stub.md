# P0-4: hamr-account 鉴权永远 200 OK（最严重信任缺陷）

**子项目**: `hamr-account`
**严重度**: P0 ship-blocker (Cluster 3)
**审计来源**: `.iter-skill/runs/2026-06-30/03-go-core-services.md` Top 1
**当前状态**: 任何人都能"登录"任何账号 — 家庭产品致命缺陷

## 背景

`hamr-account/cmd/login-app/main.go:146-174`：

```go
// TODO: implement
func handleLogin(w http.ResponseWriter, r *http.Request) {
    w.WriteHeader(http.StatusOK)
    w.Write([]byte(`{"status":"ok"}`))
}

func handleRegister(w http.ResponseWriter, r *http.Request) {
    w.WriteHeader(http.StatusOK)
    w.Write([]byte(`{"status":"ok"}`))
}

func handle2FA(w http.ResponseWriter, r *http.Request) {
    w.WriteHeader(http.StatusOK)
    w.Write([]byte(`{"status":"ok"}`))
}
```

## 修复方案

### 最小可信实现（应急）

```go
func handleLogin(w http.ResponseWriter, r *http.Request) {
    var req struct {
        Username string `json:"username"`
        Password string `json:"password"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        hamr.WriteError(w, hamr.NewError("request.bad_input", err.Error(), 400))
        return
    }

    // 1. 取 user
    user, err := store.GetUserByUsername(r.Context(), req.Username)
    if err != nil {
        // 故意模糊 — 不告诉攻击者"用户不存在"还是"密码错"
        hamr.WriteError(w, hamr.ErrUnauthorized)
        return
    }

    // 2. 验证密码（用 argon2id）
    ok, err := auth.VerifyPassword(req.Password, user.PasswordHash)
    if err != nil || !ok {
        hamr.WriteError(w, hamr.ErrUnauthorized)
        return
    }

    // 3. 签发 JWT
    token, err := auth.IssueToken(user.ID, jwtTTL)
    if err != nil {
        hamr.WriteError(w, hamr.ErrInternal)
        return
    }

    // 4. 返回 token + Set-Cookie (HttpOnly, Secure, SameSite=Lax)
    http.SetCookie(w, &http.Cookie{
        Name:     "hamr_session",
        Value:    token,
        Path:     "/",
        HttpOnly: true,
        Secure:   true,
        SameSite: http.SameSiteLaxMode,
        MaxAge:   int(jwtTTL.Seconds()),
    })
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]any{
        "user_id": user.ID,
        "expires_at": time.Now().Add(jwtTTL),
    })
}
```

### 注册

```go
func handleRegister(w http.ResponseWriter, r *http.Request) {
    var req struct {
        Username string `json:"username"`
        Password string `json:"password"`
        Email    string `json:"email"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        hamr.WriteError(w, hamr.NewError("request.bad_input", err.Error(), 400))
        return
    }

    // 1. 校验
    if err := auth.ValidateUsername(req.Username); err != nil {
        hamr.WriteError(w, hamr.NewError("auth.invalid_username", err.Error(), 400))
        return
    }
    if err := auth.ValidatePasswordStrength(req.Password); err != nil {
        hamr.WriteError(w, hamr.NewError("auth.weak_password", err.Error(), 400))
        return
    }

    // 2. 检查用户是否存在
    exists, err := store.UserExists(r.Context(), req.Username, req.Email)
    if err != nil {
        hamr.WriteError(w, hamr.ErrInternal)
        return
    }
    if exists {
        hamr.WriteError(w, hamr.NewError("auth.user_exists", "user already exists", 409))
        return
    }

    // 3. 创建
    hash, err := auth.HashPassword(req.Password)
    if err != nil {
        hamr.WriteError(w, hamr.ErrInternal)
        return
    }
    user, err := store.CreateUser(r.Context(), req.Username, req.Email, hash)
    if err != nil {
        hamr.WriteError(w, hamr.ErrInternal)
        return
    }

    w.WriteHeader(http.StatusCreated)
    json.NewEncoder(w).Encode(map[string]any{"user_id": user.ID})
}
```

### 2FA

最小实现：TOTP（RFC 6238）。详见 `auth/totp.go`。

```go
func handle2FA(w http.ResponseWriter, r *http.Request) {
    var req struct {
        UserID string `json:"user_id"`
        Code   string `json:"code"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        hamr.WriteError(w, hamr.NewError("request.bad_input", err.Error(), 400))
        return
    }

    secret, err := store.GetTOTPSecret(r.Context(), req.UserID)
    if err != nil {
        hamr.WriteError(w, hamr.ErrUnauthorized)
        return
    }
    if !totp.Verify(req.Code, secret) {
        hamr.WriteError(w, hamr.NewError("auth.invalid_2fa", "invalid 2FA code", 401))
        return
    }

    // 颁发 elevated token
    token, _ := auth.IssueElevatedToken(req.UserID, 5*time.Minute)
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]any{"token": token})
}
```

## 验证

```bash
# 1. 注册新用户
curl -X POST http://localhost:8080/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"Hunter2!","email":"a@x.com"}'
# 期望: 201 + {"user_id":"..."}

# 2. 登录
curl -X POST http://localhost:8080/login \
  -H 'Content-Type: application/json' \
  -c cookies.txt \
  -d '{"username":"alice","password":"Hunter2!"}'
# 期望: 200 + Set-Cookie: hamr_session=...

# 3. 错误密码
curl -X POST http://localhost:8080/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"wrong"}'
# 期望: 401 + {"code":"auth.unauthorized",...}

# 4. 不存在用户
curl -X POST http://localhost:8080/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"nobody","password":"x"}'
# 期望: 401 + 同上（不区分）
```

## 单元测试

```go
func TestHandleLogin_StubGone(t *testing.T) {
    s := setupTestServer(t)
    defer s.Close()

    // 旧 stub 行为：永远 200
    // 新行为：缺字段 → 400
    resp, err := http.Post(s.URL+"/login", "application/json", strings.NewReader(`{}`))
    require.NoError(t, err)
    assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}
```

## 回退

如果实施周期长：
1. 临时在 hamr-api 加 IP 白名单中间件
2. 在 hamr-account 前加 nginx basic auth
3. 在登录页强制提示"功能开发中，暂未开放"

但**不要**长期 ship 任何人都能登的版本。