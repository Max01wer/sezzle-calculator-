import { useEffect, useRef } from 'react'
import type { BinaryOperation } from '../types/calculator'
import type { CalculatorActions } from './useCalculator'

/** Physical keys mapped to binary operations. */
const OPERATION_KEYS: Record<string, BinaryOperation> = {
  '+': 'add',
  '-': 'subtract',
  '*': 'multiply',
  x: 'multiply',
  X: 'multiply',
  '/': 'divide',
  '^': 'power',
  '%': 'percentage',
}

/**
 * Translates a keyboard event into a calculator action.
 * Exported separately so the mapping can be unit tested without a DOM.
 * Returns true when the key was handled.
 */
export function handleKey(key: string, actions: CalculatorActions): boolean {
  if (/^[0-9]$/.test(key)) {
    actions.inputDigit(key)
    return true
  }
  const operation = OPERATION_KEYS[key]
  if (operation) {
    actions.chooseOperation(operation)
    return true
  }
  switch (key) {
    case '.':
    case ',':
      actions.inputDecimal()
      return true
    case 'Enter':
    case '=':
      actions.equals()
      return true
    case 'Backspace':
      actions.backspace()
      return true
    case 'Escape':
    case 'Delete':
    case 'c':
    case 'C':
      actions.clear()
      return true
    case 'r':
    case 'R':
      void actions.squareRoot()
      return true
    case 'F9':
      actions.toggleSign()
      return true
    default:
      return false
  }
}

/** Listens to global key presses and forwards them to the calculator. */
export function useKeyboard(actions: CalculatorActions): void {
  // Keep the latest actions in a ref so the listener is registered only once.
  const actionsRef = useRef(actions)
  useEffect(() => {
    actionsRef.current = actions
  }, [actions])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Leave browser/OS shortcuts alone (Ctrl+C, Cmd+R, ...).
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (handleKey(event.key, actionsRef.current)) {
        // Prevents "/" opening quick-find in Firefox and Enter re-clicking a focused button.
        event.preventDefault()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
