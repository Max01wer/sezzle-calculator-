package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCORS(t *testing.T) {
	const allowedOrigin = "http://localhost:5173"

	// Downstream handler that marks it was reached.
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusTeapot)
	})
	h := CORS([]string{allowedOrigin, " ", "http://localhost:3000"})(next)

	tests := []struct {
		name          string
		method        string
		origin        string
		preflight     bool
		wantStatus    int
		wantAllowOrig string
	}{
		{name: "allowed origin simple request", method: http.MethodPost, origin: allowedOrigin, wantStatus: http.StatusTeapot, wantAllowOrig: allowedOrigin},
		{name: "disallowed origin simple request", method: http.MethodPost, origin: "http://evil.com", wantStatus: http.StatusTeapot, wantAllowOrig: ""},
		{name: "no origin (curl, server-to-server)", method: http.MethodGet, wantStatus: http.StatusTeapot, wantAllowOrig: ""},
		{name: "allowed preflight", method: http.MethodOptions, origin: allowedOrigin, preflight: true, wantStatus: http.StatusNoContent, wantAllowOrig: allowedOrigin},
		{name: "disallowed preflight", method: http.MethodOptions, origin: "http://evil.com", preflight: true, wantStatus: http.StatusForbidden, wantAllowOrig: ""},
		{name: "plain OPTIONS is passed through", method: http.MethodOptions, origin: allowedOrigin, wantStatus: http.StatusTeapot, wantAllowOrig: allowedOrigin},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(tc.method, "/api/v1/calculate", nil)
			if tc.origin != "" {
				req.Header.Set("Origin", tc.origin)
			}
			if tc.preflight {
				req.Header.Set("Access-Control-Request-Method", http.MethodPost)
			}
			rec := httptest.NewRecorder()

			h.ServeHTTP(rec, req)

			if rec.Code != tc.wantStatus {
				t.Errorf("status = %d, want %d", rec.Code, tc.wantStatus)
			}
			if got := rec.Header().Get("Access-Control-Allow-Origin"); got != tc.wantAllowOrig {
				t.Errorf("Allow-Origin = %q, want %q", got, tc.wantAllowOrig)
			}
			if tc.wantStatus == http.StatusNoContent {
				if rec.Header().Get("Access-Control-Allow-Methods") == "" {
					t.Error("preflight must set Access-Control-Allow-Methods")
				}
				if rec.Header().Get("Access-Control-Allow-Headers") == "" {
					t.Error("preflight must set Access-Control-Allow-Headers")
				}
			}
		})
	}
}
