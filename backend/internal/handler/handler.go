// Package handler is the HTTP layer: it decodes requests, validates input,
// calls the calculator service and encodes JSON responses. It contains no
// math at all.
package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"

	"github.com/jmllanos/sezzle-calculator/backend/internal/calculator"
	"github.com/jmllanos/sezzle-calculator/backend/internal/model"
)

// maxBodyBytes caps the request size; a calculator payload is tiny.
const maxBodyBytes = 1 << 10 // 1 KB

// Error codes exposed to API clients.
const (
	CodeInvalidJSON         = "INVALID_JSON"
	CodeInvalidOperand      = "INVALID_OPERAND"
	CodeMissingOperand      = "MISSING_OPERAND"
	CodeUnsupportedOp       = "UNSUPPORTED_OPERATION"
	CodeDivisionByZero      = "DIVISION_BY_ZERO"
	CodeNegativeSquareRoot  = "NEGATIVE_SQUARE_ROOT"
	CodeOverflow            = "OVERFLOW"
	CodeUndefinedResult     = "UNDEFINED_RESULT"
	CodeUnsupportedMedia    = "UNSUPPORTED_MEDIA_TYPE"
	CodeInternalServerError = "INTERNAL_ERROR"
)

// Calculator is the behaviour the handler needs. Defining the interface on
// the consumer side (idiomatic Go) lets tests swap in a fake if needed.
type Calculator interface {
	Calculate(op calculator.Operation, a, b float64) (float64, error)
}

// Handler groups the HTTP endpoints of the API.
type Handler struct {
	calc Calculator
}

// New builds a Handler with its dependencies.
func New(calc Calculator) *Handler {
	return &Handler{calc: calc}
}

// Routes registers every endpoint on a new ServeMux and returns it.
// Go 1.22+ patterns ("METHOD /path") give us method matching and automatic
// 405 Method Not Allowed responses without a third-party router.
func (h *Handler) Routes() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", h.Health)
	mux.HandleFunc("POST /api/v1/calculate", h.Calculate)
	return mux
}

// Health is a liveness probe.
func (h *Handler) Health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, model.HealthResponse{Status: "ok"})
}

// Calculate handles POST /api/v1/calculate.
func (h *Handler) Calculate(w http.ResponseWriter, r *http.Request) {
	if ct := r.Header.Get("Content-Type"); !strings.HasPrefix(ct, "application/json") {
		writeError(w, http.StatusUnsupportedMediaType, CodeUnsupportedMedia,
			"Content-Type must be application/json")
		return
	}

	req, err := decodeRequest(w, r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.code, err.message)
		return
	}

	op, opErr := calculator.ParseOperation(strings.ToLower(strings.TrimSpace(req.Operation)))
	if opErr != nil {
		writeError(w, http.StatusBadRequest, CodeUnsupportedOp,
			fmt.Sprintf("operation %q is not supported; use one of: add, subtract, multiply, divide, power, sqrt, percentage", req.Operation))
		return
	}

	if req.A == nil {
		writeError(w, http.StatusBadRequest, CodeMissingOperand, `operand "a" is required`)
		return
	}

	var b float64
	if !op.IsUnary() {
		if req.B == nil {
			writeError(w, http.StatusBadRequest, CodeMissingOperand,
				fmt.Sprintf(`operand "b" is required for operation %q`, op))
			return
		}
		b = *req.B
	}

	result, calcErr := h.calc.Calculate(op, *req.A, b)
	if calcErr != nil {
		status, code := mapDomainError(calcErr)
		msg := calcErr.Error()
		if status == http.StatusInternalServerError {
			log.Printf("unexpected calculator error: %v", calcErr)
			msg = "an unexpected error occurred"
		}
		writeError(w, status, code, msg)
		return
	}

	resp := model.CalculateResponse{Operation: string(op), A: *req.A, Result: result}
	if !op.IsUnary() {
		resp.B = req.B
	}
	writeJSON(w, http.StatusOK, resp)
}

// requestError is a small internal type carrying a code + message pair.
type requestError struct {
	code    string
	message string
}

// decodeRequest parses the JSON body strictly and turns low-level decoder
// errors into clear, client-friendly messages.
func decodeRequest(w http.ResponseWriter, r *http.Request) (*model.CalculateRequest, *requestError) {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)

	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields() // reject typos like {"operand": 1}

	var req model.CalculateRequest
	if err := dec.Decode(&req); err != nil {
		var typeErr *json.UnmarshalTypeError
		var syntaxErr *json.SyntaxError
		var maxErr *http.MaxBytesError

		switch {
		case errors.Is(err, io.EOF):
			return nil, &requestError{CodeInvalidJSON, "request body must not be empty"}
		case errors.As(err, &maxErr):
			return nil, &requestError{CodeInvalidJSON, "request body is too large"}
		case errors.As(err, &syntaxErr), errors.Is(err, io.ErrUnexpectedEOF):
			return nil, &requestError{CodeInvalidJSON, "request body contains malformed JSON"}
		case errors.As(err, &typeErr):
			// Covers non-numeric operands ("a": "abc") and numbers that do not
			// fit in a float64 ("a": 1e400), which encoding/json reports as a
			// type error.
			if typeErr.Field == "a" || typeErr.Field == "b" {
				return nil, &requestError{CodeInvalidOperand,
					fmt.Sprintf("operand %q must be a finite number within the float64 range", typeErr.Field)}
			}
			return nil, &requestError{CodeInvalidJSON,
				fmt.Sprintf("field %q has an invalid type", typeErr.Field)}
		case strings.HasPrefix(err.Error(), "json: unknown field"):
			return nil, &requestError{CodeInvalidJSON, strings.TrimPrefix(err.Error(), "json: ")}
		default:
			return nil, &requestError{CodeInvalidJSON, "request body could not be parsed"}
		}
	}

	// Reject trailing data such as `{"a":1}{"a":2}`.
	if dec.More() {
		return nil, &requestError{CodeInvalidJSON, "request body must contain a single JSON object"}
	}
	return &req, nil
}

// mapDomainError translates calculator errors into HTTP status + error code.
func mapDomainError(err error) (int, string) {
	switch {
	case errors.Is(err, calculator.ErrDivisionByZero):
		return http.StatusBadRequest, CodeDivisionByZero
	case errors.Is(err, calculator.ErrNegativeSquareRoot):
		return http.StatusBadRequest, CodeNegativeSquareRoot
	case errors.Is(err, calculator.ErrOverflow):
		return http.StatusBadRequest, CodeOverflow
	case errors.Is(err, calculator.ErrUndefinedResult):
		return http.StatusBadRequest, CodeUndefinedResult
	case errors.Is(err, calculator.ErrUnsupportedOperation):
		return http.StatusBadRequest, CodeUnsupportedOp
	default:
		return http.StatusInternalServerError, CodeInternalServerError
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("failed to write JSON response: %v", err)
	}
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, model.ErrorResponse{
		Error: model.ErrorDetail{Code: code, Message: message},
	})
}
