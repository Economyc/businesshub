import { useCallback, useState } from 'react'

// Wave 3.3 — Inline AI assistant. Hook reusable que cualquier modulo puede
// invocar para abrir el sheet lateral con un snapshot del contexto que el
// usuario esta viendo en pantalla. El snapshot se inyecta al backend en cada
// request y termina al final del system prompt.
//
// Uso tipico desde una vista:
//
//   const inlineAgent = useInlineAgent()
//   ...
//   <button onClick={() => inlineAgent.openWith({ module: 'finanzas', view: 'transacciones', ... })}>
//     Asistente
//   </button>
//   <InlineAgentSheet
//     open={inlineAgent.open}
//     onOpenChange={inlineAgent.setOpen}
//     contextSnapshot={inlineAgent.contextSnapshot}
//     module="Finanzas"
//   />

export type InlineContextSnapshot = Record<string, unknown>

export interface UseInlineAgentReturn {
  open: boolean
  setOpen: (open: boolean) => void
  openWith: (snapshot: InlineContextSnapshot) => void
  close: () => void
  contextSnapshot: InlineContextSnapshot | null
}

export function useInlineAgent(): UseInlineAgentReturn {
  const [open, setOpen] = useState(false)
  const [contextSnapshot, setContextSnapshot] = useState<InlineContextSnapshot | null>(null)

  const openWith = useCallback((snapshot: InlineContextSnapshot) => {
    setContextSnapshot(snapshot)
    setOpen(true)
  }, [])

  const close = useCallback(() => {
    setOpen(false)
  }, [])

  return {
    open,
    setOpen,
    openWith,
    close,
    contextSnapshot,
  }
}
