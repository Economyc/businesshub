# Phase 1: Dashboard Home Inteligente - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Transformar la página Home existente (grid de tarjetas de empresa con KPIs básicos) en un dashboard ejecutivo con KPIs en tiempo real, gráfica de tendencia de ventas, alertas de negocio y accesos rápidos a acciones frecuentes. El dashboard debe funcionar cuando hay una empresa seleccionada — la vista multi-empresa actual se mantiene como fallback.

</domain>

<decisions>
## Implementation Decisions

### Layout del Dashboard
- **D-01:** Grid responsive con secciones fijas (no tabs, no drag-drop). Layout similar al analytics module: KPIs en row superior, gráfica y alertas en grid 2-columnas, accesos rápidos en footer.
- **D-02:** Mobile-first: stack vertical en mobile, 2 columnas en tablet, layout completo en desktop.

### Sistema de Widgets
- **D-03:** Secciones predefinidas con layout responsivo CSS Grid/Flexbox. NO usar react-grid-layout ni drag & drop para el MVP — complejidad innecesaria. Las secciones son: KPIs, Gráfica de Ventas, Alertas, Accesos Rápidos.
- **D-04:** Cada sección es un componente independiente con su propio hook de datos y loading state.

### KPIs Principales
- **D-05:** Reutilizar el componente KPICard existente (src/core/ui/kpi-card.tsx) con animación count-up.
- **D-06:** KPIs a mostrar: Ingresos del mes, Gastos del mes, Utilidad neta, Margen de ganancia, Cuentas por cobrar netas (pendingNet). Todos con indicador de cambio vs mes anterior.
- **D-07:** Fuente de datos: useAnalyticsKPIs() para KPIs con cambios pre-calculados + useCompanySummaries() para datos de empresa.

### Gráfica de Tendencia
- **D-08:** AreaChart con gradiente (Recharts) mostrando ingresos diarios de los últimos 30 días. Color verde consistente con el theme (#5a7a5a para ingresos).
- **D-09:** Reutilizar el patrón de ChartTooltip custom del analytics module (general-dashboard.tsx). ResponsiveContainer con altura fija.
- **D-10:** Fuente de datos: useTransactions() filtradas por últimos 30 días, agrupadas por día. Si no hay datos suficientes, mostrar empty state con mensaje.

### Sistema de Alertas
- **D-11:** Sección inline en el dashboard con lista de alertas ordenadas por severidad (critical → warning → info).
- **D-12:** Tipos de alertas: contratos por vencer (useContracts + filtro endDate < 30 días), presupuesto excedido (useBudgetComparison + ejecución > 100%), proveedores expirados (useSuppliers + status expired), alertas de compras (usePurchaseAlerts).
- **D-13:** Cada alerta muestra: ícono de severidad, mensaje descriptivo, badge de tipo, y link de acción para resolver.
- **D-14:** Máximo 5 alertas visibles con "Ver todas" si hay más.

### Accesos Rápidos
- **D-15:** Grid de botones/cards pequeños con ícono + label para acciones frecuentes: Nueva transacción, Nuevo contrato, Ver análisis, Ver proveedores, Ver nómina.
- **D-16:** Usar navigate() para cada acción, consistente con el patrón existente.

### Claude's Discretion
- Animaciones de entrada (stagger) — usar patrón existente de framer-motion
- Diseño exacto de spacing y sizing de componentes
- Manejo de estados de carga (skeleton vs spinner)
- Orden exacto de las secciones en mobile

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Componentes UI existentes
- `src/core/ui/kpi-card.tsx` — Componente KPICard con animación count-up y trend indicator
- `src/core/ui/page-transition.tsx` — Wrapper de animación fade-in
- `src/core/ui/page-header.tsx` — Header de página con slots de acción
- `src/core/ui/status-badge.tsx` — Badges de estado con variantes de color
- `src/core/ui/empty-state.tsx` — Componente para estados sin datos

### Hooks de datos
- `src/modules/home/hooks.ts` — useCompanySummaries() con CompanySummary type
- `src/modules/finance/hooks.ts` — useTransactions(), useFinanceSummary(), useBudgetComparison()
- `src/modules/analytics/hooks.ts` — useAnalyticsKPIs(), useMonthlyBreakdown(), useCategoryBreakdown()
- `src/modules/contracts/hooks.ts` — useContracts() con Contract type
- `src/modules/suppliers/hooks.ts` — useSuppliers() con Supplier type
- `src/modules/purchases/hooks.ts` — usePurchaseAlerts() con PurchaseAlert type

### Patrones de referencia
- `src/modules/analytics/components/general-dashboard.tsx` — Patrón de dashboard con KPIs + charts + tooltips custom
- `src/modules/home/components/home-page.tsx` — Página Home actual a reemplazar
- `src/core/utils/format.ts` — formatCurrency(), formatPercentChange()
- `src/core/animations/variants.ts` — staggerContainer, staggerItem

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **KPICard**: Componente listo con label, value, format, change, trend, icon — perfecto para los 5 KPIs
- **Recharts v3.8.0**: BarChart, PieChart, AreaChart, LineChart disponibles con ResponsiveContainer
- **ChartTooltip pattern**: Tooltip custom con formatCurrency ya implementado en general-dashboard
- **StatusBadge**: Variantes active/paid/pending/expired/overdue/inactive para alertas
- **framer-motion**: staggerContainer/staggerItem para animaciones de entrada
- **useDateRange**: Context de rango de fechas para filtrar datos

### Established Patterns
- **Data hooks**: Todos retornan { data, loading, error?, refetch } con caching integrado
- **Company context**: useCompany() para empresa seleccionada, datos filtrados por empresa
- **CSS**: Tailwind con clases custom (bg-surface, card-elevated, text-dark-graphite, etc.)
- **Animations**: motion.div con variants para stagger animations
- **Charts**: Colores #5a7a5a (income), #9a6a6a (expenses), barSize=18, radius=[4,4,0,0]

### Integration Points
- `src/modules/home/components/home-page.tsx` — Reemplazar/extender este componente
- Router: La ruta /home ya apunta a HomePage
- Sidebar: Link a Home ya existe
- Company context: Necesita empresa seleccionada para mostrar dashboard detallado

</code_context>

<specifics>
## Specific Ideas

- El dashboard debe ser el punto de entrada ejecutivo — un vistazo rápido al estado del negocio
- Mantener la vista multi-empresa como fallback cuando no hay empresa seleccionada
- Las alertas deben ser accionables (link directo a resolver el problema)
- Los KPIs deben mostrar cambio vs mes anterior para dar contexto

</specifics>

<deferred>
## Deferred Ideas

- Widgets configurables con drag & drop real — considerar para fase futura cuando se valide el layout fijo
- Personalización de qué KPIs mostrar por usuario
- Notificaciones push para alertas críticas
- Dashboard comparativo multi-empresa

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-dashboard-home-inteligente*
*Context gathered: 2026-03-29*
