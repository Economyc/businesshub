import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'

export function KPIDashboard() {
  return (
    <PageTransition>
      <PageHeader title="Panel de Insights" />
      <p className="text-mid-gray">Dashboard en construcción...</p>
    </PageTransition>
  )
}
