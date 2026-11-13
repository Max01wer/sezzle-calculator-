import type { BinaryOperation } from '../types/calculator'

/** Symbols shown in the UI for each binary operation. */
export const OPERATION_SYMBOLS: Record<BinaryOperation, string> = {
  add: '+',
  subtract: '−',
  multiply: '×',
  divide: '÷',
  power: '^',
  percentage: '% of',
}

/** Max digits a user can type into a single operand (float64 is exact to ~15). */
export const MAX_INPUT_DIGITS = 15

/**
 * Formats a number for the display: plain notation for "normal" magnitudes,
 * scientific notation for very large or very small values so they fit.
 */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return 'Error'
  if (Object.is(value, -0)) return '0'

  const abs = Math.abs(value)
  if (abs !== 0 && (abs >= 1e15 || abs < 1e-9)) {
    // toExponential(9) -> trim trailing zeros in the mantissa: 1.230000000e+20 -> 1.23e+20
    return value.toExponential(9).replace(/\.?0+e/, 'e')
  }
  return String(value)
}

/** Counts the digits of a typed operand, ignoring sign and decimal point. */
export function countDigits(input: string): number {
  return input.replace(/[^0-9]/g, '').length
}
