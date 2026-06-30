// Package hamr provides shared utilities for HamR Go services.
//
// Source: 2026-06-30 Cluster 3/4/5 deep-research — recommended extracting
//         duplicated env loading / graceful shutdown / JSON error envelope /
//         Prometheus middleware from 6 Go services into a shared package.
//
// Usage in subprojects:
//
//   import (
//       "github.com/hamr-hub/hamr-go/pkg/hamr"
//   )
//
//   cfg := hamr.MustEnv("PORT")           // panics if missing
//   port := hamr.EnvInt("PORT", 8080)      // with default
//   srv := hamr.NewServer(cfg, router)    // graceful shutdown + /healthz
//
// Future: vendored as `pkg/hamr` once hamr-infra/go-modules/ is set up.
package hamr

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

// MustEnv returns the value of the env var or panics.
// Use for required config (DB URL, AUTH TOKEN, etc.).
func MustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		panic(fmt.Sprintf("hamr: required env var %s is not set", key))
	}
	return v
}

// Env returns the value of the env var or defaultVal if empty.
func Env(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}

// EnvInt parses an int env var with default.
func EnvInt(key string, defaultVal int) int {
	v := os.Getenv(key)
	if v == "" {
		return defaultVal
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		panic(fmt.Sprintf("hamr: env %s must be int, got %q", key, v))
	}
	return n
}

// EnvDuration parses a time.Duration env var with default (e.g. "30s", "5m").
func EnvDuration(key string, defaultVal time.Duration) time.Duration {
	v := os.Getenv(key)
	if v == "" {
		return defaultVal
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		panic(fmt.Sprintf("hamr: env %s must be duration, got %q", key, v))
	}
	return d
}

// EnvBool parses a bool env var with default ("1", "true", "yes" → true).
func EnvBool(key string, defaultVal bool) bool {
	v := strings.ToLower(os.Getenv(key))
	switch v {
	case "1", "true", "yes", "on":
		return true
	case "0", "false", "no", "off":
		return false
	case "":
		return defaultVal
	default:
		panic(fmt.Sprintf("hamr: env %s must be bool, got %q", key, v))
	}
}

// RedactURL masks user:pass in URLs for safe logging.
// e.g. "https://user:secret@host/db" → "https://user:***@host/db"
func RedactURL(raw string) string {
	at := strings.LastIndex(raw, "@")
	scheme := strings.Index(raw, "://")
	if at == -1 || scheme == -1 || at < scheme {
		return raw
	}
	creds := raw[scheme+3 : at]
	colon := strings.Index(creds, ":")
	if colon == -1 {
		return raw
	}
	return raw[:scheme+3] + creds[:colon] + ":***" + raw[at:]
}