import { useEffect, useRef, useState } from 'react'
import type { UIMessage } from 'ai'
import { MessageBubble } from './message-bubble'
import { ToolStep } from './tool-step'
import { ConfirmationCard } from './confirmation-card'
import { InlineChart } from './inline-chart'
import { Bot, Download, FileSpreadsheet, FileText, TrendingUp, AlertCircle, Search, BarChart3, CheckSquare, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const MUTATION_TOOLS = new Set([
  'createEmployee',
  'updateEmployee',
  'deleteEmployee',
  'createSupplier',
  'updateSupplier',
  'deleteSupplier',
  'createTransaction',
  'updateBudget',
  'addBudgetItem',
  'createPayrollDraft',
  'executeMonthClosing',
])

const CLIENT_RENDERED_TOOLS = new Set(['generateChart', 'exportReport'])

interface MessageListProps {
  messages: UIMessage[]
  isLoading: boolean
  onSuggestionClick?: (suggestion: string) => void
  onToolConfirm?: (toolCallId: string, toolName: string, args: Record<string, unknown>) => void
  onToolCancel?: (toolCallId: string) => void
  onExportReport?: (args: Record<string, unknown>) => void
}

export function MessageList({ messages, isLoading, onSuggestionClick, onToolConfirm, onToolCancel, onExportReport }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    stickToBottomRef.current = distanceFromBottom < 100
  }

  useEffect(() => {
    if (!stickToBottomRef.current) return
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, isLoading])

  if (messages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-center min-h-full p-6 sm:p-8">
          <div className="text-center max-w-xl w-full">
            <div className="w-14 h-14 rounded-full bg-graphite flex items-center justify-center mx-auto mb-4">
              <Bot size={28} strokeWidth={1.5} className="text-white" />
            </div>
            <h3 className="text-heading font-semibold text-dark-graphite mb-1">BusinessHub AI</h3>
            <p className="text-body text-mid-gray mb-8">
              Pregunta sobre finanzas, empleados, proveedores o documentos.
            </p>
            <div className="space-y-5 text-left">
              {SUGGESTION_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="text-caption font-medium text-mid-gray uppercase tracking-wide mb-2">
                    {group.label}
                  </p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {group.items.map(({ text, icon: Icon }) => (
                      <button
                        key={text}
                        onClick={() => onSuggestionClick?.(text)}
                        className="flex items-center gap-2.5 text-left text-body px-3.5 py-2.5 rounded-xl border border-border/60 hover:bg-card-bg active:bg-bone transition-colors text-graphite"
                      >
                        <Icon size={14} strokeWidth={1.5} className="text-mid-gray shrink-0" />
                        <span className="truncate">{text}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto min-h-0">
      {messages.map((message) => (
        <div key={message.id}>
          {message.parts.map((part, i) => {
            if (part.type === 'file' && 'url' in part) {
              const filePart = part as unknown as { type: 'file'; url: string; mediaType: string; filename?: string }
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
              if (message.role !== 'user' && message.role !== 'assistant') return null
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

              // Render inline chart
              if (toolName === 'generateChart' && CLIENT_RENDERED_TOOLS.has(toolName)) {
                const chartArgs = args as {
                  chartType: 'bar' | 'pie' | 'area' | 'line'
                  title: string
                  data: Array<{ name: string; value: number; value2?: number }>
                  valueLabel?: string
                  value2Label?: string
                  formatAsCurrency?: boolean
                }
                return (
                  <InlineChart
                    key={`${message.id}-chart-${i}`}
                    chartType={chartArgs.chartType}
                    title={chartArgs.title}
                    data={chartArgs.data}
                    valueLabel={chartArgs.valueLabel}
                    value2Label={chartArgs.value2Label}
                    formatAsCurrency={chartArgs.formatAsCurrency}
                  />
                )
              }

              // Render export button
              if (toolName === 'exportReport' && CLIENT_RENDERED_TOOLS.has(toolName)) {
                const exportArgs = args as Record<string, unknown>
                return (
                  <ExportButton
                    key={`${message.id}-export-${i}`}
                    args={exportArgs}
                    onExport={() => onExportReport?.(exportArgs)}
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
        <div className="flex items-center gap-2.5 px-4 py-3">
          <div className="w-7 h-7 rounded-full bg-bone flex items-center justify-center">
            <Bot size={14} strokeWidth={1.5} className="text-graphite" />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-mid-gray/40 animate-bounce [animation-delay:0ms]" />
              <div className="w-2 h-2 rounded-full bg-mid-gray/40 animate-bounce [animation-delay:150ms]" />
              <div className="w-2 h-2 rounded-full bg-mid-gray/40 animate-bounce [animation-delay:300ms]" />
            </div>
            <span className="text-caption text-mid-gray">Analizando…</span>
          </div>
        </div>
      )}

      <div ref={endRef} />
    </div>
  )
}

type SuggestionItem = { text: string; icon: LucideIcon }
type SuggestionGroup = { label: string; items: SuggestionItem[] }

const SUGGESTION_GROUPS: SuggestionGroup[] = [
  {
    label: 'Finanzas',
    items: [
      { text: 'Resumen ejecutivo del mes', icon: TrendingUp },
      { text: 'Gráfico de gastos por categoría', icon: BarChart3 },
    ],
  },
  {
    label: 'Operaciones',
    items: [
      { text: 'Alertas y pendientes del negocio', icon: AlertCircle },
      { text: 'Estado de cierre del mes', icon: CheckSquare },
    ],
  },
  {
    label: 'Datos',
    items: [
      { text: 'Buscar transacciones de marketing', icon: Search },
      { text: 'Empleados activos', icon: Users },
    ],
  },
]

function ExportButton({ args, onExport }: { args: Record<string, unknown>; onExport: () => void }) {
  const [downloaded, setDownloaded] = useState(false)
  const format = String(args.format ?? 'pdf')
  const title = String(args.title ?? 'Reporte')
  const Icon = format === 'excel' ? FileSpreadsheet : FileText

  function handleClick() {
    onExport()
    setDownloaded(true)
  }

  return (
    <div className="mx-4 my-2 rounded-xl border border-border/60 bg-card-bg p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon size={16} className="text-graphite shrink-0" />
          <div className="min-w-0">
            <p className="text-body font-medium text-dark-graphite truncate">{title}</p>
            <p className="text-caption text-mid-gray">Formato: {format.toUpperCase()}</p>
          </div>
        </div>
        <button
          onClick={handleClick}
          disabled={downloaded}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-body font-medium bg-dark-graphite text-white hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          <Download size={14} />
          {downloaded ? 'Descargado' : 'Descargar'}
        </button>
      </div>
    </div>
  )
}
