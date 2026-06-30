package hamr

import (
	"context"
	"errors"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

// GracefulShutdown waits for SIGINT/SIGTERM, then drains the server with
// a configurable timeout. Safe to call once per process.
//
// Usage:
//
//	srv := &http.Server{Addr: ":8080", Handler: router}
//	go hamr.GracefulShutdown(srv, 25*time.Second)
//
func GracefulShutdown(srv *http.Server, drain time.Duration) {
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	sig := <-sigCh

	ctx, cancel := context.WithTimeout(context.Background(), drain)
	defer cancel()

	// best-effort: log if shutdown fails, but don't crash
	if err := srv.Shutdown(ctx); err != nil && !errors.Is(err, context.DeadlineExceeded) {
		// In real code: structured log here
		_ = err
	}
	_ = sig // referenced for clarity
}

// WaitForSignal blocks until SIGINT/SIGTERM. Returns the signal received.
// Useful when you want to do per-component cleanup before shutdown.
func WaitForSignal() os.Signal {
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	return <-sigCh
}

// NewServer builds an http.Server with sensible timeouts derived from env.
// Pass Addr/Handler from caller.
func NewServer(addr string, h http.Handler) *http.Server {
	return &http.Server{
		Addr:              addr,
		Handler:           h,
		ReadTimeout:       EnvDuration("HAMR_READ_TIMEOUT", 10*time.Second),
		WriteTimeout:      EnvDuration("HAMR_WRITE_TIMEOUT", 30*time.Second),
		IdleTimeout:       EnvDuration("HAMR_IDLE_TIMEOUT", 120*time.Second),
		ReadHeaderTimeout: EnvDuration("HAMR_READ_HEADER_TIMEOUT", 5*time.Second),
	}
}