import type { CalculatorActions } from '../../hooks/useCalculator'
import type { BinaryOperation } from '../../types/calculator'
import styles from './Calculator.module.css'

type Variant = 'digit' | 'function' | 'operator' | 'equals'

interface KeyConfig {
  label: string
  ariaLabel: string
  variant: Variant
  onPress: (actions: CalculatorActions) => void
  operation?: BinaryOperation
  wide?: boolean
}

const digit = (d: string): KeyConfig => ({
  label: d,
  ariaLabel: d,
  variant: 'digit',
  onPress: (a) => a.inputDigit(d),
})

const operator = (label: string, ariaLabel: string, operation: BinaryOperation, variant: Variant = 'operator'): KeyConfig => ({
  label,
  ariaLabel,
  variant,
  operation,
  onPress: (a) => a.chooseOperation(operation),
})

/** Declarative layout: 4 columns, read row by row. Easy to rearrange. */
const KEYS: KeyConfig[] = [
  { label: 'AC', ariaLabel: 'Clear', variant: 'function', onPress: (a) => a.clear() },
  { label: '⌫', ariaLabel: 'Delete', variant: 'function', onPress: (a) => a.backspace() },
  operator('xʸ', 'Power', 'power', 'function'),
  { label: '√', ariaLabel: 'Square root', variant: 'function', onPress: (a) => void a.squareRoot() },

  digit('7'), digit('8'), digit('9'), operator('÷', 'Divide', 'divide'),
  digit('4'), digit('5'), digit('6'), operator('×', 'Multiply', 'multiply'),
  digit('1'), digit('2'), digit('3'), operator('−', 'Subtract', 'subtract'),

  { label: '±', ariaLabel: 'Toggle sign', variant: 'digit', onPress: (a) => a.toggleSign() },
  digit('0'),
  { label: '.', ariaLabel: 'Decimal point', variant: 'digit', onPress: (a) => a.inputDecimal() },
  operator('+', 'Add', 'add'),

  operator('%', 'Percent of', 'percentage', 'function'),
  { label: '=', ariaLabel: 'Equals', variant: 'equals', wide: true, onPress: (a) => a.equals() },
]

interface KeypadProps {
  actions: CalculatorActions
  activeOperation: BinaryOperation | null
  disabled: boolean
}

export function Keypad({ actions, activeOperation, disabled }: KeypadProps) {
  return (
    <div className={styles.keypad} role="group" aria-label="Calculator keypad">
      {KEYS.map((key) => {
        const isActive = key.operation !== undefined && key.operation === activeOperation
        return (
          <button
            key={key.ariaLabel}
            type="button"
            className={[styles.key, styles[key.variant], key.wide ? styles.wide : '', isActive ? styles.active : '']
              .filter(Boolean)
              .join(' ')}
            aria-label={key.ariaLabel}
            aria-pressed={key.operation ? isActive : undefined}
            disabled={disabled}
            onClick={() => key.onPress(actions)}
          >
            {key.label}
          </button>
        )
      })}
    </div>
  )
}
