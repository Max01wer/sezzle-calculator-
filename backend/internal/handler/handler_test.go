package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/jmllanos/sezzle-calculator/backend/internal/calculator"
	"github.com/jmllanos/sezzle-calculator/backend/internal/model"
)

// newTestServer wires the real service so these tests exercise the full
// HTTP -> handler -> service path (lightweight integration tests).
func newTestServer() http.Handler {
	return New(calculator.NewService()).Routes()
}

func TestCalculate(t *testing.T) {
	tests := []struct {
		name        string
		body        string
		contentType string // defaults to application/json
		wantStatus  int
		wantResult  float64 // checked only on 200
		wantCode    string  // checked only on errors
	}{
		// --- Success (200) ---
		{name: "add", body: `{"operation":"add","a":2,"b":3}`, wantStatus: http.StatusOK, wantResult: 5},
		{name: "subtract", body: `{"operation":"subtract","a":2,"b":3}`, wantStatus: http.StatusOK, wantResult: -1},
		{name: "multiply", body: `{"operation":"multiply","a":2.5,"b":4}`, wantStatus: http.StatusOK, wantResult: 10},
		{name: "divide", body: `{"operation":"divide","a":9,"b":3}`, wantStatus: http.StatusOK, wantResult: 3},
		{name: "power", body: `{"operation":"power","a":2,"b":8}`, wantStatus: http.StatusOK, wantResult: 256},
		{name: "sqrt without b", body: `{"operation":"sqrt","a":81}`, wantStatus: http.StatusOK, wantResult: 9},
		{name: "percentage", body: `{"operation":"percentage","a":10,"b":50}`, wantStatus: http.StatusOK, wantResult: 5},
		{name: "zero is a valid operand", body: `{"operation":"add","a":0,"b":0}`, wantStatus: http.StatusOK, wantResult: 0},
		{name: "operation is case-insensitive", body: `{"operation":" ADD ","a":1,"b":1}`, wantStatus: http.StatusOK, wantResult: 2},
		{name: "content-type with charset", body: `{"operation":"add","a":1,"b":1}`, contentType: "application/json; charset=utf-8", wantStatus: http.StatusOK, wantResult: 2},

		// --- Domain errors (400) ---
		{name: "division by zero", body: `{"operation":"divide","a":1,"b":0}`, wantStatus: http.StatusBadRequest, wantCode: CodeDivisionByZero},
		{name: "sqrt of negative", body: `{"operation":"sqrt","a":-9}`, wantStatus: http.StatusBadRequest, wantCode: CodeNegativeSquareRoot},
		{name: "overflow", body: `{"operation":"power","a":10,"b":400}`, wantStatus: http.StatusBadRequest, wantCode: CodeOverflow},
		{name: "undefined result", body: `{"operation":"power","a":-8,"b":0.5}`, wantStatus: http.StatusBadRequest, wantCode: CodeUndefinedResult},

		// --- Input validation errors (400) ---
		{name: "empty body", body: ``, wantStatus: http.StatusBadRequest, wantCode: CodeInvalidJSON},
		{name: "malformed JSON", body: `{"operation":"add",`, wantStatus: http.StatusBadRequest, wantCode: CodeInvalidJSON},
		{name: "invalid JSON syntax", body: `{operation:add}`, wantStatus: http.StatusBadRequest, wantCode: CodeInvalidJSON},
		{name: "non-numeric a", body: `{"operation":"add","a":"abc","b":1}`, wantStatus: http.StatusBadRequest, wantCode: CodeInvalidOperand},
		{name: "numeric string b", body: `{"operation":"add","a":1,"b":"2"}`, wantStatus: http.StatusBadRequest, wantCode: CodeInvalidOperand},
		{name: "boolean operand", body: `{"operation":"add","a":true,"b":1}`, wantStatus: http.StatusBadRequest, wantCode: CodeInvalidOperand},
		{name: "operand exceeds float64", body: `{"operation":"add","a":1e400,"b":1}`, wantStatus: http.StatusBadRequest, wantCode: CodeInvalidOperand},
		{name: "operation wrong type", body: `{"operation":5,"a":1,"b":1}`, wantStatus: http.StatusBadRequest, wantCode: CodeInvalidJSON},
		{name: "missing a", body: `{"operation":"add","b":1}`, wantStatus: http.StatusBadRequest, wantCode: CodeMissingOperand},
		{name: "null a", body: `{"operation":"add","a":null,"b":1}`, wantStatus: http.StatusBadRequest, wantCode: CodeMissingOperand},
		{name: "missing b on binary op", body: `{"operation":"divide","a":1}`, wantStatus: http.StatusBadRequest, wantCode: CodeMissingOperand},
		{name: "missing operation", body: `{"a":1,"b":2}`, wantStatus: http.StatusBadRequest, wantCode: CodeUnsupportedOp},
		{name: "unsupported operation", body: `{"operation":"modulo","a":1,"b":2}`, wantStatus: http.StatusBadRequest, wantCode: CodeUnsupportedOp},
		{name: "unknown field", body: `{"operation":"add","a":1,"b":2,"c":3}`, wantStatus: http.StatusBadRequest, wantCode: CodeInvalidJSON},
		{name: "multiple JSON objects", body: `{"operation":"add","a":1,"b":2}{"a":1}`, wantStatus: http.StatusBadRequest, wantCode: CodeInvalidJSON},
		{name: "body too large", body: `{"operation":"add","a":1,"b":2,"x":"` + strings.Repeat("x", 2048) + `"}`, wantStatus: http.StatusBadRequest, wantCode: CodeInvalidJSON},

		// --- Content-Type (415) ---
		{name: "wrong content type", body: `{"operation":"add","a":1,"b":2}`, contentType: "text/plain", wantStatus: http.StatusUnsupportedMediaType, wantCode: CodeUnsupportedMedia},
	}

	srv := newTestServer()

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/api/v1/calculate", strings.NewReader(tc.body))
			ct := tc.contentType
			if ct == "" {
				ct = "application/json"
			}
			req.Header.Set("Content-Type", ct)
			rec := httptest.NewRecorder()

			srv.ServeHTTP(rec, req)

			if rec.Code != tc.wantStatus {
				t.Fatalf("status = %d, want %d (body: %s)", rec.Code, tc.wantStatus, rec.Body.String())
			}
			if got := rec.Header().Get("Content-Type"); got != "application/json" {
				t.Errorf("Content-Type = %q, want application/json", got)
			}

			if tc.wantStatus == http.StatusOK {
				var resp model.CalculateResponse
				if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
					t.Fatalf("invalid success body: %v", err)
				}
				if resp.Result != tc.wantResult {
					t.Errorf("result = %v, want %v", resp.Result, tc.wantResult)
				}
				return
			}

			var errResp model.ErrorResponse
			if err := json.Unmarshal(rec.Body.Bytes(), &errResp); err != nil {
				t.Fatalf("invalid error body: %v", err)
			}
			if errResp.Error.Code != tc.wantCode {
				t.Errorf("error code = %q, want %q", errResp.Error.Code, tc.wantCode)
			}
			if errResp.Error.Message == "" {
				t.Error("error message should not be empty")
			}
		})
	}
}

func TestCalculate_ResponseShape(t *testing.T) {
	srv := newTestServer()

	t.Run("binary operation echoes b", func(t *testing.T) {
		rec := post(srv, `{"operation":"add","a":1,"b":2}`)
		want := `{"operation":"add","a":1,"b":2,"result":3}`
		if got := strings.TrimSpace(rec.Body.String()); got != want {
			t.Errorf("body = %s, want %s", got, want)
		}
	})

	t.Run("unary operation omits b even if sent", func(t *testing.T) {
		rec := post(srv, `{"operation":"sqrt","a":4,"b":100}`)
		want := `{"operation":"sqrt","a":4,"result":2}`
		if got := strings.TrimSpace(rec.Body.String()); got != want {
			t.Errorf("body = %s, want %s", got, want)
		}
	})
}

// fakeCalculator lets us force errors the real service never returns.
type fakeCalculator struct{ err error }

func (f fakeCalculator) Calculate(calculator.Operation, float64, float64) (float64, error) {
	return 0, f.err
}

func TestCalculate_UnexpectedErrorIsHidden(t *testing.T) {
	srv := New(fakeCalculator{err: errors.New("db password leaked")}).Routes()
	rec := post(srv, `{"operation":"add","a":1,"b":2}`)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", rec.Code)
	}
	if strings.Contains(rec.Body.String(), "leaked") {
		t.Error("internal error details must not be exposed to clients")
	}
}

func TestRouting(t *testing.T) {
	tests := []struct {
		name       string
		method     string
		path       string
		wantStatus int
	}{
		{name: "health ok", method: http.MethodGet, path: "/health", wantStatus: http.StatusOK},
		{name: "GET calculate not allowed", method: http.MethodGet, path: "/api/v1/calculate", wantStatus: http.StatusMethodNotAllowed},
		{name: "unknown route", method: http.MethodGet, path: "/nope", wantStatus: http.StatusNotFound},
	}

	srv := newTestServer()
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			srv.ServeHTTP(rec, httptest.NewRequest(tc.method, tc.path, nil))
			if rec.Code != tc.wantStatus {
				t.Errorf("status = %d, want %d", rec.Code, tc.wantStatus)
			}
		})
	}
}

func TestMapDomainError(t *testing.T) {
	tests := []struct {
		err        error
		wantStatus int
		wantCode   string
	}{
		{calculator.ErrDivisionByZero, http.StatusBadRequest, CodeDivisionByZero},
		{calculator.ErrNegativeSquareRoot, http.StatusBadRequest, CodeNegativeSquareRoot},
		{calculator.ErrOverflow, http.StatusBadRequest, CodeOverflow},
		{calculator.ErrUndefinedResult, http.StatusBadRequest, CodeUndefinedResult},
		{calculator.ErrUnsupportedOperation, http.StatusBadRequest, CodeUnsupportedOp},
		{errors.New("boom"), http.StatusInternalServerError, CodeInternalServerError},
	}
	for _, tc := range tests {
		t.Run(tc.wantCode, func(t *testing.T) {
			status, code := mapDomainError(tc.err)
			if status != tc.wantStatus || code != tc.wantCode {
				t.Errorf("got (%d, %s), want (%d, %s)", status, code, tc.wantStatus, tc.wantCode)
			}
		})
	}
}

func post(h http.Handler, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/api/v1/calculate", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}
