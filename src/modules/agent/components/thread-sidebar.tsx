import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, MoreHorizontal, FolderOpen, Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { HoverHint } from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { AgentThread, ThreadStatus } from '../types'

interface ThreadSidebarProps {
  threads: AgentThread[]
  activeThreadId: string | null
  onSelectThread: (thread: AgentThread | null) => void
  onCreateThread: (title: string) => Promise<void> | void
  onUpdateThreadStatus: (threadId: string, status: ThreadStatus) => Promise<void> | void
  onDeleteThread: (threadId: string) => Promise<void> | void
}

// Estados → variantes del badge del design system. No hay color hardcoded.
const STATUS_VARIANT: Record<ThreadStatus, 'positive' | 'info' | 'warning'> = {
  done: 'positive',
  in_progress: 'info',
  blocked: 'warning',
}

const STATUS_LABEL: Record<ThreadStatus, string> = {
  in_progress: 'En curso',
  done: 'Completado',
  blocked: 'Bloqueado',
}

// Timestamp relativo manual con Intl.RelativeTimeFormat (no hay date-fns en deps).
const RELATIVE = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })

function formatRelative(ts: unknown): string {
  if (!ts || typeof ts !== 'object') return ''
  const seconds = (ts as { seconds?: number; _seconds?: number }).seconds ??
    (ts as { _seconds?: number })._seconds ?? 0
  if (!seconds) return ''
  const diffMs = Date.now() - seconds * 1000
  const diffMin = Math.round(diffMs / 60000)
  if (Math.abs(diffMin) < 1) return 'ahora'
  if (Math.abs(diffMin) < 60) return RELATIVE.format(-diffMin, 'minute')
  const diffHr = Math.round(diffMin / 60)
  if (Math.abs(diffHr) < 24) return RELATIVE.format(-diffHr, 'hour')
  const diffDay = Math.round(diffHr / 24)
  if (Math.abs(diffDay) < 30) return RELATIVE.format(-diffDay, 'day')
  const diffMonth = Math.round(diffDay / 30)
  return RELATIVE.format(-diffMonth, 'month')
}

export function ThreadSidebar({
  threads,
  activeThreadId,
  onSelectThread,
  onCreateThread,
  onUpdateThreadStatus,
  onDeleteThread,
}: ThreadSidebarProps) {
  const [createOpen, setCreateOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuFor) return
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuFor(null)
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuFor(null)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [menuFor])

  const handleCreate = useCallback(async () => {
    const title = newTitle.trim()
    if (!title) return
    setCreating(true)
    try {
      await onCreateThread(title)
      setNewTitle('')
      setCreateOpen(false)
    } finally {
      setCreating(false)
    }
  }, [newTitle, onCreateThread])

  return (
    <aside className="w-60 shrink-0 hidden md:flex flex-col border-r border-border bg-surface-elevated min-h-0">
      <div className="px-4 h-14 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FolderOpen size={16} strokeWidth={1.5} className="text-mid-gray" />
          <p className="text-body font-medium text-dark-graphite truncate">Threads</p>
        </div>
        <HoverHint label="Nuevo thread">
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded-full text-mid-gray hover:text-graphite hover:bg-bone transition-colors active:scale-95"
          >
            <Plus size={16} strokeWidth={1.5} />
          </button>
        </HoverHint>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        <button
          type="button"
          onClick={() => onSelectThread(null)}
          className={cn(
            'w-full flex items-center gap-2 px-4 py-2.5 text-body text-left transition-colors',
            activeThreadId === null
              ? 'bg-bone/80 text-dark-graphite'
              : 'text-graphite hover:bg-bone/60',
          )}
        >
          <Inbox size={14} strokeWidth={1.5} className="text-mid-gray shrink-0" />
          <span className="truncate">Conversación libre</span>
        </button>

        {threads.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-caption text-mid-gray">
              Sin threads. Crea uno para tareas largas como cierre de mes.
            </p>
          </div>
        ) : (
          <ul className="py-1">
            {threads.map((thread) => {
              const isActive = thread.id === activeThreadId
              return (
                <li key={thread.id} className="relative">
                  <button
                    type="button"
                    onClick={() => onSelectThread(thread)}
                    className={cn(
                      'group w-full flex items-start gap-2 px-4 py-2.5 text-left transition-colors',
                      isActive ? 'bg-bone/80' : 'hover:bg-bone/60',
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-body font-medium text-dark-graphite truncate leading-tight">
                        {thread.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge
                          variant={STATUS_VARIANT[thread.status]}
                          className="px-1.5 py-0 text-caption"
                        >
                          {STATUS_LABEL[thread.status]}
                        </Badge>
                        <span className="text-caption text-mid-gray truncate">
                          {formatRelative(thread.updatedAt)}
                        </span>
                      </div>
                    </div>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation()
                        setMenuFor(menuFor === thread.id ? null : thread.id)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          e.stopPropagation()
                          setMenuFor(menuFor === thread.id ? null : thread.id)
                        }
                      }}
                      className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-mid-gray/0 group-hover:text-mid-gray hover:!text-graphite hover:bg-bone transition-colors cursor-pointer"
                      aria-label="Acciones del thread"
                    >
                      <MoreHorizontal size={14} strokeWidth={1.5} />
                    </span>
                  </button>

                  {menuFor === thread.id && (
                    <div
                      ref={menuRef}
                      className="absolute right-2 top-12 z-30 w-44 rounded-xl border border-border/60 bg-card-bg overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={async () => {
                          await onUpdateThreadStatus(thread.id, 'done')
                          setMenuFor(null)
                        }}
                        className="w-full text-left px-3 py-2 text-body text-graphite hover:bg-bone/60 transition-colors"
                      >
                        Cerrar (done)
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await onUpdateThreadStatus(thread.id, 'blocked')
                          setMenuFor(null)
                        }}
                        className="w-full text-left px-3 py-2 text-body text-graphite hover:bg-bone/60 transition-colors"
                      >
                        Marcar bloqueado
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await onUpdateThreadStatus(thread.id, 'in_progress')
                          setMenuFor(null)
                        }}
                        className="w-full text-left px-3 py-2 text-body text-graphite hover:bg-bone/60 transition-colors"
                      >
                        Reabrir (en curso)
                      </button>
                      <div className="h-px bg-border/60" />
                      <button
                        type="button"
                        onClick={async () => {
                          await onDeleteThread(thread.id)
                          setMenuFor(null)
                        }}
                        className="w-full text-left px-3 py-2 text-body text-negative-text hover:bg-negative-bg/60 transition-colors"
                      >
                        Eliminar
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo thread</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-caption text-mid-gray">Título</label>
            <Input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Cierre de abril 2026"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !creating) {
                  e.preventDefault()
                  handleCreate()
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={creating}
            >
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={creating || !newTitle.trim()}>
              {creating ? 'Creando…' : 'Crear thread'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  )
}
