import { CircleUser } from 'lucide-react'
import { useCompany } from '@/core/hooks/use-company'
import { cn } from '@/lib/utils'

export function Topbar() {
  const { companies, selectedCompany, selectCompany } = useCompany()

  return (
    <header className="flex items-center justify-between px-6 py-3.5 bg-white border-b border-border">
      <div className="text-[15px] font-bold text-dark-graphite tracking-tight">
        Business<span className="font-light text-mid-gray">Hub</span>
      </div>

      <div className="flex gap-1.5">
        {companies.map((company) => (
          <button
            key={company.id}
            onClick={() => selectCompany(company)}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200',
              selectedCompany?.id === company.id
                ? 'bg-graphite text-white'
                : 'text-mid-gray hover:bg-smoke hover:text-graphite'
            )}
          >
            {company.name}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 text-xs text-mid-gray">
        <CircleUser size={16} strokeWidth={1.5} />
        <span>Admin</span>
      </div>
    </header>
  )
}
