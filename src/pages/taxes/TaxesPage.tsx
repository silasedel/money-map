import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { PageShell } from '@/components/PageShell'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/Icon'
import { TagChip } from '@/components/Tags'
import { shallowArray, useStore } from '@/lib/store'
import { ui } from '@/lib/ui'
import { taxSummary, toCSV, yearsInLedger } from '@/lib/finance'
import { groupTransactions } from '@/lib/grouping'
import { tagTotals } from '@/lib/tags'
import { money } from '@/lib/format'
import { spring, stagger } from '@/lib/motion'
import { Composition } from '../ledger/Composition'
import { TransactionList } from '../ledger/TransactionList'
import { toSlices } from '../ledger/palette'
import '../ledger/ledger.css'
import './taxes.css'

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']

export function TaxesPage() {
  const transactions = useStore((s) => s.transactions, shallowArray)
  const years = useMemo(() => yearsInLedger(transactions), [transactions])
  const [year, setYear] = useState(years[0])

  const tax = useMemo(() => taxSummary(transactions, year), [transactions, year])
  const slices = useMemo(() => toSlices(tax.byGroup, 1), [tax.byGroup])

  const yearTx = useMemo(() => transactions.filter((t) => t.date.startsWith(`${year}-`)), [transactions, year])
  const tags = useMemo(() => tagTotals(yearTx), [yearTx])

  const groupOf = useMemo(() => {
    const map = new Map<string, string>()
    for (const g of groupTransactions(transactions.filter((t) => t.kind === 'expense'))) {
      for (const t of g.transactions) map.set(t.id, g.label)
    }
    return map
  }, [transactions])

  const exportCSV = () => {
    const blob = new Blob([toCSV(tax.entries)], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `write-offs-${year}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const qMax = Math.max(...tax.quarters, 1)
  const anyTagged = tags.length > 0

  return (
    <PageShell
      title="Taxes"
      subtitle={
        tax.deductibleCount
          ? `${money(tax.deductible)} in write-offs for ${year}`
          : 'Tag an expense as a write-off and it counts here'
      }
      actions={
        <>
          {years.length > 1 && (
            <div className="tx__years">
              {years.map((y) => (
                <button key={y} className={`tx__year num ${y === year ? 'is-on' : ''}`} onClick={() => setYear(y)}>
                  {y === year && <motion.span layoutId="tx-year" className="tx__yearThumb" transition={spring.body} />}
                  <span>{y}</span>
                </button>
              ))}
            </div>
          )}
          <Button variant="soft" icon="download" onClick={exportCSV} disabled={!tax.entries.length}>
            Export CSV
          </Button>
        </>
      }
    >
      {!anyTagged ? (
        <motion.div
          className="card tx__blank"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring.calm}
        >
          <div className="empty">
            <span className="empty__mark">
              <Icon name="tax" size={20} />
            </span>
            <h2 className="empty__title">Nothing tagged yet</h2>
            <p className="empty__text">
              When you log an expense, tap <strong>Write-off</strong>. Or hover
              any expense in the ledger and hit the receipt icon. Everything
              tagged rolls up here by quarter and by group, ready to hand over.
            </p>
            <div className="tx__blankActions">
              <Button variant="primary" icon="plus" onClick={() => ui.openComposer({ preset: { kind: 'expense', tags: ['deductible'] } })}>
                Log a write-off
              </Button>
              <Button variant="soft" onClick={() => ui.showInLedger({ kind: 'expense', month: 'all' })}>
                Tag past entries
              </Button>
            </div>
          </div>
        </motion.div>
      ) : (
        <>
          {/* ── Figures ─────────────────────────────── */}
          <div className="tx__tiles">
            <motion.div
              className="tile tile--hero tx__hero"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={spring.calm}
            >
              <span className="tile__label">Write-offs · {year}</span>
              <span className="tile__value num tx__heroValue">{money(tax.deductible)}</span>
              <span className="tile__note">
                {tax.deductibleCount} entr{tax.deductibleCount === 1 ? 'y' : 'ies'} tagged
              </span>
            </motion.div>
            <motion.div
              className="tile"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring.calm, delay: 0.05 }}
            >
              <span className="tile__label">Business spend</span>
              <span className="tile__value num">{money(tax.business)}</span>
              <span className="tile__note">Tagged business, write-off or not</span>
            </motion.div>
            <motion.div
              className="tile"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring.calm, delay: 0.1 }}
            >
              <span className="tile__label">Business income</span>
              <span className="tile__value num">{money(tax.businessIncome)}</span>
              <span className="tile__note">Income tagged business</span>
            </motion.div>
            <motion.div
              className="tile"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring.calm, delay: 0.15 }}
            >
              <span className="tile__label">Net of write-offs</span>
              <span className={`tile__value num ${tax.businessIncome - tax.deductible < 0 ? 'is-neg' : ''}`}>
                {money(tax.businessIncome - tax.deductible)}
              </span>
              <span className="tile__note">Business income − write-offs</span>
            </motion.div>
          </div>

          <div className="tx__split">
            {/* ── Quarters ───────────────────────────── */}
            <motion.section
              className="card tx__quarters"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring.calm, delay: 0.12 }}
            >
              <div className="card__head">
                <h3 className="card__title">By quarter</h3>
                <span className="card__note">Write-offs</span>
              </div>
              <div className="tx__qGrid">
                {tax.quarters.map((q, i) => (
                  <div key={QUARTERS[i]} className="tx__q">
                    <span className="tx__qAmt num">{money(q)}</span>
                    <span className="tx__qBarWrap">
                      <motion.span
                        className="tx__qBar"
                        initial={{ height: 0 }}
                        animate={{ height: `${Math.max((q / qMax) * 100, q > 0 ? 6 : 0)}%` }}
                        transition={{ ...spring.glide, delay: stagger(i, 0.06) }}
                      />
                    </span>
                    <span className="tx__qLabel">{QUARTERS[i]}</span>
                  </div>
                ))}
              </div>
            </motion.section>

            <Composition
              title="By group"
              slices={slices}
              total={tax.deductible}
              empty={`No write-offs in ${year}.`}
            />
          </div>

          {/* ── Every tag ──────────────────────────────── */}
          <div className="sec">
            <h2 className="sec__title">Every tag · {year}</h2>
            <span className="sec__note">Click one to see its entries</span>
          </div>
          <section className="card tx__tags">
            <ul className="tx__tagList">
              {tags.map((t, i) => (
                <motion.li
                  key={t.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...spring.calm, delay: stagger(i, 0.03) }}
                >
                  <button
                    className="tx__tagRow"
                    onClick={() => ui.showInLedger({ tag: t.id, month: 'all' })}
                  >
                    <TagChip id={t.id} size="md" />
                    <span className="tx__tagCount">
                      {t.count} entr{t.count === 1 ? 'y' : 'ies'}
                    </span>
                    <span className="tx__tagSums num">
                      {t.earned > 0 && <span className="is-in">+{money(t.earned)}</span>}
                      {t.spent > 0 && <span>−{money(t.spent)}</span>}
                    </span>
                    <Icon name="arrowRight" size={13} strokeWidth={2} className="tx__tagGo" />
                  </button>
                </motion.li>
              ))}
            </ul>
          </section>

          {/* ── Entries ────────────────────────────────── */}
          <div className="sec">
            <h2 className="sec__title">Write-off entries</h2>
            <span className="sec__note">What the CSV contains</span>
          </div>
          <TransactionList
            transactions={tax.entries}
            groupOf={groupOf}
            emptyText={`Nothing tagged as a write-off in ${year}.`}
          />
        </>
      )}
    </PageShell>
  )
}
