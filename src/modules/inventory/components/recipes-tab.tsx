import { useState, useMemo, useEffect } from 'react'
import { Plus, BookOpen, ChefHat, SquarePen, Trash2, AlertCircle } from 'lucide-react'
import { SearchInput } from '@/core/ui/search-input'
import { DataTable, type Column } from '@/core/ui/data-table'
import { EmptyState } from '@/core/ui/empty-state'
import { TableSkeleton } from '@/core/ui/skeleton'
import { ConfirmDialog } from '@/core/ui/confirm-dialog'
import { formatCurrency } from '@/core/utils/format'
import { usePermissions } from '@/core/hooks/use-permissions'
import { usePosCatalogo } from '@/modules/pos-sync/hooks'
import { useCompanyLocalIds } from '@/modules/pos-sync/company-mapping'
import { useInventoryItems } from '../hooks/use-inventory-items'
import { useRecipes, useRecipeMutations } from '../hooks/use-recipes'
import { costRecipe, type CostRecipeResult } from '../domain/cost-recipe'
import { RecipeEditor, type RecipePosSeed } from './recipe-editor'
import type { InventoryItem, Recipe } from '../types'

type Section = 'products' | 'preparations'

interface PosRow {
  id: string // = presentationId, requerido por DataTable
  presentationId: string
  productGeneralId: string
  productName: string
  presentationName: string
  displayName: string
  categoria: string
  price: number
  recipe?: Recipe
  cost?: CostRecipeResult
}

function RecipeChip({ row }: { row: PosRow }) {
  if (!row.recipe) {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-caption font-medium bg-warning-bg text-warning-text">
        Sin receta
      </span>
    )
  }
  if (row.cost && !row.cost.isComplete) {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-caption font-medium bg-warning-bg text-warning-text">
        Costeo incompleto
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-caption font-medium bg-positive-bg text-positive-text">
      Con receta
    </span>
  )
}

export function RecipesTab() {
  const { can } = usePermissions()
  const canCreate = can('inventory', 'create')
  const canUpdate = can('inventory', 'update')
  const canDelete = can('inventory', 'delete')

  const { localIds } = useCompanyLocalIds()
  const localId = localIds[0]
  const { productos, loading: catLoading, error: catError, fetch } = usePosCatalogo()
  const { data: recipes, loading: recLoading } = useRecipes()
  const { data: items } = useInventoryItems()
  const { remove } = useRecipeMutations()

  const [section, setSection] = useState<Section>('products')
  const [search, setSearch] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null)
  const [posSeed, setPosSeed] = useState<RecipePosSeed | null>(null)
  const [seedPrice, setSeedPrice] = useState<number | undefined>(undefined)
  const [editorAsPrep, setEditorAsPrep] = useState(false)
  const [toDelete, setToDelete] = useState<Recipe | null>(null)

  useEffect(() => {
    if (localId != null) fetch(localId)
  }, [localId, fetch])

  const itemsById = useMemo(() => {
    const map: Record<string, InventoryItem> = {}
    for (const it of items) map[it.id] = it
    return map
  }, [items])

  const preparationsById = useMemo(() => {
    const map: Record<string, Recipe> = {}
    for (const r of recipes) if (r.type === 'preparation') map[r.id] = r
    return map
  }, [recipes])

  const recipeByPresentation = useMemo(() => {
    const map = new Map<string, Recipe>()
    for (const r of recipes) {
      if (r.type === 'product' && r.posProductKey) map.set(r.posProductKey.presentationId, r)
    }
    return map
  }, [recipes])

  // Aplanar catálogo POS a presentaciones (una fila por producto vendible).
  const posRows = useMemo<PosRow[]>(() => {
    const rows: PosRow[] = []
    for (const p of productos) {
      const presentaciones = p.lista_presentacion ?? []
      const productName = String(p.productogeneral_descripcion ?? '')
      const productGeneralId = String(p.productogeneral_id ?? '')
      const categoria = String(p.categoria_descripcion ?? '')
      const multi = presentaciones.length > 1
      for (const pres of presentaciones) {
        const presentationId = String(pres.producto_id ?? '')
        if (!presentationId) continue
        const presentationName = String(pres.producto_presentacion ?? '')
        const recipe = recipeByPresentation.get(presentationId)
        const price = Number(pres.producto_precio) || 0
        rows.push({
          id: presentationId,
          presentationId,
          productGeneralId,
          productName,
          presentationName,
          displayName: multi && presentationName ? `${productName} · ${presentationName}` : productName,
          categoria,
          price,
          recipe,
          cost: recipe ? costRecipe({ recipe, itemsById, preparationsById, salePrice: price }) : undefined,
        })
      }
    }
    return rows
  }, [productos, recipeByPresentation, itemsById, preparationsById])

  const filteredPos = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return posRows
    return posRows.filter(
      (r) => r.displayName.toLowerCase().includes(q) || r.categoria.toLowerCase().includes(q),
    )
  }, [posRows, search])

  const preparations = useMemo(
    () =>
      [...recipes]
        .filter((r) => r.type === 'preparation')
        .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'es')),
    [recipes],
  )

  const filteredPreps = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return preparations
    return preparations.filter((r) => (r.name ?? '').toLowerCase().includes(q))
  }, [preparations, search])

  function openProductRecipe(row: PosRow) {
    if (!canUpdate) return
    if (row.recipe) {
      setEditingRecipe(row.recipe)
      setPosSeed(null)
    } else {
      setEditingRecipe(null)
      setPosSeed({
        presentationId: row.presentationId,
        productGeneralId: row.productGeneralId,
        name: row.productName,
      })
    }
    setSeedPrice(row.price)
    setEditorAsPrep(false)
    setEditorOpen(true)
  }

  function openPreparation(recipe: Recipe | null) {
    setEditingRecipe(recipe)
    setPosSeed(null)
    setSeedPrice(undefined)
    setEditorAsPrep(true)
    setEditorOpen(true)
  }

  async function confirmDelete() {
    if (!toDelete) return
    await remove.mutateAsync(toDelete.id)
    setToDelete(null)
  }

  const posColumns: Column<PosRow>[] = [
    {
      key: 'product',
      header: 'Producto / Presentación',
      width: '2.2fr',
      primary: true,
      render: (r) => (
        <div className="min-w-0">
          <div className="font-medium text-dark-graphite truncate">{r.displayName}</div>
          {r.categoria && <div className="text-caption text-mid-gray truncate">{r.categoria}</div>}
        </div>
      ),
    },
    { key: 'price', header: 'Precio POS', width: '1fr', render: (r) => formatCurrency(r.price) },
    { key: 'status', header: 'Receta', width: '1fr', render: (r) => <RecipeChip row={r} /> },
    {
      key: 'cost',
      header: 'Costo',
      width: '1fr',
      render: (r) =>
        r.cost ? (
          <span className={r.cost.isComplete ? 'text-graphite' : 'text-mid-gray'}>
            {formatCurrency(r.cost.totalCost)}
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'margin',
      header: 'Margen',
      width: '0.9fr',
      render: (r) => {
        if (!r.cost || r.cost.marginPct == null || !r.cost.isComplete) return '—'
        return (
          <span className={r.cost.marginPct >= 0 ? 'text-positive-text' : 'text-negative-text'}>
            {r.cost.marginPct.toFixed(0)}%
          </span>
        )
      },
    },
  ]

  const prepColumns: Column<Recipe>[] = [
    {
      key: 'name',
      header: 'Preparación',
      width: '2fr',
      primary: true,
      render: (r) => <span className="font-medium text-dark-graphite">{r.name || '(sin nombre)'}</span>,
    },
    {
      key: 'yield',
      header: 'Rinde',
      width: '1fr',
      render: (r) => (r.yieldQty != null ? `${r.yieldQty.toLocaleString('es-CO')} porc.` : '—'),
    },
    {
      key: 'cost',
      header: 'Costo / porción',
      width: '1.2fr',
      render: (r) => {
        const c = costRecipe({ recipe: r, itemsById, preparationsById })
        const y = r.yieldQty && r.yieldQty > 0 ? r.yieldQty : 1
        return (
          <span className={c.isComplete ? 'text-graphite' : 'text-mid-gray'}>
            {formatCurrency(c.totalCost / y)}
          </span>
        )
      },
    },
    {
      key: 'components',
      header: 'Componentes',
      width: '1fr',
      render: (r) => `${r.components.length}`,
    },
    {
      key: 'actions',
      header: '',
      width: '88px',
      hideOnMobile: true,
      render: (r) => (
        <div className="flex items-center gap-1">
          {canUpdate && (
            <button
              onClick={(e) => { e.stopPropagation(); openPreparation(r) }}
              className="w-8 h-8 rounded-full flex items-center justify-center text-mid-gray hover:bg-bone hover:text-graphite transition-colors"
              aria-label="Editar"
            >
              <SquarePen size={15} strokeWidth={1.5} />
            </button>
          )}
          {canDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); setToDelete(r) }}
              className="w-8 h-8 rounded-full flex items-center justify-center text-mid-gray hover:bg-negative-bg hover:text-negative-text transition-colors"
              aria-label="Eliminar"
            >
              <Trash2 size={15} strokeWidth={1.5} />
            </button>
          )}
        </div>
      ),
    },
  ]

  const loading = catLoading || recLoading

  if (localId == null) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Sin local POS vinculado"
        description="No se encontró un local del POS para esta empresa. Verifica la conexión del POS para mapear recetas."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="inline-flex rounded-lg border border-border/60 p-0.5 gap-0.5 shrink-0">
          <button
            onClick={() => setSection('products')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-caption font-medium transition-colors ${
              section === 'products' ? 'bg-bone text-dark-graphite' : 'text-mid-gray hover:text-graphite'
            }`}
          >
            <BookOpen size={14} strokeWidth={1.5} />
            Productos
          </button>
          <button
            onClick={() => setSection('preparations')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-caption font-medium transition-colors ${
              section === 'preparations' ? 'bg-bone text-dark-graphite' : 'text-mid-gray hover:text-graphite'
            }`}
          >
            <ChefHat size={14} strokeWidth={1.5} />
            Preparaciones
          </button>
        </div>
        <div className="flex-1">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={section === 'products' ? 'Buscar producto o categoría...' : 'Buscar preparación...'}
          />
        </div>
        {section === 'preparations' && canCreate && (
          <button
            onClick={() => openPreparation(null)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg btn-primary text-body font-medium transition-all duration-200 shrink-0"
          >
            <Plus size={16} strokeWidth={1.5} />
            Nueva preparación
          </button>
        )}
      </div>

      {catError && section === 'products' && (
        <div className="flex items-start gap-2 rounded-lg bg-negative-bg px-4 py-3 text-body text-negative-text">
          <AlertCircle size={16} strokeWidth={1.5} className="shrink-0 mt-0.5" />
          <span>No se pudo cargar el catálogo del POS: {catError}</span>
        </div>
      )}

      {section === 'products' ? (
        loading && posRows.length === 0 ? (
          <TableSkeleton rows={6} columns={5} />
        ) : filteredPos.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title={posRows.length === 0 ? 'Sin productos en el catálogo' : 'Sin resultados'}
            description={
              posRows.length === 0
                ? 'El catálogo del POS no devolvió productos vendibles.'
                : 'Ningún producto coincide con la búsqueda.'
            }
          />
        ) : (
          <DataTable columns={posColumns} data={filteredPos} onRowClick={canUpdate ? openProductRecipe : undefined} />
        )
      ) : recLoading && preparations.length === 0 ? (
        <TableSkeleton rows={4} columns={4} />
      ) : filteredPreps.length === 0 ? (
        <EmptyState
          icon={ChefHat}
          title={preparations.length === 0 ? 'Aún no hay preparaciones' : 'Sin resultados'}
          description={
            preparations.length === 0
              ? 'Crea una preparación (salsa, mezcla) para reutilizarla en varias recetas.'
              : 'Ninguna preparación coincide con la búsqueda.'
          }
        />
      ) : (
        <DataTable columns={prepColumns} data={filteredPreps} onRowClick={canUpdate ? openPreparation : undefined} />
      )}

      <RecipeEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        recipe={editingRecipe}
        posSeed={posSeed}
        salePrice={seedPrice}
        asPreparation={editorAsPrep}
      />

      <ConfirmDialog
        open={!!toDelete}
        title="Eliminar preparación"
        description={toDelete ? `¿Eliminar "${toDelete.name ?? 'preparación'}"? Esta acción no se puede deshacer.` : ''}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}
