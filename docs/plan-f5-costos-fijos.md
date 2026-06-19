# F5 — Costos fijos (Ecore) — Handoff para sesión nueva

> Preparado 2026-06-18 al cerrar F4. Leer esto + `docs/plan-app-tesoreria.md §F5`
> antes de arrancar. Estado F0–F4: HECHAS (ver memoria `project_app_tesoreria_plan`).
> Repos: **Ecore** = `C:\Users\sbdbu\Documents\Empresas\Ecore` (app nueva, git local).
> **businesshub** = este repo (App1 + las Cloud Functions de todo el grupo).

## Qué es F5

**Costos fijos = el tab `fixed` ("Costos fijos") de Por Pagar en Ecore** (hoy es un
placeholder `EmptyState` en `Ecore/src/modules/invoicing/components/payables-view.tsx`).
NO es un módulo aparte. Cada costo fijo es una **regla recurrente** (arriendo,
servicios, etc.) que **genera una Cuenta por Pagar** (`expense`/`invoice`/`pending`)
cada período. Reusa el modelo `RecurringTransaction` que ya existe y funciona en App1.

Las ocurrencias generadas caen en la lista normal de Por Pagar (Proveedores) porque
son `documentKind='invoice'` + `status='pending'` → ya las recoge `useInvoicesPending`.
El tab `fixed` gestiona las **reglas** (alta/edición/pausa), no las ocurrencias.

## Decisión de alcance (del plan §F5)

> "F1 puede arrancar con el generador cliente y migrar a cron en su fase."

F5 = **dos entregables**:
- **A) Portar la infra de recurrentes a Ecore + UI del tab `fixed` + generador cliente.**
  Esto ya deja la feature funcionando (igual que App1 hoy).
- **B) Migrar la generación a un cron backend** (Cloud Function `onSchedule`) para que
  los fijos se generen aunque nadie abra la app.

Sugerencia: hacer **A** primero (commit), luego **B** (commit aparte). B toca el repo
businesshub/functions y se deploya con `gcloud` (NUNCA firebase-tools — ver memorias).

---

## Parte A — Portar recurrentes a Ecore (cliente)

Todo es copiar-y-adaptar desde App1. Archivos fuente de referencia en businesshub:
- Tipo: `src/modules/finance/types.ts` → `RecurringTransaction` (líneas ~84-109).
  Campos: concept, category, amount, type, status, frequency
  (`'daily'|'weekly'|'monthly'|'yearly'`), startDate, endDate?, nextDueDate,
  lastGeneratedDate?, isActive, + opcionales payeeRef/documentKind/priority/splitGroupId.
- Servicio CRUD: `src/modules/finance/recurring-service.ts` (colección
  `recurring-transactions`). Copiar tal cual a Ecore.
- Generador: `src/modules/finance/recurring-generator.ts` →
  `generatePendingTransactions(companyId)`. Es **idempotente** vía
  `nextDueDate`/`lastGeneratedDate`: avanza la fecha mientras `nextDue <= hoy`,
  crea una tx por ocurrencia con `sourceType='recurring'`, y actualiza la regla.
- Trigger cliente: `src/modules/finance/hooks.ts` → `useRecurringGenerator()`
  (líneas ~146-164): corre **1 vez** al montar (ref guard), genera y luego invalida
  `['firestore', companyId, 'transactions']`.

Pasos en Ecore:
1. `Ecore/src/modules/invoicing/types.ts`: añadir `RecurringTransaction` +
   `RecurringTransactionFormData` (`RecurrenceFrequency` ya NO existe en Ecore →
   añadirlo). Para costos fijos forzar `type='expense'`, `documentKind='invoice'`,
   `status='pending'`. `frequency` práctico: ofrecer `monthly` (default) +
   `weekly`/`yearly`.
2. `Ecore/src/modules/invoicing/recurring-service.ts`: copiar de App1 (usa los
   helpers de Ecore `@/core/firebase/helpers`, que ya existen).
3. `Ecore/src/modules/invoicing/recurring-generator.ts`: copiar de App1. Ajustar
   imports: `recurringService` local, `financeService` de Ecore
   (`./finance-service`), `invalidateCollection` de `@/core/query/invalidation`.
   OJO: el generador de App1 propaga `splitGroupId` por ocurrencia — para costos
   fijos simples eso queda undefined; dejar el código igual (no estorba).
4. Hook `useRecurringGenerator()` en `hooks.ts` de Ecore (copiar patrón ref-guard).
   Montarlo UNA vez en un punto alto del módulo Facturación (p.ej. en `PayablesView`
   o en el layout del módulo) para que corra al entrar. En App1 vive en finance.
5. UI del tab `fixed` en `payables-view.tsx`: reemplazar el `EmptyState` por un
   `RecurringManager` (lista de reglas activas/pausadas + alta/edición). Patrón de
   form/dialog: clonar `account-form.tsx` (mismo estilo modal `--app-*`). Campos:
   concept, category, amount (CurrencyInput), frequency (SelectInput), startDate
   (DateInput → primer `nextDueDate`), endDate? opcional, proveedor? (reusar
   `useSuppliers` + payeeRef como en `invoice-form.tsx`), isActive (toggle pausar).
   Mostrar `nextDueDate` ("próxima generación") en cada fila.

Verificación A: crear regla mensual con startDate pasada → al recargar, aparece(n)
la(s) CxP generada(s) en el tab Proveedores con `sourceType='recurring'`; la regla
avanza su `nextDueDate`. `typecheck`+`lint`+`build` verdes en Ecore.

## Parte B — Cron backend (businesshub/functions)

Objetivo: generar las ocurrencias sin depender de que alguien abra la app.

Patrón a copiar: `functions/src/sheet-jobs-dispatch.ts` (`onSchedule`, región
`us-central1`, timeZone `America/Bogota`). Para iterar TODAS las companies:
`db.collection('companies').get()` (ver `functions/src/scheduled-reports-dispatch.ts:291`).

Pasos:
1. Nuevo `functions/src/recurring-dispatch.ts`: `export const dispatchRecurring =
   onSchedule({ schedule: 'every day 06:00', timeZone: 'America/Bogota',
   region: 'us-central1', memory: '512MiB', retryCount: 0 }, async () => {...})`.
   Itera companies, y por cada una replica la lógica de `generatePendingTransactions`
   con **firebase-admin** (no el SDK cliente): leer `companies/{id}/recurring-transactions`
   con `isActive=true`, y por cada regla con `nextDueDate <= hoy` crear las tx en
   `companies/{id}/transactions` + actualizar la regla. Idempotente igual que el
   cliente. Usar `Timestamp`/`FieldValue` de `firebase-admin/firestore`.
2. Registrar el export en `functions/src/index.ts`.
3. `npm run build` en `functions/`.
4. Deploy con **gcloud** (ver memorias `feedback_firebase_deploy`):
   `gcloud functions deploy dispatchRecurring --gen2 --region=us-central1
   --runtime=nodejs20 --trigger-topic=... ` → OJO: `onSchedule` v2 crea su propio
   Cloud Scheduler; el comando exacto sigue el de `dispatchSheetJobs`/`posReconcileNightly`
   (HTTP + Scheduler, **SIN** `--allow-unauthenticated`). Verificar memory explícito
   `--memory=512Mi` (gcloud ignora el del código).
5. Una vez confiable el cron, el generador cliente puede quedarse como respaldo
   (es idempotente; correr ambos no duplica). Opcional: quitarlo después.

Verificación B: invocar la function a mano / esperar el schedule → las CxP de costos
fijos vencidas se generan sin abrir Ecore. No duplica si el cliente ya las generó.

---

## Notas / OJOs

- **Multi-tenant:** todo pasa por `companyCollection`/`companyDoc` (Ecore helpers).
  La colección `recurring-transactions` es por-company (NO root).
- **Compat App1:** App1 ya tiene su propio `useRecurringGenerator` corriendo. Si una
  regla la crea Ecore en `companies/{id}/recurring-transactions`, App1 también la
  generaría (mismo formato). Idempotencia compartida vía `nextDueDate` → no se duplica.
  Las reglas son las mismas para ambas apps (misma colección). Tenerlo presente: un
  costo fijo creado en Ecore aparecerá también en el módulo recurrentes de App1.
- **No reabrir:** misma colección `transactions`, saldos on-the-fly, design tokens
  `--app-*`, sin command palette. Ver `docs/plan-app-tesoreria.md`.
- **Próximo tras F5:** F6 (Drive/hojas mejoradas + PDF consolidado factura + N
  comprobantes). Ver §F6 del plan.
