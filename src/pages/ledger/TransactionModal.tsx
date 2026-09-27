import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Segmented } from '@/components/ui/Field'
import { CategoryPicker } from '@/components/Categories'
import { actions, useStore, shallowArray } from '@/lib/store'
import { ui, useUI } from '@/lib/ui'
import { currencySymbol, todayISO } from '@/lib/format'
import { detectGroup } from '@/lib/grouping'
import { CADENCES, advanceDate } from '@/lib/subscriptions'
import { easeQuick } from '@/lib/motion'
import { Icon } from '@/components/Icon'
import type { Cadence, Transaction, TxKind } from '@/lib/types'

type Repeat = 'none' | Cadence

/**
 * The full entry form. Mounted once at the app root and opened from anywhere
 * through the `ui` store. The quick-add bar covers the common case; this is
 * for a different date, a tag, something that repeats, or a note — and for
 * editing anything already logged.
 */
export function TransactionModal() {
  const { open, editing, preset } = useUI((s) => s.composer)
  const transactions = useStore((s) => s.transactions, shallowArray)
  const subscriptions = useStore((s) => s.subscriptions, shallowArray)

  const [kind, setKind] = useState<TxKind>('expense')
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO)
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined)
  const [repeat, setRepeat] = useState<Repeat>('none')
  const [note, setNote] = useState('')
  const [showNote, setShowNote] = useState(false)
  /** Empty means "keep filing this automatically". */
  const [group, setGroup] = useState('')
  const [showGroup, setShowGroup] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const titleRef = useRef<HTMLInputElement>(null)
  const amountRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setKind(editing?.kind ?? preset?.kind ?? 'expense')
    setTitle(editing?.title ?? preset?.title ?? '')
    setAmount(
      editing ? String(editing.amount) : preset?.amount !== undefined ? String(preset.amount) : '',
    )
    setDate(editing?.date ?? preset?.date ?? todayISO())
    setCategoryId(editing?.categoryId ?? preset?.categoryId)
    setRepeat('none')
    setNote(editing?.note ?? '')
    setShowNote(Boolean(editing?.note))
    setGroup(editing?.group ?? preset?.group ?? '')
    setShowGroup(Boolean(editing?.group ?? preset?.group))
    setConfirmDelete(false)
    // Wait for the panel's entrance to commit before taking the caret. If the
    // title came pre-filled, the amount is what's missing.
    const t = setTimeout(() => {
      const el = preset?.title && !editing ? amountRef.current : titleRef.current
      el?.focus()
    }, 90)
    return () => clearTimeout(t)
  }, [open, editing, preset])

  const value = Number.parseFloat(amount)
  const valid = title.trim().length > 0 && Number.isFinite(value) && value > 0

  /* Where this entry will be filed — shown before you commit, so the app's
     guess is visible rather than something you discover on a chart later. */
  const detected = useMemo(() => {
    const clean = title.trim()
    if (clean.length < 3) return null
    const probe: Transaction = {
      id: editing?.id ?? '__probe',
      kind,
      title: clean,
      amount: Number.isFinite(value) ? value : 1,
      date,
      createdAt: editing?.createdAt ?? Date.now(),
    }
    return detectGroup(probe, transactions)
  }, [title, kind, value, date, transactions, editing])

  /** The subscription this entry belongs to, if it was logged from one. */
  const linkedId = editing?.subscriptionId ?? preset?.subscriptionId
  const linked = linkedId ? subscriptions.find((s) => s.id === linkedId) : undefined

  const submit = () => {
    if (!valid) return
    const clean = title.trim()
    const override = group.trim()
    const payload = {
      kind,
      title: clean,
      amount: value,
      note: note.trim() || undefined,
      date,
      group: override || undefined,
      // Tags are only ever set from the ledger row (write-off) — keep them.
      tags: editing?.tags ?? preset?.tags,
      categoryId,
      subscriptionId: editing?.subscriptionId ?? preset?.subscriptionId,
    }

    if (editing) {
      actions.updateTransaction(editing.id, payload)
    } else if (preset?.subscriptionId) {
      // A payment logged from a subscription: the store advances the date.
      actions.logSubscriptionPayment(preset.subscriptionId, date, value)
    } else if (repeat !== 'none') {
      // Track it going forward — the next one is already on the calendar.
      const subId = actions.addSubscription({
        title: clean,
        amount: value,
        kind,
        cadence: repeat,
        nextDate: advanceDate(date, repeat),
        status: 'active',
        group: override || undefined,
        categoryId,
      })
      actions.addTransaction({ ...payload, subscriptionId: subId })
    } else {
      actions.addTransaction(payload)
    }

    // A correction is about the name, not the one entry — apply it to every
    // entry sharing this title so you never have to make it twice.
    if (override) actions.regroupByTitle(clean, override)

    ui.closeComposer()
  }

  const close = ui.closeComposer

  return (
    <Modal
      open={open}
      onClose={close}
      title={editing ? 'Edit entry' : linked ? `Log ${linked.title}` : kind === 'income' ? 'Money in' : 'Money out'}
      subtitle={
        linked
          ? 'Logging this moves the next expected date forward.'
          : editing
            ? 'Change anything — the charts follow.'
            : 'Name it, price it, done. Everything else is optional.'
      }
      width={440}
      footer={
        <>
          {editing &&
            (confirmDelete ? (
              <span className="confirm" style={{ marginRight: 'auto' }}>
                Delete this entry?
                <button
                  className="confirm__yes"
                  onClick={() => {
                    actions.removeTransaction(editing.id)
                    close()
                  }}
                >
                  Delete
                </button>
                <button className="confirm__no" onClick={() => setConfirmDelete(false)}>
                  Keep
                </button>
              </span>
            ) : (
              <Button
                variant="quiet"
                icon="trash"
                onClick={() => setConfirmDelete(true)}
                style={{ marginRight: 'auto' }}
              >
                Delete
              </Button>
            ))}
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!valid}>
            {editing ? 'Save' : linked ? 'Log payment' : 'Add'}
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
          layoutId="tx-kind"
          options={[
            { value: 'expense', label: 'Spent', accent: 'clay' },
            { value: 'income', label: 'Earned', accent: 'sage' },
          ]}
        />

        <Field label="What">
          <Input
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={kind === 'income' ? 'Paycheck, client invoice…' : 'Groceries, rent, Netflix…'}
            autoComplete="off"
            spellCheck={false}
          />
        </Field>

        <AnimatePresence initial={false}>
          {detected && !showGroup && (
            <motion.div
              className="txf__hint"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={easeQuick}
            >
              <Icon name="sparkle" size={13} strokeWidth={1.8} />
              <span>
                Goes under <strong>{group.trim() || detected}</strong>
              </span>
              <button
                type="button"
                className="txf__fix"
                onClick={() => {
                  setGroup(group.trim() || detected)
                  setShowGroup(true)
                }}
              >
                Change
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {showGroup && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={easeQuick}
              style={{ overflow: 'hidden' }}
            >
              <Field label="Group" hint="Applies to every entry with this name">
                <Input
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                  placeholder={detected ?? 'Group name'}
                  autoComplete="off"
                />
              </Field>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="txf__row">
          <Field label="How much">
            <Input
              ref={amountRef}
              prefix={currencySymbol()}
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="0.00"
              inputMode="decimal"
              autoComplete="off"
            />
          </Field>
          <Field label="When">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value || todayISO())}
            />
          </Field>
        </div>

        <Field label="Category" hint="Optional — a project, a channel, a side of life">
          <CategoryPicker value={categoryId} onChange={setCategoryId} />
        </Field>

        <div className="txf__extras">

          {!editing && !linked && (
            <label className="txf__repeat">
              <Icon name="repeat" size={13} strokeWidth={2} />
              <select
                className="txf__repeatSel"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value as Repeat)}
              >
                <option value="none">Just once</option>
                {CADENCES.map((c) => (
                  <option key={c.name} value={c.name}>
                    Repeats {c.label.toLowerCase()}
                  </option>
                ))}
              </select>
            </label>
          )}

          {!showNote && (
            <button type="button" className="txf__noteBtn" onClick={() => setShowNote(true)}>
              <Icon name="pencil" size={12} strokeWidth={2} /> Add a note
            </button>
          )}
        </div>

        <AnimatePresence initial={false}>
          {showNote && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={easeQuick}
              style={{ overflow: 'hidden' }}
            >
              <textarea
                className="inp"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Anything worth remembering later"
                autoFocus
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Lets Enter submit from any field without a visible control. */}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  )
}
