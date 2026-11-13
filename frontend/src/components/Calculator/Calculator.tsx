import { useCalculator } from '../../hooks/useCalculator'
import { useKeyboard } from '../../hooks/useKeyboard'
import styles from './Calculator.module.css'
import { Display } from './Display'
import { Keypad } from './Keypad'

/** Container component: owns state via hooks, renders presentational children. */
export function Calculator() {
  const { state, actions } = useCalculator()
  useKeyboard(actions)

  return (
    <section className={styles.calculator} aria-label="Calculator">
      <Display expression={state.expression} value={state.display} error={state.error} loading={state.loading} />
      <Keypad actions={actions} activeOperation={state.waitingForOperand ? state.operation : null} disabled={state.loading} />
      <p className={styles.hint}>
        Keyboard: <kbd>0–9</kbd> <kbd>.</kbd> <kbd>+</kbd> <kbd>-</kbd> <kbd>*</kbd> <kbd>/</kbd> <kbd>^</kbd>{' '}
        <kbd>%</kbd> <kbd>r</kbd> √ · <kbd>Enter</kbd> = · <kbd>⌫</kbd> · <kbd>Esc</kbd> clear
      </p>
    </section>
  )
}
