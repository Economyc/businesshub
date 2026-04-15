import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Search, Home, BarChart3, Users, Briefcase, DollarSign, Handshake,
  ClipboardList, FileSignature, Building2, Tags, BadgeCheck, Network,
  ArrowRight, Clock, Plus, CornerDownLeft, Wallet, Gift,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEmployees } from '@/modules/talent/hooks'
import { useTransactions } from '@/modules/finance/hooks'
import { useSuppliers } from '@/modules/suppliers/hooks'
import { usePartners } from '@/modules/partners/hooks'
import { usePurchases } from '@/modules/purchases/hooks'
import { formatCurrency } from '@/core/utils/format'

// --- Types ---

interface SearchResult {
  id: string
  type: 'navigation' | 'action' | 'employee' | 'transaction' | 'supplier' | 'partner' | 'purchase' | 'recent'
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
  { id: 'nav-analytics', type: 'navigation', label: 'Analisis', icon: <BarChart3 size={ICON_SIZE} strokeWidth={STROKE} />, to: '/analytics', keywords: 'reportes estadisticas graficos kpi metricas analytics analisis costos nomina compras' },
  { id: 'nav-analytics-costs', type: 'navigation', label: 'Estructura de Costos', icon: <BarChart3 size={ICON_SIZE} strokeWidth={STROKE} />, to: '/analytics/costs', keywords: 'costos estructura fijos variables rubros gastos' },
  { id: 'nav-analytics-purchases', type: 'navigation', label: 'Analisis de Compras', icon: <BarChart3 size={ICON_SIZE} strokeWidth={STROKE} />, to: '/analytics/purchases', keywords: 'compras insumos proveedores tendencia productos' },
  { id: 'nav-analytics-payroll', type: 'navigation', label: 'Analisis de Nomina', icon: <BarChart3 size={ICON_SIZE} strokeWidth={STROKE} />, to: '/analytics/payroll', keywords: 'nomina salarios empleados departamentos cargos' },
  { id: 'nav-talent', type: 'navigation', label: 'Equipo', icon: <Users size={ICON_SIZE} strokeWidth={STROKE} />, to: '/talent', keywords: 'empleados personas equipo talento recurso humano nomina' },
  { id: 'nav-suppliers', type: 'navigation', label: 'Proveedores', icon: <Briefcase size={ICON_SIZE} strokeWidth={STROKE} />, to: '/suppliers', keywords: 'proveedores compras suministros vendors' },
  { id: 'nav-finance', type: 'navigation', label: 'Finanzas', icon: <DollarSign size={ICON_SIZE} strokeWidth={STROKE} />, to: '/finance', keywords: 'finanzas transacciones pagos ingresos egresos contabilidad' },
  { id: 'nav-purchases', type: 'navigation', label: 'Compras', icon: <DollarSign size={ICON_SIZE} strokeWidth={STROKE} />, to: '/finance/purchases', keywords: 'compras insumos pedidos ordenes proveedores' },
  { id: 'nav-products', type: 'navigation', label: 'Catalogo de Insumos', icon: <DollarSign size={ICON_SIZE} strokeWidth={STROKE} />, to: '/finance/purchases/products', keywords: 'insumos productos catalogo ingredientes inventario' },
  { id: 'nav-cashflow', type: 'navigation', label: 'Flujo de Caja', icon: <DollarSign size={ICON_SIZE} strokeWidth={STROKE} />, to: '/finance/cash-flow', keywords: 'flujo caja efectivo cash flow saldo entradas salidas balance' },
  { id: 'nav-income', type: 'navigation', label: 'Estado de Resultados', icon: <DollarSign size={ICON_SIZE} strokeWidth={STROKE} />, to: '/finance/income-statement', keywords: 'estado resultados p&l perdidas ganancias utilidad margen' },
  { id: 'nav-budget', type: 'navigation', label: 'Presupuesto vs Real', icon: <DollarSign size={ICON_SIZE} strokeWidth={STROKE} />, to: '/finance/budget', keywords: 'presupuesto budget meta objetivo comparar real ejecucion' },
  { id: 'nav-import', type: 'navigation', label: 'Importar Transacciones', icon: <DollarSign size={ICON_SIZE} strokeWidth={STROKE} />, to: '/finance/import', keywords: 'importar csv excel transacciones carga masiva' },
  { id: 'nav-reconciliation', type: 'navigation', label: 'Conciliacion Bancaria', icon: <DollarSign size={ICON_SIZE} strokeWidth={STROKE} />, to: '/finance/reconciliation', keywords: 'conciliacion bancaria extracto banco bank reconciliation statement ofx' },
  { id: 'nav-cartera', type: 'navigation', label: 'Cartera', icon: <Wallet size={ICON_SIZE} strokeWidth={STROKE} />, to: '/cartera', keywords: 'cartera cuentas cobrar pagar pendientes abonos pagos vencidos receivables payables rappi' },
  { id: 'nav-partners', type: 'navigation', label: 'Socios', icon: <Handshake size={ICON_SIZE} strokeWidth={STROKE} />, to: '/partners', keywords: 'socios partners inversion participacion accionistas' },
  { id: 'nav-closings', type: 'navigation', label: 'Cierres de Caja', icon: <ClipboardList size={ICON_SIZE} strokeWidth={STROKE} />, to: '/closings', keywords: 'cierres cierre caja diario ventas efectivo datafono propinas' },
  { id: 'nav-prestaciones', type: 'navigation', label: 'Prestaciones Sociales', icon: <Gift size={ICON_SIZE} strokeWidth={STROKE} />, to: '/prestaciones', keywords: 'prestaciones sociales prima cesantias intereses vacaciones liquidacion definitiva terminacion' },
  { id: 'nav-contracts', type: 'navigation', label: 'Contratos', icon: <FileSignature size={ICON_SIZE} strokeWidth={STROKE} />, to: '/contracts', keywords: 'contratos laborales documentos legales' },
  { id: 'nav-templates', type: 'navigation', label: 'Plantillas de Contratos', icon: <FileSignature size={ICON_SIZE} strokeWidth={STROKE} />, to: '/contracts/templates', keywords: 'plantillas templates modelos contratos clausulas' },
  { id: 'nav-settings-companies', type: 'navigation', label: 'Companias', icon: <Building2 size={ICON_SIZE} strokeWidth={STROKE} />, to: '/settings/companies', keywords: 'ajustes configuracion companias empresas settings' },
  { id: 'nav-settings-categories', type: 'navigation', label: 'Categorias', icon: <Tags size={ICON_SIZE} strokeWidth={STROKE} />, to: '/settings/categories', keywords: 'ajustes configuracion categorias financieras settings' },
  { id: 'nav-settings-roles', type: 'navigation', label: 'Cargos', icon: <BadgeCheck size={ICON_SIZE} strokeWidth={STROKE} />, to: '/settings/roles', keywords: 'ajustes configuracion cargos puestos roles settings' },
  { id: 'nav-settings-departments', type: 'navigation', label: 'Departamentos', icon: <Network size={ICON_SIZE} strokeWidth={STROKE} />, to: '/settings/departments', keywords: 'ajustes configuracion departamentos areas settings' },
]

// --- Quick actions ---

function getActionResults(_navigate: ReturnType<typeof useNavigate>): SearchResult[] {
  return [
    { id: 'act-new-transaction', type: 'action', label: 'Nueva Transaccion', description: 'Registrar ingreso o egreso', icon: <Plus size={ICON_SIZE} strokeWidth={STROKE} />, to: '/finance', keywords: 'crear nueva transaccion pago ingreso egreso' },
    { id: 'act-new-purchase', type: 'action', label: 'Nueva Compra', description: 'Registrar orden de compra', icon: <Plus size={ICON_SIZE} strokeWidth={STROKE} />, to: '/finance/purchases/new', keywords: 'crear nueva compra orden pedido' },
    { id: 'act-new-contract', type: 'action', label: 'Generar Contrato', description: 'Crear contrato laboral', icon: <Plus size={ICON_SIZE} strokeWidth={STROKE} />, to: '/contracts/new', keywords: 'generar crear nuevo contrato laboral' },
    { id: 'act-import', type: 'action', label: 'Importar Transacciones', description: 'Carga masiva CSV/Excel', icon: <Plus size={ICON_SIZE} strokeWidth={STROKE} />, to: '/finance/import', keywords: 'importar csv excel transacciones carga masiva' },
    { id: 'act-new-settlement', type: 'action', label: 'Nueva Liquidacion de Prestaciones', description: 'Prima, cesantias, vacaciones o liquidacion definitiva', icon: <Plus size={ICON_SIZE} strokeWidth={STROKE} />, to: '/prestaciones', keywords: 'crear nueva liquidacion prestaciones prima cesantias vacaciones' },
  ]
}

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

  // Entity data
  const { data: employees } = useEmployees()
  const { data: transactions } = useTransactions()
  const { data: suppliers } = useSuppliers()
  const { data: partners } = usePartners()
  const { data: purchases } = usePurchases()

  const actions = useMemo(() => getActionResults(navigate), [navigate])

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
      const viewportW = window.innerWidth
      let left = rect.right + MARGIN
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

  // Build entity results from data
  const entityResults = useMemo<SearchResult[]>(() => {
    const q = normalize(query)
    if (!q || q.length < 2) return []

    const results: SearchResult[] = []

    for (const emp of employees) {
      if (
        normalize(emp.name).includes(q) ||
        normalize(emp.role).includes(q) ||
        normalize(emp.identification || '').includes(q) ||
        normalize(emp.email || '').includes(q)
      ) {
        results.push({
          id: `emp-${emp.id}`,
          type: 'employee',
          label: emp.name,
          description: `${emp.role} · ${emp.department}`,
          icon: <Users size={ICON_SIZE} strokeWidth={STROKE} className="text-blue-500" />,
          to: `/talent/${emp.id}`,
        })
      }
    }

    for (const tx of transactions) {
      if (
        normalize(tx.concept).includes(q) ||
        normalize(tx.category).includes(q) ||
        normalize(tx.notes || '').includes(q)
      ) {
        results.push({
          id: `tx-${tx.id}`,
          type: 'transaction',
          label: tx.concept,
          description: `${tx.type === 'income' ? 'Ingreso' : 'Egreso'} · ${formatCurrency(tx.amount)} · ${tx.category}`,
          icon: <DollarSign size={ICON_SIZE} strokeWidth={STROKE} className={tx.type === 'income' ? 'text-emerald-500' : 'text-red-400'} />,
          to: '/finance',
        })
      }
    }

    for (const sup of suppliers) {
      if (
        normalize(sup.name).includes(q) ||
        normalize(sup.contactName || '').includes(q) ||
        normalize(sup.category || '').includes(q) ||
        normalize(sup.identification || '').includes(q)
      ) {
        results.push({
          id: `sup-${sup.id}`,
          type: 'supplier',
          label: sup.name,
          description: `${sup.category} · ${sup.contactName}`,
          icon: <Briefcase size={ICON_SIZE} strokeWidth={STROKE} className="text-orange-500" />,
          to: `/suppliers/${sup.id}`,
        })
      }
    }

    for (const p of partners) {
      if (
        normalize(p.name).includes(q) ||
        normalize(p.identification || '').includes(q) ||
        normalize(p.email || '').includes(q)
      ) {
        results.push({
          id: `part-${p.id}`,
          type: 'partner',
          label: p.name,
          description: `${p.ownership}% participacion · ${formatCurrency(p.investment)}`,
          icon: <Handshake size={ICON_SIZE} strokeWidth={STROKE} className="text-purple-500" />,
          to: '/partners',
        })
      }
    }

    for (const pur of purchases) {
      if (
        normalize(pur.supplierName).includes(q) ||
        normalize(pur.invoiceNumber || '').includes(q) ||
        normalize(pur.notes || '').includes(q)
      ) {
        results.push({
          id: `pur-${pur.id}`,
          type: 'purchase',
          label: `Compra #${pur.invoiceNumber || pur.id.slice(0, 6)}`,
          description: `${pur.supplierName} · ${formatCurrency(pur.total)}`,
          icon: <ClipboardList size={ICON_SIZE} strokeWidth={STROKE} className="text-teal-500" />,
          to: `/finance/purchases/${pur.id}`,
        })
      }
    }

    return results.slice(0, 8)
  }, [query, employees, transactions, suppliers, partners, purchases])

  const filteredNav = useMemo(() => {
    const q = normalize(query)
    if (!q) return []
    return NAV_RESULTS.filter(
      (item) =>
        normalize(item.label).includes(q) ||
        normalize(item.keywords || '').includes(q)
    ).slice(0, 6)
  }, [query])

  const filteredActions = useMemo(() => {
    const q = normalize(query)
    if (!q) return actions
    return actions.filter(
      (item) =>
        normalize(item.label).includes(q) ||
        normalize(item.description || '').includes(q) ||
        normalize(item.keywords || '').includes(q)
    )
  }, [query, actions])

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
    if (!query) s.push({ title: 'Acciones rapidas', items: actions })
    if (filteredActions.length > 0 && query) s.push({ title: 'Acciones', items: filteredActions })
    if (filteredNav.length > 0) s.push({ title: 'Navegacion', items: filteredNav })
    if (entityResults.length > 0) s.push({ title: 'Resultados', items: entityResults })

    return s
  }, [recentItems, actions, filteredActions, filteredNav, entityResults, query])

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
    purchase: 'Compra',
  }

  let globalIndex = -1

  return (
    <div ref={containerRef} className="relative">
      {/* Search trigger — input-like button */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-caption transition-all duration-150 cursor-pointer',
          open
            ? 'border-input-focus ring-[3px] ring-graphite/5 bg-surface-elevated text-graphite'
            : 'border-border bg-smoke text-mid-gray hover:text-graphite hover:border-input-focus shadow-sm'
        )}
      >
        <Search size={14} strokeWidth={1.5} />
        <span className="flex-1 text-left">Buscar...</span>
        <kbd className="flex items-center gap-0.5 rounded border border-border bg-surface-elevated px-1 py-0.5 text-[10px] font-medium">
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
                      <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-mid-gray/70">
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
