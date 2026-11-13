package calculator

import (
	"errors"
	"math"
	"testing"
)

func TestService_Calculate(t *testing.T) {
	svc := NewService()

	tests := []struct {
		name    string
		op      Operation
		a, b    float64
		want    float64
		wantErr error
	}{
		// --- Basic operations ---
		{name: "add positives", op: Add, a: 2, b: 3, want: 5},
		{name: "add negatives", op: Add, a: -2, b: -3, want: -5},
		{name: "add floating point noise is rounded", op: Add, a: 0.1, b: 0.2, want: 0.3},
		{name: "subtract", op: Subtract, a: 10, b: 4, want: 6},
		{name: "subtract to negative", op: Subtract, a: 4, b: 10, want: -6},
		{name: "multiply", op: Multiply, a: 3, b: -4, want: -12},
		{name: "multiply by zero gives positive zero", op: Multiply, a: -5, b: 0, want: 0},
		{name: "divide", op: Divide, a: 10, b: 4, want: 2.5},
		{name: "divide zero by number", op: Divide, a: 0, b: 7, want: 0},
		{name: "divide repeating decimal", op: Divide, a: 1, b: 3, want: 0.333333333333333},

		// --- Advanced operations ---
		{name: "power", op: Power, a: 2, b: 10, want: 1024},
		{name: "power zero exponent", op: Power, a: 5, b: 0, want: 1},
		{name: "power negative exponent", op: Power, a: 2, b: -2, want: 0.25},
		{name: "power fractional exponent", op: Power, a: 9, b: 0.5, want: 3},
		{name: "sqrt", op: SquareRoot, a: 16, want: 4},
		{name: "sqrt of zero", op: SquareRoot, a: 0, want: 0},
		{name: "sqrt ignores b", op: SquareRoot, a: 2.25, b: 999, want: 1.5},
		{name: "percentage", op: Percentage, a: 15, b: 200, want: 30},
		{name: "percentage over 100", op: Percentage, a: 150, b: 40, want: 60},

		// --- Edge cases / errors ---
		{name: "division by zero", op: Divide, a: 1, b: 0, wantErr: ErrDivisionByZero},
		{name: "zero divided by zero", op: Divide, a: 0, b: 0, wantErr: ErrDivisionByZero},
		{name: "zero to negative power", op: Power, a: 0, b: -1, wantErr: ErrDivisionByZero},
		{name: "sqrt of negative", op: SquareRoot, a: -4, wantErr: ErrNegativeSquareRoot},
		{name: "negative base fractional exponent", op: Power, a: -8, b: 0.5, wantErr: ErrUndefinedResult},
		{name: "overflow on add", op: Add, a: math.MaxFloat64, b: math.MaxFloat64, wantErr: ErrOverflow},
		{name: "overflow on multiply", op: Multiply, a: 1e200, b: 1e200, wantErr: ErrOverflow},
		{name: "overflow on power", op: Power, a: 10, b: 400, wantErr: ErrOverflow},
		{name: "overflow on divide", op: Divide, a: math.MaxFloat64, b: 1e-10, wantErr: ErrOverflow},
		{name: "unsupported operation", op: Operation("modulo"), a: 1, b: 2, wantErr: ErrUnsupportedOperation},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := svc.Calculate(tc.op, tc.a, tc.b)

			if tc.wantErr != nil {
				if !errors.Is(err, tc.wantErr) {
					t.Fatalf("expected error %v, got %v", tc.wantErr, err)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tc.want {
				t.Errorf("got %v, want %v", got, tc.want)
			}
			if math.Signbit(got) && got == 0 {
				t.Errorf("got negative zero, want 0")
			}
		})
	}
}

func TestParseOperation(t *testing.T) {
	tests := []struct {
		raw     string
		want    Operation
		wantErr bool
	}{
		{raw: "add", want: Add},
		{raw: "subtract", want: Subtract},
		{raw: "multiply", want: Multiply},
		{raw: "divide", want: Divide},
		{raw: "power", want: Power},
		{raw: "sqrt", want: SquareRoot},
		{raw: "percentage", want: Percentage},
		{raw: "", wantErr: true},
		{raw: "modulo", wantErr: true},
		{raw: "ADD", wantErr: true}, // normalization is the caller's job
	}

	for _, tc := range tests {
		t.Run(tc.raw, func(t *testing.T) {
			got, err := ParseOperation(tc.raw)
			if tc.wantErr {
				if !errors.Is(err, ErrUnsupportedOperation) {
					t.Fatalf("expected ErrUnsupportedOperation, got %v", err)
				}
				return
			}
			if err != nil || got != tc.want {
				t.Fatalf("got (%q, %v), want (%q, nil)", got, err, tc.want)
			}
		})
	}
}

func TestOperation_IsUnary(t *testing.T) {
	if !SquareRoot.IsUnary() {
		t.Error("sqrt should be unary")
	}
	for _, op := range []Operation{Add, Subtract, Multiply, Divide, Power, Percentage} {
		if op.IsUnary() {
			t.Errorf("%s should not be unary", op)
		}
	}
}
