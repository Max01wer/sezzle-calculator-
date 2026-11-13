// Package calculator contains the pure math/business logic of the app.
// It has no knowledge of HTTP or JSON, which makes it trivial to unit test
// and to reuse from other transports (CLI, gRPC, ...).
package calculator

import (
	"fmt"
	"math"
	"strconv"
)

// Operation identifies a supported calculator operation.
type Operation string

const (
	Add        Operation = "add"
	Subtract   Operation = "subtract"
	Multiply   Operation = "multiply"
	Divide     Operation = "divide"
	Power      Operation = "power"
	SquareRoot Operation = "sqrt"
	Percentage Operation = "percentage"
)

// ParseOperation validates a raw string and converts it into an Operation.
func ParseOperation(raw string) (Operation, error) {
	op := Operation(raw)
	switch op {
	case Add, Subtract, Multiply, Divide, Power, SquareRoot, Percentage:
		return op, nil
	default:
		return "", fmt.Errorf("%w: %q", ErrUnsupportedOperation, raw)
	}
}

// IsUnary reports whether the operation only needs one operand.
func (o Operation) IsUnary() bool {
	return o == SquareRoot
}

// Service performs calculations. It is stateless; a struct is used so it can
// be injected into handlers and so it is easy to extend later (e.g. a
// configurable precision) without changing call sites.
type Service struct{}

// NewService returns a ready-to-use calculator service.
func NewService() *Service {
	return &Service{}
}

// Calculate runs op over the operands. For unary operations, b is ignored.
//
// Percentage semantics: "a percent of b", i.e. percentage(15, 200) = 30.
func (s *Service) Calculate(op Operation, a, b float64) (float64, error) {
	var result float64

	switch op {
	case Add:
		result = a + b
	case Subtract:
		result = a - b
	case Multiply:
		result = a * b
	case Divide:
		if b == 0 {
			return 0, ErrDivisionByZero
		}
		result = a / b
	case Power:
		// 0 raised to a negative exponent is 1/0^n -> a hidden division by zero.
		if a == 0 && b < 0 {
			return 0, ErrDivisionByZero
		}
		result = math.Pow(a, b)
	case SquareRoot:
		if a < 0 {
			return 0, ErrNegativeSquareRoot
		}
		result = math.Sqrt(a)
	case Percentage:
		result = a / 100 * b
	default:
		return 0, fmt.Errorf("%w: %q", ErrUnsupportedOperation, op)
	}

	return checkResult(result)
}

// checkResult guards against results that cannot be represented as a finite
// float64 and normalizes the value for display.
func checkResult(v float64) (float64, error) {
	switch {
	case math.IsInf(v, 0):
		return 0, ErrOverflow
	case math.IsNaN(v):
		// e.g. a negative base with a fractional exponent: (-8)^0.5
		return 0, ErrUndefinedResult
	}
	return roundSignificant(v), nil
}

// roundSignificant rounds to 15 significant digits (the precision float64
// can reliably guarantee) to hide binary floating-point noise, so that
// 0.1 + 0.2 returns 0.3 instead of 0.30000000000000004.
func roundSignificant(v float64) float64 {
	rounded, err := strconv.ParseFloat(strconv.FormatFloat(v, 'g', 15, 64), 64)
	if err != nil {
		return v // cannot happen for finite values; fall back safely
	}
	if rounded == 0 {
		return 0 // normalize -0 to 0
	}
	return rounded
}
