import { afterEach, describe, expect, it, vi } from 'vitest'
import { CalculatorApiError, calculate } from './calculatorApi'

const BASE_URL = 'http://api.test'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function mockFetch(impl: () => Promise<Response>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(impl)
}

async function expectApiError(promise: Promise<unknown>, code: string, userMessage?: string) {
  const err = await promise.catch((e: unknown) => e)
  expect(err).toBeInstanceOf(CalculatorApiError)
  expect((err as CalculatorApiError).code).toBe(code)
  if (userMessage) expect((err as CalculatorApiError).userMessage).toBe(userMessage)
}

describe('calculate', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('sends a typed POST request and returns the parsed result', async () => {
    const fetchSpy = mockFetch(() => Promise.resolve(jsonResponse({ operation: 'add', a: 2, b: 3, result: 5 })))

    const res = await calculate({ operation: 'add', a: 2, b: 3 }, { baseUrl: BASE_URL })

    expect(res.result).toBe(5)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]!
    expect(url).toBe(`${BASE_URL}/api/v1/calculate`)
    expect(init?.method).toBe('POST')
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(init?.body as string)).toEqual({ operation: 'add', a: 2, b: 3 })
  })

  it('sends unary operations without "b"', async () => {
    const fetchSpy = mockFetch(() => Promise.resolve(jsonResponse({ operation: 'sqrt', a: 9, result: 3 })))

    await calculate({ operation: 'sqrt', a: 9 }, { baseUrl: BASE_URL })

    expect(JSON.parse(fetchSpy.mock.calls[0]![1]?.body as string)).toEqual({ operation: 'sqrt', a: 9 })
  })

  it.each([
    ['DIVISION_BY_ZERO', 'Cannot divide by zero'],
    ['NEGATIVE_SQUARE_ROOT', 'Cannot take the square root of a negative number'],
    ['OVERFLOW', 'Result is too large to display'],
    ['UNDEFINED_RESULT', 'Result is not a real number'],
    ['INVALID_OPERAND', 'Please enter a valid number'],
  ])('maps backend error %s to a friendly message', async (code, friendly) => {
    mockFetch(() => Promise.resolve(jsonResponse({ error: { code, message: 'raw backend message' } }, 400)))

    await expectApiError(calculate({ operation: 'divide', a: 1, b: 0 }, { baseUrl: BASE_URL }), code, friendly)
  })

  it('keeps the status code and raw message on API errors', async () => {
    mockFetch(() =>
      Promise.resolve(jsonResponse({ error: { code: 'DIVISION_BY_ZERO', message: 'division by zero is not allowed' } }, 400)),
    )

    const err = (await calculate({ operation: 'divide', a: 1, b: 0 }, { baseUrl: BASE_URL }).catch(
      (e: unknown) => e,
    )) as CalculatorApiError
    expect(err.status).toBe(400)
    expect(err.message).toBe('division by zero is not allowed')
  })

  it('falls back to the raw message for unknown error codes', async () => {
    mockFetch(() => Promise.resolve(jsonResponse({ error: { code: 'SOMETHING_NEW', message: 'new failure' } }, 400)))

    const err = (await calculate({ operation: 'add', a: 1, b: 1 }, { baseUrl: BASE_URL }).catch(
      (e: unknown) => e,
    )) as CalculatorApiError
    expect(err.userMessage).toBe('new failure')
  })

  it('reports a network error when fetch rejects', async () => {
    mockFetch(() => Promise.reject(new TypeError('Failed to fetch')))

    await expectApiError(
      calculate({ operation: 'add', a: 1, b: 1 }, { baseUrl: BASE_URL }),
      'NETWORK_ERROR',
      'Unable to reach the server. Is the backend running?',
    )
  })

  it('reports a network error when fetch rejects with a non-Error value', async () => {
    mockFetch(() => Promise.reject('boom'))

    await expectApiError(calculate({ operation: 'add', a: 1, b: 1 }, { baseUrl: BASE_URL }), 'NETWORK_ERROR')
  })

  it('times out slow requests', async () => {
    vi.useFakeTimers()
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        }),
    )

    const promise = calculate({ operation: 'add', a: 1, b: 1 }, { baseUrl: BASE_URL, timeoutMs: 100 })
    vi.advanceTimersByTime(100)

    await expectApiError(promise, 'TIMEOUT')
  })

  it('rejects non-JSON bodies', async () => {
    mockFetch(() => Promise.resolve(new Response('<html>Bad gateway</html>', { status: 502 })))

    await expectApiError(calculate({ operation: 'add', a: 1, b: 1 }, { baseUrl: BASE_URL }), 'INVALID_RESPONSE')
  })

  it('rejects error responses without the expected envelope', async () => {
    mockFetch(() => Promise.resolve(jsonResponse({ message: 'nope' }, 500)))

    await expectApiError(calculate({ operation: 'add', a: 1, b: 1 }, { baseUrl: BASE_URL }), 'INVALID_RESPONSE')
  })

  it('rejects success responses with an unexpected shape', async () => {
    mockFetch(() => Promise.resolve(jsonResponse({ value: 5 })))

    await expectApiError(calculate({ operation: 'add', a: 1, b: 1 }, { baseUrl: BASE_URL }), 'INVALID_RESPONSE')
  })
})
