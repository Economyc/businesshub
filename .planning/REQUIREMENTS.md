# Requirements: BusinessHub — Milestone v2 Operación de Punto

**Defined:** 2026-05-06
**Core Value:** Que el equipo administrativo central y el equipo operativo de cada sede trabajen sobre la misma fuente de verdad, cada uno viendo sólo lo que necesita para su rol.

## v2 Requirements

Requirements para el milestone v2. Cada uno mapea a una fase del roadmap.

### Sedes (BRANCH)

Modelo de datos de sede y gestión.

- [ ] **BRANCH-01**: Admin corporativo puede crear una sede en una company (nombre, dirección opcional, `posTenantId` opcional, flag activa)
- [ ] **BRANCH-02**: Admin corporativo puede editar y activar/desactivar una sede existente
- [ ] **BRANCH-03**: Sistema soporta colección `branches` como subcolección de `companies/{id}/branches/{branchId}`
- [ ] **BRANCH-04**: Sistema añade `branchId` opcional a `CompanyMember` sin romper usuarios corporativos existentes

### Roles & Permisos (RBAC)

Roles de sistema para operación de sede.

- [ ] **RBAC-01**: Sistema provee role `branch_admin` (Administrador de Punto) con permisos sobre `closings` y `discounts` dentro de su sede asignada
- [ ] **RBAC-02**: Sistema provee role `cashier` (Cajero) con permisos reducidos: lectura de cierres + escritura sobre apertura/cierre de caja del día, dentro de su sede
- [ ] **RBAC-03**: Roles `branch_admin` y `cashier` son `isSystem: true` (no editables ni eliminables desde Settings)

### Settings de Sede (SET)

UI para que admin corporativo gestione sedes y usuarios.

- [ ] **SET-01**: Admin corporativo ve sección "Sedes" en `/settings` con listado de sedes activas e inactivas
- [ ] **SET-02**: Admin corporativo puede crear/editar sede desde Settings (formulario con validación)
- [ ] **SET-03**: Admin corporativo puede asignar/desasignar un usuario a una sede con role `branch_admin` o `cashier` desde la pantalla de team

### Operations Layout (OPS)

Shell aislada para roles de sede.

- [ ] **OPS-01**: Usuario con role de sede ve shell `/ops` con header (logo + chip de sede + avatar) sin sidebar grande administrativo
- [ ] **OPS-02**: Top-nav en desktop y tablet muestra ítems: Inicio · Cierres · Descuentos
- [ ] **OPS-03**: Bottom-nav fija aparece en mobile con los mismos 3 ítems
- [ ] **OPS-04**: Página `/ops` (Inicio) muestra sólo tarjetas que llevan a los módulos, sin KPIs ni datos de resumen
- [ ] **OPS-05**: Layout funciona correctamente en celular (375px), tablet (768px) y desktop (1280px+)
- [ ] **OPS-06**: Layout respeta `DESIGN_SYSTEM.md` (sin shadows, sin gradientes, escalas tipográficas fijas, tokens semánticos)

### Routing & Guards (RTE)

Control de acceso por role.

- [ ] **RTE-01**: Al login exitoso, usuario con role `branch_admin` o `cashier` se redirige automáticamente a `/ops` (no a `/home`)
- [ ] **RTE-02**: Usuario con role de sede que intente acceder a una ruta administrativa (ej: `/finance`, `/settings/team`) es redirigido a `/ops`
- [ ] **RTE-03**: Usuarios corporativos (sin `branchId`) siguen accediendo al `AppLayout` actual sin cambios de comportamiento

### Cierres adaptado (CLOS)

Módulo de cierres con scope por sede.

- [ ] **CLOS-01**: Cierres creados desde `/ops` se guardan con el `branchId` de la sede del usuario
- [ ] **CLOS-02**: Listado de cierres en `/ops/closings` filtra automáticamente por la sede del usuario activo
- [ ] **CLOS-03**: Cierres existentes sin `branchId` siguen visibles en el módulo administrativo (`/closings`) para roles corporativos
- [ ] **CLOS-04**: Visual del módulo Cierres en `/ops` replica el actual: tabs (Nuevo Cierre / Historial), cards mobile con grid 2×2 + badge oscuro de fecha, tabla desktop con columnas (Fecha, Venta Total, Efectivo, Datáfono, Propinas, Responsable)

### Descuentos (DISC)

Módulo nuevo para tracking de descuentos.

- [ ] **DISC-01**: Usuario puede registrar un descuento con tipo (`parcial` o `cortesía 100%`), monto, fecha y motivo (Influencer / Socio / Empleado / Prueba de calidad / Otro)
- [ ] **DISC-02**: Form de descuento incluye campo `beneficiario` (texto libre con el nombre/handle del influencer, socio, empleado, etc.)
- [ ] **DISC-03**: Form de descuento incluye campo `pedido #` (referencia al ticket POS, ej: `POS-08421`)
- [ ] **DISC-04**: Form de descuento incluye campo `aprobado por` (nombre de la persona que autorizó)
- [ ] **DISC-05**: Listado de descuentos muestra fecha, badge de tipo, beneficiario, pedido, monto, motivo y aprobador (tabla en desktop, cards en mobile)
- [ ] **DISC-06**: Listado filtra automáticamente por la sede del usuario activo
- [ ] **DISC-07**: Datos del `discount-tab.tsx` actual (dentro del módulo Cierres) quedan accesibles tras la migración — no se pierden registros históricos

## Future Requirements

Diferidos a milestones posteriores.

### Operación de Punto v3 (futuro)

- **OPS-07**: Módulo Caja con apertura/cierre de turno, conteo de efectivo, registro de retiros
- **OPS-08**: Módulo Reportes diarios de sede (ventas por hora, productos más vendidos)
- **OPS-09**: Notificaciones push para roles de sede (alertas de cierre pendiente, retraso de POS)
- **DISC-08**: Workflow de aprobación in-app — solicitud del cajero, aprobación del admin de punto vía notificación
- **DISC-09**: Reporte mensual consolidado de descuentos por sede para roles corporativos

## Out of Scope

Excluidos explícitamente.

| Feature | Razón |
|---------|-------|
| App nativa móvil | PWA responsive cubre el caso operativo; costo de mantener dos plataformas no se justifica en v2 |
| Modo offline | Operación de sede requiere POS + Firestore en tiempo real; offline rompería integridad de datos |
| Reportes multi-sede en `/ops` | Los reportes consolidados son responsabilidad de roles corporativos en `/analytics` |
| Permisos custom por usuario en roles de sede | v2 usa roles fijos `branch_admin` y `cashier`; granularidad custom se evalúa cuando haya casos reales |
| Migrar el `discount-tab.tsx` actual a la nueva colección | El histórico se mantiene accesible; v2 sólo escribe nuevos registros en la colección nueva |
| Selector de sede en el header de `/ops` | Usuario está atado a UNA sede; cambiar de sede requiere reasignación por admin corporativo |

## Traceability

Cobertura de requirements por fase. Se completa al crear el roadmap.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BRANCH-01 | TBD | Pending |
| BRANCH-02 | TBD | Pending |
| BRANCH-03 | TBD | Pending |
| BRANCH-04 | TBD | Pending |
| RBAC-01 | TBD | Pending |
| RBAC-02 | TBD | Pending |
| RBAC-03 | TBD | Pending |
| SET-01 | TBD | Pending |
| SET-02 | TBD | Pending |
| SET-03 | TBD | Pending |
| OPS-01 | TBD | Pending |
| OPS-02 | TBD | Pending |
| OPS-03 | TBD | Pending |
| OPS-04 | TBD | Pending |
| OPS-05 | TBD | Pending |
| OPS-06 | TBD | Pending |
| RTE-01 | TBD | Pending |
| RTE-02 | TBD | Pending |
| RTE-03 | TBD | Pending |
| CLOS-01 | TBD | Pending |
| CLOS-02 | TBD | Pending |
| CLOS-03 | TBD | Pending |
| CLOS-04 | TBD | Pending |
| DISC-01 | TBD | Pending |
| DISC-02 | TBD | Pending |
| DISC-03 | TBD | Pending |
| DISC-04 | TBD | Pending |
| DISC-05 | TBD | Pending |
| DISC-06 | TBD | Pending |
| DISC-07 | TBD | Pending |

**Coverage:**
- v2 requirements: 30 total
- Mapped to phases: 0 (pending roadmap)
- Unmapped: 30 ⚠️

---
*Requirements defined: 2026-05-06*
*Last updated: 2026-05-06 after initial definition*
