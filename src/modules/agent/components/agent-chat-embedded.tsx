import { useChat } from '@ai-sdk/react'
import { useCallback, useMemo } from 'react'
import { AlertCircle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useCompany } from '@/core/hooks/use-company'
import { useAuth } from '@/core/hooks/use-auth'
import { invalidateCollection } from '@/core/query/invalidation'
import { MessageList } from './message-list'
import { ChatInput } from './chat-input'
import { executeMutation } from '../utils/execute-mutation'
import { buildUndoAction } from '../utils/build-undo'
import { UndoToastContainer, useUndoToasts } from './undo-toast'
import { exportToPDF, exportToExcel } from '../utils/export-report'
import { preprocessImage, isImageFile, isSpreadsheetFile, isPdfFile } from '../utils/image-preprocessing'
import { parseSpreadsheetToText } from '../utils/parse-spreadsheet'
import { getUserMemory } from '../services'
import { buildInlinePlaceholder } from '../utils/inline-context'

const AGENT_API_URL = import.meta.env.VITE_AGENT_API_URL || '/api/agent/chat'

const TOOL_COLLECTIONS: Record<string, string> = {
  createEmployee: 'employees',
  updateEmployee: 'employees',
  deleteEmployee: 'employees',
  createSupplier: 'suppliers',
  updateSupplier: 'suppliers',
  deleteSupplier: 'suppliers',
  createTransaction: 'transactions',
  updateTransaction: 'transactions',
  deleteTransaction: 'transactions',
  createSplitExpense: 'transactions',
  updateBudget: 'settings',
  addBudgetItem: 'settings',
  deleteBudgetItem: 'settings',
}

const ENTITY_LABELS: Record<string, string> = {
  createEmployee: 'empleado creado',
  updateEmployee: 'empleado actualizado',
  deleteEmployee: 'empleado eliminado',
  createSupplier: 'proveedor creado',
  updateSupplier: 'proveedor actualizado',
  deleteSupplier: 'proveedor eliminado',
  createTransaction: 'transacción creada',
  updateTransaction: 'transacción actualizada',
  deleteTransaction: 'transacción eliminada',
  createSplitExpense: 'gasto compartido creado',
  updateBudget: 'presupuesto actualizado',
  addBudgetItem: 'item de presupuesto agregado',
  deleteBudgetItem: 'item de presupuesto eliminado',
}

interface AgentChatEmbeddedProps {
  /**
   * Snapshot de contexto inmediato (filtros, IDs visibles, totales) que el
   * usuario tiene en pantalla. Se manda al backend en cada request y se
   * inyecta al final del system prompt como "Contexto inmediato".
   */
  inlineContext?: Record<string, unknown> | null
}

/**
 * Variante embebida del chat para uso dentro de sheets/paneles laterales en
 * otros modulos (Finance, etc.). A diferencia de AgentChat:
 * - No persiste la conversacion (one-off por sesion del sheet).
 * - Acepta inlineContext que viaja en el body de cada request.
 * - No expone slash commands de historial ni titulo.
 *
 * Reusa el motor (useChat), MessageList, ChatInput y la pipeline de mutaciones
 * con undo para mantener paridad funcional con /agent.
 */
export function AgentChatEmbedded({ inlineContext }: AgentChatEmbeddedProps) {
  const { selectedCompany, companies } = useCompany()
  const { user } = useAuth()
  const uid = user?.uid ?? null

  const { data: userMemory } = useQuery({
    queryKey: ['userMemory', uid],
    queryFn: () => (uid ? getUserMemory(uid) : Promise.resolve(null)),
    enabled: !!uid,
    staleTime: 5 * 60 * 1000,
  })

  const {
    messages,
    input,
    setInput,
    handleSubmit,
    isLoading,
    error,
    stop,
    reload,
    addToolResult,
    append,
  } = useChat({
    api: AGENT_API_URL,
    maxSteps: 5,
    body: {
      companyId: selectedCompany?.id,
      companies: companies.map((c) => ({
        id: c.id,
        name: c.name,
        location: c.location ?? null,
        slug: c.slug ?? null,
      })),
      userMemory: userMemory ?? null,
      inlineContext: inlineContext ?? null,
    },
    onToolCall: async ({ toolCall }) => {
      if (toolCall.toolName === 'generateChart') {
        return { rendered: true }
      }
      if (toolCall.toolName === 'exportReport') {
        return { rendered: true, message: 'Reporte listo para descargar.' }
      }
    },
  })

  const handleSuggestionClick = useCallback((suggestion: string) => {
    append({ role: 'user', content: suggestion })
  }, [append])

  const handleSendWithFiles = useCallback(async (text: string, files: File[]): Promise<boolean> => {
    if (!selectedCompany) {
      throw new Error('Selecciona un local antes de enviar archivos.')
    }

    const imageFiles = files.filter(isImageFile)
    const spreadsheetFiles = files.filter(isSpreadsheetFile)
    const pdfFiles = files.filter(isPdfFile)

    let messageText = text

    const attachments: Array<{ name: string; contentType: string; url: string }> = []

    for (const img of imageFiles) {
      try {
        const processed = await preprocessImage(img)
        const base64 = await fileToDataUrl(processed)
        attachments.push({
          name: processed.name,
          contentType: processed.type,
          url: base64,
        })
      } catch (err) {
        console.error('preprocessImage failed:', err)
        throw new Error(`No se pudo procesar la imagen "${img.name}". Prueba con JPG o PNG.`)
      }
    }

    for (const pdf of pdfFiles) {
      try {
        const base64 = await fileToDataUrl(pdf)
        attachments.push({
          name: pdf.name,
          contentType: 'application/pdf',
          url: base64,
        })
      } catch (err) {
        console.error('fileToDataUrl PDF failed:', err)
        throw new Error(`No se pudo leer el PDF "${pdf.name}".`)
      }
    }

    for (const file of spreadsheetFiles) {
      try {
        const parsed = await parseSpreadsheetToText(file)
        messageText += `\n\nContenido del archivo "${file.name}":\n${parsed}`
      } catch (err) {
        console.error('parseSpreadsheet failed:', err)
        throw new Error(`No se pudo leer el archivo "${file.name}".`)
      }
    }

    if (attachments.length > 0) {
      append({
        role: 'user',
        content: messageText || 'Analiza esta imagen. Si es una factura o recibo, extrae todos los datos: proveedor, RUT, fecha, monto, items, IVA, total, y sugiere una categoría de gasto.',
        experimental_attachments: attachments,
      })
    } else {
      append({
        role: 'user',
        content: messageText || 'Analiza los datos del archivo.',
      })
    }
    return true
  }, [selectedCompany, append])

  const placeholder = useMemo(() => buildInlinePlaceholder(inlineContext ?? null), [inlineContext])

  const { toasts, showUndoToast, dismissToast } = useUndoToasts()

  const handleToolConfirm = useCallback(async (
    toolCallId: string,
    toolName: string,
    args: Record<string, unknown>,
    previousState: Record<string, unknown> | null,
  ) => {
    if (!selectedCompany) return

    try {
      // Busca adjunto reciente para tools que persisten archivos a Drive.
      let latestAttachment: { name: string; contentType: string; dataUrl: string } | null = null
      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i] as typeof messages[number] & {
          experimental_attachments?: Array<{ name: string; contentType: string; url: string }>
        }
        if (m.role !== 'user') continue
        const att = m.experimental_attachments?.[0]
        if (att?.url) {
          latestAttachment = { name: att.name, contentType: att.contentType, dataUrl: att.url }
          break
        }
      }
      const result = await executeMutation(selectedCompany.id, toolName, args, { companies, latestAttachment }, toolCallId)

      const collection = TOOL_COLLECTIONS[toolName]
      if (collection) {
        const targetIds = result.affectedCompanyIds ?? [selectedCompany.id]
        for (const cid of targetIds) {
          invalidateCollection(cid, collection)
        }
      }

      addToolResult({ toolCallId, result })

      if (result.success) {
        const undoAction = buildUndoAction(selectedCompany.id, toolName, args, previousState, result)
        const description = ENTITY_LABELS[toolName] ?? 'Cambio aplicado'
        if (undoAction) {
          showUndoToast({
            description: `${description.charAt(0).toUpperCase() + description.slice(1)}`,
            onUndo: async () => {
              await undoAction()
              const targetIds = result.affectedCompanyIds ?? [selectedCompany.id]
              if (collection) {
                for (const cid of targetIds) invalidateCollection(cid, collection)
              }
            },
          })
        } else {
          showUndoToast({
            description: `${description.charAt(0).toUpperCase() + description.slice(1)} · función de deshacer próximamente`,
            onUndo: null,
          })
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      addToolResult({
        toolCallId,
        result: { success: false, message: `Error: ${message}` },
      })
    }
  }, [selectedCompany, companies, addToolResult, showUndoToast, messages])

  const handleToolCancel = useCallback((toolCallId: string) => {
    addToolResult({
      toolCallId,
      result: { success: false, message: 'Acción cancelada por el usuario.' },
    })
  }, [addToolResult])

  const handleExportReport = useCallback((args: Record<string, unknown>) => {
    try {
      const format = String(args.format ?? 'pdf')
      const title = String(args.title ?? 'Reporte')
      const sections = (args.sections ?? []) as Array<{
        heading: string
        type: 'table' | 'kpi' | 'text'
        data: unknown
      }>
      if (format === 'excel') {
        exportToExcel(title, sections)
      } else {
        exportToPDF(title, sections)
      }
    } catch (err) {
      console.error('Error exporting report:', err)
    }
  }, [])

  if (!selectedCompany) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p className="text-body text-mid-gray">Selecciona una compañía para usar el asistente.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <MessageList
        messages={messages}
        isLoading={isLoading}
        onSuggestionClick={handleSuggestionClick}
        onToolConfirm={handleToolConfirm}
        onToolCancel={handleToolCancel}
        onExportReport={handleExportReport}
        variant="embedded"
      />

      {error && (
        <div className="px-4 py-2.5 bg-negative-bg border-t border-border/60">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle size={14} className="text-negative-text shrink-0" />
              <p className="text-caption text-negative-text truncate">
                Error al conectar con el asistente. {error.message}
              </p>
            </div>
            <button
              onClick={() => reload()}
              className="shrink-0 text-caption text-negative-text font-medium hover:underline"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      <ChatInput
        input={input}
        onInputChange={setInput}
        onSubmit={handleSubmit}
        onSendWithFiles={handleSendWithFiles}
        isLoading={isLoading}
        onStop={stop}
        placeholder={placeholder}
      />

      <UndoToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
