import { useChat } from '@ai-sdk/react'
import { useCallback, useEffect, useRef } from 'react'
import type { UIMessage } from 'ai'
import { useCompany } from '@/core/hooks/use-company'
import { invalidateCollection } from '@/core/query/invalidation'
import { MessageList } from './message-list'
import { ChatInput } from './chat-input'
import { executeMutation } from '../utils/execute-mutation'
import { exportToPDF, exportToExcel } from '../utils/export-report'
import { preprocessImage, isImageFile, isSpreadsheetFile } from '../utils/image-preprocessing'
import { parseSpreadsheetToText } from '../utils/parse-spreadsheet'
import { conversationService } from '../services'

const AGENT_API_URL = import.meta.env.VITE_AGENT_API_URL || '/api/agent/chat'

const TOOL_COLLECTIONS: Record<string, string> = {
  createEmployee: 'employees',
  updateEmployee: 'employees',
  deleteEmployee: 'employees',
  createSupplier: 'suppliers',
  updateSupplier: 'suppliers',
  deleteSupplier: 'suppliers',
  createTransaction: 'transactions',
  createSplitExpense: 'transactions',
  updateBudget: 'settings',
  addBudgetItem: 'settings',
}

interface AgentChatProps {
  initialMessages?: UIMessage[]
  conversationId: string | null
  onConversationSaved: (id: string, title: string, messageCount: number) => void
}

// Reemplaza data URLs largas (base64 de imágenes) por un placeholder. Sin
// esto, los parts pueden empujar el doc por encima del límite de 1MiB de
// Firestore. Cap conservador: 8KB por string en cualquier nivel.
const STRING_CAP = 8 * 1024
function pruneLargeStrings(value: any): any {
  if (typeof value === 'string') {
    if (value.startsWith('data:') && value.length > STRING_CAP) return '[imagen]'
    if (value.length > STRING_CAP) return value.slice(0, STRING_CAP) + '…[truncado]'
    return value
  }
  if (Array.isArray(value)) return value.map(pruneLargeStrings)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(value)) {
      out[k] = pruneLargeStrings(value[k])
    }
    return out
  }
  return value
}

function sanitizeMessages(messages: UIMessage[]) {
  return messages.map((msg) => {
    const { experimental_attachments, ...rest } = msg as any
    const cleaned = pruneLargeStrings(rest)
    // Quita tool-invocation parts incompletos (estado partial-call): pueden
    // tener args truncados/inválidos que rompen la deserialización al recargar.
    if (Array.isArray(cleaned.parts)) {
      cleaned.parts = cleaned.parts.filter((p: any) => {
        if (p?.type === 'tool-invocation') {
          return p.toolInvocation?.state !== 'partial-call'
        }
        return true
      })
    }
    if (Array.isArray(cleaned.toolInvocations)) {
      cleaned.toolInvocations = cleaned.toolInvocations.filter(
        (ti: any) => ti?.state !== 'partial-call',
      )
    }
    return cleaned
  })
}

function generateTitle(messages: UIMessage[]): string {
  const firstUser = messages.find((m) => m.role === 'user')
  if (!firstUser) return 'Conversación'
  const text = firstUser.content || ''
  return text.length > 50 ? text.slice(0, 50) + '…' : text || 'Conversación'
}

export function AgentChat({ initialMessages, conversationId, onConversationSaved }: AgentChatProps) {
  const { selectedCompany, companies } = useCompany()
  const conversationIdRef = useRef(conversationId)
  const isSavingRef = useRef(false)

  useEffect(() => {
    conversationIdRef.current = conversationId
  }, [conversationId])

  const handleAutoSave = useCallback(async () => {
    if (!selectedCompany?.id || isSavingRef.current) return
    isSavingRef.current = true

    try {
      const currentMessages = messagesRef.current
      if (currentMessages.length === 0) return

      const cleanMessages = sanitizeMessages(currentMessages)
      const title = generateTitle(currentMessages)
      const messageCount = currentMessages.length
      const currentId = conversationIdRef.current

      if (currentId) {
        await conversationService.update(selectedCompany.id, currentId, { messages: cleanMessages, messageCount, title })
        onConversationSaved(currentId, title, messageCount)
      } else {
        const newId = await conversationService.create(selectedCompany.id, { title, messages: cleanMessages, messageCount })
        onConversationSaved(newId, title, messageCount)
      }
    } catch (err) {
      console.error('Error saving conversation:', err)
    } finally {
      isSavingRef.current = false
    }
  }, [selectedCompany?.id, onConversationSaved])

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
    initialMessages,
    maxSteps: 5,
    body: {
      companyId: selectedCompany?.id,
      companies: companies.map((c) => ({
        id: c.id,
        name: c.name,
        location: c.location ?? null,
        slug: c.slug ?? null,
      })),
    },
    onFinish: handleAutoSave,
    onToolCall: async ({ toolCall }) => {
      if (toolCall.toolName === 'generateChart') {
        return { rendered: true }
      }
      if (toolCall.toolName === 'exportReport') {
        return { rendered: true, message: 'Reporte listo para descargar.' }
      }
    },
  })

  const messagesRef = useRef(messages)
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const handleSuggestionClick = useCallback((suggestion: string) => {
    append({ role: 'user', content: suggestion })
  }, [append])

  const handleSendWithFiles = useCallback(async (text: string, files: File[]) => {
    if (!selectedCompany) return

    try {
      const imageFiles = files.filter(isImageFile)
      const spreadsheetFiles = files.filter(isSpreadsheetFile)

      let messageText = text

      const attachments: Array<{ name: string; contentType: string; url: string }> = []

      for (const img of imageFiles) {
        const processed = await preprocessImage(img)
        const base64 = await fileToDataUrl(processed)
        attachments.push({
          name: processed.name,
          contentType: processed.type,
          url: base64,
        })
      }

      for (const file of spreadsheetFiles) {
        const parsed = await parseSpreadsheetToText(file)
        messageText += `\n\nContenido del archivo "${file.name}":\n${parsed}`
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
    } catch (err) {
      console.error('Error processing files:', err)
    }
  }, [selectedCompany, append])

  const handleToolConfirm = useCallback(async (
    toolCallId: string,
    toolName: string,
    args: Record<string, unknown>,
  ) => {
    if (!selectedCompany) return

    try {
      const result = await executeMutation(selectedCompany.id, toolName, args, { companies })

      const collection = TOOL_COLLECTIONS[toolName]
      if (collection) {
        const targetIds = result.affectedCompanyIds ?? [selectedCompany.id]
        for (const cid of targetIds) {
          invalidateCollection(cid, collection)
        }
      }

      addToolResult({ toolCallId, result })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      addToolResult({
        toolCallId,
        result: { success: false, message: `Error: ${message}` },
      })
    }
  }, [selectedCompany, companies, addToolResult])

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
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-sm text-mid-gray">Selecciona una compañía para usar el asistente.</p>
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
      />

      {error && (
        <div className="px-4 py-2 bg-destructive/5 border-t border-destructive/20">
          <div className="flex items-center justify-between">
            <p className="text-xs text-destructive">
              Error al conectar con el asistente. {error.message}
            </p>
            <button
              onClick={() => reload()}
              className="text-xs text-destructive font-medium hover:underline"
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
      />
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
