import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CalculatorApiError, calculate } from '../../services/calculatorApi'
import type { CalculateRequest, CalculateResponse } from '../../types/calculator'
import { Calculator } from './Calculator'

// Mock only the network call; keep the real CalculatorApiError class so the
// component's error handling is exercised exactly as in production.
vi.mock('../../services/calculatorApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/calculatorApi')>()
  return { ...actual, calculate: vi.fn() }
})

const mockedCalculate = vi.mocked(calculate)

/** Fake backend that does the math locally, so tests read naturally. */
function fakeBackend(req: CalculateRequest): Promise<CalculateResponse> {
  const ops: Record<string, (a: number, b: number) => number> = {
    add: (a, b) => a + b,
    subtract: (a, b) => a - b,
    multiply: (a, b) => a * b,
    divide: (a, b) => a / b,
    power: (a, b) => a ** b,
    percentage: (a, b) => (a / 100) * b,
    sqrt: (a) => Math.sqrt(a),
  }
  const b = 'b' in req ? req.b : 0
  return Promise.resolve({ ...req, result: ops[req.operation]!(req.a, b) })
}

const display = () => screen.getByTestId('display')
const expression = () => screen.getByTestId('expression')
const press = (user: ReturnType<typeof userEvent.setup>, name: string) => user.click(screen.getByRole('button', { name }))

describe('<Calculator />', () => {
  beforeEach(() => {
    mockedCalculate.mockReset()
    mockedCalculate.mockImplementation(fakeBackend)
  })

  describe('rendering', () => {
    it('renders the display and every key', () => {
      render(<Calculator />)

      expect(display()).toHaveTextContent('0')
      for (const name of ['Clear', 'Delete', 'Power', 'Square root', 'Divide', 'Multiply', 'Subtract', 'Add', 'Percent of', 'Equals', 'Toggle sign', 'Decimal point']) {
        expect(screen.getByRole('button', { name })).toBeInTheDocument()
      }
      for (let d = 0; d <= 9; d++) {
        expect(screen.getByRole('button', { name: String(d) })).toBeInTheDocument()
      }
    })
  })

  describe('mouse / touch interaction', () => {
    it('computes 12 ÷ 4 = 3 through the API', async () => {
      const user = userEvent.setup()
      render(<Calculator />)

      await press(user, '1')
      await press(user, '2')
      await press(user, 'Divide')
      expect(screen.getByRole('button', { name: 'Divide' })).toHaveAttribute('aria-pressed', 'true')
      await press(user, '4')
      await press(user, 'Equals')

      await waitFor(() => expect(display()).toHaveTextContent('3'))
      expect(expression()).toHaveTextContent('12 ÷ 4 =')
      expect(mockedCalculate).toHaveBeenCalledWith({ operation: 'divide', a: 12, b: 4 })
    })

    it('chains operations: 2 + 3 × 4 = 20', async () => {
      const user = userEvent.setup()
      render(<Calculator />)

      await press(user, '2')
      await press(user, 'Add')
      await press(user, '3')
      await press(user, 'Multiply')
      await waitFor(() => expect(expression()).toHaveTextContent('5 ×'))
      await press(user, '4')
      await press(user, 'Equals')

      await waitFor(() => expect(display()).toHaveTextContent('20'))
      expect(mockedCalculate).toHaveBeenCalledTimes(2)
    })

    it('computes a square root with a unary request', async () => {
      const user = userEvent.setup()
      render(<Calculator />)

      await press(user, '8')
      await press(user, '1')
      await press(user, 'Square root')

      await waitFor(() => expect(display()).toHaveTextContent('9'))
      expect(mockedCalculate).toHaveBeenCalledWith({ operation: 'sqrt', a: 81 })
    })

    it('computes power and percentage', async () => {
      const user = userEvent.setup()
      render(<Calculator />)

      await press(user, '2')
      await press(user, 'Power')
      await press(user, '1')
      await press(user, '0')
      await press(user, 'Equals')
      await waitFor(() => expect(display()).toHaveTextContent('1024'))

      await press(user, '1')
      await press(user, '5')
      await press(user, 'Percent of')
      await press(user, '2')
      await press(user, '0')
      await press(user, '0')
      await press(user, 'Equals')
      await waitFor(() => expect(display()).toHaveTextContent('30'))
    })

    it('supports sign toggle, decimals, delete and clear', async () => {
      const user = userEvent.setup()
      render(<Calculator />)

      await press(user, '1')
      await press(user, 'Decimal point')
      await press(user, '5')
      await press(user, 'Toggle sign')
      expect(display()).toHaveTextContent('-1.5')

      await press(user, 'Delete')
      expect(display()).toHaveTextContent('-1.')

      await press(user, 'Clear')
      expect(display()).toHaveTextContent('0')
    })
  })

  describe('client-side validation', () => {
    it('does not call the API when "=" is pressed with nothing to compute', async () => {
      const user = userEvent.setup()
      render(<Calculator />)

      await press(user, '5')
      await press(user, 'Equals')

      expect(mockedCalculate).not.toHaveBeenCalled()
      expect(display()).toHaveTextContent('5')
    })

    it('asks for the second operand instead of sending an incomplete request', async () => {
      const user = userEvent.setup()
      render(<Calculator />)

      await press(user, '5')
      await press(user, 'Add')
      await press(user, 'Equals')

      expect(mockedCalculate).not.toHaveBeenCalled()
      expect(screen.getByRole('alert')).toHaveTextContent('Enter a second number first')
    })
  })

  describe('API error handling', () => {
    it('shows a friendly message for division by zero', async () => {
      mockedCalculate.mockRejectedValueOnce(
        new CalculatorApiError('DIVISION_BY_ZERO', 'division by zero is not allowed', 400),
      )
      const user = userEvent.setup()
      render(<Calculator />)

      await press(user, '5')
      await press(user, 'Divide')
      await press(user, '0')
      await press(user, 'Equals')

      expect(await screen.findByRole('alert')).toHaveTextContent('Cannot divide by zero')
      expect(display()).toHaveTextContent('0')
    })

    it('shows a friendly message for the square root of a negative number', async () => {
      mockedCalculate.mockRejectedValueOnce(new CalculatorApiError('NEGATIVE_SQUARE_ROOT', 'raw', 400))
      const user = userEvent.setup()
      render(<Calculator />)

      await press(user, '4')
      await press(user, 'Toggle sign')
      await press(user, 'Square root')

      expect(await screen.findByRole('alert')).toHaveTextContent('Cannot take the square root of a negative number')
    })

    it('shows a message when the server is unreachable', async () => {
      mockedCalculate.mockRejectedValueOnce(new CalculatorApiError('NETWORK_ERROR', 'Failed to fetch'))
      const user = userEvent.setup()
      render(<Calculator />)

      await press(user, '1')
      await press(user, 'Add')
      await press(user, '1')
      await press(user, 'Equals')

      expect(await screen.findByRole('alert')).toHaveTextContent('Unable to reach the server')
    })

    it('shows a generic message for unexpected errors', async () => {
      mockedCalculate.mockRejectedValueOnce(new Error('kaboom'))
      const user = userEvent.setup()
      render(<Calculator />)

      await press(user, '1')
      await press(user, 'Add')
      await press(user, '1')
      await press(user, 'Equals')

      expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again')
    })

    it('clears the error as soon as the user types again', async () => {
      mockedCalculate.mockRejectedValueOnce(new CalculatorApiError('DIVISION_BY_ZERO', 'raw', 400))
      const user = userEvent.setup()
      render(<Calculator />)

      await press(user, '1')
      await press(user, 'Divide')
      await press(user, '0')
      await press(user, 'Equals')
      await screen.findByRole('alert')

      await press(user, '7')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(display()).toHaveTextContent('7')
    })

    it('disables the keypad and shows a loading state while waiting for the API', async () => {
      let resolve!: (value: CalculateResponse) => void
      mockedCalculate.mockImplementationOnce(() => new Promise((r) => (resolve = r)))
      const user = userEvent.setup()
      render(<Calculator />)

      await press(user, '9')
      await press(user, 'Square root')

      expect(screen.getByText('Calculating…')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Equals' })).toBeDisabled()

      resolve({ operation: 'sqrt', a: 9, result: 3 })
      await waitFor(() => expect(display()).toHaveTextContent('3'))
      expect(screen.getByRole('button', { name: 'Equals' })).toBeEnabled()
    })
  })

  describe('keyboard support', () => {
    it('computes an expression typed on the keyboard', async () => {
      const user = userEvent.setup()
      render(<Calculator />)

      await user.keyboard('7*6{Enter}')

      await waitFor(() => expect(display()).toHaveTextContent('42'))
      expect(mockedCalculate).toHaveBeenCalledWith({ operation: 'multiply', a: 7, b: 6 })
    })

    it.each([
      ['9-4=', { operation: 'subtract', a: 9, b: 4 }],
      ['8/2{Enter}', { operation: 'divide', a: 8, b: 2 }],
      ['2^3{Enter}', { operation: 'power', a: 2, b: 3 }],
      ['10%50{Enter}', { operation: 'percentage', a: 10, b: 50 }],
      ['1.5+1,5{Enter}', { operation: 'add', a: 1.5, b: 1.5 }],
      ['3x3{Enter}', { operation: 'multiply', a: 3, b: 3 }],
      ['16r', { operation: 'sqrt', a: 16 }],
    ])('maps the keys %s to %o', async (keys, expected) => {
      const user = userEvent.setup()
      render(<Calculator />)

      await user.keyboard(keys)

      await waitFor(() => expect(mockedCalculate).toHaveBeenCalledWith(expected))
    })

    it('supports Backspace, Escape and F9 (toggle sign)', async () => {
      const user = userEvent.setup()
      render(<Calculator />)

      await user.keyboard('123{Backspace}')
      expect(display()).toHaveTextContent('12')

      await user.keyboard('{F9}')
      expect(display()).toHaveTextContent('-12')

      await user.keyboard('{Escape}')
      expect(display()).toHaveTextContent('0')
    })

    it('ignores unrelated keys and shortcuts with modifiers', async () => {
      const user = userEvent.setup()
      render(<Calculator />)

      await user.keyboard('5q{Control>}7{/Control}')

      expect(display()).toHaveTextContent('5')
    })
  })
})
