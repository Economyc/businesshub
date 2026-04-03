import { useNavigate } from 'react-router-dom'
import { Plus, Receipt, Wallet, BarChart3, Users, PiggyBank } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface QuickActionButtonProps {
  icon: LucideIcon
  label: string
  to: string
}

function QuickActionButton({ icon: Icon, label, to }: QuickActionButtonProps) {
  const navigate = useNavigate()

  return (
    <button
      onClick={() => navigate(to)}
      className="flex items-center gap-2.5 bg-surface-elevated border border-border hover:bg-bone hover:border-border-hover rounded-lg px-3.5 py-3 transition-colors text-left group"
    >
      <Icon size={16} strokeWidth={1.5} className="text-graphite group-hover:text-dark-graphite shrink-0" />
      <span className="text-body text-graphite group-hover:text-dark-graphite truncate">{label}</span>
    </button>
  )
}

export function QuickActions() {
  return (
    <div className="bg-surface rounded-xl card-elevated p-6">
      <h2 className="text-subheading font-medium text-dark-graphite mb-4">Acciones rápidas</h2>
      <div className="grid grid-cols-2 gap-3">
        <QuickActionButton icon={Plus} label="Nueva transacción" to="/finance" />
        <QuickActionButton icon={Receipt} label="Nuevo cierre" to="/closings" />
        <QuickActionButton icon={Wallet} label="Ver cartera" to="/cartera" />
        <QuickActionButton icon={BarChart3} label="Análisis" to="/analytics" />
        <QuickActionButton icon={Users} label="Nómina" to="/payroll" />
        <QuickActionButton icon={PiggyBank} label="Presupuesto" to="/finance/budget" />
      </div>
    </div>
  )
}
