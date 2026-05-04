import { useState, useRef, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { ConfirmDialog } from '@/core/ui/confirm-dialog'

const inputClass =
  'w-full px-3 py-2.5 rounded-lg border border-input-border bg-input-bg text-body text-graphite placeholder:text-mid-gray/60 focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200'

function InlineEdit({ value, onSave, className }: { value: string; onSave: (v: string) => void; className?: string }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  function commit() {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== value) {
      onSave(trimmed)
    } else {
      setDraft(value)
    }
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit() }
          if (e.key === 'Escape') { setDraft(value); setEditing(false) }
        }}
        onBlur={commit}
        className="px-2 py-1 rounded-md border border-input-focus ring-[3px] ring-graphite/5 text-body text-graphite bg-surface outline-none"
      />
    )
  }

  return (
    <span
      onDoubleClick={() => { setDraft(value); setEditing(true) }}
      className={cn('relative cursor-default rounded px-1 -mx-1 transition-colors hover:bg-bone/80 group/tip', className)}
    >
      {value}
      <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 px-2.5 py-1 rounded-lg bg-dark-graphite text-white text-caption whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity duration-200 shadow-md">
        Doble clic para renombrar
      </span>
    </span>
  )
}

interface SettingsListProps {
  title: string
  items: string[]
  onAdd: (name: string) => void
  onRemove: (name: string) => void
  onUpdate: (oldName: string, newName: string) => void
  placeholder?: string
  itemLabel?: string
}

export function SettingsList({ title, items, onAdd, onRemove, onUpdate, placeholder, itemLabel }: SettingsListProps) {
  const [newName, setNewName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  function handleAdd() {
    const trimmed = newName.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setNewName('')
  }

  return (
    <PageTransition>
      <PageHeader title={title} />

      <div className="rounded-xl bg-surface card-elevated overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-caption uppercase tracking-wider text-mid-gray font-medium px-4 py-3 border-r border-border">Nombre</th>
              <th className="text-right text-caption uppercase tracking-wider text-mid-gray font-medium px-4 py-3 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item} className="border-b border-border last:border-b-0 group hover:bg-bone/30 transition-colors">
                <td className="px-4 py-3 border-r border-border">
                  <InlineEdit
                    value={item}
                    onSave={(newName) => onUpdate(item, newName)}
                    className="text-body font-medium text-dark-graphite"
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => setDeleteTarget(item)}
                    className="p-1.5 rounded-lg text-mid-gray hover:text-negative-text hover:bg-red-50 transition-all"
                  >
                    <Trash2 size={13} strokeWidth={1.5} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {items.length === 0 && (
          <div className="px-4 py-8 text-center text-body text-mid-gray">
            No hay elementos
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
          placeholder={placeholder ?? 'Nuevo elemento...'}
          className={inputClass}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!newName.trim()}
          className="shrink-0 flex items-center gap-1 px-3 py-2.5 rounded-lg btn-primary text-body font-medium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={14} strokeWidth={2} />
        </button>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title={`Eliminar ${itemLabel ?? 'elemento'}`}
        description={`¿Estás seguro de que deseas eliminar "${deleteTarget}"? Esta acción no se puede deshacer.`}
        onConfirm={async () => { onRemove(deleteTarget!); setDeleteTarget(null) }}
        onCancel={() => setDeleteTarget(null)}
      />
    </PageTransition>
  )
}
