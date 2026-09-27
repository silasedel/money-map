import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { spring } from '@/lib/motion'
import { Icon } from '../Icon'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  width?: number
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 420,
}: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        /* Keyed, and a motion element in its own right: AnimatePresence needs
           both to reliably retire a child. The root is also pointer-transparent
           and the scrim drops its pointer events the instant it starts leaving,
           so even a stuck overlay can never swallow the app's clicks. */
        <motion.div
          key="modal"
          className="modal__root"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 1 }}
        >
          <motion.div
            className="modal__scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, pointerEvents: 'auto' }}
            exit={{ opacity: 0, pointerEvents: 'none' }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            onPointerDown={onClose}
          />
          <motion.div
            className="modal__panel"
            style={{ width }}
            initial={{ opacity: 0, scale: 0.955, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={spring.body}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <header className="modal__head">
              <div className="modal__titles">
                <h2 className="modal__title">{title}</h2>
                {subtitle && <p className="modal__sub">{subtitle}</p>}
              </div>
              <button className="modal__close" onClick={onClose} aria-label="Close">
                <Icon name="close" size={15} strokeWidth={1.9} />
              </button>
            </header>

            <div className="modal__body">{children}</div>

            {footer && <footer className="modal__foot">{footer}</footer>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
