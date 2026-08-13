import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Search, Home, BarChart3, Building2, Tags, BadgeCheck, Network,
  ArrowRight, Clock, CornerDownLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePermissions } from '@/core/hooks/use-permissions'
import { getPageByPath } from '@/core/config/access-registry'

// --- Types ---

// La búsqueda de entidades (empleados, transacciones, proveedores, socios) se
// retiró junto con sus módulos: sus resultados navegaban a rutas que BusinessHub
// ya no monta. Queda la navegación por páginas y los recientes.
interface SearchResult {
  id: string
  type: 'navigation' | 'recent'
  label: string
  description?: string
  icon: React.ReactNode
  to?: string
  onSelect?: () => void
  keywords?: string
}

// --- Navigation items ---

const ICON_SIZE = 16
const STROKE = 1.5

const NAV_RESULTS: SearchResult[] = [
  { id: 'nav-home', type: 'navigation', label: 'Home', icon: <Home size={ICON_SIZE} strokeWidth={STROKE} />, to: '/home', keywords: 'inicio home dashboard' },
  { id: 'nav-analytics', type: 'navigation', label: 'Analisis', icon: <BarChart3 size={ICON_SIZE} strokeWidth={STROKE} />, to: '/analytics', keywords: 'reportes estadisticas graficos kpi metricas analytics analisis pos ventas' },
  { id: 'nav-settings-companies', type: 'navigation', label: 'Companias', icon: <Building2 size={ICON_SIZE} strokeWidth={STROKE} />, to: '/settings/companies', keywords: 'ajustes configuracion companias empresas settings' },
  { id: 'nav-settings-categories', type: 'navigation', label: 'Categorias', icon: <Tags size={ICON_SIZE} strokeWidth={STROKE} />, to: '/settings/categories', keywords: 'ajustes configuracion categorias financieras settings' },
  { id: 'nav-settings-roles', type: 'navigation', label: 'Cargos', icon: <BadgeCheck size={ICON_SIZE} strokeWidth={STROKE} />, to: '/settings/roles', keywords: 'ajustes configuracion cargos puestos roles settings' },
  { id: 'nav-settings-departments', type: 'navigation', label: 'Departamentos', icon: <Network size={ICON_SIZE} strokeWidth={STROKE} />, to: '/settings/departments', keywords: 'ajustes configuracion departamentos areas settings' },
]

// Las acciones rápidas (nueva transacción, generar contrato, importar) también
// se retiraron: las tres abrían pantallas de Finanzas o Contratos.

// --- Recent searches (localStorage) ---

const RECENT_KEY = 'bh-command-palette-recent'
const MAX_RECENT = 5

function getRecent(): { label: string; to: string }[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
  } catch {
    return []
  }
}

function saveRecent(item: { label: string; to: string }) {
  const recent = getRecent().filter((r) => r.to !== item.to)
  recent.unshift(item)
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)))
}

// --- Normalize for search (strip accents) ---

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

// --- Component ---

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null)
  const navigate = useNavigate()
  const { canAccessPage } = usePermissions()

  // Keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // Close on click outside (container OR dropdown portal)
  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      const inContainer = containerRef.current?.contains(target)
      const inDropdown = dropdownRef.current?.contains(target)
      if (!inContainer && !inDropdown) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  // Compute + track portal position (right of the sidebar trigger)
  useEffect(() => {
    if (!open) return
    const DESIRED_WIDTH = 420
    const MARGIN = 8

    function updatePosition() {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const sidebar = el.closest('nav')
      const anchorRight = sidebar ? sidebar.getBoundingClientRect().right : rect.right + MARGIN
      const viewportW = window.innerWidth
      let left = anchorRight
      const maxLeft = viewportW - DESIRED_WIDTH - MARGIN
      if (left > maxLeft) left = Math.max(MARGIN, maxLeft)
      const width = Math.min(DESIRED_WIDTH, viewportW - left - MARGIN)
      setPosition({ top: rect.top, left, width })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition, { passive: true })
    window.addEventListener('scroll', updatePosition, { passive: true, capture: true })
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, { capture: true } as EventListenerOptions)
    }
  }, [open])

  const filteredNav = useMemo(() => {
    const q = normalize(query)
    if (!q) return []
    return NAV_RESULTS.filter((item) => {
      // Ocultar entradas a páginas a las que el usuario no tiene acceso —
      // si no las puede ver en el sidebar, tampoco deberían aparecer aquí
      // (especialmente Cargos, que es solo del owner).
      const page = item.to ? getPageByPath(item.to) : undefined
      if (page && !canAccessPage(page.id)) return false
      return (
        normalize(item.label).includes(q) ||
        normalize(item.keywords || '').includes(q)
      )
    }).slice(0, 6)
  }, [query, canAccessPage])

  const recentItems = useMemo<SearchResult[]>(() => {
    if (query) return []
    return getRecent().map((r, i) => ({
      id: `recent-${i}`,
      type: 'recent' as const,
      label: r.label,
      icon: <Clock size={ICON_SIZE} strokeWidth={STROKE} className="text-mid-gray" />,
      to: r.to,
    }))
  }, [query, open]) // eslint-disable-line react-hooks/exhaustive-deps

  const sections = useMemo(() => {
    const s: { title: string; items: SearchResult[] }[] = []

    if (recentItems.length > 0) s.push({ title: 'Recientes', items: recentItems })
    if (filteredNav.length > 0) s.push({ title: 'Navegacion', items: filteredNav })

    return s
  }, [recentItems, filteredNav])

  const flatItems = useMemo(() => sections.flatMap((s) => s.items), [sections])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useEffect(() => {
    if (!listRef.current) return
    const activeEl = listRef.current.querySelector(`[data-index="${activeIndex}"]`)
    activeEl?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const handleSelect = useCallback(
    (item: SearchResult) => {
      setOpen(false)
      if (item.to) {
        saveRecent({ label: item.label, to: item.to })
        navigate(item.to)
      }
      item.onSelect?.()
    },
    [navigate]
  )

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => (prev + 1) % flatItems.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => (prev - 1 + flatItems.length) % flatItems.length)
    } else if (e.key === 'Enter' && flatItems[activeIndex]) {
      e.preventDefault()
      handleSelect(flatItems[activeIndex])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  const TYPE_LABELS: Record<string, string> = {
    employee: 'Empleado',
    transaction: 'Transaccion',
    supplier: 'Proveedor',
    partner: 'Socio',
  }

  let globalIndex = -1

  return (
    <div ref={containerRef} className="relative">
      {/* Search trigger — input-like button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-caption transition-all duration-150 cursor-pointer',
          open
            ? 'border-input-focus ring-[3px] ring-graphite/5 bg-surface-elevated text-graphite'
            : 'border-border bg-smoke text-mid-gray hover:text-graphite hover:border-input-focus shadow-sm'
        )}
      >
        <Search size={14} strokeWidth={1.5} />
        <span className="flex-1 text-left">Buscar...</span>
        <kbd className="flex items-center gap-0.5 rounded border border-border/60 bg-graphite/5 px-1 py-0.5 text-[10px] font-medium text-mid-gray">
          Ctrl K
        </kbd>
      </button>

      {/* Dropdown — portaled so it escapes the sidebar width */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {open && position && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
            style={{ top: position.top, left: position.left, width: position.width }}
            className="fixed z-[60]"
          >
            <div className="overflow-hidden rounded-xl border border-border bg-surface-elevated shadow-lg">
              {/* Search input */}
              <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
                <Search size={15} strokeWidth={1.5} className="shrink-0 text-mid-gray" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Buscar secciones, empleados, transacciones..."
                  className="flex-1 bg-transparent text-caption text-dark-graphite placeholder:text-mid-gray/50 outline-none"
                />
                <kbd className="hidden sm:flex items-center rounded-md border border-border bg-bone px-1 py-0.5 text-[9px] font-medium text-mid-gray">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div ref={listRef} className="max-h-[min(50vh,360px)] overflow-y-auto overscroll-contain p-1.5">
                {flatItems.length === 0 && query ? (
                  <div className="flex flex-col items-center gap-1.5 py-6 text-center">
                    <Search size={24} strokeWidth={1} className="text-mid-gray/30" />
                    <p className="text-caption text-mid-gray">Sin resultados para "{query}"</p>
                  </div>
                ) : (
                  sections.map((section) => (
                    <div key={section.title} className="mb-0.5 last:mb-0">
                      <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider font-semibold text-mid-gray/70">
                        {section.title}
                      </div>
                      {section.items.map((item) => {
                        globalIndex++
                        const idx = globalIndex
                        const isActive = idx === activeIndex
                        const badge = TYPE_LABELS[item.type]

                        return (
                          <button
                            key={item.id}
                            data-index={idx}
                            onClick={() => handleSelect(item)}
                            onMouseEnter={() => setActiveIndex(idx)}
                            className={cn(
                              'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors duration-75',
                              isActive
                                ? 'bg-bone text-dark-graphite'
                                : 'text-graphite hover:bg-bone/50'
                            )}
                          >
                            <span className="shrink-0">{item.icon}</span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate text-caption font-medium">{item.label}</span>
                                {badge && (
                                  <span className="shrink-0 rounded-full bg-graphite/8 px-1.5 py-0.5 text-[9px] font-medium text-mid-gray">
                                    {badge}
                                  </span>
                                )}
                              </div>
                              {item.description && (
                                <div className="truncate text-[11px] text-mid-gray">{item.description}</div>
                              )}
                            </div>
                            {isActive && (
                              <ArrowRight size={12} strokeWidth={1.5} className="shrink-0 text-mid-gray" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* Footer hints */}
              <div className="flex items-center gap-3 border-t border-border px-3 py-1.5">
                <div className="flex items-center gap-1 text-[9px] text-mid-gray/60">
                  <kbd className="rounded border border-border bg-bone px-1 py-0.5 font-mono text-[8px]"><CornerDownLeft size={8} /></kbd>
                  <span>Seleccionar</span>
                </div>
                <div className="flex items-center gap-1 text-[9px] text-mid-gray/60">
                  <kbd className="rounded border border-border bg-bone px-1 py-0.5 font-mono text-[8px]">&uarr;&darr;</kbd>
                  <span>Navegar</span>
                </div>
                <div className="flex items-center gap-1 text-[9px] text-mid-gray/60">
                  <kbd className="rounded border border-border bg-bone px-1 py-0.5 font-mono text-[8px]">ESC</kbd>
                  <span>Cerrar</span>
                </div>
              </div>
            </div>
          </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}
