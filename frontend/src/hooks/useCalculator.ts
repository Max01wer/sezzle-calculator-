import { useCallback, useReducer } from 'react'
import { CalculatorApiError, calculate } from '../services/calculatorApi'
import { calculatorReducer, initialState } from '../state/calculatorReducer'
import type { BinaryOperation, CalculateRequest } from '../types/calculator'
import { OPERATION_SYMBOLS, formatNumber } from '../utils/format'

/** Converts the display string into a number the API can accept, or null. */
function toOperand(display: string): number | null {
  const value = Number(display)
  return display.trim() !== '' && Number.isFinite(value) ? value : null
}

function errorMessage(err: unknown): string {
  return err instanceof CalculatorApiError ? err.userMessage : 'Something went wrong. Please try again'
}

/**
 * Glue between the pure reducer and the API service. Every action that needs
 * the backend goes through `send`, which handles loading and error states.
 */
export function useCalculator() {
  const [state, dispatch] = useReducer(calculatorReducer, initialState)

  const send = useCallback(async (request: CalculateRequest): Promise<number | null> => {
    dispatch({ type: 'requestStart' })
    try {
      const { result } = await calculate(request)
      return result
    } catch (err) {
      dispatch({ type: 'requestFailure', message: errorMessage(err) })
      return null
    }
  }, [])

  const runBinary = useCallback(
    async (a: number, op: BinaryOperation, b: number, nextOperation: BinaryOperation | null) => {
      const result = await send({ operation: op, a, b })
      if (result === null) return
      dispatch({
        type: 'binaryResult',
        result,
        nextOperation,
        expression: `${formatNumber(a)} ${OPERATION_SYMBOLS[op]} ${formatNumber(b)} =`,
      })
    },
    [send],
  )

  const inputDigit = useCallback((digit: string) => dispatch({ type: 'digit', digit }), [])
  const inputDecimal = useCallback(() => dispatch({ type: 'decimal' }), [])
  const backspace = useCallback(() => dispatch({ type: 'backspace' }), [])
  const toggleSign = useCallback(() => dispatch({ type: 'toggleSign' }), [])
  const clear = useCallback(() => dispatch({ type: 'clear' }), [])

  const chooseOperation = useCallback(
    (op: BinaryOperation) => {
      if (state.loading) return
      const current = toOperand(state.display)
      if (current === null) {
        dispatch({ type: 'validationError', message: 'Please enter a valid number' })
        return
      }
      // A pending operation with a typed second operand: compute it first (chaining).
      if (state.operation && !state.waitingForOperand && state.firstOperand !== null) {
        void runBinary(state.firstOperand, state.operation, current, op)
        return
      }
      dispatch({ type: 'setOperation', operation: op })
    },
    [state, runBinary],
  )

  const equals = useCallback(() => {
    if (state.loading) return
    // Nothing to compute: never send an empty/incomplete request.
    if (!state.operation || state.firstOperand === null) return
    if (state.waitingForOperand) {
      dispatch({ type: 'validationError', message: 'Enter a second number first' })
      return
    }
    const b = toOperand(state.display)
    if (b === null) {
      dispatch({ type: 'validationError', message: 'Please enter a valid number' })
      return
    }
    void runBinary(state.firstOperand, state.operation, b, null)
  }, [state, runBinary])

  const squareRoot = useCallback(async () => {
    if (state.loading) return
    const a = toOperand(state.display)
    if (a === null) {
      dispatch({ type: 'validationError', message: 'Please enter a valid number' })
      return
    }
    const result = await send({ operation: 'sqrt', a })
    if (result === null) return
    dispatch({ type: 'unaryResult', result, expression: `√(${formatNumber(a)}) =` })
  }, [state, send])

  return {
    state,
    actions: { inputDigit, inputDecimal, backspace, toggleSign, clear, chooseOperation, equals, squareRoot },
  }
}

export type CalculatorActions = ReturnType<typeof useCalculator>['actions']
