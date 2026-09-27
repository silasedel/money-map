import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { actions, shallowArray, useStore } from '@/lib/store'
import type { Category, CategoryColor } from '@/lib/types'
import { spring } from '@/lib/motion'
import { Icon } from './Icon'

export const CATEGORY_COLORS: CategoryColor[] = ['cat-1', 'cat-2', 'cat-3', 'cat-4', 'cat-5', 'cat-6']

/** Hand out the least-used colour so a new category never matches its neighbour. */
export function nextColor(existing: Category[]): CategoryColor {
  const counts = new Map(CATEGORY_COLORS.map((c) => [c, 0]))
  existing.forEach((c) => counts.set(c.color, (counts.get(c.color) ?? 0) + 1))
  return [...counts.entries()].sort((a, b) => a[1] - b[1])[0][0]
}

/* ── Chip ───────────────────────────────────────────── */

interface ChipProps {
  category: Category
  size?: 'sm' | 'md'
  active?: boolean
  onClick?: () => void
  count?: number
}

export function CategoryChip({ category, size = 'sm', active, onClick, count }: ChipProps) {
  const Tag = onClick ? 'button' : 'span'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`cat cat--${size} ${active ? 'is-active' : ''} ${onClick ? 'is-clickable' : ''}`}
      style={{ '--cat-color': `var(--${category.color})` } as React.CSSProperties}
      onClick={onClick}
    >
      <span className="cat__dot" />
      <span className="cat__label">{category.name}</span>
      {count !== undefined && <span className="cat__count num">{count}</span>}
    </Tag>
  )
}

/* ── Picker (single choice + inline "new") ──────────── */

interface PickerProps {
  value: string | undefined
  onChange: (id: string | undefined) => void
}

/**
 * Pick one category, or make one on the spot. Categories are yours, so the
 * "+" is always in reach — the moment you have a new project you can file
 * money under it without leaving the form.
 */
export function CategoryPicker({ value, onChange }: PickerProps) {
  const categories = useStore((s) => s.categories, shallowArray)
  const [typing, setTyping] = useState(false)
  const [draft, setDraft] = useState('')

  const commit = () => {
    const name = draft.trim()
    if (name) {
      const dupe = categories.find((c) => c.name.toLowerCase() === name.toLowerCase())
      const id = dupe ? dupe.id : actions.addCategory({ name, color: nextColor(categories) })
      onChange(id)
    }
    setDraft('')
    setTyping(false)
  }

  return (
    <div className="catpick">
      {categories.map((c) => (
        <CategoryChip
          key={c.id}
          category={c}
          size="md"
          active={value === c.id}
          onClick={() => onChange(value === c.id ? undefined : c.id)}
        />
      ))}

      <AnimatePresence initial={false} mode="popLayout">
        {typing ? (
          <motion.input
            key="input"
            className="catpick__input"
            autoFocus
            value={draft}
            placeholder="New category…"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                e.stopPropagation()
                commit()
              }
              if (e.key === 'Escape') {
                e.stopPropagation()
                setDraft('')
                setTyping(false)
              }
            }}
            initial={{ opacity: 0, width: 60 }}
            animate={{ opacity: 1, width: 150 }}
            exit={{ opacity: 0, width: 60 }}
            transition={spring.snap}
          />
        ) : (
          <motion.button
            key="add"
            type="button"
            className="catpick__add"
            onClick={() => setTyping(true)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Icon name="plus" size={11} strokeWidth={2.4} />
            {categories.length ? 'New' : 'New category'}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
