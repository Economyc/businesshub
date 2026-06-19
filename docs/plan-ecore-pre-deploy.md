# Ecore — Cambios pre-deploy — Handoff sesión nueva

> Preparado 2026-06-18. Leer esto + memoria `project_app_tesoreria_plan` antes de arrancar.
> Objetivo: hacer unos ajustes **antes** de montar el deploy de Ecore. Tres frentes
> (el usuario detalla los específicos al iniciar): **(1) ajustes a las tablas**,
> **(2) otros cambios visuales**, **(3) seguir F6 (Bloques C y D)**.

## Repos y entorno
- **Ecore** = `C:\Users\sbdbu\Documents\Empresas\Ecore` (app de tesorería/facturación; Vite+React18+TS
  strict+RR7+Tailwind v4; git en rama **`master`**, **SIN remote/Coolify todavía** → solo commits locales).
  Comparte Firebase `empresas-bf` y la colección `transactions` con App1.
- **businesshub** = este repo (App1 + todas las Cloud Functions del grupo). Functions se deployan con
  **gcloud** (NUNCA firebase-tools — ver memorias). App1 en https://businesshub.myvnc.com.
- **Design system de Ecore:** `Ecore/DESIGN_SYSTEM.md` — LEER antes de tocar UI. Tokens `--app-*` (mismos
  nombres que App1, valores dark + acento periwinkle). Tipografía en escalas fijas (`text-caption/body/
  subheading/heading/kpi`), colores solo por token, spacing múltiplos de 4, radius `rounded-lg/xl/2xl/full`,
  cards planas (borde 1px, sin shadow).

## Cuenta de pruebas (usar para verificar en navegador)
- **`claude@economyc.cc` / `123456789`** (memoria `reference_ecore_test_account`). Ya es miembro de la empresa
  **Blue Smash Brgr – Manila** (tiene datos reales de Por Pagar). RBAC F0 de Ecore: cualquier miembro activo entra.
- **Verificar visual:** `cd Ecore && npm run dev` (Vite; suele caer en 5173, hoy quedó en **5176** por puertos
  ocupados — revisar el output). Luego Playwright MCP (`mcp__playwright__browser_*`): navigate al localhost,
  login con la cuenta, seleccionar Manila. Errores de consola CORS de logos en `localhost` son normales (no aplican en prod).

## Estado al cierre de esta sesión (todo committeado)
- **F6 Bloque A** (Ecore commit `498078f`): página **Hojas/Drive** conectada al callable
  `saveInvoiceSheetToDrive`. Archivos: `Ecore/src/modules/invoicing/sheets-service.ts`,
  `components/sheets-view.tsx`, `routes.tsx`.
- **F6 Bloque B** (businesshub commit `6c5f755`, **DEPLOYADO**): pestañas nuevas en la hoja de Drive
  (Por Pagar/Por Cobrar/Traslados/Saldos/Entre Locales/Abonos) en `functions/src/invoice-sheet/`
  (`accounting-rows.ts` + `regenerate.ts` + `build-workbook.ts`). Deploy gcloud verificado:
  `saveInvoiceSheetToDrive` rev 00006 + `dispatchSheetJobs` ACTIVE (comandos en memoria
  `reference_gcloud_sheet_functions`, `--memory=512Mi` explícito).
- **Tablas Por Pagar/Por Cobrar** (Ecore commit `0789acb`): convertidas de tarjetas a **tabla columnar**
  (paridad App1). Verificado en navegador con la cuenta de pruebas.

---

## Frente 1 — Ajustes a las tablas

**Archivo único:** `Ecore/src/modules/invoicing/components/transaction-table.tsx` (componente compartido
`TransactionTable`, usado por `payables-view.tsx` y `receivables-view.tsx`).

Cómo está hecho hoy (para ubicar dónde tocar):
- Tabla a medida con **CSS grid**, sin virtualización. Dos plantillas en la const `GRID`: 5 columnas en
  mobile, 10 en `md+`. Las celdas secundarias llevan la clase `SECONDARY` (`hidden md:flex`) → en mobile el
  auto-placement las salta. **Header y filas comparten `GRID`** (si se añade/quita una columna, ajustar AMBAS
  plantillas y el header y la fila a la vez, o se desalinean).
- Columnas hoy: chevron · **Proveedor/Cliente** (con concepto como subline) · **Categoría** (punto de color
  vía `getCategoryColor`) · **Tipo** · **Número** · **Fecha** · **Vence** (chip rojo/ámbar `DueCell`) ·
  **Valor** (con `saldo` si `partial`) · **Estado** (`StatusBadge`) · acciones (Abonar/Cobrar + eliminar).
- **Detalle expandible** (`ExpandedDetail`): barra de progreso si `partial`, documentos
  (`sourceDocument`/`paymentProof`/`combinedDocument` → `DocLink`), notas, e historial de abonos (`useTransactionPayments`).
- **NO se incluyó Prioridad** (el usuario la descartó). Si se quiere, hay que reañadir columna + ajustar plantillas.
- **Color de categoría:** `getCategoryColor` (en `Ecore/src/core/utils/categories.ts`) matchea contra
  `DEFAULT_CATEGORIES`. Las categorías propias del negocio (Socio, Tecnología, etc.) **no están en DEFAULT →
  salen con punto gris**. Si se quiere color real, hay que cablear las categorías personalizadas de la empresa
  (en App1 vienen de un `SettingsContext`/Firestore `settings/categories`; en Ecore NO existe ese context aún
  — sería trabajo de portarlo).

Posibles ajustes (a confirmar con el usuario): búsqueda/filtros, ordenamiento por columna, paginación,
densidad/anchos, qué columnas se ocultan en mobile, mostrar/ocultar concepto, totales por columna, etc.

## Frente 2 — Otros cambios visuales

Pendiente: **el usuario especifica los cambios exactos al iniciar la sesión.** Preguntar primero qué pantallas
y qué ajustes. Contexto:
- Vistas de Ecore en `Ecore/src/modules/invoicing/components/` (accounts-view, transfers-view, payables/
  receivables, sheets-view, interlocal-panel, recurring-manager) y core UI en `Ecore/src/core/ui/`.
- Respetar `Ecore/DESIGN_SYSTEM.md`. Verificar cada cambio en navegador con la cuenta de pruebas + Playwright.

## Frente 3 — F6 Bloques C y D

Detalle file-by-file ya escrito en **`businesshub/docs/plan-f6-drive-hojas.md`** (Bloques C y D). Resumen:

- **Bloque C — PDF consolidado factura + N comprobantes de abono** (toca functions, redeploy):
  - `functions/src/combine-invoice-payment.ts`: cambiar `CombineInput.proofFileId?` por `proofFileIds?: string[]`
    (o migrar las llamadas de App1). Descargar los N comprobantes.
  - `functions/src/utils/build-combined-pdf.ts`: ya fusiona N partes; **añadir página-carátula** (pdf-lib) que
    liste cada abono (fecha, monto, % acumulado, saldo) hasta cuadrar el total — recibir metadatos de abonos.
  - **Prerequisito Ecore:** que el abono guarde su comprobante (`paymentProof` en `Payment`/dialog de abono) y
    suba a Drive. Si no se quiere subir comprobantes desde Ecore aún, C puede quedar como mejora solo-App1.
  - **Redeploy:** `combineInvoicePaymentToDrive` con gcloud (`--allow-unauthenticated`, ver memoria
    `feedback_firebase_callable_gcloud`). Si tocas `drive-oauth`/`build-combined-pdf`, redeploya lo que las importe.
- **Bloque D — Publicar consent screen OAuth** (config en consola GCP, no código): proyecto `empresas-bf`,
  OAuth consent screen → Publish app. Hoy en modo Testing → el refresh token de Drive muere cada 7 días
  (memoria `project_drive_token_7day_expiry`). Hacerlo antes de prometer auto-actualización confiable.

---

## Verificación general
- Ecore: `npm run typecheck` + `npm run lint` (no introducir errores; hay 5 warnings preexistentes) + `npm run build` verdes.
- functions: `npm run build` verde antes de cada gcloud deploy.
- UI: navegador con la cuenta de pruebas (Playwright MCP).

## Después de los cambios — deploy de Ecore (frente aparte)
Montar remote + dominio + Coolify (patrón memoria `project_app2_admin_hetzner`: git push a main + rebuild
manual en Coolify, NO deploy-oracle, NO auto-deploy). Sin esto, Ecore solo vive local.

## Commits
Uno por bloque lógico, en español, trailer `Co-Authored-By`. Ecore en `master` (solo local); functions en
businesshub `main`. Mostrar resumen y preguntar guardar/deploy al cerrar.
