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
