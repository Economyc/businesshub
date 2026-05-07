# BusinessHub

## What This Is

Plataforma interna multi-tenant de Bukz para administración financiera y operativa de sus negocios en Colombia. Hoy cubre cierres de caja, finanzas, cartera, payroll, contratos, partners, suppliers, marketing, agente AI y POS sync. Próximo paso: habilitar acceso operativo restringido para administradores y cajeros de cada sede.

## Core Value

Que el equipo administrativo central y el equipo operativo de cada sede trabajen sobre la misma fuente de verdad, cada uno viendo sólo lo que necesita para su rol.

## Current Milestone: v2 Operación de Punto

**Goal:** Habilitar a Administradores de Punto y Cajeros para que entren a la app y vean una shell simplificada con sólo los módulos operativos de su sede, con un nuevo módulo de Descuentos integrado.

**Target features:**
- Modelo de sede (`branchId`) con asignación de usuarios por sede
- 2 roles de sistema nuevos: `branch_admin` y `cashier`
- `OperationsLayout` responsive (mobile/tablet/desktop) paralelo al `AppLayout` administrativo
- Routing guard que redirige roles de sede a `/ops` y bloquea rutas administrativas
- Módulo Cierres adaptado a scope por sede (manteniendo visual actual)
- Módulo Descuentos nuevo con beneficiario, pedido # POS y aprobador
- UI mínima en Settings para crear sedes y asignar usuarios

## Requirements

### Validated

<!-- Shipped y confirmado valioso. -->

- ✓ Sistema RBAC con `CompanyMember` + `RoleDefinition` por `ModuleKey` — v1
- ✓ Multi-tenant vía `CompanyProvider` + `useCompany()` — v1
- ✓ 16 módulos aislados con lazy loading (`agent`, `analytics`, `cartera`, `closings`, `contracts`, `finance`, `home`, `marketing`, `notifications`, `partners`, `payroll`, `pos-sync`, `prestaciones`, `purchases`, `suppliers`, `talent`) — v1
- ✓ POS sync multi-tenant con reconcile y chunking 31 días — v1
- ✓ Design System monocromático cálido con tokens en `src/index.css` — v1
- ✓ Agente AI con observabilidad Langfuse, threads, RAG — v1

### Active

<!-- Scope actual: milestone v2. -->

- [ ] Modelo de sede (`branches` por company, `branchId` opcional en `CompanyMember`)
- [ ] Roles `branch_admin` y `cashier` (sistema, no editables)
- [ ] `OperationsLayout` responsive con top-nav (Inicio · Cierres · Descuentos) y bottom-nav mobile
- [ ] Guard de routing: redirect a `/ops` para roles de sede, bloqueo de rutas administrativas
- [ ] Cierres adaptado a `branchId` (visual actual preservado)
- [ ] Módulo Descuentos con beneficiario, pedido # POS y aprobador
- [ ] Settings: gestión de sedes y asignación de usuarios

### Out of Scope

<!-- Boundaries explícitos. -->

- App nativa móvil — la PWA responsive cubre el caso de uso operativo
- Modo offline — operación de sede requiere conectividad (POS y Firestore en tiempo real)
- Reportes consolidados multi-sede en `/ops` — los corporativos los ven en módulos administrativos
- Permisos custom por usuario dentro de roles de sede — los roles `branch_admin`/`cashier` son fijos en v2
- Migración del `discount-tab.tsx` actual (dentro de Cierres) — los datos viejos se mantienen accesibles, pero el form vivo nuevo está en el módulo Descuentos

## Context

- **Stack actual:** Vite + React 18 + TypeScript + Tailwind v4 + shadcn + Firebase (Firestore, Functions, Auth) + TanStack Query + React Router v7. Proyecto Firebase: `empresas-bf`.
- **Multi-tenant:** scoping por `CompanyProvider`; añadir `branchId` extiende el modelo sin romper queries existentes (los corporativos siguen sin filtrar por sede).
- **Sedes activas hoy:** Filipo y Blue (2). El sistema debe permitir agregar más sin tocar código.
- **POS:** ya hay `posTenantId` por sede en `companies` + `pos-tenants.ts` (multi-tenant) — se reutiliza para vincular sede ↔ POS.
- **Mockup aprobado:** `Downloads/operations-layout.html` (3 pantallas × 3 viewports). Es la referencia visual del milestone.
- **Deploy:** frontend vía `/deploy-oracle` skill (Oracle Cloud), functions vía `gcloud functions deploy` (firebase-tools desaconsejado).

## Constraints

- **Tech stack:** Vite + React + Firebase. No migrar a Next.js, Supabase, MUI ni Chakra. Decisión cerrada.
- **Design System:** todo cambio UI respeta `DESIGN_SYSTEM.md` (escalas tipográficas fijas, tokens, sin sombras, sin gradientes). Ver sección 0 de `CLAUDE.md`.
- **Idioma:** UI en español, código e identificadores en inglés. Marca en UI siempre "BusinessHub" (nunca "Bukz").
- **Compatibilidad backwards:** usuarios corporativos existentes (sin `branchId` en su `CompanyMember`) siguen funcionando idénticos. La migración no rompe sesiones activas.
- **Dispositivos:** la shell de operación debe funcionar en celular (375px+), tablet (768px+) y computador (1280px+).

## Key Decisions

| Decisión | Racional | Outcome |
|----------|----------|---------|
| `branchId` opcional en `CompanyMember`, no requerido | No romper usuarios corporativos existentes; escalar progresivamente | — Pending |
| `branches` como subcolección de `companies` | Mantener consistencia con scoping por company; aislamiento natural | — Pending |
| Shell `/ops` como ruta paralela en la misma SPA, no app separada | Una SPA es más mantenible que dos que comparten Firebase | — Pending |
| Roles `branch_admin` y `cashier` fijos (`isSystem: true`) | v2 no necesita roles custom de sede; reduce complejidad | — Pending |
| Mockup HTML aprobado antes de planear fases | Evitar retrabajo en UX de shell crítica | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-06 after starting milestone v2 Operación de Punto*
