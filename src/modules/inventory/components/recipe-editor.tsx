import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Trash2, AlertTriangle } from 'lucide-react'
import { SelectInput } from '@/core/ui/select-input'
import { modalVariants } from '@/core/animations/variants'
import { formatCurrency } from '@/core/utils/format'
import { useInventoryItems } from '../hooks/use-inventory-items'
import { useRecipes, useRecipeMutations } from '../hooks/use-recipes'
import { costRecipe } from '../domain/cost-recipe'
import type { Recipe, RecipeComponent, RecipeComponentKind, RecipeFormData } from '../types'

const inputClass =
  'w-full px-3 py-2.5 rounded-lg border border-input-border bg-input-bg text-body text-graphite placeholder:text-mid-gray/60 focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200'
const labelClass = 'block text-caption uppercase tracking-wider font-semibold text-mid-gray mb-1'

const KIND_OPTIONS = [
  { value: 'item', label: 'Insumo' },
  { value: 'preparation', label: 'Preparación' },
]

export interface RecipePosSeed {
  presentationId: string
  productGeneralId: string
  name: string
  price?: number
}

interface RecipeEditorProps {
  open: boolean
  onClose: () => void
  /** Receta existente a editar (producto o preparación). */
  recipe?: Recipe | null
  /** Presentación del catálogo a la que se atará una receta de producto nueva. */
  posSeed?: RecipePosSeed | null
  /** Precio POS de la presentación (para margen). Lo conoce el tab. */
  salePrice?: number
  /** Fuerza modo preparación (CTA "Nueva preparación"). */
  asPreparation?: boolean
}

interface ComponentRow {
  kind: RecipeComponentKind
  refId: string
  qty: string
  /** Merma en % (10 = 10%). Se guarda como wasteFactor 0.1. */
  wastePct: string
}

interface FormState {
  name: string
  yieldQty: string
  components: ComponentRow[]
  active: 'true' | 'false'
}

const EMPTY_ROW: ComponentRow = { kind: 'item', refId: '', qty: '', wastePct: '' }

const EMPTY: FormState = {
  name: '',
  yieldQty: '1',
  components: [{ ...EMPTY_ROW }],
  active: 'true',
}

function fromRecipe(recipe: Recipe): FormState {
  return {
    name: recipe.name ?? '',
    yieldQty: recipe.yieldQty != null ? String(recipe.yieldQty) : '1',
    components:
      recipe.components.length > 0
        ? recipe.components.map((c) => ({
            kind: c.kind,
            refId: c.refId,
            qty: String(c.qty),
            wastePct: c.wasteFactor != null && c.wasteFactor > 0 ? String(c.wasteFactor * 100) : '',
          }))
        : [{ ...EMPTY_ROW }],
    active: recipe.active === false ? 'false' : 'true',
  }
}

export function RecipeEditor({
  open,
  onClose,
  recipe,
  posSeed,
  salePrice,
  asPreparation,
}: RecipeEditorProps) {
  const { create, update } = useRecipeMutations()
  const { data: items } = useInventoryItems()
  const { data: recipes } = useRecipes()
  const [form, setForm] = useState<FormState>(EMPTY)

  const isEdit = !!recipe
  const isPreparation = recipe?.type === 'preparation' || (!recipe && !!asPreparation)

  useEffect(() => {
    if (!open) return
    setForm(recipe ? fromRecipe(recipe) : EMPTY)
  }, [open, recipe])

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  // Índices para costeo y selectores.
  const itemsById = useMemo(() => {
    const map: Record<string, (typeof items)[number]> = {}
    for (const it of items) map[it.id] = it
    return map
  }, [items])

  const preparationsById = useMemo(() => {
    const map: Record<string, Recipe> = {}
    for (const r of recipes) if (r.type === 'preparation') map[r.id] = r
    return map
  }, [recipes])

  const itemOptions = useMemo(
    () =>
      items
        .filter((it) => it.active !== false)
        .sort((a, b) => a.name.localeCompare(b.name, 'es'))
        .map((it) => ({ value: it.id, label: it.name })),
    [items],
  )

  // Preparaciones disponibles como componente, excluyendo la que se edita.
  const preparationOptions = useMemo(
    () =>
      recipes
        .filter((r) => r.type === 'preparation' && r.id !== recipe?.id)
        .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'es'))
        .map((r) => ({ value: r.id, label: r.name ?? r.id })),
    [recipes, recipe?.id],
  )

  // Receta provisional desde el form, para costeo en vivo.
  const draft = useMemo<Recipe>(() => {
    const components: RecipeComponent[] = form.components
      .filter((r) => r.refId && Number(r.qty) > 0)
      .map((r) => {
        const waste = Number(r.wastePct)
        return {
          kind: r.kind,
          refId: r.refId,
          qty: Number(r.qty),
          ...(waste > 0 ? { wasteFactor: waste / 100 } : {}),
        }
      })
    return {
      id: recipe?.id ?? 'draft',
      type: isPreparation ? 'preparation' : 'product',
      components,
      active: true,
    } as Recipe
  }, [form.components, isPreparation, recipe?.id])

  const cost = useMemo(
    () => costRecipe({ recipe: draft, itemsById, preparationsById, salePrice }),
    [draft, itemsById, preparationsById, salePrice],
  )

  const yieldNum = Number(form.yieldQty)
  const costPerPortion = isPreparation && yieldNum > 0 ? cost.totalCost / yieldNum : null
  const missingNames = cost.missingCostItemIds.map((id) => itemsById[id]?.name ?? id)
  const pending = create.isPending || update.isPending

  const headerName = isPreparation
    ? isEdit
      ? `Editar preparación`
      : 'Nueva preparación'
    : recipe?.posProductKey?.name ?? posSeed?.name ?? 'Receta'

  function setRow(idx: number, patch: Partial<ComponentRow>) {
    setForm((prev) => ({
      ...prev,
      components: prev.components.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    }))
  }

  function addRow() {
    setForm((prev) => ({ ...prev, components: [...prev.components, { ...EMPTY_ROW }] }))
  }

  function removeRow(idx: number) {
    setForm((prev) => ({
      ...prev,
      components: prev.components.length > 1 ? prev.components.filter((_, i) => i !== idx) : prev.components,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pending) return

    const components: RecipeComponent[] = form.components
      .filter((r) => r.refId && Number(r.qty) > 0)
      .map((r) => {
        const waste = Number(r.wastePct)
        return {
          kind: r.kind,
          refId: r.refId,
          qty: Number(r.qty),
          ...(waste > 0 ? { wasteFactor: waste / 100 } : {}),
        }
      })

    let data: RecipeFormData
    if (isPreparation) {
      data = {
        type: 'preparation',
        name: form.name.trim(),
        yieldQty: yieldNum > 0 ? yieldNum : 1,
        components,
        active: form.active === 'true',
      }
    } else {
      const key = recipe?.posProductKey ?? (posSeed
        ? { presentationId: posSeed.presentationId, productGeneralId: posSeed.productGeneralId, name: posSeed.name }
        : null)
      if (!key) return
      data = {
        type: 'product',
        posProductKey: key,
        components,
        active: form.active === 'true',
      }
    }

    if (isEdit && recipe) {
      await update.mutateAsync({ id: recipe.id, data })
    } else {
      await create.mutateAsync(data)
    }
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.div
            variants={modalVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="relative bg-surface-elevated rounded-xl shadow-lg w-full max-w-3xl mx-4 border border-border max-h-[90vh] flex flex-col"
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border shrink-0">
              <div className="min-w-0">
                <h2 className="text-subheading font-semibold text-dark-graphite truncate">{headerName}</h2>
                {!isPreparation && (
                  <p className="text-caption text-mid-gray mt-0.5">
                    Receta de producto vendible{salePrice != null && salePrice > 0 ? ` · ${formatCurrency(salePrice)} POS` : ''}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-mid-gray hover:text-graphite hover:bg-bone transition-colors shrink-0"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto flex-1 space-y-5">
                {isPreparation && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Nombre de la preparación</label>
                      <input
                        value={form.name}
                        onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                        required
                        placeholder="Ej: Salsa de la casa, Mezcla de especias"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Rinde (porciones)</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={form.yieldQty}
                        onChange={(e) => setForm((p) => ({ ...p, yieldQty: e.target.value }))}
                        required
                        placeholder="Ej: 10"
                        className={inputClass}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className={labelClass + ' mb-0'}>Componentes</label>
                    <button
                      type="button"
                      onClick={addRow}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-input-border text-graphite text-caption font-medium hover:bg-bone transition-colors"
                    >
                      <Plus size={14} strokeWidth={1.5} />
                      Añadir
                    </button>
                  </div>

                  <div className="space-y-2">
                    {form.components.map((row, idx) => {
                      const unitHint =
                        row.kind === 'item'
                          ? itemsById[row.refId]?.stockUnit ?? 'u.'
                          : 'porciones'
                      return (
                        <div
                          key={idx}
                          className="grid grid-cols-12 gap-2 items-center rounded-lg border border-border/60 p-2"
                        >
                          <div className="col-span-3">
                            <SelectInput
                              value={row.kind}
                              onChange={(v) => setRow(idx, { kind: v as RecipeComponentKind, refId: '' })}
                              options={KIND_OPTIONS}
                            />
                          </div>
                          <div className="col-span-4">
                            <SelectInput
                              value={row.refId}
                              onChange={(v) => setRow(idx, { refId: v })}
                              options={row.kind === 'item' ? itemOptions : preparationOptions}
                              placeholder={row.kind === 'item' ? 'Insumo...' : 'Preparación...'}
                            />
                          </div>
                          <div className="col-span-2">
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={row.qty}
                                onChange={(e) => setRow(idx, { qty: e.target.value })}
                                placeholder="Cant."
                                className={inputClass + ' pr-9'}
                              />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-caption text-mid-gray pointer-events-none">
                                {unitHint}
                              </span>
                            </div>
                          </div>
                          <div className="col-span-2">
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={row.wastePct}
                                onChange={(e) => setRow(idx, { wastePct: e.target.value })}
                                placeholder="Merma"
                                className={inputClass + ' pr-6'}
                              />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-caption text-mid-gray pointer-events-none">
                                %
                              </span>
                            </div>
                          </div>
                          <div className="col-span-1 flex justify-center">
                            <button
                              type="button"
                              onClick={() => removeRow(idx)}
                              className="w-8 h-8 rounded-full flex items-center justify-center text-mid-gray hover:bg-negative-bg hover:text-negative-text transition-colors"
                              aria-label="Quitar componente"
                            >
                              <Trash2 size={15} strokeWidth={1.5} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Resumen de costeo */}
                <div className="rounded-xl border border-border/60 bg-bone p-4 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <div className="text-caption uppercase tracking-wider text-mid-gray">Costo</div>
                      <div className="text-subheading font-semibold text-dark-graphite">{formatCurrency(cost.totalCost)}</div>
                    </div>
                    {costPerPortion != null && (
                      <div>
                        <div className="text-caption uppercase tracking-wider text-mid-gray">Por porción</div>
                        <div className="text-subheading font-semibold text-dark-graphite">{formatCurrency(costPerPortion)}</div>
                      </div>
                    )}
                    {!isPreparation && salePrice != null && salePrice > 0 && (
                      <>
                        <div>
                          <div className="text-caption uppercase tracking-wider text-mid-gray">Precio POS</div>
                          <div className="text-subheading font-semibold text-dark-graphite">{formatCurrency(salePrice)}</div>
                        </div>
                        <div>
                          <div className="text-caption uppercase tracking-wider text-mid-gray">Margen</div>
                          <div
                            className={`text-subheading font-semibold ${
                              (cost.marginPct ?? 0) >= 0 ? 'text-positive-text' : 'text-negative-text'
                            }`}
                          >
                            {cost.marginPct != null ? `${cost.marginPct.toFixed(0)}%` : '—'}
                            {cost.margin != null && (
                              <span className="text-caption font-normal text-mid-gray ml-1">
                                ({formatCurrency(cost.margin)})
                              </span>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {!cost.isComplete && missingNames.length > 0 && (
                    <div className="flex items-start gap-2 rounded-lg bg-warning-bg px-3 py-2 text-caption text-warning-text">
                      <AlertTriangle size={14} strokeWidth={1.5} className="shrink-0 mt-0.5" />
                      <span>
                        Costeo incompleto: {missingNames.length} insumo{missingNames.length > 1 ? 's' : ''} sin costo
                        {' '}({missingNames.slice(0, 3).join(', ')}
                        {missingNames.length > 3 ? '…' : ''}).
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 px-6 py-4 border-t border-border shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-lg border border-input-border text-graphite text-body font-medium transition-all duration-200 hover:bg-bone"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="px-5 py-2.5 rounded-lg btn-primary text-body font-medium transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {pending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Guardar receta'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
