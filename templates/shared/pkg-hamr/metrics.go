package hamr

import (
	"net/http"
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// Metrics holds the standard HamR service metrics. Use NewMetrics to construct.
//
// Source: 2026-06-30 Cluster 6 #5 — "12 alert rules + 4 Grafana dashboards
// assume http_requests_total{service=~"hamr-.+"} but NOTHING emits it."
//
// One Metrics instance per service; reuse across requests.
type Metrics struct {
	Service string

	HTTPRequestsTotal   *prometheus.CounterVec
	HTTPRequestDuration *prometheus.HistogramVec
	HTTPInFlight        prometheus.Gauge
}

// NewMetrics registers the standard HamR metrics with the given registry.
// Use prometheus.DefaultRegisterer in most services.
func NewMetrics(service string, reg prometheus.Registerer) *Metrics {
	factory := promauto.With(reg)
	return &Metrics{
		Service: service,
		HTTPRequestsTotal: factory.NewCounterVec(
			prometheus.CounterOpts{
				Name: "http_requests_total",
				Help: "Total HTTP requests handled, labeled by service/method/path/status.",
			},
			[]string{"service", "method", "path", "status"},
		),
		HTTPRequestDuration: factory.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "http_request_duration_seconds",
				Help:    "HTTP request latency in seconds.",
				Buckets: prometheus.DefBuckets,
			},
			[]string{"service", "method", "path"},
		),
		HTTPInFlight: factory.NewGauge(
			prometheus.GaugeOpts{
				Name: "http_in_flight_requests",
				Help: "Number of HTTP requests currently being handled.",
			},
		),
	}
}

// Middleware returns an http middleware that records metrics for every request.
// Place BEFORE auth middleware so 401/403 are counted too.
//
// Important: use the route template (e.g. "/users/:id") not the raw path,
// otherwise path cardinality explodes the metric set.
func (m *Metrics) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		m.HTTPInFlight.Inc()
		start := time.Now()

		// Capture status code
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)

		path := routeTemplate(r)
		status := strconv.Itoa(rec.status)

		m.HTTPRequestsTotal.WithLabelValues(m.Service, r.Method, path, status).Inc()
		m.HTTPRequestDuration.WithLabelValues(m.Service, r.Method, path).Observe(time.Since(start).Seconds())
		m.HTTPInFlight.Dec()
	})
}

// Handler returns an http.Handler for /metrics endpoint.
func (m *Metrics) Handler() http.Handler {
	return promhttp.Handler()
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

// routeTemplate extracts the route pattern if chi/mux/gin set one.
// Falls back to r.URL.Path (high cardinality — fix in v0.2).
func routeTemplate(r *http.Request) string {
	if t := r.Context().Value(routeKey{}); t != nil {
		if s, ok := t.(string); ok {
			return s
		}
	}
	return "unknown" // safer than raw path
}

type routeKey struct{}

// WithRoute stores the route template in context; chi middleware sets it.
// Usage with chi:
//
//	r.Use(func(next http.Handler) http.Handler {
//	    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
//	        rctx := chi.RouteContext(r.Context())
//	        tmpl := rctx.RoutePattern()
//	        ctx := context.WithValue(r.Context(), routeKey{}, tmpl)
//	        next.ServeHTTP(w, r.WithContext(ctx))
//	    })
//	})