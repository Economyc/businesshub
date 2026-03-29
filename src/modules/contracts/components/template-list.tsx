import { useState, useMemo } from 'react'
import { Plus, LayoutTemplate, Upload } from 'lucide-react'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { SearchInput } from '@/core/ui/search-input'
import { FilterPopover } from '@/core/ui/filter-popover'
import { DataTable } from '@/core/ui/data-table'
import { StatusBadge } from '@/core/ui/status-badge'
import { EmptyState } from '@/core/ui/empty-state'
import { useCompany } from '@/core/hooks/use-company'
import { useTemplates } from '../hooks'
import { templateService } from '../services'
import { getDefaultTemplates } from '../defaults/templates'
import { TemplateForm } from './template-form'
import { ContractsTabs } from './contracts-tabs'
import type { ContractTemplate } from '../types'

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  indefinido: 'Término Indefinido',
  fijo: 'Término Fijo',
  obra_labor: 'Obra o Labor',
  aprendizaje: 'Aprendizaje',
  prestacion_servicios: 'Prestación de Servicios',
}

export function TemplateList() {
  const { selectedCompany } = useCompany()
  const { data: templates, loading, refetch } = useTemplates()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ContractTemplate | null>(null)
  const [seeding, setSeeding] = useState(false)

  const filtered = useMemo(() => {
    return templates.filter((t) => {
      const matchesSearch =
        search === '' ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.position.toLowerCase().includes(search.toLowerCase())
      const matchesType = typeFilter === '' || t.contractType === typeFilter
      return matchesSearch && matchesType
    })
  }, [templates, search, typeFilter])

  async function seedDefaults() {
    if (!selectedCompany || seeding) return
    setSeeding(true)
    try {
      const defaults = getDefaultTemplates()
      for (const d of defaults) {
        await templateService.create(selectedCompany.id, d)
      }
      await refetch()
    } finally {
      setSeeding(false)
    }
  }

  const columns = [
    {
      key: 'name',
      header: 'Nombre',
      width: '2.5fr',
      render: (t: ContractTemplate) => (
        <span className="font-medium text-dark-graphite">{t.name}</span>
      ),
    },
    {
      key: 'contractType',
      header: 'Tipo',
      width: '1.5fr',
      render: (t: ContractTemplate) => CONTRACT_TYPE_LABELS[t.contractType] ?? t.contractType,
    },
    {
      key: 'position',
      header: 'Cargo',
      width: '1.5fr',
      render: (t: ContractTemplate) => t.position,
    },
    {
      key: 'clauses',
      header: 'Cláusulas',
      width: '0.8fr',
      render: (t: ContractTemplate) => t.clauses?.length ?? 0,
    },
    {
      key: 'isDefault',
      header: 'Origen',
      width: '0.8fr',
      render: (t: ContractTemplate) => (
        <StatusBadge variant={t.isDefault ? 'active' : 'pending'} label={t.isDefault ? 'Base' : 'Custom'} />
      ),
    },
  ]

  return (
    <PageTransition>
      <PageHeader title="Contratos">
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] btn-primary text-body font-medium transition-all duration-200 hover:-translate-y-px hover:shadow-md"
        >
          <Plus size={15} strokeWidth={2} />
          Nueva Plantilla
        </button>
      </PageHeader>

      <ContractsTabs />

      <TemplateForm
        open={showForm || !!editingTemplate}
        template={editingTemplate}
        onClose={() => { setShowForm(false); setEditingTemplate(null); refetch() }}
      />

      <div className="flex gap-3 mb-5">
        <div className="flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar plantilla..." />
        </div>
        <FilterPopover
          activeCount={typeFilter ? 1 : 0}
          onClear={() => setTypeFilter('')}
        >
          <div>
            <label className="block text-caption text-mid-gray mb-1">Tipo de contrato</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-[10px] border border-input-border bg-input-bg text-body text-graphite focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200"
            >
              <option value="">Todos los tipos</option>
              {Object.entries(CONTRACT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </FilterPopover>
      </div>

      {loading ? (
        <div className="text-body text-mid-gray py-8 text-center">Cargando...</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12">
          <EmptyState
            icon={LayoutTemplate}
            title="No hay plantillas"
            description="Carga las plantillas predeterminadas o crea una nueva"
          />
          <button
            onClick={seedDefaults}
            disabled={seeding}
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] btn-primary text-body font-medium transition-all duration-200 hover:-translate-y-px hover:shadow-md disabled:opacity-60"
          >
            <Upload size={15} strokeWidth={2} />
            {seeding ? 'Cargando...' : 'Cargar plantillas predeterminadas'}
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={LayoutTemplate}
          title="Sin resultados"
          description="No se encontraron plantillas con esos filtros"
        />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          onRowClick={(t) => setEditingTemplate(t)}
        />
      )}
    </PageTransition>
  )
}
