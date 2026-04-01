# Phase 1: Dashboard Home Inteligente - Research

**Researched:** 2026-03-29
**Domain:** React dashboard composition — KPI widgets, Recharts AreaChart, alert aggregation, quick-action grid
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Grid responsive con secciones fijas (no tabs, no drag-drop). Layout similar al analytics module: KPIs en row superior, gráfica y alertas en grid 2-columnas, accesos rápidos en footer.
- **D-02:** Mobile-first: stack vertical en mobile, 2 columnas en tablet, layout completo en desktop.
- **D-03:** Secciones predefinidas con layout responsivo CSS Grid/Flexbox. NO usar react-grid-layout ni drag & drop para el MVP. Las secciones son: KPIs, Gráfica de Ventas, Alertas, Accesos Rápidos.
- **D-04:** Cada sección es un componente independiente con su propio hook de datos y loading state.
- **D-05:** Reutilizar el componente KPICard existente (src/core/ui/kpi-card.tsx) con animación count-up.
- **D-06:** KPIs a mostrar: Ingresos del mes, Gastos del mes, Utilidad neta, Margen de ganancia, Cuentas por cobrar netas (pendingNet). Todos con indicador de cambio vs mes anterior.
- **D-07:** Fuente de datos: useAnalyticsKPIs() para KPIs con cambios pre-calculados + useCompanySummaries() para datos de empresa.
- **D-08:** AreaChart con gradiente (Recharts) mostrando ingresos diarios de los últimos 30 días. Color verde consistente con el theme (#5a7a5a para ingresos).
- **D-09:** Reutilizar el patrón de ChartTooltip custom del analytics module. ResponsiveContainer con altura fija.
- **D-10:** Fuente de datos: useTransactions() filtradas por últimos 30 días, agrupadas por día. Si no hay datos suficientes, mostrar empty state con mensaje.
- **D-11:** Sección inline en el dashboard con lista de alertas ordenadas por severidad (critical → warning → info).
- **D-12:** Tipos de alertas: contratos por vencer (useContracts + filtro endDate < 30 días), presupuesto excedido (useBudgetComparison + ejecución > 100%), proveedores expirados (useSuppliers + status expired), alertas de compras (usePurchaseAlerts).
- **D-13:** Cada alerta muestra: ícono de severidad, mensaje descriptivo, badge de tipo, y link de acción para resolver.
- **D-14:** Máximo 5 alertas visibles con "Ver todas" si hay más.
- **D-15:** Grid de botones/cards pequeños con ícono + label para acciones frecuentes: Nueva transacción, Nuevo contrato, Ver análisis, Ver proveedores, Ver nómina.
- **D-16:** Usar navigate() para cada acción, consistente con el patrón existente.

### Claude's Discretion
- Animaciones de entrada (stagger) — usar patrón existente de framer-motion
- Diseño exacto de spacing y sizing de componentes
- Manejo de estados de carga (skeleton vs spinner)
- Orden exacto de las secciones en mobile

### Deferred Ideas (OUT OF SCOPE)
- Widgets configurables con drag & drop real — considerar para fase futura
- Personalización de qué KPIs mostrar por usuario
- Notificaciones push para alertas críticas
- Dashboard comparativo multi-empresa
</user_constraints>

---

## Summary

The existing codebase is well-suited for this phase. KPICard, ChartTooltip, stagger animations, and all required data hooks already exist and are production-quality. The dominant implementation work is composing known primitives into a new page layout, plus writing two new data-transformation hooks: one for the 30-day daily sales trend and one for the unified alert aggregator.

The single most important architectural finding is that `/home` is NOT wrapped in `DateRangeProvider` in App.tsx. `useAnalyticsKPIs()` calls `useDateRange()` internally and will throw without the provider. The plan must add `DateRangeProvider` wrapping to the `/home` route (mirroring the analytics route group) before any KPI hook can be called. This is the one integration prerequisite that cannot be skipped.

The alerts section requires the most new logic: aggregating heterogeneous alert sources (contracts, suppliers, budget, purchase price changes) into a normalized `DashboardAlert[]` shape, sorting by severity, and providing per-alert action routes. No library is needed — pure useMemo composition over existing hooks.

**Primary recommendation:** Create a new `src/modules/home/hooks/use-dashboard-data.ts` (or split into per-section hooks as D-04 requires), compose into a new `DashboardPage` component, keep the old `HomePage` as the multi-company fallback, and switch between them based on `selectedCompany` presence.

---

## Standard Stack

### Core (all already installed — no new installs required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | 3.8.0 | AreaChart for sales trend | Already used in analytics module |
| framer-motion | 12.38.0 | Stagger entry animations | Already used project-wide |
| lucide-react | 0.577.0 | Alert severity icons, quick-action icons | Standard icon set for this project |
| react-router-dom | 7.13.1 | navigate() for quick actions | Already used everywhere |
| tailwindcss | 4.2.2 | Responsive grid layout | Project-wide CSS |

### No New Dependencies
All functionality can be achieved with the existing stack. Do NOT add new packages.

---

## Architecture Patterns

### Recommended File Structure

```
src/modules/home/
├── components/
│   ├── home-page.tsx          ← EXISTING — multi-company fallback, keep as-is
│   ├── dashboard-page.tsx     ← NEW — single-company executive dashboard
│   ├── dashboard-kpis.tsx     ← NEW — KPI row section
│   ├── sales-trend-chart.tsx  ← NEW — AreaChart 30-day daily
│   ├── alerts-section.tsx     ← NEW — aggregated alert list
│   └── quick-actions.tsx      ← NEW — grid of navigation buttons
├── hooks/
│   ├── use-daily-sales.ts     ← NEW — 30-day daily aggregation from useTransactions()
│   └── use-dashboard-alerts.ts ← NEW — unified alert aggregator
└── hooks.ts                   ← EXISTING — useCompanySummaries()
```

### Pattern 1: DateRangeProvider on the /home route

**What:** The `/home` route must be wrapped with `DateRangeProvider` because `useAnalyticsKPIs()` calls `useDateRange()` internally.
**When to use:** Required before any analytics hook is called from the dashboard.
**Example (App.tsx change):**
```tsx
// App.tsx — wrap /home the same way analytics routes are wrapped
<Route element={<DateRangeProvider><Outlet /></DateRangeProvider>}>
  <Route path="/home" element={<Suspense fallback={<Loading />}><HomePage /></Suspense>} />
</Route>
```
OR: wrap `DateRangeProvider` directly inside `DashboardPage` itself to avoid touching App.tsx and keep the home route independent. This is the cleaner option — add `<DateRangeProvider>` as the outermost wrapper inside `DashboardPage`.

**Recommended:** Wrap inside `DashboardPage` component to keep App.tsx minimal and localize the dependency.

### Pattern 2: Company-conditional rendering in HomePage

**What:** When no company is selected, show the existing multi-company grid. When a company is selected, render `DashboardPage`.
**Why:** D-01 and the phase boundary both state this. The existing `home-page.tsx` becomes the fallback, not a competitor.

```tsx
// home-page.tsx updated entry point
export function HomePage() {
  const { selectedCompany } = useCompany()
  if (selectedCompany) return <DashboardPage />
  return <MultiCompanyView />  // existing grid moved into this component
}
```

### Pattern 3: Per-section independent hooks (D-04)

Each section manages its own loading state:
```tsx
// dashboard-kpis.tsx
export function DashboardKPIs() {
  const { kpis, loading } = useAnalyticsKPIs()
  if (loading) return <KPISkeletonRow />
  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate"
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      <KPICard label="Ingresos del Mes" value={kpis.totalIncome} format="currency"
        change={kpis.incomeChange} trend={...} icon={TrendingUp} />
      {/* ... 4 more KPICards */}
    </motion.div>
  )
}
```

### Pattern 4: Daily sales trend hook

**What:** `useTransactions()` returns all transactions. Filter to last 30 days income, group by `date.toDate().toLocaleDateString('es-CO', {day:'2-digit',month:'short'})`, accumulate per-day totals.

```tsx
// hooks/use-daily-sales.ts
export function useDailySales() {
  const { data: transactions, loading } = useTransactions()

  const dailyData = useMemo(() => {
    const now = new Date()
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(now.getDate() - 29)
    thirtyDaysAgo.setHours(0, 0, 0, 0)

    const dayMap: Record<string, { day: string; income: number }> = {}

    // Seed all 30 days with zero so chart is contiguous
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      const key = d.toISOString().slice(0, 10) // 'YYYY-MM-DD'
      const label = d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
      dayMap[key] = { day: label, income: 0 }
    }

    transactions.forEach((t) => {
      if (t.type !== 'income') return
      const d = t.date?.toDate?.()
      if (!d || d < thirtyDaysAgo) return
      const key = d.toISOString().slice(0, 10)
      if (dayMap[key]) dayMap[key].income += t.amount
    })

    return Object.values(dayMap)
  }, [transactions])

  return { dailyData, loading }
}
```

### Pattern 5: AreaChart with gradient (Recharts)

Recharts 3.x supports `<defs>` + `<linearGradient>` inside the chart SVG:

```tsx
// sales-trend-chart.tsx
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, defs, linearGradient, stop } from 'recharts'

// Inside the chart:
<ResponsiveContainer width="100%" height={200}>
  <AreaChart data={dailyData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
    <defs>
      <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#5a7a5a" stopOpacity={0.3} />
        <stop offset="95%" stopColor="#5a7a5a" stopOpacity={0} />
      </linearGradient>
    </defs>
    <CartesianGrid strokeDasharray="3 3" stroke="#eeece9" vertical={false} />
    <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#8a8a8a' }} axisLine={false} tickLine={false}
      interval={4} />  {/* Show every 5th label to avoid crowding */}
    <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11, fill: '#8a8a8a' }}
      axisLine={false} tickLine={false} width={54} />
    <Tooltip content={<ChartTooltip />} />
    <Area type="monotone" dataKey="income" name="Ingresos"
      stroke="#5a7a5a" strokeWidth={2}
      fill="url(#incomeGradient)" />
  </AreaChart>
</ResponsiveContainer>
```

Note: In Recharts, `<defs>` and `<linearGradient>` are imported from recharts as React components (they wrap SVG elements). The pattern `fill="url(#incomeGradient)"` references the gradient by ID.

### Pattern 6: Unified alert aggregator hook

```tsx
// hooks/use-dashboard-alerts.ts
export interface DashboardAlert {
  id: string
  severity: 'critical' | 'warning' | 'info'
  type: 'contract' | 'budget' | 'supplier' | 'purchase'
  message: string
  actionLabel: string
  actionPath: string
}

export function useDashboardAlerts() {
  const { data: contracts, loading: contractsLoading } = useContracts()
  const { data: suppliers, loading: suppliersLoading } = useSuppliers()
  const { alerts: purchaseAlerts, loading: purchasesLoading } = usePurchaseAlerts()
  // useBudgetComparison requires startDate/endDate — pass current month range
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  const { comparison, loading: budgetLoading } = useBudgetComparison(monthStart, monthEnd)

  const loading = contractsLoading || suppliersLoading || purchasesLoading || budgetLoading

  const alerts = useMemo<DashboardAlert[]>(() => {
    const result: DashboardAlert[] = []
    const now = new Date()
    const in30Days = new Date(now)
    in30Days.setDate(now.getDate() + 30)

    // Contracts expiring within 30 days
    contracts.forEach((c) => {
      if (!c.endDate) return
      const end = c.endDate.toDate()
      if (end > now && end <= in30Days) {
        const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        result.push({
          id: `contract-${c.id}`,
          severity: daysLeft <= 7 ? 'critical' : 'warning',
          type: 'contract',
          message: `Contrato de ${c.employeeName} vence en ${daysLeft} días`,
          actionLabel: 'Ver contrato',
          actionPath: `/contracts/${c.id}`,
        })
      }
    })

    // Budget exceeded (execution > 100%)
    comparison.rows
      .filter((r) => r.type === 'expense' && r.execution > 100 && r.budgeted > 0)
      .forEach((r) => {
        result.push({
          id: `budget-${r.category}`,
          severity: 'warning',
          type: 'budget',
          message: `Presupuesto "${r.category}" excedido: ${r.execution.toFixed(0)}% ejecutado`,
          actionLabel: 'Ver presupuesto',
          actionPath: '/finance/budget',
        })
      })

    // Expired suppliers
    suppliers
      .filter((s) => s.status === 'expired')
      .forEach((s) => {
        result.push({
          id: `supplier-${s.id}`,
          severity: 'warning',
          type: 'supplier',
          message: `Proveedor ${s.name} con contrato expirado`,
          actionLabel: 'Ver proveedor',
          actionPath: `/suppliers/${s.id}`,
        })
      })

    // Purchase price/consumption alerts
    purchaseAlerts.forEach((a, i) => {
      result.push({
        id: `purchase-${i}`,
        severity: a.severity === 'warning' ? 'warning' : 'info',
        type: 'purchase',
        message: `${a.productName}: ${a.message}`,
        actionLabel: 'Ver compras',
        actionPath: '/finance/purchases',
      })
    })

    // Sort: critical first, then warning, then info
    const severityOrder = { critical: 0, warning: 1, info: 2 }
    return result.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
  }, [contracts, suppliers, purchaseAlerts, comparison])

  return { alerts, loading }
}
```

### Pattern 7: Quick Actions grid

```tsx
// quick-actions.tsx
const ACTIONS = [
  { label: 'Nueva transacción', icon: PlusCircle, path: '/finance' },
  { label: 'Nuevo contrato',    icon: FileText,   path: '/contracts/new' },
  { label: 'Ver análisis',      icon: BarChart2,  path: '/analytics' },
  { label: 'Ver proveedores',   icon: Briefcase,  path: '/suppliers' },
  { label: 'Ver nómina',        icon: Users,      path: '/talent' },
]

export function QuickActions() {
  const navigate = useNavigate()
  return (
    <div className="bg-surface rounded-xl card-elevated p-5">
      <h2 className="text-subheading font-medium text-dark-graphite mb-4">Accesos Rápidos</h2>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        {ACTIONS.map(({ label, icon: Icon, path }) => (
          <button key={path} onClick={() => navigate(path)}
            className="flex flex-col items-center gap-2 p-3 rounded-xl bg-bone/50
                       hover:bg-bone transition-colors cursor-pointer text-center">
            <Icon size={20} strokeWidth={1.5} className="text-graphite" />
            <span className="text-[11px] text-mid-gray leading-tight">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
```

### Anti-Patterns to Avoid

- **Calling useAnalyticsKPIs() without DateRangeProvider in tree:** Throws "useDateRange must be used within DateRangeProvider". Wrapping DateRangeProvider inside DashboardPage is the fix.
- **Passing `undefined` dates to useBudgetComparison:** The hook requires `startDate` and `endDate` as direct arguments (not from context). Always pass hardcoded current-month range for the alerts aggregator.
- **XAxis tick density on 30-day chart:** 30 data points create unreadable overlapping labels. Use `interval={4}` or `interval="preserveStartEnd"` on the XAxis.
- **Not seeding zero-value days in dailyData:** Without seeding all 30 days, days with no transactions create gaps in the AreaChart line. Always build the full day map first, then fill from transactions.
- **Rendering DashboardPage when no company selected:** useAnalyticsKPIs and useContracts use useCollection which reads from the selected company's Firestore subcollection. Rendering without a selected company returns empty data, not an error, but gives a misleading "no data" state. Guard with `if (!selectedCompany) return <MultiCompanyView />`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Count-up animation | Custom number animation | `KPICard` (built-in useCountUp) | Already implemented with cubic easing |
| Chart tooltips | Custom positioned tooltips | `ChartTooltip` pattern from general-dashboard.tsx | Correct styling, formatCurrency integration |
| Loading spinners | Custom spinner | `animate-pulse` text (project pattern) | Consistent with rest of app |
| Date range for KPIs | Custom date math | `DateRangeProvider` + `useDateRange()` | Provider is already wired — just need to add to /home |
| Severity badge | Custom colored pill | `StatusBadge` with `variant="expired"/"pending"/"active"` | Already has critical/warning/info-appropriate variants |
| Empty chart state | Custom no-data UI | `EmptyState` component from `src/core/ui/empty-state.tsx` | Correct sizing, typography, icon pattern |

---

## Common Pitfalls

### Pitfall 1: DateRangeProvider Missing
**What goes wrong:** `useAnalyticsKPIs()` calls `useDateRange()` which throws "useDateRange must be used within DateRangeProvider". The entire home route crashes.
**Why it happens:** The `/home` route in App.tsx is NOT inside the `DateRangeProvider` wrapper group (unlike `/analytics` and `/finance` which are).
**How to avoid:** Wrap `<DateRangeProvider>` inside `DashboardPage`'s return, as the outermost element, so it doesn't require App.tsx changes.
**Warning signs:** Console error during development when navigating to `/home` with `selectedCompany` set.

### Pitfall 2: useBudgetComparison date argument scope
**What goes wrong:** `useBudgetComparison` in `finance/hooks.ts` does NOT read from DateRangeContext — it takes explicit `startDate` and `endDate` parameters. Calling it with wrong dates (or stale dates from a closure) gives incorrect budget data.
**Why it happens:** Unlike `useAnalyticsKPIs`, `useBudgetComparison` is a parameterized hook.
**How to avoid:** In `useDashboardAlerts`, compute `monthStart`/`monthEnd` outside `useMemo` (at render time) and pass them directly. These are stable values for "current month" alerts.

### Pitfall 3: XAxis label overlap on 30-day chart
**What goes wrong:** 30 data points on a typical mobile viewport causes XAxis labels to overlap, making the chart unreadable.
**Why it happens:** Default XAxis renders every tick. 30 ticks at ~10px each exceeds most phone screen widths.
**How to avoid:** Use `interval={4}` on XAxis (show every 5th label) or `interval="preserveStartEnd"` to show first and last. Alternatively, use shorter label format (`"dd/MM"` instead of `"dd Mmm"`).

### Pitfall 4: Stale contract/supplier data alerting
**What goes wrong:** If `useContracts()` or `useSuppliers()` returns empty while Firestore loads, the alerts section shows "0 alertas" momentarily before populating.
**Why it happens:** Data hooks load asynchronously. The loading state from `useDashboardAlerts` solves this — guard the render.
**How to avoid:** Show a skeleton/spinner in `AlertsSection` while `loading === true`. Never render "0 alertas" while any sub-hook is still loading.

### Pitfall 5: `defs`/`linearGradient` import from recharts
**What goes wrong:** In Recharts v3, SVG `<defs>` and `<linearGradient>` are NOT exported from the recharts package. They must be used as raw lowercase JSX (`<defs>`, `<linearGradient>`, `<stop>`) inside the chart SVG scope — Recharts passes them through to the underlying SVG.
**Why it happens:** Developers unfamiliar with Recharts try to import these from recharts.
**How to avoid:** Write `<defs>`, `<linearGradient>`, `<stop>` as standard lowercase JSX elements inside `<AreaChart>`. They render as native SVG.

---

## Code Examples

### AreaChart with gradient (verified pattern for Recharts v3)
```tsx
// Source: Recharts docs pattern — SVG defs in lowercase JSX
<AreaChart data={dailyData}>
  <defs>
    <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%" stopColor="#5a7a5a" stopOpacity={0.3} />
      <stop offset="95%" stopColor="#5a7a5a" stopOpacity={0} />
    </linearGradient>
  </defs>
  <Area
    type="monotone"
    dataKey="income"
    stroke="#5a7a5a"
    strokeWidth={2}
    fill="url(#incomeGradient)"
    dot={false}
  />
</AreaChart>
```

### KPICard usage (verified from kpi-card.tsx interface)
```tsx
// Source: src/core/ui/kpi-card.tsx
<KPICard
  label="Ingresos del Mes"
  value={kpis.totalIncome}
  format="currency"
  change={kpis.incomeChange}        // string like "+12.5%"
  trend={kpis.incomeChange.startsWith('+') ? 'up' : 'down'}
  icon={TrendingUp}
/>
```

### pendingNet from useCompanySummaries (D-06 KPI)
```tsx
// Source: src/modules/home/hooks.ts — CompanySummary type
// useAnalyticsKPIs does NOT expose pendingNet.
// pendingNet comes from useCompanySummaries() for the selected company.
const { summaries } = useCompanySummaries()
const currentSummary = summaries.find(s => s.company.id === selectedCompany?.id)
const pendingNet = currentSummary?.pendingNet ?? 0
```

Note: `useAnalyticsKPIs()` provides `totalIncome`, `totalExpenses`, `netProfit`, `profitMargin` with change strings. `pendingNet` requires `useCompanySummaries()` — it is NOT in the analytics hook. The KPI section needs BOTH hooks.

### StatusBadge for alerts (verified from status-badge.tsx)
```tsx
// Source: src/core/ui/status-badge.tsx
// For 'critical' severity alerts — use 'expired' variant (red)
<StatusBadge variant="expired" label="Crítico" />
// For 'warning' severity — use 'pending' variant (amber)
<StatusBadge variant="pending" label="Advertencia" />
// For 'info' severity — use 'info' variant (blue)
<StatusBadge variant="info" label="Info" />
```

### staggerContainer / staggerItem usage (verified from variants.ts)
```tsx
// Source: src/core/animations/variants.ts
// staggerContainer does NOT define initial — it only defines animate.transition.staggerChildren
// staggerItem defines initial: { opacity: 0, y: 4 } and animate: { opacity: 1, y: 0 }
// Must pass initial="initial" animate="animate" to the container
<motion.div
  variants={staggerContainer}
  initial="initial"
  animate="animate"
  className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4"
>
  <KPICard ... />  {/* KPICard already wraps itself in motion.div variants={staggerItem} */}
</motion.div>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Page-level loading gate (wait all data) | Per-section independent loading (D-04) | This phase | Each section loads independently, no full-page spinner |
| Home shows all companies unconditionally | Home conditionally branches on selectedCompany | This phase | Single-company dashboard vs multi-company grid |

---

## Open Questions

1. **pendingNet KPI format for negative values**
   - What we know: `pendingNet` from `CompanySummary` can be negative (pending expenses > pending income). KPICard uses `format="currency"` which calls `formatCurrency(animatedValue)` — `animatedValue` is from `useCountUp(value)` which starts at 0 and animates to `value`. If value is negative, `useCountUp` will show 0 → negative which is unusual.
   - What's unclear: Should pendingNet show as "Cuentas por Cobrar" (assuming positive) or handle negative case?
   - Recommendation: Show pendingNet with a conditional trend: `trend={pendingNet >= 0 ? 'up' : 'down'}`. Accept the count-up animating through negative range — it's cosmetic.

2. **DateRangeProvider default for dashboard KPIs**
   - What we know: `useAnalyticsKPIs()` reads from DateRangeContext, which defaults to `'thisMonth'` range in `DateRangeProvider`. The home dashboard's intent is "current month" KPIs (D-06 says "Ingresos del mes").
   - What's unclear: Should the dashboard expose a date picker, or hardcode "this month"?
   - Recommendation: Add `DateRangeProvider` internally, let it default to `thisMonth`. No date picker exposed on the dashboard — it is a single-period executive summary, not an analytics explorer.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — all tooling is in-repo, Node/npm already in use, Firebase already connected).

---

## Validation Architecture

`workflow.nyquist_validation` is absent from `.planning/config.json` — treating as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — no test config files found in repo |
| Config file | None |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements → Test Map

No formal requirement IDs were provided for this phase. Behavioral verification is manual:

| Behavior | Test Type | How to Verify |
|----------|-----------|---------------|
| KPIs render with correct values | Manual smoke | Open /home with selected company, compare values to /analytics |
| AreaChart shows 30 days with no gaps | Manual visual | Inspect chart renders contiguous line even on days with 0 income |
| Alerts list correct severity order | Manual | Add test data: expired supplier + expiring contract, verify critical appears first |
| Quick actions navigate correctly | Manual | Click each button, verify route |
| Multi-company fallback still works | Manual | Deselect company (if possible) or navigate as user with no selection |
| No crash without DateRangeProvider | Dev tools | Open browser console, no "useDateRange" errors |

### Wave 0 Gaps
- No test framework is installed. Since the project has no test infrastructure at all, and no test requirement IDs were provided, no test setup is required for this phase. Verification is manual.

---

## Sources

### Primary (HIGH confidence)
- Direct source code audit: `src/core/ui/kpi-card.tsx` — KPICard interface and props
- Direct source code audit: `src/modules/analytics/components/general-dashboard.tsx` — ChartTooltip pattern, stagger usage
- Direct source code audit: `src/modules/analytics/hooks.ts` — useAnalyticsKPIs signature and DateRange dependency
- Direct source code audit: `src/modules/finance/hooks.ts` — useBudgetComparison signature (explicit date params, not context)
- Direct source code audit: `src/modules/finance/context/date-range-context.tsx` — DateRangeProvider default preset
- Direct source code audit: `src/App.tsx` — confirmed /home route NOT wrapped in DateRangeProvider
- Direct source code audit: `src/modules/purchases/hooks.ts` — usePurchaseAlerts return type: `{ alerts: PurchaseAlert[], loading }`
- Direct source code audit: `src/modules/contracts/types.ts` — Contract.endDate is `Timestamp | undefined`
- Direct source code audit: `src/modules/suppliers/types.ts` — Supplier.status is SupplierStatus
- Direct source code audit: `src/core/animations/variants.ts` — staggerContainer does not define `initial`, staggerItem does
- Direct source code audit: `package.json` — recharts 3.8.0, framer-motion 12.38.0 confirmed installed

### Secondary (MEDIUM confidence)
- Recharts documentation pattern: `<defs>/<linearGradient>/<stop>` as lowercase JSX inside chart components — standard SVG-in-React approach, consistent with Recharts rendering model

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies verified from package.json and source
- Architecture: HIGH — patterns verified from reading actual source files, no assumptions
- Pitfalls: HIGH — DateRangeProvider gap verified from App.tsx source; other pitfalls from direct code inspection
- Data shapes: HIGH — all hook return types verified by reading hook implementations

**Research date:** 2026-03-29
**Valid until:** 2026-04-29 (stable — no external dependencies to go stale)
