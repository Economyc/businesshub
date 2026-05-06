import type { Message } from '@ai-sdk/ui-utils'
import type { Timestamp } from 'firebase/firestore'

export interface AgentMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: Date
}

export type ToolStatus = 'pending' | 'running' | 'complete' | 'failed'

export interface ToolInvocation {
  toolCallId: string
  toolName: string
  args: Record<string, unknown>
  state: 'call' | 'result' | 'partial-call'
  result?: unknown
}

export type AutonomyLevel = 'conservative' | 'balanced' | 'autonomous'

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  messageCount: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

// Wave 1.2 — Memoria persistente del usuario para el agente.
// Se guarda en `users/{uid}/agentMemory/preferences` y se inyecta al system
// prompt en cada turno de chat. Es 1 doc por usuario, no por compañía.
export type AgentResponseFormat = 'table' | 'prose' | 'auto'
export type AgentLanguage = 'es' | 'en'

export interface UserAgentMemory {
  preferredCompanies: string[]
  preferredFormat: AgentResponseFormat
  language: AgentLanguage
  shortcuts: Record<string, string>
  notes: string
  updatedAt?: Timestamp
}

// Wave 4.2 — Threads con memoria persistente entre sesiones.
// Tareas de larga duración (ej: "Cierre de abril 2026") con estado que el
// agente recuerda entre conversaciones. Se guardan en
// `companies/{companyId}/threads/{threadId}` y se inyectan al system prompt
// cuando hay un thread activo seleccionado.
export type ThreadStatus = 'in_progress' | 'done' | 'blocked'

export interface AgentThread {
  id: string
  title: string
  status: ThreadStatus
  context: Record<string, unknown>
  conversationIds: string[]
  nextActions: string[]
  summary?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}
