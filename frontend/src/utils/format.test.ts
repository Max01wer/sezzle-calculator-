import { describe, expect, it } from 'vitest'
import { countDigits, formatNumber } from './format'

describe('formatNumber', () => {
  it.each([
    [0, '0'],
    [-0, '0'],
    [42, '42'],
    [-3.5, '-3.5'],
    [0.3, '0.3'],
    [123456789012345, '123456789012345'],
    [1e15, '1e+15'],
    [1.23e20, '1.23e+20'],
    [-2.5e-12, '-2.5e-12'],
    [Infinity, 'Error'],
    [NaN, 'Error'],
  ])('formats %s as %s', (input, expected) => {
    expect(formatNumber(input)).toBe(expected)
  })
})

describe('countDigits', () => {
  it.each([
    ['0', 1],
    ['-12.5', 3],
    ['0.', 1],
  ])('counts digits in %s', (input, expected) => {
    expect(countDigits(input)).toBe(expected)
  })
})
