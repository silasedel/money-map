import { useEffect, useRef, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { CATEGORY_COLORS, nextColor } from '@/components/Categories'
import { actions, shallowArray, useStore } from '@/lib/store'
import type { Category, CategoryColor } from '@/lib/types'

interface Props {
  open: boolean
  onClose: () => void
  editing?: Category | null
  onCreated?: (id: string) => void
}

export function CategoryModal({ open, onClose, editing, onCreated }: Props) {
  const categories = useStore((s) => s.categories, shallowArray)
  const txCount = useStore((s) =>
    editing ? s.transactions.filter((t) => t.categoryId === editing.id).length : 0,
  )

  const [name, setName] = useState('')
  const [color, setColor] = useState<CategoryColor>('cat-1')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setName(editing?.name ?? '')
    setColor(editing?.color ?? nextColor(categories))
    setConfirmDelete(false)
    const t = setTimeout(() => nameRef.current?.focus(), 90)
    return () => clearTimeout(t)
  }, [open, editing, categories])

  const clean = name.trim()
  const duplicate = categories.some(
    (c) => c.id !== editing?.id && c.name.toLowerCase() === clean.toLowerCase(),
  )
  const valid = clean.length > 0 && !duplicate

  const submit = () => {
    if (!valid) return
    if (editing) actions.updateCategory(editing.id, { name: clean, color })
    else onCreated?.(actions.addCategory({ name: clean, color }))
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit category' : 'New category'}
      subtitle="A bucket that's yours — a business, a channel, a trip."
      width={400}
      footer={
        <>
          {editing &&
            (confirmDelete ? (
              <span className="confirm" style={{ marginRight: 'auto' }}>
                {txCount ? `${txCount} entr${txCount === 1 ? 'y' : 'ies'} stay, just uncategorised.` : 'Remove it?'}
                <button
                  className="confirm__yes"
                  onClick={() => {
                    actions.removeCategory(editing.id)
                    onClose()
                  }}
                >
                  Remove
                </button>
                <button className="confirm__no" onClick={() => setConfirmDelete(false)}>
                  Keep
                </button>
              </span>
            ) : (
              <Button variant="quiet" icon="trash" onClick={() => setConfirmDelete(true)} style={{ marginRight: 'auto' }}>
                Remove
              </Button>
            ))}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!valid}>
            {editing ? 'Save' : 'Create'}
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
        <Field label="Name" hint={duplicate ? 'Already exists' : undefined}>
          <Input
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Silas AI, Consulting, Japan trip…"
            autoComplete="off"
          />
        </Field>

        <Field label="Colour">
          <div className="ctm__colors">
            {CATEGORY_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`ctm__color ${color === c ? 'is-on' : ''}`}
                style={{ background: `var(--${c})` }}
                onClick={() => setColor(c)}
                aria-label={c}
              />
            ))}
          </div>
        </Field>

        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  )
}
