import { useState, useEffect, useCallback } from 'react'
import { Bot, RotateCcw } from 'lucide-react'
import type { UIMessage } from 'ai'
import { useCompany } from '@/core/hooks/use-company'
import { HoverHint } from '@/components/ui/tooltip'
import { AgentChat } from './agent-chat'
import { ConversationHistory } from './conversation-history'
import { conversationService } from '../services'
import type { Conversation } from '../types'

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

export function AgentPage() {
  const { selectedCompany } = useCompany()
  const [chatKey, setChatKey] = useState(0)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])

  useEffect(() => {
    if (!selectedCompany?.id) return
    conversationService.getAll(selectedCompany.id).then(setConversations).catch(console.error)
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

  const handleConversationSaved = useCallback((id: string, title: string, messageCount: number) => {
    setActiveConversationId(id)
    setConversations((prev) => {
      const existing = prev.find((c) => c.id === id)
      if (existing) {
        return prev.map((c) => c.id === id ? { ...c, title, messageCount, updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as any } : c)
      }
      return [{ id, title, messageCount, messages: [], createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as any, updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as any }, ...prev]
    })
  }, [])

  return (
    <div className="-mx-4 -mb-8 md:mx-0 md:mb-0 h-[calc(100dvh-6.5rem)] md:h-[calc(100vh-3rem)] flex flex-col md:rounded-xl md:border md:border-border bg-surface-elevated overflow-hidden">
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
      <AgentChat
        key={chatKey}
        initialMessages={initialMessages}
        conversationId={activeConversationId}
        onConversationSaved={handleConversationSaved}
      />
    </div>
  )
}
