import { useEffect, useRef, useState } from 'react'
import type { UIMessage } from 'ai'
import { MessageBubble } from './message-bubble'
import { ToolStep } from './tool-step'
import { ConfirmationCard } from './confirmation-card'
import { InlineChart } from './inline-chart'
import { Bot, Download, FileSpreadsheet, FileText } from 'lucide-react'

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
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
        <div className="text-center max-w-md">
          <div className="w-14 h-14 rounded-full bg-graphite flex items-center justify-center mx-auto mb-4">
            <Bot size={28} strokeWidth={1.5} className="text-white" />
          </div>
          <h3 className="text-lg font-bold text-dark-graphite mb-1">BusinessHub AI</h3>
          <p className="text-sm text-mid-gray mb-6">
            Analiza finanzas, gestiona empleados, procesa facturas y mas.
          </p>
          <div className="flex flex-col sm:grid sm:grid-cols-2 gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => onSuggestionClick?.(suggestion)}
                className="text-left text-[13px] px-3.5 py-2.5 rounded-xl border border-border hover:bg-card-bg active:bg-bone transition-colors text-graphite"
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
  'Muestra las alertas y pendientes del negocio',
  'Muestra un gráfico de gastos por categoría',
  'Busca todo lo relacionado con "marketing"',
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-graphite" />
          <div>
            <p className="text-xs font-semibold text-dark-graphite">{title}</p>
            <p className="text-[10px] text-mid-gray">Formato: {format.toUpperCase()}</p>
          </div>
        </div>
        <button
          onClick={handleClick}
          disabled={downloaded}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          <Download size={12} />
          {downloaded ? 'Descargado' : 'Descargar'}
        </button>
      </div>
    </div>
  )
}
