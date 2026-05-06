// Hook que subscribe a `toolProgress/{toolCallId}` en Firestore para mostrar
// pasos incrementales mientras una tool larga ejecuta.
//
// Wave 2.3 — patrón pull desde el cliente. Las tools pesadas escriben pasos
// a `toolProgress/{toolCallId}` (server-side via reportProgress, o
// client-side via reportProgressClient). Este hook lee ese doc en vivo y
// devuelve el array de pasos ordenado por timestamp.
//
// TTL automático recomendado: 24h vía Firestore TTL policy en consola
// sobre el campo `updatedAt`.

import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/core/firebase/config'

export interface ProgressStep {
  label: string
  status: 'running' | 'done' | 'error'
  ts: number
}

interface UseToolProgressResult {
  steps: ProgressStep[]
  loading: boolean
}

export function useToolProgress(toolCallId: string | undefined): UseToolProgressResult {
  const [steps, setSteps] = useState<ProgressStep[]>([])
  const [loading, setLoading] = useState(Boolean(toolCallId))

  useEffect(() => {
    if (!toolCallId) {
      setSteps([])
      setLoading(false)
      return
    }
    setLoading(true)
    const ref = doc(db, 'toolProgress', toolCallId)
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = snap.data() as { steps?: ProgressStep[] } | undefined
        const raw = Array.isArray(data?.steps) ? data!.steps : []
        // Orden cronológico por timestamp (defensivo: arrayUnion no garantiza orden).
        const sorted = [...raw].sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0))
        setSteps(sorted)
        setLoading(false)
      },
      (err) => {
        console.warn('useToolProgress snapshot error', err)
        setLoading(false)
      },
    )
    return () => unsub()
  }, [toolCallId])

  return { steps, loading }
}
