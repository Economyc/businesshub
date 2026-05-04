import { useState, useEffect, useRef } from 'react'
import { Clock, Trash2, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { HoverHint } from '@/components/ui/tooltip'
import type { Conversation } from '../types'

interface ConversationHistoryProps {
  conversations: Conversation[]
  activeConversationId: string | null
  onSelect: (conversation: Conversation) => void
  onDelete: (conversationId: string) => void
}

function formatRelativeDate(timestamp: { seconds?: number; _seconds?: number }): string {
  const seconds = timestamp.seconds ?? timestamp._seconds ?? 0
  const date = new Date(seconds * 1000)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return 'Ahora'
  if (diffMin < 60) return `hace ${diffMin}m`
  if (diffHr < 24) return `hace ${diffHr}h`
  if (diffDays < 7) return `hace ${diffDays}d`
  return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
}

export function ConversationHistory({ conversations, activeConversationId, onSelect, onDelete }: ConversationHistoryProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  function handleSelect(conversation: Conversation) {
    onSelect(conversation)
    setOpen(false)
  }

  function handleDelete(e: React.MouseEvent, conversationId: string) {
    e.stopPropagation()
    onDelete(conversationId)
  }

  return (
    <div ref={containerRef} className="relative">
      <HoverHint label="Historial de conversaciones">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-8 h-8 flex items-center justify-center rounded-full text-mid-gray hover:text-graphite hover:bg-bone transition-colors active:scale-95 relative"
        >
          <Clock size={16} strokeWidth={1.5} />
          {conversations.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-graphite text-white text-caption font-medium flex items-center justify-center leading-none">
              {conversations.length > 9 ? '9+' : conversations.length}
            </span>
          )}
        </button>
      </HoverHint>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-72 z-50 rounded-xl border border-border/60 bg-card-bg overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100">
          <div className="px-3 py-2.5 border-b border-border/60">
            <p className="text-body font-medium text-dark-graphite">Conversaciones</p>
          </div>

          {conversations.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <MessageSquare size={20} className="text-mid-gray/40 mx-auto mb-2" />
              <p className="text-body text-mid-gray">Sin conversaciones guardadas</p>
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => handleSelect(conv)}
                  className={cn(
                    'flex items-start group hover:bg-bone/60 transition-colors cursor-pointer',
                    conv.id === activeConversationId && 'bg-bone/80'
                  )}
                >
                  <div className="flex-1 min-w-0 px-3 py-2.5">
                    <p className="text-body font-medium text-dark-graphite truncate leading-tight">
                      {conv.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-caption text-mid-gray">
                        {formatRelativeDate(conv.updatedAt as unknown as { seconds?: number; _seconds?: number })}
                      </span>
                      <span className="text-caption text-mid-gray/60">
                        {conv.messageCount} msgs
                      </span>
                    </div>
                  </div>
                  <HoverHint label="Eliminar">
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, conv.id)}
                      className="shrink-0 w-6 h-6 mr-2 mt-2.5 flex items-center justify-center rounded text-mid-gray/0 group-hover:text-mid-gray hover:!text-destructive transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </HoverHint>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
