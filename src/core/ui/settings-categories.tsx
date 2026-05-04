import { useState, useRef, useEffect, Fragment } from 'react'
import { X, Plus, ChevronRight, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { ConfirmDialog } from '@/core/ui/confirm-dialog'
import { useSettings } from '@/core/hooks/use-settings'

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
      <div className="flex items-center gap-1.5">
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
      </div>
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

export function SettingsCategories() {
  const { categories, addCategory, removeCategory, updateCategory, addSubcategory, removeSubcategory, updateSubcategory } = useSettings()

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [newCatName, setNewCatName] = useState('')
  const [newCatColor, setNewCatColor] = useState('#95A5A6')
  const [newSubInputs, setNewSubInputs] = useState<Record<string, string>>({})
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'cat' | 'sub'; catId: string; name: string } | null>(null)

  useEffect(() => {
    if (!expandedId) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault()
        setExpandedId(null)
      }
    }
    document.addEventListener('keydown', handleKey, true)
    return () => document.removeEventListener('keydown', handleKey, true)
  }, [expandedId])

  function handleAddCategory() {
    const trimmed = newCatName.trim()
    if (!trimmed) return
    addCategory(trimmed, newCatColor)
    setNewCatName('')
    setNewCatColor('#95A5A6')
  }

  function handleAddSubcategory(categoryId: string) {
    const value = newSubInputs[categoryId]?.trim()
    if (!value) return
    addSubcategory(categoryId, value)
    setNewSubInputs((prev) => ({ ...prev, [categoryId]: '' }))
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return
    if (deleteTarget.type === 'cat') {
      removeCategory(deleteTarget.catId)
      if (expandedId === deleteTarget.catId) setExpandedId(null)
    } else {
      removeSubcategory(deleteTarget.catId, deleteTarget.name)
    }
    setDeleteTarget(null)
  }

  return (
    <PageTransition>
      <PageHeader title="Categorías Financieras" />

      <div className="rounded-xl bg-surface card-elevated overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[500px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-caption uppercase tracking-wider text-mid-gray font-medium px-4 py-3 w-10 border-r border-border"></th>
              <th className="text-left text-caption uppercase tracking-wider text-mid-gray font-medium px-4 py-3 border-r border-border">Categoría</th>
              <th className="text-left text-caption uppercase tracking-wider text-mid-gray font-medium px-4 py-3 w-32 border-r border-border">Subcategorías</th>
              <th className="text-right text-caption uppercase tracking-wider text-mid-gray font-medium px-4 py-3 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => {
              const isExpanded = expandedId === cat.id
              return (
                <Fragment key={cat.id}>
                  <tr
                    className={cn('border-b border-border last:border-b-0 group cursor-pointer select-none transition-colors hover:bg-bone/30', isExpanded && 'bg-bone/20')}
                    onClick={() => setExpandedId(isExpanded ? null : cat.id)}
                  >
                    {/* Color dot */}
                    <td className="px-4 py-3 border-r border-border">
                      <label className="block w-5 h-5 rounded-full cursor-pointer border border-border transition-shadow hover:shadow-sm" style={{ backgroundColor: cat.color }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="color"
                          value={cat.color}
                          onChange={(e) => updateCategory(cat.id, { color: e.target.value })}
                          className="sr-only"
                        />
                      </label>
                    </td>

                    {/* Name — expandable + editable */}
                    <td className="px-4 py-3 border-r border-border">
                      <div className="flex items-center gap-2">
                        <ChevronRight
                          size={14}
                          strokeWidth={1.5}
                          className={cn('text-mid-gray transition-transform duration-200 shrink-0', isExpanded && 'rotate-90')}
                        />
                        <span onClick={(e) => e.stopPropagation()}>
                          <InlineEdit
                            value={cat.name}
                            onSave={(newName) => updateCategory(cat.id, { name: newName })}
                            className="text-body font-medium text-dark-graphite"
                          />
                        </span>
                      </div>
                    </td>

                    {/* Subcategory count */}
                    <td className="px-4 py-3 border-r border-border text-center">
                      {cat.subcategories.length > 0 ? (
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[12.6px] font-medium bg-bone text-mid-gray">
                          {cat.subcategories.length}
                        </span>
                      ) : (
                        <span className="text-caption text-mid-gray/50">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setDeleteTarget({ type: 'cat', catId: cat.id, name: cat.name })}
                        className="p-1.5 rounded-lg text-mid-gray hover:text-negative-text hover:bg-red-50 transition-all"
                      >
                        <Trash2 size={13} strokeWidth={1.5} />
                      </button>
                    </td>
                  </tr>

                  {/* Inline subcategories rows */}
                  {isExpanded && cat.subcategories.map((sub) => (
                    <tr key={sub} className="border-b border-border last:border-b-0 bg-bone/30 group/sub">
                      <td className="border-r border-border" />
                      <td className="px-4 py-2.5 border-r border-border pl-12">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: cat.color, opacity: 0.5 }} />
                          <InlineEdit
                            value={sub}
                            onSave={(newName) => updateSubcategory(cat.id, sub, newName)}
                            className="text-body text-graphite"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-2.5 border-r border-border" />
                      <td className="px-4 py-2.5 text-center">
                        <button
                          onClick={() => setDeleteTarget({ type: 'sub', catId: cat.id, name: sub })}
                          className="p-0.5 rounded text-mid-gray hover:text-negative-text transition-all"
                        >
                          <X size={13} strokeWidth={1.5} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {isExpanded && cat.subcategories.length === 0 && (
                    <tr className="border-b border-border last:border-b-0 bg-bone/30">
                      <td className="border-r border-border" />
                      <td colSpan={3} className="px-4 py-2.5 pl-12 text-caption text-mid-gray">Sin subcategorías</td>
                    </tr>
                  )}
                  {isExpanded && (
                    <tr className="border-b border-border last:border-b-0 bg-bone/30">
                      <td className="border-r border-border" />
                      <td colSpan={3} className="px-4 py-2.5 pl-12">
                        <div className="flex gap-2">
                          <input
                            value={newSubInputs[cat.id] ?? ''}
                            onChange={(e) => setNewSubInputs((prev) => ({ ...prev, [cat.id]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSubcategory(cat.id) } }}
                            placeholder="Nueva subcategoría..."
                            className={inputClass}
                          />
                          <button
                            type="button"
                            onClick={() => handleAddSubcategory(cat.id)}
                            disabled={!newSubInputs[cat.id]?.trim()}
                            className="shrink-0 flex items-center gap-1 px-3 py-2.5 rounded-lg btn-primary text-body font-medium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Plus size={14} strokeWidth={2} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>

        {categories.length === 0 && (
          <div className="px-4 py-8 text-center text-body text-mid-gray">
            No hay categorías
          </div>
        )}
      </div>

      {/* Add new category */}
      <div className="mt-4 flex items-center gap-2">
        <label
          className="w-10 h-10 rounded-lg border border-input-border cursor-pointer shrink-0 transition-all hover:border-border-hover hover:shadow-sm"
          style={{ backgroundColor: newCatColor }}
        >
          <input
            type="color"
            value={newCatColor}
            onChange={(e) => setNewCatColor(e.target.value)}
            className="sr-only"
          />
        </label>
        <input
          value={newCatName}
          onChange={(e) => setNewCatName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategory() } }}
          placeholder="Nueva categoría..."
          className={inputClass}
        />
        <button
          type="button"
          onClick={handleAddCategory}
          disabled={!newCatName.trim()}
          className="shrink-0 flex items-center gap-1 px-3 py-2.5 rounded-lg btn-primary text-body font-medium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={14} strokeWidth={2} />
        </button>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title={deleteTarget?.type === 'cat' ? 'Eliminar categoría' : 'Eliminar subcategoría'}
        description={`¿Estás seguro de que deseas eliminar ${deleteTarget?.type === 'cat' ? 'la categoría' : 'la subcategoría'} "${deleteTarget?.name}"? Esta acción no se puede deshacer.`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </PageTransition>
  )
}
