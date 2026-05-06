import { useChat } from '@ai-sdk/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import type { UIMessage } from 'ai'
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
import type { PlanProposal, PlanStep, StepExecution } from './plan-review-card'
import type { SaveNoteResult } from '../utils/obsidian-client'
import { preprocessImage, isImageFile, isSpreadsheetFile } from '../utils/image-preprocessing'
import { parseSpreadsheetToText } from '../utils/parse-spreadsheet'
import { conversationService, getUserMemory, threadService } from '../services'
import type { AgentThread } from '../types'

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

interface AgentChatProps {
  initialMessages?: UIMessage[]
  conversationId: string | null
  onConversationSaved: (id: string, title: string, messageCount: number) => void
  // Wave 4.2 — thread activo. Si no hay thread, todo funciona como antes.
  thread?: AgentThread | null
  onThreadStateUpdate?: (patch: Partial<AgentThread>) => void
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

export function AgentChat({ initialMessages, conversationId, onConversationSaved, thread, onThreadStateUpdate }: AgentChatProps) {
  const { selectedCompany, companies } = useCompany()
  const { user } = useAuth()
  const uid = user?.uid ?? null
  const conversationIdRef = useRef(conversationId)
  const isSavingRef = useRef(false)
  const threadRef = useRef(thread ?? null)
  useEffect(() => {
    threadRef.current = thread ?? null
  }, [thread])

  // Wave 1.2 — Memoria persistente. Si no hay uid o falla la lectura, pasamos
  // null al body para que el backend use defaults sin inyectar nada al prompt.
  const { data: userMemory } = useQuery({
    queryKey: ['userMemory', uid],
    queryFn: () => (uid ? getUserMemory(uid) : Promise.resolve(null)),
    enabled: !!uid,
    staleTime: 5 * 60 * 1000,
  })

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
      userMemory: userMemory ?? null,
      // Wave 4.2 — contexto del thread activo. Si no hay thread, llegan
      // como undefined y el system-prompt no inyecta el bloque.
      threadId: thread?.id,
      threadTitle: thread?.title,
      threadContext: thread?.context,
      nextActions: thread?.nextActions,
    },
    onFinish: async () => {
      await handleAutoSave()
      // El agente puede haber actualizado el doc del thread vía tool. Refetch
      // para reflejar context/nextActions en la UI sin recargar la página.
      const current = threadRef.current
      if (current && selectedCompany?.id && onThreadStateUpdate) {
        try {
          const fresh = await threadService.get(selectedCompany.id, current.id)
          if (fresh) {
            onThreadStateUpdate({
              context: fresh.context,
              nextActions: fresh.nextActions,
              status: fresh.status,
              summary: fresh.summary,
              updatedAt: fresh.updatedAt,
            })
          }
        } catch (err) {
          console.error('Error refetching thread state:', err)
        }
      }
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

  const { toasts, showUndoToast, dismissToast } = useUndoToasts()

  const handleToolConfirm = useCallback(async (
    toolCallId: string,
    toolName: string,
    args: Record<string, unknown>,
    previousState: Record<string, unknown> | null,
    _userQuote?: string,
  ) => {
    if (!selectedCompany) return

    try {
      const result = await executeMutation(selectedCompany.id, toolName, args, { companies }, toolCallId)

      const collection = TOOL_COLLECTIONS[toolName]
      if (collection) {
        const targetIds = result.affectedCompanyIds ?? [selectedCompany.id]
        for (const cid of targetIds) {
          invalidateCollection(cid, collection)
        }
      }

      addToolResult({ toolCallId, result })

      // Mostrar undo toast sólo si la mutación fue exitosa
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
          // Fallback: mostramos el toast pero sin botón funcional.
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
  }, [selectedCompany, companies, addToolResult, showUndoToast])

  const handleToolCancel = useCallback((toolCallId: string) => {
    addToolResult({
      toolCallId,
      result: { success: false, message: 'Acción cancelada por el usuario.' },
    })
  }, [addToolResult])

  // Wave 5.3 — Estado de ejecución de planes multi-paso. Se indexa por
  // toolCallId del proposeMultiStepPlan que disparó la ejecución.
  type PlanExecutionState = {
    steps: Record<string, StepExecution>
    isExecuting: boolean
    isCompleted: boolean
  }
  const [planExecutions, setPlanExecutions] = useState<Record<string, PlanExecutionState>>({})

  const handlePlanCancel = useCallback((toolCallId: string) => {
    addToolResult({
      toolCallId,
      result: { success: false, message: 'Plan cancelado por el usuario.' },
    })
  }, [addToolResult])

  const handlePlanApprove = useCallback(async (
    toolCallId: string,
    _plan: PlanProposal,
    steps: PlanStep[],
  ) => {
    if (!selectedCompany) return

    // Estado inicial: todos los pasos en pending.
    setPlanExecutions((prev) => ({
      ...prev,
      [toolCallId]: {
        isExecuting: true,
        isCompleted: false,
        steps: Object.fromEntries(steps.map((s) => [s.id, { status: 'pending' as const }])),
      },
    }))

    const stepResults: Array<{ id: string; success: boolean; message: string }> = []
    let aborted = false

    for (const step of steps) {
      // Marca running.
      setPlanExecutions((prev) => ({
        ...prev,
        [toolCallId]: {
          ...prev[toolCallId],
          steps: { ...prev[toolCallId].steps, [step.id]: { status: 'running' } },
        },
      }))

      try {
        const result = await executeMutation(
          selectedCompany.id,
          step.toolName,
          step.toolArgs,
          { companies },
          `${toolCallId}-${step.id}`,
        )

        const collection = TOOL_COLLECTIONS[step.toolName]
        if (collection && result.success) {
          const targetIds = result.affectedCompanyIds ?? [selectedCompany.id]
          for (const cid of targetIds) invalidateCollection(cid, collection)
        }

        stepResults.push({ id: step.id, success: result.success, message: result.message })
        setPlanExecutions((prev) => ({
          ...prev,
          [toolCallId]: {
            ...prev[toolCallId],
            steps: {
              ...prev[toolCallId].steps,
              [step.id]: result.success
                ? { status: 'done', message: result.message }
                : { status: 'error', message: result.message },
            },
          },
        }))

        if (!result.success) {
          aborted = true
          break
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error desconocido'
        stepResults.push({ id: step.id, success: false, message })
        setPlanExecutions((prev) => ({
          ...prev,
          [toolCallId]: {
            ...prev[toolCallId],
            steps: {
              ...prev[toolCallId].steps,
              [step.id]: { status: 'error', message },
            },
          },
        }))
        aborted = true
        break
      }
    }

    setPlanExecutions((prev) => ({
      ...prev,
      [toolCallId]: {
        ...prev[toolCallId],
        isExecuting: false,
        isCompleted: !aborted,
      },
    }))

    const successful = stepResults.filter((r) => r.success).length
    const summary = aborted
      ? `Plan detenido en el paso ${successful + 1} de ${steps.length}.`
      : `Plan completado: ${successful} de ${steps.length} pasos ejecutados.`

    addToolResult({
      toolCallId,
      result: {
        success: !aborted,
        message: summary,
        steps: stepResults,
      },
    })
  }, [selectedCompany, companies, addToolResult])

  // Wave 6.2 — Obsidian connector. La card hace el fetch al endpoint local
  // y nos reporta el resultado. Sólo cerramos el ciclo en el chat.
  const handleObsidianSave = useCallback((toolCallId: string, result: SaveNoteResult) => {
    addToolResult({
      toolCallId,
      result: result.ok
        ? { success: true, message: `Nota guardada en ${result.path}`, path: result.path }
        : { success: false, message: result.error ?? 'No se pudo guardar la nota.' },
    })
  }, [addToolResult])

  const handleObsidianCancel = useCallback((toolCallId: string) => {
    addToolResult({
      toolCallId,
      result: { success: false, message: 'El usuario decidió no guardar la nota.' },
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
        onPlanApprove={handlePlanApprove}
        onPlanCancel={handlePlanCancel}
        planExecutions={planExecutions}
        onObsidianSave={handleObsidianSave}
        onObsidianCancel={handleObsidianCancel}
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
