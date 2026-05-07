# Phase 2: Modelo de sede + RBAC + Settings - Context

**Gathered:** 2026-05-06
**Status:** Implementado en una sola sesión (fast-path "implementa y ya")

<domain>
## Phase Boundary

Foundation del milestone v2: agregar el modelo de `branches` a Firestore, dos roles de sistema (`branch_admin`, `cashier`) con `isSystem: true`, y la UI mínima en Settings para que el admin corporativo gestione sedes y asigne usuarios — sin romper el comportamiento de los corporativos existentes.

</domain>

<decisions>
## Implementation Decisions

### Modelo de datos

- **D-01:** `branches` como subcolección de `companies/{companyId}/branches/{branchId}`. ID auto-generado por Firestore (`addDoc`).
- **D-02:** Schema mínimo: `name` (req), `address?`, `posTenantId?`, `isActive` (bool), `createdAt`, `updatedAt`. Sin campos de timezone/locale (la app es Colombia-only).
- **D-03:** `branchId?: string` opcional en `CompanyMember`. Corporativos existentes (sin `branchId`) siguen funcionando idénticos — no hay migración destructiva.
- **D-04:** Reglas Firestore no se tocan: el wildcard existente `match /companies/{companyId}/{document=**}` ya cubre `branches/`.

### Roles y permisos

- **D-05:** `ModuleKey` añade `'discounts'` ahora (en Phase 2) para que el contrato de permisos esté completo de una vez. Esto evita reescribir DEFAULT_ROLES en Phase 5.
- **D-06:** `branch_admin`: full access a `closings` + `discounts` + read en `home`. `canManageUsers: false`, `canManageCompany: false`.
- **D-07:** `cashier`: `read` + `create` en `closings` y `discounts`, `read` en `home`. Sin update/delete (solo registra del día). Sin gestión.
- **D-08:** Ambos roles auto-seed via `DEFAULT_ROLES` en `permissions-service.ts`. Para empresas existentes (Blue, Filipo) que ya tienen roles seeded, `fetchRoles()` ahora hace **backfill aditivo**: detecta system roles faltantes y los crea sin tocar los existentes.

### UI en Settings

- **D-09:** Nueva ruta `/settings/branches` con su propio componente (`SettingsBranches`). Patrón: tabla + modal de crear/editar (estilo `settings-team-members` + `settings-team-invite`). Descartado `SettingsList` (categorías) porque branches tiene 4+ campos.
- **D-10:** Entrada "Sedes" agregada en `sidebar.tsx`, `mobile-nav.tsx`, `command-palette.tsx`, `prefetch.ts`. Icon: `MapPin`.
- **D-11:** Gate de gestión: `isAdmin` (owner/admin). Roles `branch_admin`/`cashier` no pueden crear sedes (consistente con `canManageCompany`).
- **D-12:** Form modal con campos: nombre (req), dirección (opt), posTenantId (opt, helper text que apunta a `pos-tenants.ts`), checkbox "Sede activa". Mismo modal sirve para crear y editar.
- **D-13:** Tabla muestra: icono MapPin + nombre + dirección, badge POS tenant, badge estado activa/inactiva, acciones (toggle activa, eliminar).

### Asignación branchId al usuario

- **D-14:** Modal de invitación (`SettingsTeamInvite`): campo "Sede asignada" aparece **solo cuando el role seleccionado es `branch_admin` o `cashier`**. Obligatorio en ese caso. Si no hay sedes activas, muestra mensaje de error y deshabilita el submit.
- **D-15:** Listado de miembros (`SettingsTeamMembers`): nueva columna "Sede" (visible en `lg:` y arriba). Para roles de sede muestra dropdown editable inline; para corporativos muestra "—".
- **D-16:** Si un member sin sede asignada tiene role de sede, se muestra "Sin asignar" en rojo (estado inválido visible).
- **D-17:** Cambiar de role corporativo a role de sede pre-llena con primera sede activa. Cambiar de role de sede a corporativo limpia el `branchId`.

### Claude's Discretion

- Iconografía exacta y micro-copy.
- Animaciones (heredadas de `modalVariants` y `PageTransition`).
- Manejo de estados loading (skeleton uniforme con bg-smoke).
- Sin tests automatizados (consistente con el patrón existente del proyecto: no hay test suite de UI).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design System
- `DESIGN_SYSTEM.md` — Tokens, escalas tipográficas, sin shadows/gradientes (sección 0 de CLAUDE.md)

### Tipos y servicios añadidos en esta phase
- `src/core/types/branch.ts` — `Branch`, `BRANCH_ROLE_IDS`, `isBranchRole()`
- `src/core/types/permissions.ts` — `CompanyMember.branchId`, `ModuleKey += 'discounts'`
- `src/core/services/branches-service.ts` — CRUD de branches
- `src/core/hooks/use-branches.ts` — `useBranches()` con `branches` y `activeBranches`
- `src/core/config/default-roles.ts` — `DEFAULT_ROLES` con branch_admin + cashier
- `src/core/services/permissions-service.ts` — `fetchRoles()` con backfill aditivo

### UI añadida/modificada
- `src/core/ui/settings-branches.tsx` — Página `/settings/branches` (tabla + modal)
- `src/core/ui/settings-team-invite.tsx` — Campo branchId condicional al rol
- `src/core/ui/settings-team-members.tsx` — Columna sede + edición inline

### Patrones reutilizados
- `src/core/ui/settings-team-members.tsx` — Patrón tabla con avatar/badge/estado
- `src/core/ui/settings-team-invite.tsx` — Patrón modal con framer-motion + validación
- `src/core/animations/variants.ts` — `modalVariants` para entrada/salida
- `src/core/firebase/helpers.ts` — `fetchCollection`, `createDocument` con createdAt/updatedAt

### POS tenant binding (futuro)
- `functions/src/pos-tenants.ts` — `TenantId` ('blue' | 'filipo'); `posTenantId` en branch debe coincidir

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **CompanyMember + RoleDefinition** types con `isSystem` ya soportados — solo se extiende.
- **`fetchRoles` con auto-seed** — extendido para backfill aditivo (compat con empresas existentes).
- **`createDocument`/`updateDocument` helpers** — escriben `createdAt`/`updatedAt` automáticamente.
- **Modal pattern** (`SettingsTeamInvite`) replicado para `BranchFormDialog`.
- **Inline edit dropdown** (role en members table) replicado para branchId.

### Established Patterns
- Forms con `useState` (no react-hook-form/zod).
- Errores inline (`text-negative-text`).
- Loading states con `bg-smoke animate-pulse`.
- Permisos vía `usePermissions().isAdmin`/`canManageUsers`.

### Integration Points
- Sidebar/mobile-nav/command-palette: agregar entrada "Sedes" con icon MapPin.
- App.tsx: nueva ruta dentro de `<PermissionRoute module="settings">`.
- Prefetch map: agregar `/settings/branches`.

</code_context>

<specifics>
## Specific Ideas

- Naming: "Sedes" en UI (no "Sucursales", no "Punto"). Consistente con PROJECT.md.
- `posTenantId` se valida solo a nivel de UI con un helper text — la validación dura es la del Cloud Function `resolveCompanyTenant` cuando se intente sincronizar POS desde esa sede.
- Eliminar una sede no migra los registros con ese `branchId` — quedan huérfanos pero accesibles. Dialog lo advierte explícitamente.
- "Sin asignar" para members con role de sede sin branchId se pinta en rojo: estado inválido visible para que el admin lo corrija.

</specifics>

<deferred>
## Deferred Ideas

- **Validación dura de posTenantId duplicado** entre sedes — solo aplicará cuando una company tenga >1 POS tenant; hoy es 1:1 y el helper text basta.
- **Migración masiva de members existentes** a `branchId` poblado — innecesario en v2 (corporativos no tienen sede; los nuevos roles se asignan al momento de la invitación).
- **Ver historial de cambios de sede** (auditoría de quién asignó/desasignó) — fuera de scope v2.
- **Selector de sede activa en el header** — el milestone explícitamente dice 1 usuario = 1 sede.
- **Sede default por POS tenant** (auto-crear sedes desde `pos-tenants.ts`) — manual en v2; reconsiderar si el catálogo de tenants crece.

</deferred>

---

*Phase: 02-modelo-de-sede-rbac-settings*
*Implementado: 2026-05-06 — fast path (sin agentes de research/planner)*
