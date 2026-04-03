import { useEffect, useRef } from 'react'
import type { UIMessage } from 'ai'
import { MessageBubble } from './message-bubble'
import { ToolStep } from './tool-step'
import { ConfirmationCard } from './confirmation-card'
import { Bot } from 'lucide-react'

const MUTATION_TOOLS = new Set([
  'createEmployee',
  'updateEmployee',
  'deleteEmployee',
  'createSupplier',
  'updateSupplier',
  'deleteSupplier',
  'createTransaction',
])

interface MessageListProps {
  messages: UIMessage[]
  isLoading: boolean
  onSuggestionClick?: (suggestion: string) => void
  onToolConfirm?: (toolCallId: string, toolName: string, args: Record<string, unknown>) => void
  onToolCancel?: (toolCallId: string) => void
}

export function MessageList({ messages, isLoading, onSuggestionClick, onToolConfirm, onToolCancel }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-12 h-12 rounded-full bg-graphite/10 flex items-center justify-center mx-auto mb-4">
            <Bot size={24} strokeWidth={1.5} className="text-graphite" />
          </div>
          <h3 className="text-lg font-semibold text-dark-graphite mb-2">Asistente BusinessHub</h3>
          <p className="text-sm text-mid-gray mb-6">
            Puedo ayudarte a analizar finanzas, gestionar empleados y proveedores, procesar facturas y mucho mas.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => onSuggestionClick?.(suggestion)}
                className="text-left text-xs px-3 py-2 rounded-lg border border-border hover:bg-card-bg transition-colors text-graphite"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {messages.map((message) => (
        <div key={message.id}>
          {message.parts.map((part, i) => {
            if (part.type === 'file' && 'url' in part) {
              const filePart = part as { type: 'file'; url: string; mediaType: string; filename?: string }
              if (filePart.mediaType?.startsWith('image/')) {
                return (
                  <div key={`${message.id}-file-${i}`} className="px-4 py-1 flex justify-end">
                    <img
                      src={filePart.url}
                      alt={filePart.filename ?? 'Imagen adjunta'}
                      className="max-w-[200px] max-h-[200px] rounded-lg border border-border object-cover"
                    />
                  </div>
                )
              }
              return null
            }
            if (part.type === 'text' && part.text.trim()) {
              return (
                <MessageBubble
                  key={`${message.id}-text-${i}`}
                  role={message.role}
                  content={part.text}
                />
              )
            }
            if (part.type === 'tool-invocation') {
              const { toolName, toolCallId, state, args } = part.toolInvocation

              // For mutation tools awaiting confirmation (state === 'call')
              if (MUTATION_TOOLS.has(toolName) && state === 'call') {
                return (
                  <ConfirmationCard
                    key={`${message.id}-confirm-${i}`}
                    toolName={toolName}
                    args={args as Record<string, unknown>}
                    onConfirm={() => onToolConfirm?.(toolCallId, toolName, args as Record<string, unknown>)}
                    onCancel={() => onToolCancel?.(toolCallId)}
                  />
                )
              }

              // For read-only tools or already confirmed mutations
              return (
                <ToolStep
                  key={`${message.id}-tool-${i}`}
                  toolName={toolName}
                  state={state}
                  result={state === 'result' ? (part.toolInvocation as { result?: unknown }).result : undefined}
                />
              )
            }
            return null
          })}
        </div>
      ))}

      {isLoading && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
        <div className="flex items-center gap-2 px-4 py-3">
          <div className="w-7 h-7 rounded-full bg-graphite/10 flex items-center justify-center">
            <Bot size={14} strokeWidth={1.5} className="text-graphite" />
          </div>
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-mid-gray/40 animate-bounce [animation-delay:0ms]" />
            <div className="w-2 h-2 rounded-full bg-mid-gray/40 animate-bounce [animation-delay:150ms]" />
            <div className="w-2 h-2 rounded-full bg-mid-gray/40 animate-bounce [animation-delay:300ms]" />
          </div>
        </div>
      )}

      <div ref={endRef} />
    </div>
  )
}

const SUGGESTIONS = [
  'Genera un informe ejecutivo de este mes',
  'Compara los gastos vs ingresos del último trimestre',
  'Lista los empleados activos con sus salarios',
  'Muestra el flujo de caja de marzo',
]
