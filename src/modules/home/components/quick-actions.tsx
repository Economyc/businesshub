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
    <>
      {/* Mobile: iOS-style shortcut */}
      <button
        onClick={() => navigate(to)}
        className="sm:hidden flex flex-col items-center gap-2 group active:scale-95 transition-transform"
      >
        <div className="w-14 h-14 rounded-[18px] bg-bone group-active:bg-border flex items-center justify-center border border-white shadow-sm transition-colors">
          <Icon size={22} strokeWidth={1.5} className="text-dark-graphite" />
        </div>
        <span className="text-[11px] font-bold text-dark-graphite text-center leading-tight">{label}</span>
      </button>
      {/* Desktop: rectangular button */}
      <button
        onClick={() => navigate(to)}
        className="hidden sm:flex items-center gap-2.5 bg-surface-elevated border border-border hover:bg-bone hover:border-border-hover rounded-lg px-3.5 py-3 transition-colors text-left group"
      >
        <Icon size={16} strokeWidth={1.5} className="text-graphite group-hover:text-dark-graphite shrink-0" />
        <span className="text-body text-graphite group-hover:text-dark-graphite truncate">{label}</span>
      </button>
    </>
  )
}

export function QuickActions() {
  return (
    <div className="bg-surface rounded-xl card-elevated p-[18px]">
      <h2 className="text-body font-bold text-dark-graphite mb-3">Acciones rápidas</h2>
      <div className="grid grid-cols-3 sm:grid-cols-2 gap-y-5 gap-x-2 sm:gap-2">
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
