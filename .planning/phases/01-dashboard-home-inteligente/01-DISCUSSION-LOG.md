# Phase 1: Dashboard Home Inteligente - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-29
**Phase:** 01-dashboard-home-inteligente
**Areas discussed:** Layout, Widgets, KPIs, Gráfica, Alertas, Accesos Rápidos
**Mode:** --auto (all decisions auto-selected)

---

## Layout del Dashboard

| Option | Description | Selected |
|--------|-------------|----------|
| Grid responsive con secciones fijas | Layout similar al analytics module existente | ✓ |
| Tabs por sección | Cada sección en un tab separado | |
| Single scroll con secciones colapsables | Acordeón vertical | |

**User's choice:** [auto] Grid responsive con secciones fijas (recommended default)
**Notes:** Patrón ya probado en analytics module, no requiere dependencias adicionales

---

## Sistema de Widgets

| Option | Description | Selected |
|--------|-------------|----------|
| Secciones predefinidas con CSS Grid | Layout fijo, responsive, sin dependencias extra | ✓ |
| Drag & drop con react-grid-layout | Widgets movibles y redimensionables | |
| Layout configurable via settings | Usuario elige orden en configuración | |

**User's choice:** [auto] Secciones predefinidas con CSS Grid (recommended default)
**Notes:** Drag & drop requiere react-grid-layout (~30KB), innecesario para MVP. Layout fijo es más mantenible.

---

## KPIs Principales

| Option | Description | Selected |
|--------|-------------|----------|
| 5 KPIs con KPICard existente | Ingresos, gastos, utilidad, margen, cuentas por cobrar | ✓ |
| 3 KPIs compactos | Solo ingresos, gastos, utilidad | |
| KPIs expandibles con detalle | Click para ver breakdown por categoría | |

**User's choice:** [auto] 5 KPIs con KPICard existente (recommended default)
**Notes:** Datos disponibles via useAnalyticsKPIs() y useCompanySummaries()

---

## Gráfica de Tendencia

| Option | Description | Selected |
|--------|-------------|----------|
| AreaChart con gradiente | Ingresos diarios últimos 30 días, visual y moderno | ✓ |
| LineChart simple | Línea de tendencia sin relleno | |
| BarChart diario | Barras por día, consistente con analytics | |

**User's choice:** [auto] AreaChart con gradiente (recommended default)
**Notes:** Recharts v3.8.0 ya instalado, AreaChart más visual para tendencia temporal

---

## Sistema de Alertas

| Option | Description | Selected |
|--------|-------------|----------|
| Sección inline con lista de alertas | Cards de alerta con severidad, inline en dashboard | ✓ |
| Panel lateral deslizable | Sidebar de notificaciones | |
| Toast notifications | Alertas como toasts temporales | |

**User's choice:** [auto] Sección inline con lista de alertas (recommended default)
**Notes:** Inline es más visible y no requiere estado de panel abierto/cerrado

---

## Claude's Discretion

- Animaciones de entrada stagger (framer-motion)
- Spacing y sizing de componentes
- Loading states (skeleton vs spinner)
- Orden de secciones en mobile

## Deferred Ideas

- Drag & drop widgets — fase futura
- Personalización de KPIs por usuario
- Notificaciones push
- Dashboard comparativo multi-empresa
