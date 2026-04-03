import { useNavigate } from 'react-router-dom'
import { AlertTriangle, TrendingUp, FileWarning, CheckCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { DashboardAlerts, AlertItem } from '../hooks'

interface AlertSectionProps {
  icon: LucideIcon
  color: string
  borderColor: string
  title: string
  items: AlertItem[]
  actionLabel: string
  onAction: () => void
}

function AlertSection({ icon: Icon, color, borderColor, title, items, actionLabel, onAction }: AlertSectionProps) {
  return (
    <div className={`border-l-3 ${borderColor} pl-3 py-2`}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon size={14} className={color} />
        <span className="text-body font-medium text-dark-graphite">{title}</span>
      </div>
      <div className="space-y-1 mb-2">
        {items.slice(0, 3).map((item) => (
          <div key={item.id} className="flex items-center justify-between text-caption text-graphite">
            <span className="truncate mr-2">{item.label}</span>
            <span className="text-mid-gray shrink-0">{item.detail}</span>
          </div>
        ))}
        {items.length > 3 && (
          <span className="text-caption text-mid-gray">+{items.length - 3} más</span>
        )}
      </div>
      <button
        onClick={onAction}
        className="text-caption font-medium text-graphite hover:text-dark-graphite transition-colors"
      >
        {actionLabel} →
      </button>
    </div>
  )
}

interface AlertsPanelProps {
  alerts: DashboardAlerts
}

export function AlertsPanel({ alerts }: AlertsPanelProps) {
  const navigate = useNavigate()
  const { overdueItems, budgetExceeded, expiringContracts } = alerts
  const hasAlerts = overdueItems.length > 0 || budgetExceeded.length > 0 || expiringContracts.length > 0

  return (
    <div className="bg-surface rounded-xl card-elevated p-[18px]">
      <h2 className="text-body font-bold text-dark-graphite mb-3">Alertas</h2>

      {!hasAlerts ? (
        <div className="flex flex-col items-center justify-center py-8 text-mid-gray">
          <CheckCircle size={32} strokeWidth={1.5} className="mb-2 text-emerald-400" />
          <span className="text-caption">Sin alertas activas</span>
        </div>
      ) : (
        <div className="space-y-4">
          {overdueItems.length > 0 && (
            <AlertSection
              icon={AlertTriangle}
              color="text-red-500"
              borderColor="border-red-400"
              title={`${overdueItems.length} pago${overdueItems.length > 1 ? 's' : ''} vencido${overdueItems.length > 1 ? 's' : ''}`}
              items={overdueItems}
              actionLabel="Ver cartera"
              onAction={() => navigate('/cartera')}
            />
          )}

          {budgetExceeded.length > 0 && (
            <AlertSection
              icon={TrendingUp}
              color="text-amber-500"
              borderColor="border-amber-400"
              title={`${budgetExceeded.length} categoría${budgetExceeded.length > 1 ? 's' : ''} sobre presupuesto`}
              items={budgetExceeded}
              actionLabel="Ver presupuesto"
              onAction={() => navigate('/finance/budget')}
            />
          )}

          {expiringContracts.length > 0 && (
            <AlertSection
              icon={FileWarning}
              color="text-orange-500"
              borderColor="border-orange-400"
              title={`${expiringContracts.length} contrato${expiringContracts.length > 1 ? 's' : ''} por vencer`}
              items={expiringContracts}
              actionLabel="Ver contratos"
              onAction={() => navigate('/contracts')}
            />
          )}
        </div>
      )}
    </div>
  )
}
