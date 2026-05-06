import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, RotateCcw, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const UNDO_WINDOW_MS = 30_000

export interface UndoToastSpec {
  id: string
  description: string
  onUndo: (() => Promise<void>) | null
}

interface UndoToastProps extends UndoToastSpec {
  onDismiss: (id: string) => void
}

function UndoToast({ id, description, onUndo, onDismiss }: UndoToastProps) {
  const [remaining, setRemaining] = useState(UNDO_WINDOW_MS)
  const [undoing, setUndoing] = useState(false)
  const [done, setDone] = useState<'undone' | 'expired' | null>(null)
  const startRef = useRef<number>(Date.now())

  useEffect(() => {
    const tick = () => {
      const elapsed = Date.now() - startRef.current
      const left = Math.max(0, UNDO_WINDOW_MS - elapsed)
      setRemaining(left)
      if (left <= 0) {
        setDone('expired')
        // Cierra el toast sólo si el usuario no inició un undo
        setTimeout(() => onDismiss(id), 250)
      }
    }
    const interval = setInterval(tick, 100)
    return () => clearInterval(interval)
  }, [id, onDismiss])

  const progress = Math.max(0, Math.min(1, remaining / UNDO_WINDOW_MS))
  const seconds = Math.ceil(remaining / 1000)

  async function handleUndo() {
    if (!onUndo || undoing || done) return
    setUndoing(true)
    try {
      await onUndo()
      setDone('undone')
      setTimeout(() => onDismiss(id), 1200)
    } catch (err) {
      console.error('[UndoToast] error revertiendo:', err)
      setUndoing(false)
    }
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card-bg p-4 min-w-[280px] max-w-sm">
      <div className="flex items-start gap-3">
        <div className="w-7 h-7 rounded-full flex items-center justify-center bg-positive-bg text-positive-text shrink-0">
          <Check size={14} strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-body text-dark-graphite truncate">{description}</p>
          {done === 'undone' ? (
            <p className="text-caption text-positive-text mt-1">Cambio revertido</p>
          ) : done === 'expired' ? null : (
            <p className="text-caption text-mid-gray mt-1">Deshacer disponible · {seconds}s</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!done && onUndo && (
            <button
              onClick={handleUndo}
              disabled={undoing}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-lg text-caption font-medium text-graphite hover:bg-bone transition-colors',
                undoing && 'opacity-60 cursor-not-allowed',
              )}
            >
              {undoing ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  Revirtiendo…
                </>
              ) : (
                <>
                  <RotateCcw size={12} />
                  Deshacer
                </>
              )}
            </button>
          )}
          <button
            onClick={() => onDismiss(id)}
            className="flex items-center justify-center w-6 h-6 rounded-lg text-mid-gray hover:text-dark-graphite hover:bg-bone transition-colors"
            aria-label="Cerrar"
          >
            <X size={12} />
          </button>
        </div>
      </div>
      {/* Countdown bar */}
      {!done && onUndo && (
        <div className="mt-3 h-1 rounded-full bg-bone overflow-hidden">
          <div
            className="h-full bg-graphite transition-[width] duration-100 ease-linear"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}
    </div>
  )
}

interface UndoToastContainerProps {
  toasts: UndoToastSpec[]
  onDismiss: (id: string) => void
}

export function UndoToastContainer({ toasts, onDismiss }: UndoToastContainerProps) {
  if (typeof document === 'undefined') return null
  if (toasts.length === 0) return null

  return createPortal(
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <UndoToast {...t} onDismiss={onDismiss} />
        </div>
      ))}
    </div>,
    document.body,
  )
}

export function useUndoToasts() {
  const [toasts, setToasts] = useState<UndoToastSpec[]>([])

  function showUndoToast(spec: { description: string; onUndo: (() => Promise<void>) | null }) {
    const id = `undo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setToasts((prev) => [...prev, { id, ...spec }])
  }

  function dismissToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  return { toasts, showUndoToast, dismissToast }
}
