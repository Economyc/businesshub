import { useState } from 'react'
import { Bot, RotateCcw } from 'lucide-react'
import { AgentChat } from './agent-chat'

export function AgentPage() {
  const [chatKey, setChatKey] = useState(0)

  return (
    <div className="h-[calc(100vh-6rem)] md:h-[calc(100vh-3rem)] flex flex-col rounded-xl border border-border bg-surface-elevated overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-graphite/10 flex items-center justify-center">
            <Bot size={14} strokeWidth={1.5} className="text-graphite" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-dark-graphite">Asistente AI</h1>
            <p className="text-[11px] text-mid-gray leading-tight">Analiza, gestiona y automatiza tu negocio</p>
          </div>
        </div>
        <button
          onClick={() => setChatKey((k) => k + 1)}
          className="group/new relative p-1.5 rounded-md text-mid-gray/50 hover:text-graphite hover:bg-smoke transition-colors"
          title="Nueva conversación"
        >
          <RotateCcw size={15} strokeWidth={1.5} />
          <span className="pointer-events-none absolute right-full mr-2 top-1/2 -translate-y-1/2 z-50 whitespace-nowrap rounded-lg bg-dark-graphite dark:bg-[#2a2a2a] px-3 py-1.5 text-caption font-medium text-white dark:text-[#e0e0e0] shadow-lg opacity-0 scale-95 transition-all duration-150 group-hover/new:opacity-100 group-hover/new:scale-100">
            Nueva conversación
          </span>
        </button>
      </div>
      <AgentChat key={chatKey} />
    </div>
  )
}
