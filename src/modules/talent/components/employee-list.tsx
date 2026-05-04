import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Users, FileUp } from 'lucide-react'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { SearchInput } from '@/core/ui/search-input'
import { FilterPopover } from '@/core/ui/filter-popover'
import { DataTable } from '@/core/ui/data-table'
import { StatusBadge } from '@/core/ui/status-badge'
import { EmptyState } from '@/core/ui/empty-state'
import { formatCurrency } from '@/core/utils/format'
import { TableSkeleton } from '@/core/ui/skeleton'
import { LoadMoreButton } from '@/core/ui/load-more-button'
import { ExportButton } from '@/core/ui/export-button'
import { ImportDialog } from '@/core/ui/import-dialog'
import { usePaginatedEmployees } from '../hooks'
import { talentService } from '../services'
import { useCompany } from '@/core/hooks/use-company'
import { usePermissions } from '@/core/hooks/use-permissions'
import { EmployeeForm } from './employee-form'
import { employeeFields } from '../utils/field-schema'
import type { Employee, EmployeeFormData } from '../types'

export function EmployeeList() {
  const navigate = useNavigate()
  const { selectedCompany } = useCompany()
  const { can } = usePermissions()
  const canEdit = can('talent', 'create')
  const { data: employees, loading, loadingMore, hasMore, totalCount, loadMore, refetch } = usePaginatedEmployees()
  const [search, setSearch] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)

  async function handleImport(records: EmployeeFormData[]) {
    if (!selectedCompany) return { success: 0, failed: records.length }
    let success = 0
    let failed = 0
    for (const record of records) {
      try {
        await talentService.create(selectedCompany.id, record)
        success++
      } catch {
        failed++
      }
    }
    refetch()
    return { success, failed }
  }

  const departments = useMemo(() => {
    const set = new Set(employees.map((e) => e.department).filter(Boolean))
    return Array.from(set).sort()
  }, [employees])

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      const matchesSearch =
        search === '' ||
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        (e.identification ?? '').toLowerCase().includes(search.toLowerCase()) ||
        e.role.toLowerCase().includes(search.toLowerCase()) ||
        e.email.toLowerCase().includes(search.toLowerCase())
      const matchesDept = departmentFilter === '' || e.department === departmentFilter
      const matchesStatus = statusFilter === '' || e.status === statusFilter
      return matchesSearch && matchesDept && matchesStatus
    })
  }, [employees, search, departmentFilter, statusFilter])

  const totalPayroll = useMemo(() => {
    return filtered.reduce((sum, e) => sum + (e.salary ?? 0), 0)
  }, [filtered])

  const columns = [
    {
      key: 'name',
      header: 'Nombre',
      width: '2fr',
      render: (e: Employee) => <span className="font-medium text-dark-graphite">{e.name}</span>,
    },
    {
      key: 'identification',
      header: 'Identificación',
      width: '1fr',
      render: (e: Employee) => e.identification || '—',
    },
    {
      key: 'role',
      header: 'Cargo',
      width: '1.5fr',
      render: (e: Employee) => e.role,
    },
    {
      key: 'department',
      header: 'Departamento',
      width: '1fr',
      render: (e: Employee) => e.department,
    },
    {
      key: 'salary',
      header: 'Salario',
      width: '1fr',
      render: (e: Employee) =>
        formatCurrency(e.salary ?? 0),
    },
    {
      key: 'status',
      header: 'Estado',
      width: '0.8fr',
      render: (e: Employee) => <StatusBadge variant={e.status} />,
    },
  ]

  return (
    <PageTransition>
      <PageHeader title="Directorio de Talento">
        <ExportButton data={filtered} fields={employeeFields} filenameBase="empleados" />
        {canEdit && (
          <>
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-input-border text-graphite text-body font-medium transition-all duration-200 hover:bg-bone"
            >
              <FileUp size={15} strokeWidth={2} />
              Importar
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg btn-primary text-body font-medium transition-all duration-200"
            >
              <Plus size={15} strokeWidth={2} />
              Nuevo
            </button>
          </>
        )}
      </PageHeader>

      <EmployeeForm
        open={showForm}
        employee={null}
        onClose={() => { setShowForm(false); refetch() }}
      />
      <ImportDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        title="Importar Empleados"
        fields={employeeFields}
        filenameBase="empleados"
        onImport={handleImport}
      />

      <div className="mb-4 text-caption text-mid-gray">
        Nómina total:{' '}
        <span className="font-medium text-graphite">
          {formatCurrency(totalPayroll)}
        </span>
      </div>

      <div className="flex gap-3 mb-5">
        <div className="flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar empleado..." />
        </div>
        <FilterPopover
          activeCount={[departmentFilter, statusFilter].filter(Boolean).length}
          onClear={() => {
            setDepartmentFilter('')
            setStatusFilter('')
          }}
        >
          <div>
            <label className="block text-caption text-mid-gray mb-1">Departamento</label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-input-border bg-input-bg text-body text-graphite focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200"
            >
              <option value="">Todos los departamentos</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-caption text-mid-gray mb-1">Estado</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-input-border bg-input-bg text-body text-graphite focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200"
            >
              <option value="">Todos los estados</option>
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
          </div>
        </FilterPopover>
      </div>

      {loading ? (
        <TableSkeleton rows={5} columns={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No hay empleados"
          description="Agrega tu primer empleado usando el botón + Nuevo"
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={filtered}
            onRowClick={(e) => navigate(`/talent/${e.id}`)}
          />
          <LoadMoreButton
            onClick={loadMore}
            loading={loadingMore}
            hasMore={hasMore}
            loadedCount={employees.length}
            totalCount={totalCount}
          />
        </>
      )}
    </PageTransition>
  )
}
