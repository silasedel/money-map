import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BUILTIN_TAGS, normalizeTag, tagDef } from '@/lib/tags'
import type { TagId, TxKind } from '@/lib/types'
import { spring } from '@/lib/motion'
import { Icon } from './Icon'

/* ── Display chip ───────────────────────────────────── */

interface ChipProps {
  id: TagId
  size?: 'sm' | 'md'
  onClick?: () => void
  onRemove?: () => void
  active?: boolean
  title?: string
}

export function TagChip({ id, size = 'sm', onClick, onRemove, active, title }: ChipProps) {
  const def = tagDef(id)
  const Tag = onClick ? 'button' : 'span'
  return (
    <Tag
      className={`tag tag--${def.tone} tag--${size} ${active ? 'is-active' : ''} ${onClick ? 'is-clickable' : ''}`}
      onClick={onClick}
      title={title ?? def.blurb}
      type={onClick ? 'button' : undefined}
    >
      <span className="tag__dot" />
      <span className="tag__label">{def.label}</span>
      {onRemove && (
        <button
          type="button"
          className="tag__x"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          aria-label={`Remove ${def.label}`}
        >
          <Icon name="close" size={9} strokeWidth={2.4} />
        </button>
      )}
    </Tag>
  )
}

/* ── Picker ─────────────────────────────────────────── */

interface PickerProps {
  value: TagId[]
  onChange: (next: TagId[]) => void
  kind?: TxKind
  /** Custom tags already in use elsewhere, so they can be re-applied by click. */
  suggestions?: TagId[]
}

/**
 * Built-ins as toggles, customs typed in. Anything you've used before shows up
 * as a suggestion so a custom tag only ever needs typing once.
 */
export function TagPicker({ value, onChange, suggestions = [] }: PickerProps) {
  const [draft, setDraft] = useState('')
  const [typing, setTyping] = useState(false)

  const toggle = (id: TagId) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])

  const commit = () => {
    const id = normalizeTag(draft)
    if (id && !value.includes(id)) onChange([...value, id])
    setDraft('')
    setTyping(false)
  }

  const builtins = BUILTIN_TAGS
  const customs = [
    ...new Set([...suggestions, ...value].filter((id) => !builtins.some((b) => b.id === id))),
  ]

  return (
    <div className="tagpick">
      <div className="tagpick__row">
        {builtins.map((t) => (
          <TagChip
            key={t.id}
            id={t.id}
            size="md"
            active={value.includes(t.id)}
            onClick={() => toggle(t.id)}
          />
        ))}
        {customs.map((id) => (
          <TagChip
            key={id}
            id={id}
            size="md"
            active={value.includes(id)}
            onClick={() => toggle(id)}
          />
        ))}

        <AnimatePresence initial={false} mode="popLayout">
          {typing ? (
            <motion.input
              key="input"
              className="tagpick__input"
              autoFocus
              value={draft}
              placeholder="Name it…"
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault()
                  commit()
                }
                if (e.key === 'Escape') {
                  setDraft('')
                  setTyping(false)
                }
              }}
              initial={{ opacity: 0, width: 40 }}
              animate={{ opacity: 1, width: 118 }}
              exit={{ opacity: 0, width: 40 }}
              transition={spring.snap}
            />
          ) : (
            <motion.button
              key="add"
              type="button"
              className="tagpick__add"
              onClick={() => setTyping(true)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Icon name="plus" size={11} strokeWidth={2.2} />
              Your own
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
