package calculator

import "errors"

// Domain errors. They are exported "sentinel" errors so callers (e.g. the
// HTTP layer) can map them to status codes with errors.Is, without the
// calculator package knowing anything about HTTP.
var (
	ErrUnsupportedOperation = errors.New("unsupported operation")
	ErrDivisionByZero       = errors.New("division by zero is not allowed")
	ErrNegativeSquareRoot   = errors.New("cannot calculate the square root of a negative number")
	ErrOverflow             = errors.New("result is too large to be represented (overflow)")
	ErrUndefinedResult      = errors.New("result is not a real number")
)
