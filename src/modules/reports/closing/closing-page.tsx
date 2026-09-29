import { Navigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/core/ui/page-header'
import { PageTransition } from '@/core/ui/page-transition'
import { currentYm } from '@/core/ui/month-picker'
import { prevMonthOf } from '@/core/pnl/month.ts'
import { useCompany } from '@/core/hooks/use-company'
import { usePermissions } from '@/core/hooks/use-permissions'
import { TAB_IDS } from '@/core/config/access-registry'
import { companyDisplayName } from '../domain/export'
import { ClosingView } from './closing-view'

const YM_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

/** /informes/cierre — el mes va en ?mes=YYYY-MM para poder compartir el enlace. */
export function ClosingPage() {
  const { selectedCompany } = useCompany()
  const { can, canAccessTab } = usePermissions()
  const [params, setParams] = useSearchParams()

  // Permiso propio: el Estado de Resultados no viene incluido con la página.
  if (!canAccessTab(TAB_IDS.reportsCierre)) return <Navigate to="/informes/domicilios" replace />

  // Arranca en el mes anterior: el corriente todavía no está cerrado.
  const mes = params.get('mes')
  const ym = mes && YM_PATTERN.test(mes) ? mes : prevMonthOf(currentYm())

  return (
    <PageTransition>
      <PageHeader
        title="Cierre mensual"
        subtitle={<span className="text-body text-mid-gray">{companyDisplayName(selectedCompany)}</span>}
      />
      <ClosingView
        ym={ym}
        onMonthChange={(next) => setParams({ mes: next }, { replace: true })}
        canEdit={can('reports', 'update')}
      />
    </PageTransition>
  )
}
