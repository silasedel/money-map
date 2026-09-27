import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { actions, useStore } from '@/lib/store'
import { ui } from '@/lib/ui'
import { PAGES, SECTIONS } from '@/pages/registry'
import { Icon, Logomark } from './Icon'
import { spring, easeQuick } from '@/lib/motion'
import { SettingsModal } from './SettingsModal'
import './Sidebar.css'

export function Sidebar() {
  const page = useStore((s) => s.page)
  const collapsed = useStore((s) => s.sidebarCollapsed)
  const txCount = useStore((s) => s.transactions.length)
  const subCount = useStore((s) => s.subscriptions.filter((x) => x.status === 'active').length)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const label = (text: string) => (
    <AnimatePresence initial={false}>
      {!collapsed && (
        <motion.span
          className="sb__label"
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -4 }}
          transition={easeQuick}
        >
          {text}
        </motion.span>
      )}
    </AnimatePresence>
  )

  return (
    <motion.aside
      className={`sb ${collapsed ? 'sb--collapsed' : ''}`}
      animate={{ width: collapsed ? 68 : 244 }}
      transition={spring.calm}
      initial={false}
    >
      <div className="sb__inner">
        <header className="sb__brand">
          <div className="sb__mark">
            <Logomark size={21} />
          </div>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                className="sb__wordmark"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={easeQuick}
              >
                <span className="sb__name">Money Map</span>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        {/* One entry point for logging, reachable from every page — and from
            the keyboard: N opens it anywhere. */}
        <motion.button
          className={`sb__add ${collapsed ? 'is-collapsed' : ''}`}
          onClick={() => ui.openComposer()}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.97, y: 0 }}
          transition={spring.snap}
          title={collapsed ? 'Add entry (N)' : undefined}
        >
          <span className="sb__addIcon">
            <Icon name="plus" size={16} strokeWidth={2.2} />
          </span>
          {label('Add entry')}
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.kbd
                className="sb__kbd"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={easeQuick}
              >
                N
              </motion.kbd>
            )}
          </AnimatePresence>
        </motion.button>

        <nav className="sb__nav">
          {SECTIONS.map((sec) => (
            <div key={sec.id} className="sb__section">
              <AnimatePresence initial={false}>
                {!collapsed ? (
                  <motion.span
                    className="sb__sectionLabel"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={easeQuick}
                  >
                    {sec.label}
                  </motion.span>
                ) : (
                  <span className="sb__sectionRule" />
                )}
              </AnimatePresence>

              {PAGES.filter((p) => p.section === sec.id).map((p) => {
                const active = p.id === page
                return (
                  <button
                    key={p.id}
                    className={`sb__item ${active ? 'is-active' : ''}`}
                    onClick={() => actions.setPage(p.id)}
                    title={collapsed ? p.label : undefined}
                  >
                    {active && (
                      <motion.span
                        layoutId="sb-active"
                        className="sb__pill"
                        transition={spring.body}
                      />
                    )}
                    <span className="sb__icon">
                      <Icon name={p.icon} size={18} />
                    </span>
                    {label(p.label)}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="sb__spacer" />

        <button
          className={`sb__settings ${collapsed ? 'is-collapsed' : ''}`}
          onClick={() => setSettingsOpen(true)}
          title={collapsed ? 'Settings' : undefined}
        >
          <span className="sb__icon">
            <Icon name="settings" size={18} />
          </span>
          {label('Settings')}
        </button>

        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.footer
              className="sb__foot"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={easeQuick}
            >
              <span className="sb__dot" />
              <span className="sb__footText">
                Saved on this device
                <span className="sb__footMeta">
                  {txCount} entr{txCount === 1 ? 'y' : 'ies'} · {subCount} subscription
                  {subCount === 1 ? '' : 's'}
                </span>
              </span>
            </motion.footer>
          )}
        </AnimatePresence>
      </div>

      <button
        className="sb__toggle"
        onClick={actions.toggleSidebar}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <motion.span
          animate={{ rotate: collapsed ? 0 : 180 }}
          transition={spring.body}
          style={{ display: 'flex' }}
        >
          <Icon name="chevron" size={14} strokeWidth={2.1} />
        </motion.span>
      </button>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </motion.aside>
  )
}
