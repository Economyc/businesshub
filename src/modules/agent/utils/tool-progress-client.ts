// Helper cliente para escribir pasos de progreso desde mutaciones que
// corren client-side (ej: executeMonthClosing, triggerPosReconcile).
//
// Las tools server-side (con execute() en functions/) usan
// `functions/src/tools/utils/tool-progress.ts`. Para tools que se ejecutan
// vía `executeMutation()` en el cliente, este helper escribe al mismo doc
// `toolProgress/{toolCallId}` que `useToolProgress` subscribe.
//
// Fire-and-forget: usa `void reportProgressClient(...)` para no bloquear.

import { doc, setDoc, arrayUnion, serverTimestamp, Timestamp } from 'firebase/firestore'
import { db } from '@/core/firebase/config'

export interface ProgressStep {
  label: string
  status?: 'running' | 'done' | 'error'
}

const TTL_MS = 24 * 60 * 60 * 1000

export async function reportProgressClient(
  toolCallId: string | undefined,
  step: ProgressStep,
): Promise<void> {
  if (!toolCallId) return
  try {
    await setDoc(
      doc(db, 'toolProgress', toolCallId),
      {
        steps: arrayUnion({
          label: step.label,
          status: step.status ?? 'done',
          ts: Date.now(),
        }),
        updatedAt: serverTimestamp(),
        expireAt: Timestamp.fromMillis(Date.now() + TTL_MS),
      },
      { merge: true },
    )
  } catch (e) {
    console.warn('reportProgressClient failed', e)
  }
}
