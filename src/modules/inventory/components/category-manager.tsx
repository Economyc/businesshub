import { useState } from 'react'
import { Plus, Trash2, SquarePen, Check, X, RotateCcw } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useInventoryCategories, useInventoryCategoryMutations } from '../hooks/use-inventory-categories'
import { DEFAULT_INVENTORY_CATEGORIES } from '../domain/default-categories'
import type { InventoryCategory } from '../types'

const inputClass =
  'w-full px-3 py-2.5 rounded-lg border border-input-border bg-input-bg text-body text-graphite focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200'
const labelClass = 'block text-caption text-mid-gray mb-1.5'

interface Props {
  open: boolean
  onClose: () => void
}

// Gestor del catálogo de categorías de insumos. Solo se monta para el Owner
// (el gating vive en quien lo abre). CRUD completo: crear, renombrar, eliminar.
export function CategoryManager({ open, onClose }: Props) {
  const { data: categories } = useInventoryCategories()
  const { create, update, remove } = useInventoryCategoryMutations()

  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const sorted = [...categories].sort((a, b) => a.name.localeCompare(b.name, 'es'))

  function isDuplicate(candidate: string, exceptId?: string) {
    const norm = candidate.trim().toLowerCase()
    return categories.some((c) => c.id !== exceptId && c.name.trim().toLowerCase() === norm)
  }

  async function handleAdd() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Escribe un nombre para la categoría')
      return
    }
    if (isDuplicate(trimmed)) {
      setError('Ya existe una categoría con ese nombre')
      return
    }
    try {
      await create.mutateAsync({ name: trimmed })
      setName('')
      setError('')
    } catch {
      setError('No se pudo crear la categoría')
    }
  }

  function startEdit(cat: InventoryCategory) {
    setEditingId(cat.id)
    setEditName(cat.name)
    setError('')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditName('')
  }

  async function saveEdit(id: string) {
    const trimmed = editName.trim()
    if (!trimmed) {
      setError('El nombre no puede quedar vacío')
      return
    }
    if (isDuplicate(trimmed, id)) {
      setError('Ya existe una categoría con ese nombre')
      return
    }
    try {
      await update.mutateAsync({ id, data: { name: trimmed } })
      cancelEdit()
      setError('')
    } catch {
      setError('No se pudo renombrar la categoría')
    }
  }

  async function handleRemove(id: string) {
    try {
      await remove.mutateAsync(id)
    } catch {
      setError('No se pudo eliminar la categoría')
    }
  }

  async function restoreDefaults() {
    const existing = new Set(categories.map((c) => c.name.trim().toLowerCase()))
    const missing = DEFAULT_INVENTORY_CATEGORIES.filter((n) => !existing.has(n.toLowerCase()))
    try {
      for (const n of missing) {
        await create.mutateAsync({ name: n })
      }
      setError('')
    } catch {
      setError('No se pudieron restaurar las categorías')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o: boolean) => { if (!o) { cancelEdit(); onClose() } }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Categorías de insumos</DialogTitle>
          <p className="text-caption text-mid-gray">
            Etiquetas con las que clasificas tus insumos. Solo tú puedes crearlas, renombrarlas o eliminarlas.
          </p>
        </DialogHeader>

        {sorted.length > 0 ? (
          <div className="space-y-2 max-h-[40vh] overflow-y-auto">
            {sorted.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2"
              >
                {editingId === cat.id ? (
                  <>
                    <input
                      autoFocus
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(cat.id)
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      className={inputClass}
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => saveEdit(cat.id)}
                        className="p-2 rounded-lg text-mid-gray hover:text-positive-text hover:bg-graphite/5 transition-colors"
                        aria-label="Guardar"
                      >
                        <Check className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="p-2 rounded-lg text-mid-gray hover:text-graphite hover:bg-graphite/5 transition-colors"
                        aria-label="Cancelar"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-body text-graphite truncate">{cat.name}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEdit(cat)}
                        className="p-2 rounded-lg text-mid-gray hover:text-graphite hover:bg-graphite/5 transition-colors"
                        aria-label="Renombrar categoría"
                      >
                        <SquarePen className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemove(cat.id)}
                        className="p-2 rounded-lg text-mid-gray hover:text-negative-text hover:bg-graphite/5 transition-colors"
                        aria-label="Eliminar categoría"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-caption text-mid-gray">Aún no hay categorías.</p>
        )}

        <div className="rounded-xl border border-border/60 p-4 space-y-3">
          <p className="text-caption text-mid-gray">Nueva categoría</p>
          <div>
            <label className={labelClass}>Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
              placeholder="Ej: Cárnicos"
              className={inputClass}
            />
          </div>
          {error && <p className="text-caption text-negative-text">{error}</p>}
          <Button onClick={handleAdd} disabled={create.isPending} className="w-full">
            <Plus className="size-4" />
            Agregar categoría
          </Button>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={restoreDefaults} disabled={create.isPending}>
            <RotateCcw className="size-4" />
            Restaurar estándar
          </Button>
          <Button variant="outline" onClick={() => { cancelEdit(); onClose() }}>Listo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
