import { describe, expect, it } from 'vitest'
import { type CalculatorAction, type CalculatorState, calculatorReducer, initialState } from './calculatorReducer'

/** Applies a sequence of actions starting from `from`. */
function run(actions: CalculatorAction[], from: CalculatorState = initialState): CalculatorState {
  return actions.reduce(calculatorReducer, from)
}

const digits = (s: string): CalculatorAction[] => [...s].map((digit) => ({ type: 'digit', digit }))

describe('calculatorReducer', () => {
  describe('typing numbers', () => {
    it('replaces the initial zero', () => {
      expect(run(digits('12')).display).toBe('12')
    })

    it('ignores leading zeros', () => {
      expect(run(digits('007')).display).toBe('7')
    })

    it('adds a single decimal point', () => {
      const state = run([...digits('1'), { type: 'decimal' }, { type: 'decimal' }, ...digits('5')])
      expect(state.display).toBe('1.5')
    })

    it('starts with "0." when the decimal point comes first', () => {
      expect(run([{ type: 'decimal' }]).display).toBe('0.')
    })

    it('limits input to 15 digits', () => {
      expect(run(digits('1234567890123456789')).display).toBe('123456789012345')
    })

    it('deletes the last character and falls back to 0', () => {
      expect(run([...digits('12'), { type: 'backspace' }]).display).toBe('1')
      expect(run([...digits('5'), { type: 'backspace' }]).display).toBe('0')
      expect(run([...digits('5'), { type: 'toggleSign' }, { type: 'backspace' }]).display).toBe('0')
    })

    it('toggles the sign but not on zero', () => {
      expect(run([...digits('5'), { type: 'toggleSign' }]).display).toBe('-5')
      expect(run([...digits('5'), { type: 'toggleSign' }, { type: 'toggleSign' }]).display).toBe('5')
      expect(run([{ type: 'toggleSign' }]).display).toBe('0')
    })

    it('clears everything', () => {
      const state = run([...digits('9'), { type: 'setOperation', operation: 'add' }, { type: 'clear' }])
      expect(state).toEqual(initialState)
    })
  })

  describe('operations', () => {
    it('stores the first operand and waits for the second', () => {
      const state = run([...digits('12'), { type: 'setOperation', operation: 'divide' }])
      expect(state).toMatchObject({
        firstOperand: 12,
        operation: 'divide',
        waitingForOperand: true,
        expression: '12 ÷',
      })
    })

    it('replaces the operator when pressed twice', () => {
      const state = run([
        ...digits('5'),
        { type: 'setOperation', operation: 'add' },
        { type: 'setOperation', operation: 'multiply' },
      ])
      expect(state).toMatchObject({ firstOperand: 5, operation: 'multiply', expression: '5 ×' })
    })

    it('starts a new operand after an operator', () => {
      const state = run([...digits('5'), { type: 'setOperation', operation: 'add' }, ...digits('3')])
      expect(state).toMatchObject({ display: '3', waitingForOperand: false, expression: '5 +' })
    })

    it('starts the second operand with a decimal point', () => {
      const state = run([...digits('5'), { type: 'setOperation', operation: 'add' }, { type: 'decimal' }])
      expect(state.display).toBe('0.')
    })

    it('does not toggle the sign while waiting for the second operand', () => {
      const state = run([...digits('5'), { type: 'setOperation', operation: 'add' }, { type: 'toggleSign' }])
      expect(state.display).toBe('5')
    })
  })

  describe('results', () => {
    const pending = run([...digits('2'), { type: 'setOperation', operation: 'add' }, ...digits('3')])

    it('shows a final result and resets the pending operation', () => {
      const state = run(
        [{ type: 'requestStart' }, { type: 'binaryResult', result: 5, expression: '2 + 3 =', nextOperation: null }],
        pending,
      )
      expect(state).toMatchObject({
        display: '5',
        operation: null,
        firstOperand: null,
        overwrite: true,
        loading: false,
        expression: '2 + 3 =',
      })
    })

    it('chains results into the next operation', () => {
      const state = run([{ type: 'binaryResult', result: 5, expression: '', nextOperation: 'multiply' }], pending)
      expect(state).toMatchObject({ display: '5', firstOperand: 5, operation: 'multiply', expression: '5 ×' })
    })

    it('does not let backspace edit a result', () => {
      const result = run([{ type: 'binaryResult', result: 5, expression: '2 + 3 =', nextOperation: null }], pending)
      expect(run([{ type: 'backspace' }], result).display).toBe('5')
    })

    it('starts a new calculation when typing after a result', () => {
      const result = run([{ type: 'binaryResult', result: 5, expression: '2 + 3 =', nextOperation: null }], pending)
      expect(run(digits('7'), result)).toMatchObject({ display: '7', expression: '' })
      expect(run([{ type: 'decimal' }], result)).toMatchObject({ display: '0.', expression: '' })
    })

    it('shows a unary result with its own expression', () => {
      const state = run([...digits('9'), { type: 'unaryResult', result: 3, expression: '√(9) =' }])
      expect(state).toMatchObject({ display: '3', expression: '√(9) =', overwrite: true })
    })

    it('keeps the pending expression when a unary result feeds the second operand', () => {
      const state = run([{ type: 'unaryResult', result: 1.7320508, expression: '√(3) =' }], pending)
      expect(state).toMatchObject({ display: '1.7320508', expression: '2 +', operation: 'add', waitingForOperand: false })
    })
  })

  describe('errors', () => {
    it('resets the calculator but keeps the error message on request failure', () => {
      const state = run(
        [...digits('5'), { type: 'setOperation', operation: 'divide' }, ...digits('0'), { type: 'requestStart' }, { type: 'requestFailure', message: 'Cannot divide by zero' }],
      )
      expect(state).toEqual({ ...initialState, error: 'Cannot divide by zero' })
    })

    it('keeps the state on validation errors', () => {
      const before = run([...digits('5'), { type: 'setOperation', operation: 'add' }])
      const state = run([{ type: 'validationError', message: 'Enter a second number first' }], before)
      expect(state).toEqual({ ...before, error: 'Enter a second number first' })
    })

    it('clears the error when the user types again', () => {
      const state = run([{ type: 'validationError', message: 'oops' }, ...digits('1')])
      expect(state.error).toBeNull()
    })
  })
})
