import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { actions, shallowArray, useStore } from '@/lib/store'
import { ui } from '@/lib/ui'
import { currencySymbol, todayISO } from '@/lib/format'
import { detectGroup } from '@/lib/grouping'
import { spring, easeQuick } from '@/lib/motion'
import type { Transaction, TxKind } from '@/lib/types'
import { Icon } from './Icon'

/**
 * The fastest way in: pick a direction, type a name and a number, press Enter.
 * Today's date, no tags, no note — the full form is one click away for the
 * rare entry that needs more, and everything can be edited later from the
 * ledger.
 */
export function QuickAdd() {
  const transactions = useStore((s) => s.transactions, shallowArray)
  const categories = useStore((s) => s.categories, shallowArray)
  const [kind, setKind] = useState<TxKind>('expense')
  const [categoryId, setCategoryId] = useState('')
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [flash, setFlash] = useState<string | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  const value = Number.parseFloat(amount)
  const valid = title.trim().length > 0 && Number.isFinite(value) && value > 0

  const filed = useMemo(() => {
    const clean = title.trim()
    if (clean.length < 3) return null
    const probe: Transaction = {
      id: '__probe',
      kind,
      title: clean,
      amount: 1,
      date: todayISO(),
      createdAt: 0,
    }
    return detectGroup(probe, transactions)
  }, [title, kind, transactions])

  const submit = () => {
    if (!valid) return
    actions.addTransaction({
      kind,
      title: title.trim(),
      amount: value,
      date: todayISO(),
      categoryId: categoryId || undefined,
    })
    setFlash(`${kind === 'income' ? '+' : '−'}${currencySymbol()}${value.toFixed(2)} · ${title.trim()}`)
    window.setTimeout(() => setFlash(null), 2200)
    setTitle('')
    setAmount('')
    titleRef.current?.focus()
  }

  const more = () =>
    ui.openComposer({
      preset: {
        kind,
        title: title.trim() || undefined,
        amount: Number.isFinite(value) && value > 0 ? value : undefined,
        categoryId: categoryId || undefined,
      },
    })

  return (
    <motion.form
      className={`qa qa--${kind}`}
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.calm}
    >
      <div className="qa__kind" role="tablist">
        {(
          [
            ['expense', 'Spent'],
            ['income', 'Earned'],
          ] as [TxKind, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kind === k}
            className={`qa__kindOpt ${kind === k ? 'is-on' : ''}`}
            onClick={() => setKind(k)}
          >
            {kind === k && <motion.span layoutId="qa-kind" className="qa__kindThumb" transition={spring.body} />}
            <span>{label}</span>
          </button>
        ))}
      </div>

      <label className="qa__field qa__field--title">
        <input
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={kind === 'income' ? 'What came in? e.g. Paycheck' : 'What was it? e.g. Groceries'}
          autoComplete="off"
          spellCheck={false}
        />
        <AnimatePresence>
          {filed && (
            <motion.span
              className="qa__filed"
              initial={{ opacity: 0, x: 4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={easeQuick}
            >
              → {filed}
            </motion.span>
          )}
        </AnimatePresence>
      </label>

      <label className="qa__field qa__field--amount">
        <span className="qa__sym">{currencySymbol()}</span>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
          placeholder="0.00"
          inputMode="decimal"
          autoComplete="off"
        />
      </label>

      {categories.length > 0 && (
        <select
          className={`qa__cat ${categoryId ? 'has-value' : ''}`}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          aria-label="Category"
        >
          <option value="">No category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}

      <button type="submit" className="qa__go" disabled={!valid}>
        <Icon name="check" size={15} strokeWidth={2.4} />
        <span>Add</span>
      </button>

      <button type="button" className="qa__more" onClick={more} title="Date, tags, repeat, note">
        <Icon name="grip" size={14} strokeWidth={2} />
      </button>

      <AnimatePresence>
        {flash && (
          <motion.span
            className="qa__flash"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={easeQuick}
          >
            <Icon name="check" size={11} strokeWidth={2.6} /> Logged {flash}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.form>
  )
}
