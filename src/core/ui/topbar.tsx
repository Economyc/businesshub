import { Menu } from 'lucide-react'
import { Link } from 'react-router-dom'
import { NotificationBell } from '@/modules/notifications/components/notification-bell'

interface TopbarProps {
  onMenuToggle?: () => void
}

export function Topbar({ onMenuToggle }: TopbarProps) {
  return (
    <header className="flex items-center gap-3 py-3.5 bg-card-bg border-b border-border px-4">
      <button
        onClick={onMenuToggle}
        className="p-1.5 rounded-lg text-graphite hover:bg-bone transition-colors"
      >
        <Menu size={20} strokeWidth={1.5} />
      </button>
      <Link to="/home" className="flex-1 text-heading font-bold text-dark-graphite tracking-tight hover:opacity-70 transition-opacity">
        Business<span className="font-light text-mid-gray">Hub</span>
      </Link>
      <NotificationBell />
    </header>
  )
}
