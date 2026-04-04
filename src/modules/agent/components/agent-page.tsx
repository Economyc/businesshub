import { useState } from 'react'
import { Bot, RotateCcw } from 'lucide-react'
import { AgentChat } from './agent-chat'

export function AgentPage() {
  const [chatKey, setChatKey] = useState(0)

  return (
    <div className="-mx-4 -mb-8 md:mx-0 md:mb-0 h-[calc(100dvh-6.5rem)] md:h-[calc(100vh-3rem)] flex flex-col md:rounded-xl md:border md:border-border bg-surface-elevated overflow-hidden">
      {/* Compact header */}
      <div className="px-3 h-12 border-b border-border flex items-center justify-between shrink-0 bg-surface-elevated shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-graphite flex items-center justify-center">
            <Bot size={14} strokeWidth={1.5} className="text-white" />
          </div>
          <div className="flex flex-col justify-center">
            <h1 className="text-sm font-bold text-dark-graphite leading-none tracking-tight">BusinessHub AI</h1>
            <p className="text-[10px] text-mid-gray leading-none mt-0.5">Siempre activo</p>
          </div>
        </div>
        <button
          onClick={() => setChatKey((k) => k + 1)}
          className="w-8 h-8 flex items-center justify-center rounded-full text-mid-gray hover:text-graphite hover:bg-bone transition-colors active:scale-95"
          title="Nueva conversación"
        >
          <RotateCcw size={16} strokeWidth={1.5} />
        </button>
      </div>
      <AgentChat key={chatKey} />
    </div>
  )
}
