import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

// Menú contextual (click derecho) propio, sin dependencias externas. Se renderiza
// vía portal en <body> con position:fixed en las coordenadas del cursor, con
// clamping al viewport, cierre por click-outside / Escape / scroll. Mismo enfoque
// que `select-input.tsx`. El caller controla apertura/cierre y las coordenadas.

interface ContextMenuProps {
  open: boolean
  x: number
  y: number
  onClose: () => void
  children: ReactNode
  className?: string
}

const MARGIN = 8

export function ContextMenu({ open, x, y, onClose, children, className }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y })

  // Posicionar (con clamp al viewport) tras montar/medir. useLayoutEffect para
  // evitar un frame en la esquina equivocada.
  useLayoutEffect(() => {
    if (!open) return
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    let nx = x
    let ny = y
    if (nx + r.width > window.innerWidth - MARGIN) nx = window.innerWidth - r.width - MARGIN
    if (ny + r.height > window.innerHeight - MARGIN) ny = window.innerHeight - r.height - MARGIN
    setPos({ x: Math.max(MARGIN, nx), y: Math.max(MARGIN, ny) })
  }, [open, x, y])

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onClose, true)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onClose, true)
      window.removeEventListener('resize', onClose)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', left: pos.x, top: pos.y }}
      className={cn(
        'min-w-[13rem] rounded-xl border border-border bg-card-bg p-1.5 shadow-lg z-[100] outline-none',
        className,
      )}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </div>,
    document.body,
  )
}

interface ContextMenuItemProps {
  onSelect?: () => void
  disabled?: boolean
  children: ReactNode
  className?: string
  /** Indenta el item (para sub-opciones desplegadas). */
  indent?: boolean
}

export function ContextMenuItem({ onSelect, disabled, children, className, indent }: ContextMenuItemProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'flex items-center gap-2 w-full px-3 py-2 rounded-lg text-body text-graphite text-left transition-colors',
        'hover:bg-bone disabled:opacity-50 disabled:cursor-not-allowed',
        indent && 'pl-8',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function ContextMenuSeparator() {
  return <div className="my-1 h-px bg-border/60" />
}
