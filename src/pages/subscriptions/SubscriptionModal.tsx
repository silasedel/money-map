import { useEffect, useRef, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Segmented } from '@/components/ui/Field'
import { CategoryPicker } from '@/components/Categories'
import { actions } from '@/lib/store'
import { currencySymbol, todayISO } from '@/lib/format'
import { CADENCES, perMonth } from '@/lib/subscriptions'
import { money } from '@/lib/format'
import type { Cadence, Subscription, TxKind } from '@/lib/types'

export interface SubPreset {
  title?: string
  amount?: number
  kind?: TxKind
  cadence?: Cadence
  nextDate?: string
}

interface Props {
  open: boolean
  onClose: () => void
  editing?: Subscription | null
  preset?: SubPreset | null
}

export function SubscriptionModal({ open, onClose, editing, preset }: Props) {
  const [kind, setKind] = useState<TxKind>('expense')
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [cadence, setCadence] = useState<Cadence>('monthly')
  const [nextDate, setNextDate] = useState(todayISO)
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined)
  const [note, setNote] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setKind(editing?.kind ?? preset?.kind ?? 'expense')
    setTitle(editing?.title ?? preset?.title ?? '')
    setAmount(editing ? String(editing.amount) : preset?.amount ? String(preset.amount) : '')
    setCadence(editing?.cadence ?? preset?.cadence ?? 'monthly')
    setNextDate(editing?.nextDate ?? preset?.nextDate ?? todayISO())
    setCategoryId(editing?.categoryId)
    setNote(editing?.note ?? '')
    setConfirmDelete(false)
    const t = setTimeout(() => titleRef.current?.focus(), 90)
    return () => clearTimeout(t)
  }, [open, editing, preset])

  const value = Number.parseFloat(amount)
  const valid = title.trim().length > 0 && Number.isFinite(value) && value > 0 && /^\d{4}-\d{2}-\d{2}$/.test(nextDate)

  const submit = () => {
    if (!valid) return
    const payload = {
      title: title.trim(),
      amount: value,
      kind,
      cadence,
      nextDate,
      tags: editing?.tags,
      categoryId,
      note: note.trim() || undefined,
    }
    if (editing) actions.updateSubscription(editing.id, payload)
    else actions.addSubscription({ ...payload, status: 'active' })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit subscription' : 'New subscription'}
      subtitle="Anything that repeats — rent, streaming, a retainer coming in."
      width={460}
      footer={
        <>
          {editing &&
            (confirmDelete ? (
              <span className="confirm" style={{ marginRight: 'auto' }}>
                Delete? Logged payments stay in the ledger.
                <button
                  className="confirm__yes"
                  onClick={() => {
                    actions.removeSubscription(editing.id)
                    onClose()
                  }}
                >
                  Delete
                </button>
                <button className="confirm__no" onClick={() => setConfirmDelete(false)}>
                  Keep
                </button>
              </span>
            ) : (
              <>
                <Button variant="quiet" icon="trash" onClick={() => setConfirmDelete(true)}>
                  Delete
                </Button>
                {editing.status !== 'cancelled' && (
                  <Button
                    variant="quiet"
                    onClick={() => {
                      actions.updateSubscription(editing.id, { status: 'cancelled' })
                      onClose()
                    }}
                    style={{ marginRight: 'auto' }}
                  >
                    Cancel it
                  </Button>
                )}
              </>
            ))}
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" onClick={submit} disabled={!valid}>
            {editing ? 'Save' : 'Track it'}
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
        <Segmented
          value={kind}
          onChange={setKind}
          layoutId="sub-kind"
          options={[
            { value: 'expense', label: 'I pay', accent: 'clay' },
            { value: 'income', label: 'I get paid', accent: 'sage' },
          ]}
        />

        <Field label="Name">
          <Input
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={kind === 'income' ? 'Retainer — Acme' : 'Netflix'}
            autoComplete="off"
            spellCheck={false}
          />
        </Field>

        <div className="txf__row">
          <Field label="Amount" hint={Number.isFinite(value) && cadence !== 'monthly' ? `≈ ${money(perMonth(value, cadence))}/mo` : undefined}>
            <Input
              prefix={currencySymbol()}
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="0.00"
              inputMode="decimal"
              autoComplete="off"
            />
          </Field>
          <Field label="Every">
            <select className="inp" value={cadence} onChange={(e) => setCadence(e.target.value as Cadence)}>
              {CADENCES.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Next due" hint="Moves forward each time you log a payment">
          <Input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value || todayISO())} />
        </Field>

        <Field label="Category" hint="Carried onto every payment">
          <CategoryPicker value={categoryId} onChange={setCategoryId} />
        </Field>

        <Field label="Note" hint="Optional">
          <textarea className="inp" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Plan, account, who it's shared with…" />
        </Field>

        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  )
}
