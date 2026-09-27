import { useEffect, useRef, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { actions } from '@/lib/store'
import { currencySymbol } from '@/lib/format'
import type { Goal, GoalMetric } from '@/lib/types'

interface Props {
  open: boolean
  onClose: () => void
  editing?: Goal | null
}

/**
 * Money goals bind to a live figure instead of a number you maintain; anything
 * else keeps a value you set by hand.
 */
const SOURCES: {
  metric: GoalMetric
  label: string
  blurb: string
  prefix?: string
  suffix?: string
}[] = [
  { metric: 'savings', label: 'Savings', blurb: 'Earned − spent', prefix: '$' },
  { metric: 'monthlyIncome', label: 'Monthly income', blurb: 'This month, in', prefix: '$' },
  { metric: 'earned', label: 'Total earned', blurb: 'All income', prefix: '$' },
  { metric: 'manual', label: 'Something else', blurb: 'You set the number' },
]

export function GoalModal({ open, onClose, editing }: Props) {
  const [title, setTitle] = useState('')
  const [target, setTarget] = useState('')
  const [current, setCurrent] = useState('')
  const [metric, setMetric] = useState<GoalMetric>('savings')
  const [suffix, setSuffix] = useState('')

  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setTitle(editing?.title ?? '')
    setTarget(editing ? String(editing.target) : '')
    setCurrent(editing ? String(editing.current) : '')
    setMetric(editing?.metric ?? 'savings')
    setSuffix(editing?.suffix?.trim() ?? '')
    const t = setTimeout(() => titleRef.current?.focus(), 90)
    return () => clearTimeout(t)
  }, [open, editing])

  const targetValue = Number.parseFloat(target)
  const valid =
    title.trim().length > 0 && Number.isFinite(targetValue) && targetValue > 0

  const source = SOURCES.find((s) => s.metric === metric)!
  const isMoney = metric !== 'manual'

  const submit = () => {
    if (!valid) return
    const payload = {
      title: title.trim(),
      target: targetValue,
      current: isMoney ? 0 : Number.parseFloat(current) || 0,
      metric,
      prefix: isMoney ? '$' : undefined,
      suffix: !isMoney && suffix.trim() ? ` ${suffix.trim()}` : undefined,
      accent: (editing?.accent ?? pickAccent(title)) as Goal['accent'],
    }
    if (editing) actions.updateGoal(editing.id, payload)
    else actions.addGoal(payload)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit goal' : 'New goal'}
      subtitle={
        isMoney
          ? 'This one keeps itself up to date from your entries.'
          : 'Track anything with a number attached.'
      }
      width={432}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!valid}>
            {editing ? 'Save' : 'Create goal'}
          </Button>
        </>
      }
    >
      <form
        className="glf"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <Field label="Goal">
          <Input
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Save $25,000"
            autoComplete="off"
          />
        </Field>

        <Field label="Track it from" hint={source.blurb}>
          <div className="glf__sources">
            {SOURCES.map((s) => (
              <button
                key={s.metric}
                type="button"
                className={`glf__source ${metric === s.metric ? 'is-on' : ''}`}
                onClick={() => setMetric(s.metric)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </Field>

        <div className="txf__row">
          <Field label="Target">
            <Input
              prefix={isMoney ? currencySymbol() : undefined}
              value={target}
              onChange={(e) => setTarget(e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder={isMoney ? '25000' : '100000'}
              inputMode="decimal"
              autoComplete="off"
            />
          </Field>

          {isMoney ? (
            <Field label="Progress" hint="Automatic">
              <div className="glf__auto">{source.label}</div>
            </Field>
          ) : (
            <Field label="Current">
              <Input
                value={current}
                onChange={(e) => setCurrent(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="0"
                inputMode="decimal"
                autoComplete="off"
              />
            </Field>
          )}
        </div>

        {!isMoney && (
          <Field label="Unit" hint="Optional — shown after the number">
            <Input
              value={suffix}
              onChange={(e) => setSuffix(e.target.value)}
              placeholder="subscribers"
              autoComplete="off"
            />
          </Field>
        )}

        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  )
}

const ACCENTS: Goal['accent'][] = ['sage', 'dusk', 'clay', 'amber']

/** Deterministic so a goal's colour never shuffles between renders. */
function pickAccent(seed: string): Goal['accent'] {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 9973
  return ACCENTS[h % ACCENTS.length]
}
