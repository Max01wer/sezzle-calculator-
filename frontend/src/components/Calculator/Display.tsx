import styles from './Calculator.module.css'

interface DisplayProps {
  expression: string
  value: string
  error: string | null
  loading: boolean
}

/** Shrinks the font for long numbers so they always fit on small screens. */
function sizeClass(value: string): string {
  if (value.length > 14) return styles.valueSmall ?? ''
  if (value.length > 9) return styles.valueMedium ?? ''
  return ''
}

export function Display({ expression, value, error, loading }: DisplayProps) {
  return (
    <div className={styles.display}>
      <div className={styles.expression} data-testid="expression" aria-label="Expression">
        {expression || ' '}
      </div>
      <output
        className={`${styles.value} ${sizeClass(value)}`}
        aria-live="polite"
        aria-busy={loading}
        aria-label="Result"
        data-testid="display"
      >
        {value}
      </output>
      <div className={styles.status}>
        {error ? (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        ) : loading ? (
          <p className={styles.loading}>Calculating…</p>
        ) : null}
      </div>
    </div>
  )
}
