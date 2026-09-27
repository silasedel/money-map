import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { spring } from '@/lib/motion'

interface FieldProps {
  label: string
  hint?: string
  children: ReactNode
  className?: string
}

export function Field({ label, hint, children, className = '' }: FieldProps) {
  return (
    <label className={`fld ${className}`}>
      <span className="fld__top">
        <span className="fld__label">{label}</span>
        {hint && <span className="fld__hint">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { prefix?: string }

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ prefix, className = '', ...rest }, ref) => {
    if (prefix) {
      return (
        <span className={`inp inp--wrap ${className}`}>
          <span className="inp__prefix">{prefix}</span>
          <input ref={ref} className="inp__inner" {...rest} />
        </span>
      )
    }
    return <input ref={ref} className={`inp ${className}`} {...rest} />
  },
)
Input.displayName = 'Input'

/* ── Segmented control ──────────────────────────────── */

interface SegmentedProps<T extends string> {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; accent?: 'sage' | 'clay' }[]
  layoutId?: string
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  layoutId = 'seg',
}: SegmentedProps<T>) {
  const active = options.find((o) => o.value === value)
  return (
    <div className={`seg seg--${active?.accent ?? 'sage'}`} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          className={`seg__opt ${o.value === value ? 'is-on' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.value === value && (
            <motion.span
              layoutId={layoutId}
              className="seg__thumb"
              transition={spring.body}
            />
          )}
          <span className="seg__text">{o.label}</span>
        </button>
      ))}
    </div>
  )
}
