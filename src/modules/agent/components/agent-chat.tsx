import { useChat } from '@ai-sdk/react'
import { useCallback } from 'react'
import { useCompany } from '@/core/hooks/use-company'
import { invalidateCollection } from '@/core/query/invalidation'
import { MessageList } from './message-list'
import { ChatInput } from './chat-input'
import { executeMutation } from '../utils/execute-mutation'
import { preprocessImage, isImageFile, isSpreadsheetFile } from '../utils/image-preprocessing'
import { parseSpreadsheetToText } from '../utils/parse-spreadsheet'

const AGENT_API_URL = import.meta.env.VITE_AGENT_API_URL || '/api/agent/chat'

const TOOL_COLLECTIONS: Record<string, string> = {
  createEmployee: 'employees',
  updateEmployee: 'employees',
  deleteEmployee: 'employees',
  createSupplier: 'suppliers',
  updateSupplier: 'suppliers',
  deleteSupplier: 'suppliers',
  createTransaction: 'transactions',
}

export function AgentChat() {
  const { selectedCompany } = useCompany()

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
    maxSteps: 3,
    body: {
      companyId: selectedCompany?.id,
    },
  })

  const handleSuggestionClick = useCallback((suggestion: string) => {
    append({ role: 'user', content: suggestion })
  }, [append])

  const handleSendWithFiles = useCallback(async (text: string, files: File[]) => {
    if (!selectedCompany) return

    try {
      const imageFiles = files.filter(isImageFile)
      const spreadsheetFiles = files.filter(isSpreadsheetFile)

      let messageText = text

      // For images: convert to base64 data URLs and send as experimental_attachments
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

      // For spreadsheets: parse to text and append to message
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
      const result = await executeMutation(selectedCompany.id, toolName, args)

      const collection = TOOL_COLLECTIONS[toolName]
      if (collection) {
        invalidateCollection(selectedCompany.id, collection)
      }

      addToolResult({ toolCallId, result })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      addToolResult({
        toolCallId,
        result: { success: false, message: `Error: ${message}` },
      })
    }
  }, [selectedCompany, addToolResult])

  const handleToolCancel = useCallback((toolCallId: string) => {
    addToolResult({
      toolCallId,
      result: { success: false, message: 'Acción cancelada por el usuario.' },
    })
  }, [addToolResult])

  if (!selectedCompany) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-sm text-mid-gray">Selecciona una compañía para usar el asistente.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <MessageList
        messages={messages}
        isLoading={isLoading}
        onSuggestionClick={handleSuggestionClick}
        onToolConfirm={handleToolConfirm}
        onToolCancel={handleToolCancel}
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
