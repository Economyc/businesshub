# Project State

**Project:** BusinessHub
**Current milestone:** v2 Operación de Punto
**Last activity:** 2026-05-06 — Roadmap v2 created (4 phases)

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-06)

**Core value:** Que el equipo administrativo central y el equipo operativo de cada sede trabajen sobre la misma fuente de verdad, cada uno viendo sólo lo que necesita para su rol.
**Current focus:** Plan Phase 2 (Modelo de sede + RBAC + Settings)

## Current Position

- **Phase:** Phase 2 — Modelo de sede + RBAC + Settings (not started)
- **Plan:** —
- **Status:** Ready to plan Phase 2
- **Last activity:** 2026-05-06 — Roadmap v2 created (4 phases)

## Roadmap snapshot

| Phase | Goal | Reqs |
|-------|------|------|
| 2. Modelo de sede + RBAC + Settings | Admin corporativo modela sedes y asigna usuarios con nuevos roles | 10 |
| 3. OperationsLayout + Routing guards | Roles de sede aterrizan en `/ops` con shell propia | 9 |
| 4. Cierres por sede | Cierres con scope automático por `branchId` en `/ops` | 4 |
| 5. Módulo Descuentos | Módulo nuevo de descuentos con beneficiario, pedido POS, aprobador | 7 |

**Coverage:** 30/30 requirements mapeados ✓

## Blockers/Concerns

None.

## Accumulated Context

### Milestone v1 (en progreso, parcial)

- 16 módulos shipped: agent, analytics, cartera, closings, contracts, finance, home, marketing, notifications, partners, payroll, pos-sync, prestaciones, purchases, suppliers, talent
- RBAC + multi-tenant + Design System + Agente AI con Langfuse + POS sync multi-tenant operativos
- Phase 1 (Dashboard Home Inteligente) pendiente — diferida al backlog. Por eso v2 arranca en Phase 2.

### Decisiones clave registradas en roadmap v2

- `branchId` opcional en `CompanyMember` para no romper corporativos existentes.
- `branches` como subcolección de `companies` (consistencia con scoping por company).
- Shell `/ops` como ruta paralela en la misma SPA (no app separada).
- Roles `branch_admin` y `cashier` fijos (`isSystem: true`).
- Mockup HTML (`Downloads/operations-layout.html`) aprobado como referencia visual de Phases 3-5.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260329-les | Command Palette con busqueda global Ctrl+K | 2026-03-29 | pending | [260329-les-implementar-command-palette-con-busqueda](./quick/260329-les-implementar-command-palette-con-busqueda/) |

## Session Continuity

**Next step:** `/gsd:plan-phase 2` para descomponer Phase 2 en plans ejecutables.
