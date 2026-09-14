import { useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { Download, FileSpreadsheet, FileText, PackageOpen } from 'lucide-react'
import { PageHeader } from '@/core/ui/page-header'
import { PageTransition } from '@/core/ui/page-transition'
import { DateRangePicker } from '@/core/ui/date-range-picker'
import { ActionMenu } from '@/core/ui/action-menu'
import { EmptyState } from '@/core/ui/empty-state'
import { TableSkeleton } from '@/core/ui/skeleton'
import { UnderlineButtonTabs } from '@/core/ui/underline-tabs'
import { useCompany } from '@/core/hooks/use-company'
import { companyDisplayName } from '../domain/export'
import { formatPeriodLabel } from '../domain/period'
import { useDeliveryReportData } from '../hooks/use-delivery-report-data'
import { useReportDownloads } from '../hooks/use-report-downloads'
import { getReport, type ReportDefinition } from '../registry'
import { ReportDataStatus } from './report-data-status'
import { ReportTable } from './report-table'

export function ReportDetailPage() {
  const { reportId } = useParams()
  const report = getReport(reportId)
  if (!report) return <Navigate to="/informes" replace />
  // key: al saltar de un informe a otro se reinicia la pestaña activa.
  return <ReportDetail key={report.id} report={report} />
}

function ReportDetail({ report }: { report: ReportDefinition }) {
  const { selectedCompany } = useCompany()
  const data = useDeliveryReportData()
  const downloads = useReportDownloads(data.context)
  const [sheetId, setSheetId] = useState(report.sheets[0].id)
  const sheet = report.sheets.find((s) => s.id === sheetId) ?? report.sheets[0]
  const table = useMemo(() => sheet.build(data.context), [sheet, data.context])

  const disabled = !data.ready || downloads.busy !== null
  const subtitle = [
    companyDisplayName(selectedCompany),
    formatPeriodLabel(data.period),
    report.comparesPrevious ? `comparado con ${formatPeriodLabel(data.previousPeriod)}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <PageTransition>
      <PageHeader title={report.title} backTo="/informes" subtitle={<span className="text-body text-mid-gray">{subtitle}</span>}>
        <DateRangePicker />
        <ActionMenu
          label={downloads.busy ? 'Generando…' : 'Descargar'}
          icon={Download}
          items={[
            {
              label: `Excel (.xlsx) · ${report.sheets.length === 1 ? '1 hoja' : `${report.sheets.length} hojas`}`,
              icon: FileSpreadsheet,
              onClick: () => void downloads.downloadExcel(report),
              disabled,
            },
            {
              label: `CSV (.csv) · ${sheet.label}`,
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

      <div className="mt-6 max-w-3xl">
        <h2 className="text-caption font-medium text-mid-gray mb-2">Notas</h2>
        <ol className="space-y-1 text-caption text-mid-gray list-decimal pl-4">
          {report.sheets.length > 1 && <li>Cada pestaña es una hoja del Excel; el CSV descarga solo la pestaña que estás viendo.</li>}
          {report.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ol>
      </div>
    </PageTransition>
  )
}
