// Types mirroring the Go DTOs in backend/internal/model/dto.go.
// Keeping them in one place makes the API contract explicit on both sides.

export const BINARY_OPERATIONS = [
  'add',
  'subtract',
  'multiply',
  'divide',
  'power',
  'percentage',
] as const

export type BinaryOperation = (typeof BINARY_OPERATIONS)[number]
export type UnaryOperation = 'sqrt'
export type Operation = BinaryOperation | UnaryOperation

/** Discriminated union: `b` is required for binary operations and forbidden for sqrt. */
export type CalculateRequest =
  | { operation: BinaryOperation; a: number; b: number }
  | { operation: UnaryOperation; a: number }

export interface CalculateResponse {
  operation: Operation
  a: number
  b?: number
  result: number
}

/** Error codes returned by the backend. */
export type ApiErrorCode =
  | 'INVALID_JSON'
  | 'INVALID_OPERAND'
  | 'MISSING_OPERAND'
  | 'UNSUPPORTED_OPERATION'
  | 'DIVISION_BY_ZERO'
  | 'NEGATIVE_SQUARE_ROOT'
  | 'OVERFLOW'
  | 'UNDEFINED_RESULT'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'INTERNAL_ERROR'

/** Codes produced on the client when the request never got a valid answer. */
export type ClientErrorCode = 'NETWORK_ERROR' | 'TIMEOUT' | 'INVALID_RESPONSE'

export interface ErrorResponse {
  error: {
    code: ApiErrorCode
    message: string
  }
}
