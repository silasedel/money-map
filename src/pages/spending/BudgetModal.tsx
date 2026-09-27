import { useEffect, useMemo, useRef, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Segmented } from '@/components/ui/Field'
import { actions, shallowArray, useStore } from '@/lib/store'
import { currencySymbol } from '@/lib/format'
import { groupTransactions } from '@/lib/grouping'
import { ALL_LABEL } from '@/lib/budgets'
import type { Budget, BudgetPeriod } from '@/lib/types'

export interface BudgetPreset {
  /** `undefined` means the whole month. */
  group?: string
  limit?: number
}

interface Props {
  open: boolean
  onClose: () => void
  editing?: Budget | null
  preset?: BudgetPreset | null
}

const ALL = '__all'
const CUSTOM = '__custom'

export function BudgetModal({ open, onClose, editing, preset }: Props) {
  const transactions = useStore((s) => s.transactions, shallowArray)
  const budgets = useStore((s) => s.budgets, shallowArray)

  const [choice, setChoice] = useState<string>(ALL)
  const [custom, setCustom] = useState('')
  const [limit, setLimit] = useState('')
  const [period, setPeriod] = useState<BudgetPeriod>('monthly')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const limitRef = useRef<HTMLInputElement>(null)

  /* Every expense group the ledger knows, so a budget is picked rather than
     typed — a typo'd group would watch nothing. */
  const groups = useMemo(
    () => groupTransactions(transactions.filter((t) => t.kind === 'expense')).map((g) => g.label),
    [transactions],
  )

  useEffect(() => {
    if (!open) return
    const g = editing ? editing.group : preset?.group
    if (g === undefined) setChoice(ALL)
    else if (groups.includes(g)) setChoice(g)
    else {
      setChoice(CUSTOM)
      setCustom(g)
    }
    if (g === undefined || groups.includes(g)) setCustom('')
    setLimit(editing ? String(editing.limit) : preset?.limit ? String(preset.limit) : '')
    setPeriod(editing?.period ?? 'monthly')
    setConfirmDelete(false)
    const t = setTimeout(() => limitRef.current?.focus(), 90)
    return () => clearTimeout(t)
  }, [open, editing, preset, groups])

  const value = Number.parseFloat(limit)
  const group = choice === ALL ? undefined : choice === CUSTOM ? custom.trim() : choice
  const valid = Number.isFinite(value) && value > 0 && (choice !== CUSTOM || custom.trim().length > 0)

  const duplicate =
    !editing &&
    budgets.some((b) => (b.group ?? '').toLowerCase() === (group ?? '').toLowerCase())

  const submit = () => {
    if (!valid || duplicate) return
    const payload = { group, limit: value, period }
    if (editing) actions.updateBudget(editing.id, payload)
    else actions.addBudget(payload)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit budget' : 'Set a budget'}
      subtitle="A ceiling on a group the ledger already tracks."
      width={420}
      footer={
        <>
          {editing &&
            (confirmDelete ? (
              <span className="confirm" style={{ marginRight: 'auto' }}>
                Remove this budget?
                <button
                  className="confirm__yes"
                  onClick={() => {
                    actions.removeBudget(editing.id)
                    onClose()
                  }}
                >
                  Remove
                </button>
                <button className="confirm__no" onClick={() => setConfirmDelete(false)}>
                  Keep
                </button>
              </span>
            ) : (
              <Button variant="quiet" icon="trash" onClick={() => setConfirmDelete(true)} style={{ marginRight: 'auto' }}>
                Remove
              </Button>
            ))}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!valid || duplicate}>
            {editing ? 'Save' : 'Set budget'}
          </Button>
        </>
      }
    >
      <form
        className="txf"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <Field label="Watches" hint={duplicate ? 'Already has a budget' : undefined}>
          <select className="inp" value={choice} onChange={(e) => setChoice(e.target.value)}>
            <option value={ALL}>{ALL_LABEL} — every expense</option>
            {groups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
            <option value={CUSTOM}>Something not listed…</option>
          </select>
        </Field>

        {choice === CUSTOM && (
          <Field label="Group name" hint="Must match how entries are filed">
            <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="e.g. Coffee" autoComplete="off" />
          </Field>
        )}

        <div className="txf__row">
          <Field label="Limit">
            <Input
              ref={limitRef}
              prefix={currencySymbol()}
              value={limit}
              onChange={(e) => setLimit(e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="0"
              inputMode="decimal"
              autoComplete="off"
            />
          </Field>
          <Field label="Per">
            <Segmented
              value={period}
              onChange={setPeriod}
              layoutId="budget-period"
              options={[
                { value: 'monthly', label: 'Month' },
                { value: 'yearly', label: 'Year' },
              ]}
            />
          </Field>
        </div>

        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  )
}
