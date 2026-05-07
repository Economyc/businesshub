# BusinessHub Milestones

Historial de releases del producto.

## v1 — Core Business Management Platform

**Status:** En progreso (parcial; foundational shipped, dashboard widget pendiente)
**Started:** 2026-03-29

**Shipped:**
- Sistema RBAC con `CompanyMember` + `RoleDefinition` por `ModuleKey`
- Multi-tenant (`CompanyProvider` + `useCompany()`)
- 16 módulos aislados (closings, finance, cartera, payroll, contracts, partners, talent, suppliers, marketing, agent, analytics, home, notifications, pos-sync, prestaciones, purchases)
- POS sync multi-tenant con reconcile, chunking 31 días, stamp empty
- Agente AI con observabilidad Langfuse, threads persistentes, RAG
- Design System monocromático cálido (`DESIGN_SYSTEM.md`)
- Command Palette con búsqueda global (Ctrl+K) — 2026-03-29

**Pending phases (deferred to backlog):**
- Phase 1: Dashboard Home Inteligente — KPIs en tiempo real, gráfica de tendencia, alertas, accesos rápidos

## v2 — Operación de Punto

**Status:** Defining requirements
**Started:** 2026-05-06

**Goal:** Habilitar a Administradores de Punto y Cajeros para que entren a la app y vean una shell simplificada con sólo los módulos operativos de su sede, con un nuevo módulo de Descuentos integrado.

**Target features:**
- Modelo de sede (`branchId`) en `CompanyMember` + colección `branches`
- 2 roles nuevos: `branch_admin`, `cashier`
- `OperationsLayout` responsive (mobile/tablet/desktop)
- Routing guard con redirect a `/ops` para roles de sede
- Cierres adaptado a scope por sede
- Módulo Descuentos nuevo con beneficiario, pedido # POS, aprobador
- Settings de Sedes (CRUD + asignación de usuarios)

---
*Última actualización: 2026-05-06 al iniciar v2*
