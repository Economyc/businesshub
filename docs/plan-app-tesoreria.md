# App de Facturación / Tesorería (nueva, externa a BusinessHub)

## Context

Hoy la "facturación" de BusinessHub vive como **una sola colección** `companies/{id}/transactions`: una factura es una `Transaction` con `documentKind='invoice'`. El módulo finance ya cubre bien Cuentas por Pagar (factura a crédito → `status='pending'` + `dueDate` + `payeeRef` + alertas de vencimiento), recurrentes (costos fijos), nómina con devengo, y exporta una **hoja contable mensual a Google Drive** vía 3 Cloud Functions.

Faltan piezas que el negocio (y el contador) necesitan y que **no existen** hoy:
- **Cuentas bancarias propias con saldo** (hoy solo hay "métodos de pago" como texto y extractos sueltos).
- **Traslados** entre cuentas propias (A→B), neutrales al P&L, clave para conciliación bancaria.
- **Cuentas por Cobrar formales** (hoy solo Rappi entra como income pendiente; se quiere algo nuevo, Rappi se descarta).
- **Operaciones entre locales con contraparte recíproca** (préstamo/traslado Manila↔Escondite registrado y neteable en ambos lados). Lo más parecido hoy es `split-service.ts`, que solo reparte gastos sin contraparte.

**Decisión del usuario:** construir una **app aparte**, con **otro design system (shadcn, preset propio)**, que **opera sobre el mismo Firebase `empresas-bf` y la misma colección `transactions`** (fuente única, cero migración), agregando colecciones nuevas (`accounts`, `transfers`, `customers`). La app nueva **reemplaza gradualmente** el finance de BusinessHub. Hosting estilo App2-admin (Hetzner/Coolify) con dominio propio. Quiere **todas** las capacidades; aquí se fasea por orden de construcción, no se recorta alcance.

## Principio rector

**Una sola verdad contable.** Toda capacidad nueva o (a) **extiende `transactions`** con campos discriminadores para que P&L/Flujo la recojan sin reescribir lógica, o (b) vive en una **colección nueva explícitamente neutral al P&L** (`accounts`, `transfers`). Nunca se duplica el modelo de transacciones.

---

## Arquitectura

### Plataforma multi-módulo (no es solo facturación)
La app nueva es una **plataforma** que hospedará varios módulos; **Facturación es el primero**. Más adelante se sumará **Recursos Humanos** (fuera de alcance ahora — no diseñar nada de RR.HH. todavía).

**Sidebar = réplica completa de App1.** Portar `src/core/ui/sidebar.tsx` + `src/core/config/navigation.ts` + `access-registry.ts` y replicar TODO su comportamiento, con **una sola excepción: quitar el command palette** (el usuario no lo usa). Lo que se conserva de App1:
- **Company switcher** arriba (cambiar de local con logo + check).
- **Opener + sub-panel deslizable:** al hacer clic en un módulo (Facturación) se desliza un segundo panel con sus páginas (`sidebar.tsx:555`). Patrón idéntico al sub-panel de Contabilidad de App1.
- **Fijar / auto-ocultar** (lock toggle persistido en localStorage), **auto-expandir** la sección activa al navegar, **barra inferior** (notificaciones, tema claro/oscuro, menú de usuario) y **drawer en mobile** (`MobileNav`).
- Visibilidad por permisos vía `usePermissions` + `canAccessPage`.

**Estructura de navegación (mapeada al patrón de App1):**
- **Nivel 1 — módulos:** Facturación (hoy) · Recursos Humanos (futuro, opener vacío reservado).
- **Nivel 2 — sub-panel de Facturación:** Cuentas por Pagar · Cuentas por Cobrar · Traslados · Cuentas · Hojas/Drive · Consolidado.
- **Segmentos in-page (no en el sidebar):** igual que las tabs de Nómina en App1 (`finance.payroll.*`), Cuentas por Pagar tiene tabs **Proveedores · Entre locales · Costos fijos**; Cuentas por Cobrar tiene **Clientes · Entre locales**.
- **No existe un módulo "Entre Locales"** ni "Costos fijos": son tabs dentro de CxP/CxC.
- Routing de dos niveles: `/facturacion/por-pagar`, `/facturacion/por-cobrar`, etc., con las tabs como sub-ruta o estado. El opener deja espacio a `/rrhh/*` después.

### Stack y repo
- **Repo nuevo independiente** (patrón App2-admin), no monorepo. Stack: **Vite + React 18 + TS strict + React Router v7 + Tailwind v4 + shadcn** con el **preset `b1VlIzU8`** como tema base (su propio `DESIGN_SYSTEM.md`, distinto al plano bone/graphite de BusinessHub).
- **Deploy:** git push a `main` + rebuild Coolify a mano (igual que businessadm). Dominio nuevo a definir.
- **Backend:** **se reusa `empresas-bf` tal cual.** Mismo Firebase Auth (mismos usuarios), mismas `companies`/`members`. Las 3 Cloud Functions de Drive (`saveInvoiceSheetToDrive`, `markSheetJobDirty`, `dispatchSheetJobs`) **no se tocan en F1**: la app nueva llama a las mismas callables. Las functions siguen viviendo en el repo BusinessHub y se deployan con `gcloud` (ver memorias).

### Reuso de código (copiar, no compartir paquete)
Copiar/portar al repo nuevo el mínimo núcleo (es código estable y pequeño):
- `src/core/firebase/helpers.ts` — `companyCollection()`/`companyDoc()` y `ROOT_COLLECTIONS` (chokepoint multi-tenant). **Crítico:** todo va por aquí.
- Tipos: `src/modules/finance/types.ts`, `types-bank.ts`, `core/types/index.ts` (`Company`, `Transaction`, `PayeeRef`...).
- `CompanyProvider`/`useCompany` (`src/core/ui/company-provider.tsx`) y RBAC primitivo (`access-registry.ts` + `usePermissions`), simplificable para un set de roles "pro/contador".
- Servicios reutilizables como referencia de patrón: `split-service.ts` (writeBatch multi-company), `recurring-generator.ts`, `due-status.ts`.

> Deuda aceptada: por ahora hay duplicación de tipos entre los dos repos. Si diverge mucho, extraer `@bukz/finance-core` como paquete compartido en una fase posterior.

---

## Modelo de datos

### 1. `accounts` — cuentas de dinero con saldo (NUEVO)
Colección `companies/{id}/accounts`. Evoluciona el actual `payment-methods` (que es solo texto en un doc array).
```
Account {
  id, name, type: 'bank'|'cash'|'wallet'|'card',
  bankName?, last4?, currency: 'COP',
  openingBalance: number, openingDate: Timestamp,
  isActive: boolean, createdAt, updatedAt
}
```
- **Saldo = calculado on-the-fly** (como `useCashFlow` ya calcula opening balance, `hooks.ts:198`): `openingBalance + Σ(income pagado a la cuenta) − Σ(expense pagado desde la cuenta) + Σ(transfers in) − Σ(transfers out)`. Denormalizar el saldo es optimización posterior.
- Migración suave: sembrar `accounts` desde los `paymentMethods` existentes.

### 2. Extensión de `transactions` — `accountId` (NUEVO campo)
Agregar `accountId?: string` a `Transaction`. Cuando una transacción se paga/cobra, apunta a la cuenta que recibió/entregó la plata. Es lo que hace posible saldos por cuenta y conciliación. Hoy `paymentMethod` es texto libre; se mantiene por compatibilidad y se va migrando a `accountId`.

### 3. `transfers` — traslados entre cuentas propias (NUEVO)
Colección `companies/{id}/transfers`. **Neutral al P&L por diseño** (no es income ni expense).
```
Transfer {
  id, fromAccountId, toAccountId, amount, date,
  reference?, notes?, createdAt
}
```
- Solo afecta saldos de `accounts`. Los hooks de P&L/Flujo **ignoran** `transfers`; los de saldo los incluyen. Esto resuelve lo que pide el contador para conciliación bancaria sin ensuciar el estado de resultados.

### 4. Cuentas por Pagar (AP) — ya casi existe, se consolida
Reusar el modelo actual: `type='expense'` + `documentKind='invoice'` + `status in ['pending','overdue']` + `dueDate` + `payeeRef`. Reusar `useInvoicesPending()` (`hooks.ts:27`) y `getDueInfo()` (`utils/due-status.ts`). Al marcar pagada: setear `paidDate` + `accountId` + `status='paid'`.

### 5. Cuentas por Cobrar (AR) — NUEVO, espejo de AP (sin Rappi)
- Nueva colección raíz compartida **`customers`** (mismo patrón que `suppliers` en `ROOT_COLLECTIONS`, `helpers.ts:31`): visible entre locales.
- AR = `Transaction` con `type='income'` + nuevo `documentKind='receivable'` + `status='pending'` + `dueDate` + `counterpartyRef` (cliente). Hook nuevo `useReceivablesPending()` espejo de `useInvoicesPending()`. Al cobrar: `paidDate` + `accountId` + `status='paid'`.
- Extender `PayeeRef.type` (o un `CounterpartyRef` paralelo) para incluir `'customer'`.

### 6. Entre locales — recíproco dentro de CxP/CxC (NUEVO)
**No es un módulo aparte:** es una **sub-vista** de Cuentas por Pagar ("Entre locales") y de Cuentas por Cobrar ("Entre locales"). Si Blue Manila le debe a Blue Escondite, **Escondite ve una Cuenta por Cobrar** y **Manila ve una Cuenta por Pagar**, ligadas por `interLocalGroupId` y neteables por par de locales.

Distinguir dos casos:
- **Gasto compartido** (ya existe, se conserva): `split-service.ts` crea un expense real en cada local con `splitGroupId`. Cada local asume su parte como gasto P&L.
- **Préstamo/traslado entre locales** (NUEVO): A le pasa plata a B sin gasto subyacente → **neutral al P&L**, crea una **cuenta por cobrar en A** y una **cuenta por pagar en B**, ligadas por `interLocalGroupId`, neteables por par de locales.
  - Extender `PayeeType` con `'company'` (el otro local como contraparte).
  - Reusar el patrón `writeBatch` multi-company de `createSplitInvoices()` (`split-service.ts:107`) para escribir ambos lados atómicamente.
  - Vista "Entre locales": balance neto por par (cuánto me debe Escondite / cuánto le debo).
- **Consolidación:** no hay capa de "grupo" sobre companies (`helpers.ts:16-19`). Cualquier consolidado/entre-locales se arma **iterando los `companyId` accesibles** (como ya hace `split-service`). Un `groups` ligero queda para fase posterior.

### 7. Pagos parciales / abonos (NUEVO) — aplica a AP y AR
Hoy una factura pasa de `pending` → `paid` de un solo golpe (un comprobante cruza la factura, `payment-upload-dialog.tsx:393-404`). Falta el caso real: debemos 500.000 y abonamos 250.000 (50%), y luego el resto.

**Modelo — subcolección `payments`** bajo cada transacción: `companies/{id}/transactions/{txId}/payments/{payId}`
```
Payment {
  id, amount, date, accountId,
  proof?: PayableFile,   // comprobante del abono en Drive
  method?, notes?, createdAt
}
```
Denormalizar en la transacción padre (para listas/filtros sin leer subcolección):
- `paidAmount` = Σ payments · `remainingAmount` = `amount − paidAmount`.
- **Extender `TransactionStatus`** con `'partial'`: `0 → pending`, `0 < pagado < total → partial`, `pagado ≥ total → paid`. (Cambio en tipo compartido `core/types/index.ts:34`; debe ser retrocompatible con el finance viejo.)
- `paidDate` = fecha del abono que completa el saldo (compat).

**Reconocimiento de caja (clave para el contador):** cuando hay abonos, el Flujo de Caja debe reconocer **cada `payment`** por su fecha/cuenta/monto, no el `paidDate` único. Reescribir el hook de cashflow para iterar la subcolección `payments` (o un índice plano de pagos) en vez de mirar solo `status='paid'`. Cada abono afecta el saldo de su `account`.

**UI:** botón "Registrar abono" en Por Pagar / Por Cobrar → diálogo con monto (sugerido = saldo restante), cuenta, fecha, comprobante. Barra de progreso pagado/saldo + historial de abonos por factura.

### 8. Costos fijos — sub-vista de Cuentas por Pagar (reusar lo existente)
**Viven dentro de Cuentas por Pagar** (segmento "Costos fijos"): cada mes generan una CxP a pagar (arriendo, servicios, etc.). Reusar `RecurringTransaction` (`types.ts:81`) + `recurring-generator.ts`; las ocurrencias generadas son transacciones `expense`/`invoice` con `status='pending'` que aparecen en la lista de Por Pagar. **Mejora propuesta:** mover la generación de client-side (hoy corre al abrir la app, `hooks.ts:143`) a un **cron backend** (Cloud Function `onSchedule`, patrón ya usado en `dispatchSheetJobs`) para que los fijos se generen aunque nadie abra la app. F1 puede arrancar con el generador cliente y migrar a cron en su fase.

---

## Drive + hojas de seguimiento (mejoras)

Conservar las 3 functions y `regenerateInvoiceSheet` (`functions/src/invoice-sheet/regenerate.ts`) como única fuente de verdad del contenido. Mejoras:
- **Nuevas pestañas** en el workbook mensual: `Por Pagar`, `Por Cobrar`, `Traslados`, `Saldos de Cuentas`, `Entre Locales` — además de las actuales `Pagadas`/`Pendientes`.
- **Abonos en el seguimiento (para contadores):** en las pestañas de facturas agregar columnas `Valor total`, `Abonado`, `Saldo`, `% Pagado`, `Estado` (Pendiente/Parcial/Pagada/Vencida). Además una pestaña **`Abonos`** con una fila por cada pago (factura, fecha, monto, cuenta, saldo restante) para rastrear cómo se compone el total — fácil de leer para el contador.
- **PDF consolidado con todos los comprobantes:** extender `combineInvoicePaymentToDrive` (hoy combina 1 factura + 1 pago) para fusionar **la factura + N comprobantes de abono** con una carátula-resumen que liste cada abono (fecha, monto, % acumulado, saldo) hasta cuadrar el total. Se regenera al registrar cada abono.
- **Carpetas mejoradas**: hoy `Año/Mes/Seguimiento`. Considerar subcarpetas por tipo y un consolidado por local.
- **OJO deuda conocida:** el contenido de la hoja tiene **doble implementación** que hay que mantener en sync — `functions/src/invoice-sheet/accounting-rows.ts` (server) y `src/modules/finance/utils/accounting-export.ts` (cliente). Al agregar columnas/pestañas se tocan ambos. **Recomendación:** consolidar en una sola fuente server-side y que el cliente solo dispare la callable.
- **Prerrequisito de confiabilidad:** el OAuth de Drive está en modo *Testing* → el refresh token muere cada 7 días (`drive-oauth.ts:127-138`, memoria `project_drive_token_7day_expiry`). Si la auto-actualización debe ser confiable, **publicar la pantalla de consentimiento** es prerequisito.
- Redeploy de estas functions: `gcloud` + `--memory=512Mi` explícito (gcloud ignora el memory del código; 256 = OOM).

---

## UI de la app nueva (navegación de dos niveles)

**Nivel 1 — riel de módulos** (shadcn preset propio, densidad tipo tesorería): Facturación (hoy) · RR.HH. (futuro, sin diseñar aún).

**Nivel 2 — sidebar del módulo Facturación:**
- **Cuentas por Pagar (AP)** — con segmentos:
  - *Proveedores* — facturas a crédito, vencimientos, **abonos parciales** (barra pagado/saldo) con selección de cuenta.
  - *Entre locales* — CxP recíproca con otro local.
  - *Costos fijos* — recurrentes que generan CxP cada mes.
- **Cuentas por Cobrar (AR)** — con segmentos:
  - *Clientes* — cobros, vencimientos, **abonos parciales** recibidos.
  - *Entre locales* — CxC recíproca con otro local.
- **Traslados** — mover plata entre cuentas propias.
- **Cuentas** — cuentas bancarias/caja con saldo en vivo.
- **Hojas/Drive** — disparar y ver la hoja del mes.
- **Consolidado** (opcional) — vista multi-local iterando companies.

---

## Fases de ejecución (orden de construcción, no recorte de alcance)

- **F0 — Andamiaje:** repo nuevo, shadcn preset `b1VlIzU8`, Firebase shared (auth + `companies`), RBAC mínimo. **Portar el sidebar de App1 completo** (sidebar.tsx + navigation.ts + access-registry) con su sub-panel deslizable, company switcher, fijar/auto-ocultar y barra inferior — **sin command palette**. Módulos = Facturación (+ opener RR.HH. reservado). Vista read-only de `transactions` para validar conexión a `empresas-bf`.
- **F1 — AP + Cuentas + Abonos:** colección `accounts` (+ seed desde paymentMethods), `accountId` en transacciones, AP completo, **subcolección `payments` + estado `partial` + reconocimiento de caja por abono**, proveedores (root `suppliers`).
- **F2 — Traslados:** colección `transfers`, saldos por cuenta on-the-fly, vista de conciliación básica.
- **F3 — AR nuevo:** colección root `customers`, `documentKind='receivable'`, `useReceivablesPending()`, contraparte `'customer'`.
- **F4 — Entre locales (sub-vista de CxP/CxC):** `interLocalGroupId`, recíprocos vía writeBatch multi-company, netting por par. Segmentos "Entre locales" en Por Pagar y Por Cobrar.
- **F5 — Costos fijos:** reuse recurring; migrar generación a cron backend.
- **F6 — Drive/hojas mejoradas:** pestañas nuevas en `regenerate.ts` (incl. `Abonos` + columnas Abonado/Saldo/%), **PDF consolidado factura + N comprobantes**, mejorar carpetas, consolidar la doble-implementación. Publicar consent screen OAuth.

---

## Riesgos / decisiones abiertas

- **Doble verdad transaccional:** mitigada porque ambas apps usan la MISMA colección `transactions`. El riesgo real es de *esquema*: campos nuevos (`accountId`, `documentKind='receivable'`, estado `partial`) deben ser opcionales y no romper el finance viejo. **OJO `partial`:** el finance viejo solo conoce `paid|pending|overdue`; mientras coexistan, tratar `partial` como "pendiente" en sus vistas para no romperlas.
- **Reuso de código por copia:** los tipos se duplican entre repos; vigilar drift. Plan B: paquete `@bukz/finance-core`.
- **Saldos calculados vs denormalizados:** empezar calculados; si hay volumen, denormalizar con trigger.
- **OAuth Drive en Testing (7 días):** bloquea auto-actualización confiable hasta publicar consent.
- **Sin capa de grupo:** consolidado/entre-locales por iteración de `companyId` (aceptable a la escala actual de locales).

---

## Verificación (end-to-end)

1. **Conexión backend (F0):** login con `claude@tester.com` en la app nueva; ver que lista las mismas `transactions` que BusinessHub para un local. Confirmar que escribir un campo nuevo opcional no rompe el finance viejo (abrir ambas apps lado a lado).
2. **AP + abonos (F1):** crear factura de 500.000 pendiente → aparece en el finance viejo. Registrar abono de 250.000 con una cuenta → `status='partial'`, `paidAmount=250.000`, `remaining=250.000`, saldo de la cuenta baja 250.000, y el Flujo de Caja reconoce 250.000 en la fecha del abono. Segundo abono de 250.000 → `status='paid'`. El PDF consolidado contiene factura + ambos comprobantes con resumen; el seguimiento muestra Abonado/Saldo/% y la fila por abono en la pestaña `Abonos`.
3. **Traslados (F2):** transfer A→B → saldos de A y B se ajustan; el P&L/Flujo **no** cambian (verificar en income-statement viejo).
4. **AR (F3):** crear receivable con cliente → `useReceivablesPending` lo lista; cobrarlo afecta saldo de cuenta, ingreso entra al P&L por causación.
5. **Entre locales (F4):** préstamo Manila→Escondite → cuenta por cobrar en Manila y por pagar en Escondite con mismo `interLocalGroupId`; el neto cuadra; ninguno aparece como gasto/ingreso en P&L.
6. **Costos fijos (F5):** recurrente vencido genera transacción; tras migrar a cron, se genera sin abrir la app.
7. **Drive (F6):** disparar `saveInvoiceSheetToDrive` → la hoja del mes muestra las pestañas nuevas (Por Pagar/Por Cobrar/Traslados/Saldos/Entre Locales) con datos correctos. `typecheck` + `lint` + `build` verdes en el repo nuevo antes de cada deploy.
