import { useEffect } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { Sidebar } from '@/components/Sidebar'
import { useStore } from '@/lib/store'
import { ui, useUI } from '@/lib/ui'
import { pageById } from '@/pages/registry'
import { applyTheme, watchSystemTheme } from '@/lib/theme'
import { TransactionModal } from '@/pages/ledger/TransactionModal'
import './App.css'

export default function App() {
  const page = useStore((s) => s.page)
  const settings = useStore((s) => s.settings)
  const composerOpen = useUI((s) => s.composer.open)
  const { Component } = pageById(page)

  /* Theme lives on the root element; every token keys off that one attribute,
     so the whole interface — chart palette included — turns over in one paint. */
  useEffect(() => {
    applyTheme(settings.theme)
    if (settings.theme !== 'system') return
    return watchSystemTheme(() => applyTheme('system'))
  }, [settings.theme])

  /* N opens the composer from anywhere that isn't already taking text. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (composerOpen || e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target as HTMLElement | null
      const typing =
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.tagName === 'SELECT' ||
          el.isContentEditable)
      if (typing) return
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        ui.openComposer()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [composerOpen])

  return (
    /* `reducedMotion` is what makes the Motion setting real: framer ignores the
       OS preference by default, so without this the springs would keep running
       for someone who asked the system to stop them. "user" defers to the OS;
       the explicit choice overrides it in either direction. */
    <MotionConfig reducedMotion={settings.motion === 'reduced' ? 'always' : 'user'}>
      <div className="app">
        <Sidebar />
        <main className="app__main">
          {/* Pages are absolutely positioned siblings, so they cross-fade rather
              than queueing. The next page is on screen immediately — waiting for
              the outgoing one to finish would just add dead time to every click. */}
          <AnimatePresence initial={false}>
            <motion.div
              key={page}
              className="app__page"
              initial={{ opacity: 0, y: 10, scale: 0.995 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.997, transition: { duration: 0.14 } }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <Component />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* One composer for the whole app — every "add entry" opens this. */}
      <TransactionModal />
    </MotionConfig>
  )
}
