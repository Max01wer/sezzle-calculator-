import type { BinaryOperation } from '../types/calculator'
import { MAX_INPUT_DIGITS, OPERATION_SYMBOLS, countDigits, formatNumber } from '../utils/format'

/**
 * All calculator UI state lives here as a pure reducer: no I/O, no React.
 * Pure functions are trivial to unit test and to reason about. The API calls
 * live in the useCalculator hook, which dispatches the outcome back here.
 */
export interface CalculatorState {
  /** What the main display shows: the number being typed or the last result. */
  display: string
  /** Left operand of a pending binary operation. */
  firstOperand: number | null
  /** Binary operation waiting for its second operand. */
  operation: BinaryOperation | null
  /** True right after an operator is chosen: there is no second operand yet. */
  waitingForOperand: boolean
  /** True when the next digit should replace the display (after an operator or a result). */
  overwrite: boolean
  /** Small "history" line above the display, e.g. "12 ÷ 4 =". */
  expression: string
  /** User-friendly error message, if any. */
  error: string | null
  /** True while a request to the API is in flight. */
  loading: boolean
}

export type CalculatorAction =
  | { type: 'digit'; digit: string }
  | { type: 'decimal' }
  | { type: 'backspace' }
  | { type: 'toggleSign' }
  | { type: 'clear' }
  | { type: 'setOperation'; operation: BinaryOperation }
  | { type: 'requestStart' }
  | { type: 'binaryResult'; result: number; expression: string; nextOperation: BinaryOperation | null }
  | { type: 'unaryResult'; result: number; expression: string }
  | { type: 'requestFailure'; message: string }
  | { type: 'validationError'; message: string }

export const initialState: CalculatorState = {
  display: '0',
  firstOperand: null,
  operation: null,
  waitingForOperand: false,
  overwrite: false,
  expression: '',
  error: null,
  loading: false,
}

export function calculatorReducer(state: CalculatorState, action: CalculatorAction): CalculatorState {
  switch (action.type) {
    case 'digit': {
      if (state.overwrite) {
        return {
          ...state,
          display: action.digit,
          overwrite: false,
          waitingForOperand: false,
          // Typing after "=" starts a brand-new calculation.
          expression: state.operation ? state.expression : '',
          error: null,
        }
      }
      if (countDigits(state.display) >= MAX_INPUT_DIGITS) return state
      const display =
        state.display === '0' ? action.digit : state.display === '-0' ? `-${action.digit}` : state.display + action.digit
      return { ...state, display, error: null }
    }

    case 'decimal': {
      if (state.overwrite) {
        return {
          ...state,
          display: '0.',
          overwrite: false,
          waitingForOperand: false,
          expression: state.operation ? state.expression : '',
          error: null,
        }
      }
      if (state.display.includes('.')) return state
      return { ...state, display: `${state.display}.`, error: null }
    }

    case 'backspace': {
      // Results are not editable digit by digit, like on a real calculator.
      if (state.overwrite) return state
      const trimmed = state.display.slice(0, -1)
      const display = trimmed === '' || trimmed === '-' ? '0' : trimmed
      return { ...state, display, error: null }
    }

    case 'toggleSign': {
      if (state.waitingForOperand || state.display === '0') return state
      const display = state.display.startsWith('-') ? state.display.slice(1) : `-${state.display}`
      return { ...state, display, error: null }
    }

    case 'clear':
      return initialState

    case 'setOperation': {
      // Operator pressed twice in a row: just swap it (e.g. "5 +" then "×").
      if (state.operation && state.waitingForOperand) {
        return {
          ...state,
          operation: action.operation,
          expression: `${formatNumber(state.firstOperand ?? 0)} ${OPERATION_SYMBOLS[action.operation]}`,
          error: null,
        }
      }
      const firstOperand = Number(state.display)
      return {
        ...state,
        firstOperand,
        operation: action.operation,
        waitingForOperand: true,
        overwrite: true,
        expression: `${formatNumber(firstOperand)} ${OPERATION_SYMBOLS[action.operation]}`,
        error: null,
      }
    }

    case 'requestStart':
      return { ...state, loading: true, error: null }

    case 'binaryResult': {
      const display = formatNumber(action.result)
      if (action.nextOperation) {
        // Chained calculation: "2 + 3 ×" -> result 5 becomes the next left operand.
        return {
          ...state,
          display,
          firstOperand: action.result,
          operation: action.nextOperation,
          waitingForOperand: true,
          overwrite: true,
          expression: `${display} ${OPERATION_SYMBOLS[action.nextOperation]}`,
          loading: false,
        }
      }
      return {
        ...state,
        display,
        firstOperand: null,
        operation: null,
        waitingForOperand: false,
        overwrite: true,
        expression: action.expression,
        loading: false,
      }
    }

    case 'unaryResult':
      return {
        ...state,
        display: formatNumber(action.result),
        waitingForOperand: false,
        overwrite: true,
        // Keep showing a pending "12 +" so the user knows sqrt fed the second operand.
        expression: state.operation ? state.expression : action.expression,
        loading: false,
      }

    case 'requestFailure':
      // A failed calculation resets the calculator (like "Error" on a real one)
      // but keeps the explanation visible until the user types again.
      return { ...initialState, error: action.message }

    case 'validationError':
      return { ...state, error: action.message, loading: false }

    default: {
      // Exhaustiveness check: TypeScript errors here if an action type is unhandled.
      const unreachable: never = action
      return unreachable
    }
  }
}
