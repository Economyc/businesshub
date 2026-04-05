import { useState } from 'react'
import { Clock, Trash2, MessageSquare } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
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

  function handleSelect(conversation: Conversation) {
    onSelect(conversation)
    setOpen(false)
  }

  function handleDelete(e: React.MouseEvent, conversationId: string) {
    e.stopPropagation()
    onDelete(conversationId)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="w-8 h-8 flex items-center justify-center rounded-full text-mid-gray hover:text-graphite hover:bg-bone transition-colors active:scale-95 relative"
        title="Historial de conversaciones"
      >
        <Clock size={16} strokeWidth={1.5} />
        {conversations.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-graphite text-white text-[9px] font-bold flex items-center justify-center">
            {conversations.length > 9 ? '9+' : conversations.length}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0">
        <div className="px-3 py-2.5 border-b border-border">
          <p className="text-xs font-semibold text-dark-graphite">Conversaciones</p>
        </div>

        {conversations.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <MessageSquare size={20} className="text-mid-gray/40 mx-auto mb-1.5" />
            <p className="text-xs text-mid-gray">Sin conversaciones guardadas</p>
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => handleSelect(conv)}
                className={cn(
                  'w-full text-left px-3 py-2.5 flex items-start gap-2.5 hover:bg-bone/60 transition-colors group',
                  conv.id === activeConversationId && 'bg-bone/80'
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-dark-graphite truncate leading-tight">
                    {conv.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-mid-gray">
                      {formatRelativeDate(conv.updatedAt as unknown as { seconds?: number; _seconds?: number })}
                    </span>
                    <span className="text-[10px] text-mid-gray/60">
                      {conv.messageCount} msgs
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => handleDelete(e, conv.id)}
                  className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-mid-gray/0 group-hover:text-mid-gray hover:!text-destructive transition-colors"
                  title="Eliminar"
                >
                  <Trash2 size={13} />
                </button>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
