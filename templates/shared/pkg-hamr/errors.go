package hamr

import (
	"encoding/json"
	"net/http"
)

// ErrorEnvelope is the unified JSON error response for all HamR APIs.
// Avoids the gin-default plain text + random status strings problem.
//
// Source: 2026-06-30 Cluster 3 — hamr-api/internal/middleware/errors.go
//         reimplements this 3 times in slightly different shapes.
type ErrorEnvelope struct {
	Code      string         `json:"code"`                 // machine-readable: "auth.invalid_credentials"
	Message   string         `json:"message"`              // human-readable, safe to display
	RequestID string         `json:"request_id,omitempty"` // trace correlation
	Details   map[string]any `json:"details,omitempty"`    // field-level errors etc.
	HTTPStatus int           `json:"-"`                    // not serialized; used by WriteError
}

// WriteError writes a structured JSON error response.
// Status code comes from the envelope's HTTPStatus field.
func WriteError(w http.ResponseWriter, env ErrorEnvelope) {
	if env.HTTPStatus == 0 {
		env.HTTPStatus = http.StatusInternalServerError
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(env.HTTPStatus)
	_ = json.NewEncoder(w).Encode(env)
}

// Common errors (reusable across services).
var (
	ErrUnauthorized = ErrorEnvelope{
		Code:       "auth.unauthorized",
		Message:    "Authentication required",
		HTTPStatus: http.StatusUnauthorized,
	}
	ErrForbidden = ErrorEnvelope{
		Code:       "auth.forbidden",
		Message:    "Permission denied",
		HTTPStatus: http.StatusForbidden,
	}
	ErrNotFound = ErrorEnvelope{
		Code:       "resource.not_found",
		Message:    "Resource not found",
		HTTPStatus: http.StatusNotFound,
	}
	ErrBadRequest = ErrorEnvelope{
		Code:       "request.bad_input",
		Message:    "Invalid request",
		HTTPStatus: http.StatusBadRequest,
	}
	ErrInternal = ErrorEnvelope{
		Code:       "internal.error",
		Message:    "Internal server error",
		HTTPStatus: http.StatusInternalServerError,
	}
)

// NewError builds an envelope with a code, message, and optional httpStatus override.
// Pass 0 for status to use the default (500).
func NewError(code, message string, httpStatus int) ErrorEnvelope {
	return ErrorEnvelope{
		Code:       code,
		Message:    message,
		HTTPStatus: httpStatus,
	}
}