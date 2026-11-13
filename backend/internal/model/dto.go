// Package model holds the DTOs (Data Transfer Objects) that define the JSON
// contract of the REST API. Keeping them separate from the domain makes the
// public contract explicit and easy to share with the frontend.
package model

// CalculateRequest is the body of POST /api/v1/calculate.
//
// Operands are pointers so we can tell "field missing" (nil) apart from a
// legitimate zero value (0), which a plain float64 cannot do.
type CalculateRequest struct {
	Operation string   `json:"operation"`
	A         *float64 `json:"a"`
	B         *float64 `json:"b,omitempty"`
}

// CalculateResponse is returned with 200 OK on success.
type CalculateResponse struct {
	Operation string   `json:"operation"`
	A         float64  `json:"a"`
	B         *float64 `json:"b,omitempty"`
	Result    float64  `json:"result"`
}

// ErrorResponse is the single error envelope used by every endpoint.
type ErrorResponse struct {
	Error ErrorDetail `json:"error"`
}

// ErrorDetail carries a machine-readable code (for the frontend to branch on)
// and a human-readable message (to show the user).
type ErrorDetail struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// HealthResponse is returned by GET /health.
type HealthResponse struct {
	Status string `json:"status"`
}
