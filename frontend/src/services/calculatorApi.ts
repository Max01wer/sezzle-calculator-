import type {
  ApiErrorCode,
  CalculateRequest,
  CalculateResponse,
  ClientErrorCode,
  ErrorResponse,
} from '../types/calculator'

const DEFAULT_TIMEOUT_MS = 8_000

/** Base URL of the API. Empty string means "same origin" (Docker + nginx proxy). */
export const API_BASE_URL: string = (import.meta.env.VITE_API_URL ?? 'http://localhost:8080').replace(/\/$/, '')

/** Friendly, user-facing messages for every known error code. */
const FRIENDLY_MESSAGES: Record<ApiErrorCode | ClientErrorCode, string> = {
  DIVISION_BY_ZERO: 'Cannot divide by zero',
  NEGATIVE_SQUARE_ROOT: 'Cannot take the square root of a negative number',
  OVERFLOW: 'Result is too large to display',
  UNDEFINED_RESULT: 'Result is not a real number',
  INVALID_OPERAND: 'Please enter a valid number',
  MISSING_OPERAND: 'A number is missing',
  UNSUPPORTED_OPERATION: 'That operation is not supported',
  INVALID_JSON: 'The request was invalid',
  UNSUPPORTED_MEDIA_TYPE: 'The request was invalid',
  INTERNAL_ERROR: 'Something went wrong on the server. Please try again',
  NETWORK_ERROR: 'Unable to reach the server. Is the backend running?',
  TIMEOUT: 'The server took too long to respond',
  INVALID_RESPONSE: 'Received an unexpected response from the server',
}

/** Error thrown by every function in this module, so callers handle a single type. */
export class CalculatorApiError extends Error {
  readonly code: ApiErrorCode | ClientErrorCode
  readonly status?: number

  constructor(code: ApiErrorCode | ClientErrorCode, message: string, status?: number) {
    super(message)
    this.name = 'CalculatorApiError'
    this.code = code
    this.status = status
  }

  /** Message suitable for showing to the end user. */
  get userMessage(): string {
    return FRIENDLY_MESSAGES[this.code] ?? this.message
  }
}

// --- Runtime type guards: never trust the network blindly. ---

function isErrorResponse(body: unknown): body is ErrorResponse {
  if (typeof body !== 'object' || body === null || !('error' in body)) return false
  const { error } = body as { error: unknown }
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { code?: unknown }).code === 'string' &&
    typeof (error as { message?: unknown }).message === 'string'
  )
}

function isCalculateResponse(body: unknown): body is CalculateResponse {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as { result?: unknown }).result === 'number' &&
    typeof (body as { operation?: unknown }).operation === 'string'
  )
}

/**
 * Calls POST /api/v1/calculate.
 * Resolves with the typed response or rejects with a CalculatorApiError.
 */
export async function calculate(
  request: CalculateRequest,
  { timeoutMs = DEFAULT_TIMEOUT_MS, baseUrl = API_BASE_URL } = {},
): Promise<CalculateResponse> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let response: Response
  try {
    response = await fetch(`${baseUrl}/api/v1/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new CalculatorApiError('TIMEOUT', 'request timed out')
    }
    throw new CalculatorApiError('NETWORK_ERROR', err instanceof Error ? err.message : 'network error')
  } finally {
    clearTimeout(timer)
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new CalculatorApiError('INVALID_RESPONSE', 'response body is not valid JSON', response.status)
  }

  if (!response.ok) {
    if (isErrorResponse(body)) {
      throw new CalculatorApiError(body.error.code, body.error.message, response.status)
    }
    throw new CalculatorApiError('INVALID_RESPONSE', `unexpected status ${response.status}`, response.status)
  }

  if (!isCalculateResponse(body)) {
    throw new CalculatorApiError('INVALID_RESPONSE', 'response has an unexpected shape', response.status)
  }
  return body
}
