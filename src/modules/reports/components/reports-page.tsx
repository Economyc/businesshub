import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Download, Loader2, Bike, Calculator } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/core/ui/page-header'
import { PageTransition } from '@/core/ui/page-transition'
import { DateRangePicker } from '@/core/ui/date-range-picker'
import { UnderlineButtonTabs } from '@/core/ui/underline-tabs'
import { currentYm } from '@/core/ui/month-picker'
import { prevMonthOf } from '@/core/pnl/month.ts'
import { useCompany } from '@/core/hooks/use-company'
import { usePermissions } from '@/core/hooks/use-permissions'
import { TAB_IDS } from '@/core/config/access-registry'
import { ClosingView } from '../closing/closing-view'
import { companyDisplayName } from '../domain/export'
import { formatPeriodLabel } from '../domain/period'
import { useDeliveryReportData } from '../hooks/use-delivery-report-data'
import { useReportDownloads } from '../hooks/use-report-downloads'
import { REPORTS, REPORT_CATEGORIES, type ReportDefinition } from '../registry'
import { ReportDataStatus } from './report-data-status'

export function ReportsPage() {
  const { selectedCompany } = useCompany()
  const { can, canAccessTab } = usePermissions()
  const [tab, setTab] = useState('domicilios')
  // El cierre arranca en el mes anterior: el corriente todavía no está cerrado.
  const [ym, setYm] = useState(() => prevMonthOf(currentYm()))

  // /informes lo usa también gente de mercadeo para los informes de domicilios.
  // El cierre trae el Estado de Resultados completo —utilidad, caja, gastos— así
  // que es una pestaña aparte con su propio permiso, no algo que venga incluido
  // por tener acceso a la página.
  const verCierre = canAccessTab(TAB_IDS.reportsCierre)
  const tabs = [
    { value: 'domicilios', label: 'Domicilios', icon: Bike },
    ...(verCierre ? [{ value: 'cierre', label: 'Cierre mensual', icon: Calculator }] : []),
  ]
  // Si alguien pierde el permiso con la pestaña abierta, vuelve a domicilios.
  const activo = tab === 'cierre' && !verCierre ? 'domicilios' : tab

  return (
    <PageTransition>
      <PageHeader
        title="Informes"
        subtitle={<span className="text-body text-mid-gray">{companyDisplayName(selectedCompany)}</span>}
      >
        {/* El cierre trae su propio selector: siempre es un mes completo. */}
        {activo === 'domicilios' && <DateRangePicker />}
      </PageHeader>

      {tabs.length > 1 && (
        <UnderlineButtonTabs tabs={tabs} active={activo} onChange={setTab} />
      )}

      {activo === 'cierre' ? (
        <ClosingView ym={ym} onMonthChange={setYm} canEdit={can('reports', 'update')} />
      ) : (
        <DeliveryReports />
      )}
    </PageTransition>
  )
}

/**
 * Los informes de domicilios viven en su propio componente para que sus queries
 * al POS sólo corran cuando la pestaña está abierta.
 */
function DeliveryReports() {
  const navigate = useNavigate()
  const data = useDeliveryReportData()
  const downloads = useReportDownloads(data.context)
  const orderCount = data.context.orders.length

  return (
    <>
      <ReportDataStatus data={data} />

      {REPORT_CATEGORIES.map((category) => (
        <section key={category.id} className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="text-subheading font-medium text-dark-graphite">{category.title}</h2>
            <span className="text-caption text-mid-gray tabular-nums">
              {data.isPending ? 'Cargando ventas…' : `${orderCount.toLocaleString('es-CO')} pedidos · ${formatPeriodLabel(data.period)}`}
            </span>
          </div>

          <div className="bg-surface rounded-xl card-elevated overflow-hidden">
            <div className="hidden md:grid grid-cols-[minmax(0,2.6fr)_minmax(0,1.2fr)_200px] px-[18px] py-3 bg-bone border-b border-border-hover text-caption font-medium text-mid-gray">
              <div>Informe</div>
              <div className="px-3">Hojas del archivo</div>
              <div className="text-right">Descargar</div>
            </div>
            {REPORTS.filter((r) => r.category === category.id).map((report) => (
              <ReportListRow
                key={report.id}
                report={report}
                ready={data.ready}
                busy={downloads.busy}
                onOpen={() => navigate(`/informes/${report.id}`)}
                onExcel={() => downloads.downloadExcel(report)}
                onCsv={() => downloads.downloadCsv(report)}
              />
            ))}
          </div>

          {downloads.error && <p className="text-caption text-negative-text">{downloads.error}</p>}
        </section>
      ))}
    </>
  )
}

interface ReportListRowProps {
  report: ReportDefinition
  ready: boolean
  busy: string | null
  onOpen: () => void
  onExcel: () => void
  onCsv: () => void
}

function ReportListRow({ report, ready, busy, onOpen, onExcel, onCsv }: ReportListRowProps) {
  const Icon = report.icon
  const downloadIcon = (format: 'xlsx' | 'csv') =>
    busy === `${report.id}:${format}` ? <Loader2 className="animate-spin" /> : <Download strokeWidth={1.5} />

  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,2.6fr)_minmax(0,1.2fr)_200px] items-center gap-4 md:gap-0 px-[18px] py-3 border-b border-border last:border-b-0">
      <button type="button" onClick={onOpen} className="group flex items-center gap-3 text-left min-w-0 md:pr-3">
        <span className="size-8 rounded-lg bg-bone text-mid-gray flex items-center justify-center shrink-0">
          <Icon size={16} strokeWidth={1.5} />
        </span>
        <span className="min-w-0 text-body font-medium text-dark-graphite group-hover:underline underline-offset-4">
          {report.title}
        </span>
      </button>
      <div className="hidden md:block px-3 text-caption text-graphite">
        {report.sheets.map((s) => s.label).join(' · ')}
      </div>
      <div className="flex items-center gap-2 md:justify-end">
        <Button variant="outline" size="sm" onClick={onExcel} disabled={!ready || busy !== null}>
          {downloadIcon('xlsx')}
          Excel
        </Button>
        <Button variant="outline" size="sm" onClick={onCsv} disabled={!ready || busy !== null}>
          {downloadIcon('csv')}
          CSV
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onOpen} aria-label={`Abrir ${report.title}`}>
          <ChevronRight strokeWidth={1.5} />
        </Button>
      </div>
    </div>
  )
}
