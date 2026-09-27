import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Icon } from './Icon'
import { actions, snapshot, useStore } from '@/lib/store'
import { CURRENCIES } from '@/lib/format'
import { easeQuick, spring } from '@/lib/motion'
import type { MotionChoice, ThemeChoice } from '@/lib/types'
import './SettingsModal.css'

interface Props {
  open: boolean
  onClose: () => void
}

const THEMES: { value: ThemeChoice; label: string; hint: string }[] = [
  { value: 'light', label: 'Light', hint: 'Warm paper' },
  { value: 'dark', label: 'Dark', hint: 'Warm dusk' },
  { value: 'system', label: 'System', hint: 'Follow the OS' },
]

const MOTIONS: { value: MotionChoice; label: string; hint: string }[] = [
  { value: 'full', label: 'Full', hint: 'Springs and physics' },
  { value: 'reduced', label: 'Reduced', hint: 'Cuts animation' },
]

export function SettingsModal({ open, onClose }: Props) {
  const settings = useStore((s) => s.settings)
  const nodeCount = useStore((s) => s.nodes.length)
  const txCount = useStore((s) => s.transactions.length)
  const goalCount = useStore((s) => s.goals.length)
  const subCount = useStore((s) => s.subscriptions.length)
  const budgetCount = useStore((s) => s.budgets.length)

  const [confirmingReset, setConfirmingReset] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const flash = (msg: string) => {
    setNotice(msg)
    window.setTimeout(() => setNotice(null), 2600)
  }

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(snapshot(), null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `money-map-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    flash('Backup downloaded')
  }

  const importBackup = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const ok = actions.importState(JSON.parse(String(reader.result)))
        flash(ok ? 'Backup restored' : "That file isn't a Money Map backup")
      } catch {
        flash("That file couldn't be read")
      }
    }
    reader.readAsText(file)
  }

  const close = () => {
    setConfirmingReset(false)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Settings"
      subtitle="Everything lives on this device"
      width={468}
      footer={
        <>
          <AnimatePresence>
            {notice && (
              <motion.span
                className="set__notice"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={easeQuick}
              >
                <Icon name="check" size={13} strokeWidth={2.2} />
                {notice}
              </motion.span>
            )}
          </AnimatePresence>
          <Button variant="soft" onClick={close}>
            Done
          </Button>
        </>
      }
    >
      <div className="set">
        {/* ── Appearance ─────────────────────────────── */}
        <section className="set__group">
          <h3 className="set__label">Appearance</h3>
          <div className="set__choices set__choices--3">
            {THEMES.map((t) => (
              <button
                key={t.value}
                className={`set__choice ${settings.theme === t.value ? 'is-on' : ''}`}
                onClick={() => actions.updateSettings({ theme: t.value })}
              >
                <span className={`set__swatch set__swatch--${t.value}`} aria-hidden="true" />
                <span className="set__choiceLabel">{t.label}</span>
                <span className="set__choiceHint">{t.hint}</span>
                {settings.theme === t.value && (
                  <motion.span
                    layoutId="set-theme"
                    className="set__ring"
                    transition={spring.body}
                  />
                )}
              </button>
            ))}
          </div>
        </section>

        {/* ── Motion ─────────────────────────────────── */}
        <section className="set__group">
          <h3 className="set__label">Motion</h3>
          <div className="set__choices">
            {MOTIONS.map((m) => (
              <button
                key={m.value}
                className={`set__choice set__choice--wide ${settings.motion === m.value ? 'is-on' : ''}`}
                onClick={() => actions.updateSettings({ motion: m.value })}
              >
                <span className="set__choiceLabel">{m.label}</span>
                <span className="set__choiceHint">{m.hint}</span>
                {settings.motion === m.value && (
                  <motion.span
                    layoutId="set-motion"
                    className="set__ring"
                    transition={spring.body}
                  />
                )}
              </button>
            ))}
          </div>
          <p className="set__note">
            Reduced also switches on by itself when your system asks for it.
          </p>
        </section>

        {/* ── Currency ───────────────────────────────── */}
        <section className="set__group">
          <h3 className="set__label">Currency</h3>
          <div className="set__row">
            <select
              className="inp set__select"
              value={settings.currency}
              onChange={(e) => actions.updateSettings({ currency: e.target.value })}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.symbol}  {c.label} ({c.code})
                </option>
              ))}
            </select>
          </div>
          <p className="set__note">
            Changes how amounts are shown. It doesn't convert anything you've
            already logged.
          </p>
        </section>

        {/* ── Data ───────────────────────────────────── */}
        <section className="set__group">
          <h3 className="set__label">Your data</h3>
          <p className="set__stat num">
            {txCount} entr{txCount === 1 ? 'y' : 'ies'} · {subCount} subscription
            {subCount === 1 ? '' : 's'} · {budgetCount} budget{budgetCount === 1 ? '' : 's'} ·{' '}
            {goalCount} goal{goalCount === 1 ? '' : 's'} · {nodeCount} bubble
            {nodeCount === 1 ? '' : 's'}
          </p>

          <div className="set__actions">
            <Button variant="soft" size="sm" icon="arrowDown" onClick={exportBackup}>
              Export backup
            </Button>
            <Button
              variant="soft"
              size="sm"
              icon="arrowUp"
              onClick={() => fileRef.current?.click()}
            >
              Restore
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) importBackup(f)
                e.target.value = ''
              }}
            />
          </div>
          <p className="set__note">
            Nothing here syncs anywhere. A backup is the only copy that survives
            clearing your browser.
          </p>
        </section>

        {/* ── Reset ──────────────────────────────────── */}
        <section className="set__group set__group--danger">
          <div className="set__dangerRow">
            <div>
              <h3 className="set__label set__label--danger">Reset everything</h3>
              <p className="set__note set__note--tight">
                Clears every bubble, entry and goal. Settings are kept.
              </p>
            </div>

            {confirmingReset ? (
              <motion.div
                className="set__confirm"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={spring.snap}
              >
                <button
                  className="set__cancel"
                  onClick={() => setConfirmingReset(false)}
                >
                  Cancel
                </button>
                <button
                  className="set__wipe"
                  onClick={() => {
                    actions.resetData()
                    setConfirmingReset(false)
                    flash('Everything cleared')
                  }}
                >
                  Yes, erase it all
                </button>
              </motion.div>
            ) : (
              <button
                className="set__danger"
                onClick={() => setConfirmingReset(true)}
              >
                <Icon name="trash" size={13} strokeWidth={1.8} />
                Reset
              </button>
            )}
          </div>
        </section>
      </div>
    </Modal>
  )
}
