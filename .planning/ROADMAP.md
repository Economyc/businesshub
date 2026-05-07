# Roadmap: BusinessHub — Milestone v2 Operación de Punto

**Created:** 2026-05-06
**Milestone:** v2 Operación de Punto
**Granularity:** standard (4 phases)
**Coverage:** 30/30 requirements mapeados ✓

## Resumen ejecutivo

v2 entrega la Operación de Punto en 4 fases que respetan dependencias estrictas:

1. **Foundation primero** (Phase 2) — sin modelo de sede ni roles, nada del resto compila.
2. **Shell vacía después** (Phase 3) — `/ops` con layout y guards, sin módulos funcionales aún. Demuestra el flujo de acceso restringido.
3. **Cierres en sede** (Phase 4) — primer módulo operativo real con scope por `branchId`. Validamos que el modelo de Phase 2 funciona en producción contra datos vivos.
4. **Descuentos** (Phase 5) — módulo nuevo end-to-end, cierra el milestone.

Cada fase es entregable independiente: al terminarla hay valor demostrable y deployable, aunque el milestone no esté completo.

## Phases

- [ ] **Phase 2: Modelo de sede + RBAC + Settings** — Admin corporativo puede crear sedes, asignar usuarios y los nuevos roles existen en el sistema.
- [ ] **Phase 3: OperationsLayout + Routing guards** — Roles de sede entran a la app y aterrizan en `/ops` con shell propia, bloqueados de rutas administrativas.
- [ ] **Phase 4: Cierres por sede** — Cierres se crean y listan filtrados por la sede del usuario activo, manteniendo visual actual.
- [ ] **Phase 5: Módulo Descuentos** — Sedes registran descuentos con beneficiario, pedido # POS y aprobador; histórico viejo accesible.

## Phase Details

### Phase 2: Modelo de sede + RBAC + Settings
**Goal**: Admin corporativo puede modelar sedes y asignar usuarios con los nuevos roles de operación, sin que el resto del sistema (corporativos existentes) cambie de comportamiento.
**Depends on**: Nada (foundation del milestone).
**Requirements**: BRANCH-01, BRANCH-02, BRANCH-03, BRANCH-04, RBAC-01, RBAC-02, RBAC-03, SET-01, SET-02, SET-03 (10 reqs)
**Success Criteria** (qué tiene que ser cierto):
  1. Admin corporativo entra a `/settings`, ve la sección "Sedes", crea una sede nueva (nombre + dirección opcional + posTenantId opcional + flag activa) y la ve listada.
  2. Admin corporativo edita una sede existente y la activa/desactiva; los cambios persisten en `companies/{id}/branches/{branchId}`.
  3. Admin corporativo asigna a un usuario role `branch_admin` o `cashier` ligado a una sede específica desde la pantalla de team; el `CompanyMember` queda con `branchId` poblado.
  4. Usuarios corporativos existentes (sin `branchId` en su `CompanyMember`) siguen entrando a la app idénticos a hoy — no se rompe ninguna sesión activa ni query existente.
  5. Los roles `branch_admin` y `cashier` aparecen como roles de sistema (`isSystem: true`) en la UI de roles y no son editables ni eliminables.
**Plans**: TBD
**UI hint**: yes

### Phase 3: OperationsLayout + Routing guards
**Goal**: Un usuario con role de sede entra a la app y aterriza en una shell `/ops` propia, con header simple y navegación de 3 ítems, sin poder acceder a rutas administrativas.
**Depends on**: Phase 2 (necesita roles `branch_admin`/`cashier` y `branchId` en `CompanyMember` para que el guard tenga sobre qué decidir).
**Requirements**: OPS-01, OPS-02, OPS-03, OPS-04, OPS-05, OPS-06, RTE-01, RTE-02, RTE-03 (9 reqs)
**Success Criteria** (qué tiene que ser cierto):
  1. Al hacer login, un usuario con role `branch_admin` o `cashier` es redirigido automáticamente a `/ops` (no pasa por `/home`).
  2. Si un usuario de sede teclea manualmente una ruta administrativa (ej: `/finance`, `/settings`, `/payroll`), el guard lo devuelve a `/ops`.
  3. La shell `/ops` muestra header con logo + chip de sede + avatar; en desktop/tablet aparece top-nav con Inicio · Cierres · Descuentos; en mobile (≤768px) aparece bottom-nav fija con los mismos 3 ítems.
  4. La página `/ops` (Inicio) muestra sólo tarjetas de acceso a los módulos — sin KPIs, sin gráficas, sin datos de resumen — y se ve correcta en 375px, 768px y 1280px.
  5. Usuarios corporativos sin `branchId` siguen accediendo al `AppLayout` actual sin interferencia del nuevo guard.
  6. La shell pasa una revisión contra `DESIGN_SYSTEM.md`: cero shadows, cero gradientes, escalas tipográficas fijas, sólo tokens semánticos.
**Plans**: TBD
**UI hint**: yes

### Phase 4: Cierres por sede
**Goal**: El módulo Cierres funciona dentro de la shell `/ops` con scope automático por sede, manteniendo el visual actual aprobado, sin afectar la vista corporativa.
**Depends on**: Phase 2 (necesita `branchId` en `CompanyMember`) y Phase 3 (vive dentro del `OperationsLayout`).
**Requirements**: CLOS-01, CLOS-02, CLOS-03, CLOS-04 (4 reqs)
**Success Criteria** (qué tiene que ser cierto):
  1. Un Administrador de Punto entra a `/ops/closings`, crea un cierre nuevo y el documento queda persistido con el `branchId` de su sede asignada.
  2. El listado en `/ops/closings` sólo muestra cierres de la sede del usuario activo — un `branch_admin` de Filipo no ve cierres de Blue.
  3. Cierres antiguos sin `branchId` siguen apareciendo en el módulo administrativo `/closings` para roles corporativos, sin pérdidas ni duplicación.
  4. La UI de Cierres en `/ops` replica el visual actual: tabs (Nuevo Cierre / Historial), cards mobile con grid 2×2 + badge oscuro de fecha, tabla desktop con columnas Fecha · Venta Total · Efectivo · Datáfono · Propinas · Responsable.
**Plans**: TBD
**UI hint**: yes

### Phase 5: Módulo Descuentos
**Goal**: Sedes registran y consultan descuentos con beneficiario, pedido # POS y aprobador; el histórico del antiguo `discount-tab.tsx` queda accesible para corporativos.
**Depends on**: Phase 2 (necesita `branchId`) y Phase 3 (vive dentro del `OperationsLayout`). Independiente de Phase 4 — podría correr en paralelo si se quisiera.
**Requirements**: DISC-01, DISC-02, DISC-03, DISC-04, DISC-05, DISC-06, DISC-07 (7 reqs)
**Success Criteria** (qué tiene que ser cierto):
  1. Un usuario de sede entra a `/ops/discounts`, abre el form, registra un descuento con tipo (parcial / cortesía 100%), monto, fecha, motivo (Influencer / Socio / Empleado / Prueba de calidad / Otro), beneficiario, pedido # POS y aprobador — y el registro queda guardado con el `branchId` de su sede.
  2. El listado de descuentos filtra automáticamente por la sede del usuario activo y muestra fecha, badge de tipo, beneficiario, pedido, monto, motivo y aprobador (tabla en desktop, cards en mobile).
  3. Validaciones del form bloquean envío si falta beneficiario, pedido # o aprobador; la UI muestra el error de manera consistente con el Design System.
  4. Los datos históricos del `discount-tab.tsx` actual (dentro del módulo Cierres administrativo) siguen siendo consultables para roles corporativos — no se borran ni se migran.
  5. Al cerrar Phase 5, un usuario `branch_admin` puede ejecutar el ciclo completo del milestone: login → `/ops` → registrar cierre → registrar descuento, sin tocar el módulo administrativo.
**Plans**: TBD
**UI hint**: yes

## Dependencies

```
Phase 2 (Foundation)
   └── Phase 3 (Shell + Guards)
          ├── Phase 4 (Cierres por sede)
          └── Phase 5 (Descuentos)
```

- **Phase 2 → Phase 3**: el guard necesita roles y `branchId` para decidir redirects.
- **Phase 3 → Phase 4 y Phase 5**: ambos módulos viven dentro de `/ops`, requieren el layout y los guards instalados.
- **Phase 4 ⊥ Phase 5**: independientes entre sí. Orden recomendado: Phase 4 antes que Phase 5 porque adapta código existente (menor riesgo) y valida el modelo en producción antes de construir el módulo nuevo.

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 2. Modelo de sede + RBAC + Settings | 0/0 | Not started | — |
| 3. OperationsLayout + Routing guards | 0/0 | Not started | — |
| 4. Cierres por sede | 0/0 | Not started | — |
| 5. Módulo Descuentos | 0/0 | Not started | — |

## Coverage

- **Total v2 requirements:** 30
- **Mapped:** 30 (Phase 2: 10 · Phase 3: 9 · Phase 4: 4 · Phase 5: 7)
- **Unmapped:** 0 ✓
- **Duplicates:** 0 ✓

## Notes

- Phase 1 del milestone v1 (Dashboard Home Inteligente) sigue diferido al backlog — la numeración de v2 arranca en Phase 2 a propósito.
- El mockup HTML aprobado (`Downloads/operations-layout.html`, 3 pantallas × 3 viewports) es la referencia visual de Phase 3, Phase 4 y Phase 5.
- Cada fase es deployable de manera independiente. No es necesario completar el milestone para liberar valor: Phase 2 solita ya entrega "admin puede modelar sedes" aunque nadie de sede tenga acceso todavía.

---

## Apéndice — Milestone v1 (referencia histórica)

**Status:** En progreso (parcial; foundational shipped, dashboard widget pendiente)
**Started:** 2026-03-29

Phases del v1 todavía pendientes (diferidas al backlog tras priorización de v2):

- [ ] **Phase 1: Dashboard Home Inteligente** — Convertir el home básico en dashboard ejecutivo con KPIs en tiempo real, gráfica de tendencia (últimos 30 días con Recharts), alertas (vencimientos de contratos, presupuesto excedido, proveedores expirados) y accesos rápidos a acciones frecuentes. Diferido al backlog: se retomará después de v2.

---
*Roadmap created: 2026-05-06*
