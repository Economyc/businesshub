import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, AlertTriangle, FileText, CalendarClock, TrendingUp, X, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/core/ui/confirm-dialog'
import {
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
  useDeleteNotification,
  useClearAllNotifications,
} from '../hooks'
import type { AppNotification } from '../types'

interface NotificationBellProps {
  /** Where the dropdown opens. 'below-right' for topbar, 'fixed' for sidebar (fixed positioning). Default: 'below-right' */
  dropdownPosition?: 'below-right' | 'fixed'
  /** When using 'fixed' position, the CSS style for the dropdown panel */
  fixedStyle?: React.CSSProperties
}

const TYPE_ICONS: Record<string, typeof Bell> = {
  'weekly-report': FileText,
  'overdue-alert': AlertTriangle,
  'closing-reminder': CalendarClock,
  'price-increase': TrendingUp,
}

const TYPE_COLORS: Record<string, string> = {
  'weekly-report': 'text-blue-500',
  'overdue-alert': 'text-amber-500',
  'closing-reminder': 'text-emerald-500',
  'price-increase': 'text-red-500',
}

function timeAgo(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Ahora'
  if (minutes < 60) return `Hace ${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Hace ${hours}h`
  const days = Math.floor(hours / 24)
  return `Hace ${days}d`
}

export function NotificationBell({ dropdownPosition = 'below-right', fixedStyle }: NotificationBellProps = {}) {
  const [open, setOpen] = useState(false)
  const [confirmClearOpen, setConfirmClearOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { data: notifications = [] } = useNotifications()
  const unreadCount = useUnreadCount()
  const markAsRead = useMarkAsRead()
  const markAllAsRead = useMarkAllAsRead()
  const deleteNotification = useDeleteNotification()
  const clearAllNotifications = useClearAllNotifications()

  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        ref.current && !ref.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleNotificationClick(notification: AppNotification) {
    if (!notification.read) {
      markAsRead.mutate(notification.id)
    }
    setOpen(false)
    // Navigate to agent with a pre-filled prompt based on notification type
    const prompts: Record<string, string> = {
      'weekly-report': 'Muestra el resumen ejecutivo de esta semana',
      'overdue-alert': 'Cobra las facturas vencidas',
      'closing-reminder': '¿Qué debo pagar esta semana?',
      'price-increase': 'Analiza los insumos que subieron de precio recientemente',
    }
    const prompt = prompts[notification.type]
    if (prompt) {
      navigate(`/agent?prompt=${encodeURIComponent(prompt)}`)
    }
  }

  const recent = notifications.slice(0, 10)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-1.5 rounded-lg text-graphite hover:bg-bone transition-colors"
      >
        <Bell size={18} strokeWidth={1.5} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={dropdownRef}
          className={cn(
            'w-80 bg-bone border border-border rounded-xl shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-left-2 duration-200',
            dropdownPosition === 'fixed' ? 'fixed' : 'absolute right-0 top-full mt-2'
          )}
          style={dropdownPosition === 'fixed' ? fixedStyle : undefined}
        >
          <div className="bg-card-bg rounded-lg border border-border/60 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-semibold text-dark-graphite">Notificaciones</span>
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllAsRead.mutate()}
                    className="flex items-center gap-1 text-xs text-mid-gray hover:text-graphite transition-colors"
                  >
                    <CheckCheck size={12} />
                    Marcar todas leídas
                  </button>
                )}
                {recent.length > 0 && (
                  <button
                    onClick={() => setConfirmClearOpen(true)}
                    className="flex items-center gap-1 text-xs text-mid-gray hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={12} />
                    Limpiar todas
                  </button>
                )}
              </div>
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto">
              {recent.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-mid-gray">
                  Sin notificaciones
                </div>
              ) : (
                recent.map((n) => {
                  const Icon = TYPE_ICONS[n.type] ?? Bell
                  const color = TYPE_COLORS[n.type] ?? 'text-graphite'
                  const createdAt = n.createdAt?.toDate?.() ?? new Date()

                  return (
                    <div
                      key={n.id}
                      className={cn(
                        'group relative border-b border-border/50 last:border-0',
                        !n.read && 'bg-blue-50/50 dark:bg-blue-950/10'
                      )}
                    >
                      <button
                        onClick={() => handleNotificationClick(n)}
                        className="w-full text-left px-4 py-3 pr-8 flex gap-3 hover:bg-bone/50 transition-colors"
                      >
                        <div className={cn('mt-0.5 shrink-0', color)}>
                          <Icon size={16} strokeWidth={1.5} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className={cn('text-xs font-medium truncate', !n.read ? 'text-dark-graphite' : 'text-graphite')}>
                              {n.title}
                            </p>
                            {!n.read && (
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                            )}
                          </div>
                          <p className="text-[11px] text-mid-gray line-clamp-2 mt-0.5">{n.summary}</p>
                          <p className="text-[10px] text-mid-gray/60 mt-1">{timeAgo(createdAt)}</p>
                        </div>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteNotification.mutate(n.id)
                        }}
                        aria-label="Eliminar notificación"
                        className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-bone transition-opacity"
                      >
                        <X size={12} className="text-mid-gray hover:text-red-500" />
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmClearOpen}
        title="¿Limpiar todas las notificaciones?"
        description="Se eliminarán todas las notificaciones de esta empresa. Esta acción no se puede deshacer."
        onConfirm={async () => {
          await clearAllNotifications.mutateAsync()
          setConfirmClearOpen(false)
        }}
        onCancel={() => setConfirmClearOpen(false)}
      />
    </div>
  )
}
