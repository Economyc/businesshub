import { useState, useEffect, useCallback } from 'react'
import { Bot, RotateCcw, Settings, X, CheckSquare, Square } from 'lucide-react'
import type { UIMessage } from 'ai'
import { useCompany } from '@/core/hooks/use-company'
import { HoverHint } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { AgentChat } from './agent-chat'
import { AgentPreferencesDialog } from './agent-preferences-dialog'
import { ConversationHistory } from './conversation-history'
import { ThreadSidebar } from './thread-sidebar'
import { conversationService, threadService } from '../services'
import type { Conversation, AgentThread, ThreadStatus } from '../types'

function deserializeMessages(raw: unknown[]): UIMessage[] {
  return raw.map((msg: any) => {
    const createdAt = msg.createdAt?.toDate?.() ?? (msg.createdAt ? new Date(msg.createdAt) : new Date())
    const parts = msg.parts ?? [{ type: 'text' as const, text: msg.content ?? '' }]
    return {
      id: msg.id,
      role: msg.role,
      content: msg.content ?? '',
      createdAt,
      parts,
    }
  }) as UIMessage[]
}

const STATUS_VARIANT: Record<ThreadStatus, 'positive' | 'info' | 'warning'> = {
  done: 'positive',
  in_progress: 'info',
  blocked: 'warning',
}

const STATUS_LABEL: Record<ThreadStatus, string> = {
  in_progress: 'En curso',
  done: 'Completado',
  blocked: 'Bloqueado',
}

export function AgentPage() {
  const { selectedCompany } = useCompany()
  const [chatKey, setChatKey] = useState(0)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  // Wave 4.2 — threads. activeThread guarda el thread completo en memoria;
  // el chat lo lee para inyectar context+nextActions al body de useChat.
  const [threads, setThreads] = useState<AgentThread[]>([])
  const [activeThread, setActiveThread] = useState<AgentThread | null>(null)
  // Marcadores locales de checkboxes; se mergean al thread al cerrar/cambiar
  // y la tool del agente puede agregar/quitar items reales en Firestore.
  const [completedActions, setCompletedActions] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!selectedCompany?.id) return
    conversationService.getAll(selectedCompany.id).then(setConversations).catch(console.error)
    threadService.list(selectedCompany.id).then(setThreads).catch(console.error)
  }, [selectedCompany?.id])

  const handleNewConversation = useCallback(() => {
    setActiveConversationId(null)
    setInitialMessages([])
    setChatKey((k) => k + 1)
  }, [])

  const handleLoadConversation = useCallback((conv: Conversation) => {
    setActiveConversationId(conv.id)
    setInitialMessages(deserializeMessages(conv.messages))
    setChatKey((k) => k + 1)
  }, [])

  const handleDeleteConversation = useCallback(async (conversationId: string) => {
    if (!selectedCompany?.id) return
    try {
      await conversationService.remove(selectedCompany.id, conversationId)
      setConversations((prev) => prev.filter((c) => c.id !== conversationId))
      if (activeConversationId === conversationId) {
        setActiveConversationId(null)
        setInitialMessages([])
        setChatKey((k) => k + 1)
      }
    } catch (err) {
      console.error('Error deleting conversation:', err)
    }
  }, [selectedCompany?.id, activeConversationId])

  const handleConversationSaved = useCallback(async (id: string, title: string, messageCount: number) => {
    setActiveConversationId(id)
    setConversations((prev) => {
      const existing = prev.find((c) => c.id === id)
      if (existing) {
        return prev.map((c) => c.id === id ? { ...c, title, messageCount, updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as any } : c)
      }
      return [{ id, title, messageCount, messages: [], createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as any, updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as any }, ...prev]
    })
    // Vincular conversación al thread activo (idempotente vía arrayUnion).
    if (activeThread && selectedCompany?.id) {
      try {
        await threadService.linkConversation(selectedCompany.id, activeThread.id, id)
      } catch (err) {
        console.error('Error linking conversation to thread:', err)
      }
    }
  }, [activeThread, selectedCompany?.id])

  const handleSelectThread = useCallback((thread: AgentThread | null) => {
    setActiveThread(thread)
    setCompletedActions(new Set())
    // Cambiar de thread limpia el chat para evitar mezclar contextos.
    setActiveConversationId(null)
    setInitialMessages([])
    setChatKey((k) => k + 1)
  }, [])

  const handleCreateThread = useCallback(async (title: string) => {
    if (!selectedCompany?.id) return
    const id = await threadService.create(selectedCompany.id, { title })
    const fresh = await threadService.get(selectedCompany.id, id)
    if (fresh) {
      setThreads((prev) => [fresh, ...prev])
      setActiveThread(fresh)
      setActiveConversationId(null)
      setInitialMessages([])
      setChatKey((k) => k + 1)
    }
  }, [selectedCompany?.id])

  const handleUpdateThreadStatus = useCallback(async (threadId: string, status: ThreadStatus) => {
    if (!selectedCompany?.id) return
    await threadService.update(selectedCompany.id, threadId, { status })
    setThreads((prev) => prev.map((t) => t.id === threadId ? { ...t, status } : t))
    setActiveThread((prev) => prev && prev.id === threadId ? { ...prev, status } : prev)
  }, [selectedCompany?.id])

  const handleDeleteThread = useCallback(async (threadId: string) => {
    if (!selectedCompany?.id) return
    await threadService.remove(selectedCompany.id, threadId)
    setThreads((prev) => prev.filter((t) => t.id !== threadId))
    if (activeThread?.id === threadId) {
      setActiveThread(null)
      setActiveConversationId(null)
      setInitialMessages([])
      setChatKey((k) => k + 1)
    }
  }, [selectedCompany?.id, activeThread?.id])

  const handleThreadStateUpdate = useCallback((patch: Partial<AgentThread>) => {
    if (!activeThread) return
    const merged = { ...activeThread, ...patch } as AgentThread
    setActiveThread(merged)
    setThreads((prev) => prev.map((t) => t.id === merged.id ? merged : t))
  }, [activeThread])

  const toggleAction = useCallback((action: string) => {
    setCompletedActions((prev) => {
      const next = new Set(prev)
      if (next.has(action)) next.delete(action)
      else next.add(action)
      return next
    })
  }, [])

  return (
    <div className="-mx-4 -mb-8 md:mx-0 md:mb-0 h-[calc(100dvh-6.5rem)] md:h-[calc(100vh-3rem)] flex md:rounded-xl md:border md:border-border bg-surface-elevated overflow-hidden">
      <ThreadSidebar
        threads={threads}
        activeThreadId={activeThread?.id ?? null}
        onSelectThread={handleSelectThread}
        onCreateThread={handleCreateThread}
        onUpdateThreadStatus={handleUpdateThreadStatus}
        onDeleteThread={handleDeleteThread}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Compact header */}
        <div className="px-4 h-14 border-b border-border flex items-center justify-between shrink-0 bg-surface-elevated sticky top-0 z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-graphite flex items-center justify-center shrink-0">
              <Bot size={16} strokeWidth={1.5} className="text-white" />
            </div>
            <div className="flex flex-col justify-center min-w-0">
              <h1 className="text-body font-semibold text-dark-graphite leading-tight truncate">BusinessHub AI</h1>
              <p className="text-caption text-mid-gray leading-tight truncate">
                {selectedCompany?.name ?? 'Sin compañía seleccionada'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <ConversationHistory
              conversations={conversations}
              activeConversationId={activeConversationId}
              onSelect={handleLoadConversation}
              onDelete={handleDeleteConversation}
            />
            <HoverHint label="Preferencias del asistente">
              <button
                onClick={() => setPreferencesOpen(true)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-mid-gray hover:text-graphite hover:bg-bone transition-colors active:scale-95"
              >
                <Settings size={16} strokeWidth={1.5} />
              </button>
            </HoverHint>
            <HoverHint label="Nueva conversación">
              <button
                onClick={handleNewConversation}
                className="w-8 h-8 flex items-center justify-center rounded-full text-mid-gray hover:text-graphite hover:bg-bone transition-colors active:scale-95"
              >
                <RotateCcw size={16} strokeWidth={1.5} />
              </button>
            </HoverHint>
          </div>
        </div>

        {activeThread && (
          <div className="px-4 py-3 border-b border-border/60 bg-bone/40 shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-body font-medium text-dark-graphite truncate">
                    {activeThread.title}
                  </p>
                  <Badge variant={STATUS_VARIANT[activeThread.status]}>
                    {STATUS_LABEL[activeThread.status]}
                  </Badge>
                </div>
                {activeThread.nextActions.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {activeThread.nextActions.map((action) => {
                      const done = completedActions.has(action)
                      return (
                        <li key={action}>
                          <button
                            type="button"
                            onClick={() => toggleAction(action)}
                            className="flex items-start gap-2 text-left w-full group"
                          >
                            {done ? (
                              <CheckSquare
                                size={14}
                                strokeWidth={1.5}
                                className="text-positive-text shrink-0 mt-0.5"
                              />
                            ) : (
                              <Square
                                size={14}
                                strokeWidth={1.5}
                                className="text-mid-gray shrink-0 mt-0.5 group-hover:text-graphite transition-colors"
                              />
                            )}
                            <span
                              className={
                                done
                                  ? 'text-caption text-mid-gray line-through'
                                  : 'text-caption text-graphite'
                              }
                            >
                              {action}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
              <HoverHint label="Cerrar thread">
                <button
                  type="button"
                  onClick={() => handleUpdateThreadStatus(activeThread.id, 'done')}
                  className="shrink-0 inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-caption font-medium text-graphite border border-border/60 bg-card-bg hover:bg-bone transition-colors"
                >
                  <X size={12} strokeWidth={1.5} />
                  Cerrar thread
                </button>
              </HoverHint>
            </div>
          </div>
        )}

        <AgentChat
          key={chatKey}
          initialMessages={initialMessages}
          conversationId={activeConversationId}
          onConversationSaved={handleConversationSaved}
          thread={activeThread}
          onThreadStateUpdate={handleThreadStateUpdate}
        />

        <AgentPreferencesDialog
          open={preferencesOpen}
          onOpenChange={setPreferencesOpen}
        />
      </div>
    </div>
  )
}
