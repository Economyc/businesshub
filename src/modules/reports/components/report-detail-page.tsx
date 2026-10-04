import { useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { CalendarDays, ChevronRight, Download, FileSpreadsheet, FileText, PackageOpen, Store, X } from 'lucide-react'
import { PageHeader } from '@/core/ui/page-header'
import { PageTransition } from '@/core/ui/page-transition'
import { DateRangePicker } from '@/core/ui/date-range-picker'
import { ActionMenu } from '@/core/ui/action-menu'
import { EmptyState } from '@/core/ui/empty-state'
import { TableSkeleton } from '@/core/ui/skeleton'
import { UnderlineButtonTabs } from '@/core/ui/underline-tabs'
import { useCompany } from '@/core/hooks/use-company'
import {
  applyCategoryFilter,
  categoryOptions,
  EMPTY_CATEGORY_FILTER,
  type CategoryFilter,
} from '../domain/category-filter'
import { companyDisplayName } from '../domain/export'
import { formatPeriodLabel } from '../domain/period'
import { useDeliveryReportData } from '../hooks/use-delivery-report-data'
import { useReportDownloads } from '../hooks/use-report-downloads'
import { getReport, type ReportDefinition } from '../registry'
import { CategoryFilterControl, describeCategoryFilter } from './category-filter-control'
import { ReportDataStatus } from './report-data-status'
import { ReportTable } from './report-table'

export function ReportDetailPage() {
  const { reportId } = useParams()
  const report = getReport(reportId)
  if (!report) return <Navigate to="/informes/domicilios" replace />
  // key: al saltar de un informe a otro se reinicia la pestaña activa.
  return <ReportDetail key={report.id} report={report} />
}

/** /informes/:reportId era la ruta del detalle antes de separar las secciones. */
export function LegacyReportRedirect() {
  const { reportId } = useParams()
  const report = getReport(reportId)
  return <Navigate to={report ? `/informes/domicilios/${report.id}` : '/informes'} replace />
}

function ReportDetail({ report }: { report: ReportDefinition }) {
  const { selectedCompany } = useCompany()
  const data = useDeliveryReportData()
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(EMPTY_CATEGORY_FILTER)
  const categories = useMemo(() => categoryOptions(data.context.orders), [data.context.orders])
  // El filtro también va al Excel/CSV: el archivo muestra lo mismo que la pantalla.
  const context = useMemo(
    () => (report.filtersByCategory ? applyCategoryFilter(data.context, categoryFilter) : data.context),
    [report.filtersByCategory, data.context, categoryFilter],
  )
  const downloads = useReportDownloads(context)
  const [sheetId, setSheetId] = useState(report.sheets[0].id)
  const sheet = report.sheets.find((s) => s.id === sheetId) ?? report.sheets[0]
  const table = useMemo(() => sheet.build(context), [sheet, context])
  const filterLabel = report.filtersByCategory ? describeCategoryFilter(categoryFilter, categories) : null

  const disabled = !data.ready || downloads.busy !== null
  const subtitle = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body text-mid-gray">
      <span className="inline-flex items-center gap-1.5">
        <Store className="size-4" strokeWidth={1.5} />
        {companyDisplayName(selectedCompany).replace(' | ', ' · ')}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <CalendarDays className="size-4" strokeWidth={1.5} />
        <span className="text-graphite">{capitalize(formatPeriodLabel(data.period))}</span>
        {report.comparesPrevious && (
          <span className="rounded-full bg-smoke px-2 py-0.5 text-caption text-graphite">
            vs {formatPeriodLabel(data.previousPeriod)}
          </span>
        )}
      </span>
    </div>
  )

  return (
    <PageTransition>
      <PageHeader title={report.title} backTo="/informes/domicilios" subtitle={subtitle}>
        {report.filtersByCategory && (
          <CategoryFilterControl options={categories} value={categoryFilter} onChange={setCategoryFilter} />
        )}
        <DateRangePicker />
        <ActionMenu
          label={downloads.busy ? 'Generando…' : 'Descargar'}
          icon={Download}
          items={[
            {
              label: `Excel (.xlsx) | ${report.sheets.length === 1 ? '1 hoja' : `${report.sheets.length} hojas`}`,
              icon: FileSpreadsheet,
              onClick: () => void downloads.downloadExcel(report),
              disabled,
            },
            {
              label: `CSV (.csv) | ${sheet.label}`,
              icon: FileText,
              onClick: () => void downloads.downloadCsv(report, sheet),
              disabled,
            },
          ]}
        />
      </PageHeader>

      <ReportDataStatus data={data} />
      {downloads.error && <p className="mb-4 text-caption text-negative-text">{downloads.error}</p>}

      {report.sheets.length > 1 && (
        <UnderlineButtonTabs
          tabs={report.sheets.map((s) => ({ value: s.id, label: s.label, icon: s.icon }))}
          active={sheet.id}
          onChange={setSheetId}
        />
      )}

      {filterLabel && (
        <div className="mb-4 flex items-center gap-2 text-caption text-mid-gray">
          <span>Filtrado:</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-smoke py-0.5 pl-2 pr-1 text-graphite">
            {filterLabel}
            <button
              type="button"
              onClick={() => setCategoryFilter({ ...categoryFilter, categories: [] })}
              className="rounded-full p-0.5 hover:bg-bone"
              aria-label="Quitar filtro"
            >
              <X className="size-3" />
            </button>
          </span>
        </div>
      )}

      {data.isPending ? (
        <TableSkeleton rows={6} columns={Math.min(table.columns.length, 6)} />
      ) : data.context.orders.length === 0 ? (
        <div className="bg-surface rounded-xl card-elevated">
          <EmptyState
            icon={PackageOpen}
            title="Sin pedidos a domicilio"
            description="No hay pedidos de Rappi, DiDi, Web ni domicilio telefónico en este periodo."
          />
        </div>
      ) : (
        <ReportTable table={table} previousPending={data.previousPending} detail={sheet.kind === 'detail'} />
      )}

      {/* Cerradas por defecto: son referencia, no algo que se lea cada vez. */}
      <details className="group mt-6 max-w-3xl">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-caption font-medium text-mid-gray hover:text-graphite [&::-webkit-details-marker]:hidden">
          <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
          Cómo se calcula
        </summary>
        <ol className="mt-2 space-y-1 text-caption text-mid-gray list-decimal pl-4">
          {report.sheets.length > 1 && <li>Cada pestaña es una hoja del Excel; el CSV descarga solo la pestaña que estás viendo.</li>}
          {report.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ol>
      </details>
    </PageTransition>
  )
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
