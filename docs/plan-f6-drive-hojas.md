# F6 — Drive / hojas mejoradas + PDF consolidado (Ecore) — Handoff sesión nueva

> Preparado 2026-06-18 al cerrar F5. Leer esto + `docs/plan-app-tesoreria.md`
> (§"Drive + hojas" línea ~127 y §F6 línea ~167) antes de arrancar.
> Estado F0–F5: HECHAS y F5 DEPLOYADA (ver memoria `project_app_tesoreria_plan`).
> Repos: **Ecore** = `C:\Users\sbdbu\Documents\Empresas\Ecore` (app nueva, git local,
> SIN remote/Coolify todavía). **businesshub** = este repo (App1 + las Cloud
> Functions de todo el grupo). Las functions se deployan con **gcloud** (NUNCA
> firebase-tools — ver memorias).

## Qué es F6

Dos cosas, más cabos sueltos de plataforma:

1. **Hojas de seguimiento en Drive mejoradas** — hoy la hoja mensual tiene solo 2
   pestañas (Pendientes + Pagadas) con datos de App1. F6 agrega pestañas para el
   modelo nuevo de Ecore (Por Pagar / Por Cobrar / Traslados / Saldos / Entre
   Locales / **Abonos** con columnas Abonado/Saldo/%) y conecta a Ecore.
2. **PDF consolidado factura + N comprobantes** — hoy se combina 1 factura + 1
   comprobante. F6 lo extiende a 1 factura + **N comprobantes de abono** con
   carátula-resumen (cada abono: fecha, monto, % acumulado, saldo).
3. **Cabos sueltos** (no fases formales): página **Consolidado** real, arrancar
   **RR.HH.**, y montar **deploy de Ecore** (remote + dominio + Coolify).

---

## Estado actual (verificado 2026-06-18)

### En businesshub/functions — TODA la maquinaria de hojas ya existe (sirve App1)
- `functions/src/invoice-sheet/regenerate.ts` → `regenerateInvoiceSheet(companyId, year, monthIndex)`.
  Genera HOY **2 pestañas**: **"Pendientes"** (solo si es mes actual; invoices
  pending/overdue) y **"Pagadas"** (status paid cuyo paidDate∈mes). Lee
  `companies/{id}/transactions` + `suppliers` (para NIT). Arma `.xlsx` con ExcelJS
  y lo sube vía `uploadOrReplaceFile` con `convertToMimeType=GOOGLE_SHEET_MIME` →
  Drive lo convierte a Google Sheet nativo (sin scope Sheets).
- `functions/src/invoice-sheet/build-workbook.ts` → `buildWorkbookBase64(sheets: SheetSpec[])`.
  Cada pestaña: fila1 aviso ámbar "no editar", fila2 headers grafito congelados,
  fila3+ datos con AutoFilter. Columna 'valor' formato `#,##0`. **Para pestañas
  nuevas basta pasar más `SheetSpec`** (campo `fields` con `{key,header,type}`).
- `functions/src/invoice-sheet/accounting-rows.ts` → `buildAccountingRows()`.
  Interfaz `AdminTx` HOY solo cubre `documentKind: 'invoice'|'purchase'` y
  `payeeRef.type: partner|employee|supplier|external`. Columnas: Numeración, Fecha,
  NIT, Proveedor, Concepto, Categoría, Prioridad, Tipo, Número, Valor, Estado,
  Método Pago, Notas. **OJO F6:** NO contempla `receivable`, `customer`, `company`,
  `interLocalGroupId`, `status='partial'`, `paidAmount`/`remainingAmount` — hay que
  extenderlo para las pestañas nuevas.
- `functions/src/invoice-sheet/month.ts` → anclaje Bogotá UTC-5 fijo (`isCurrentMonthBogota`, etc.).
- `functions/src/save-invoice-sheet.ts` → callable `saveInvoiceSheetToDrive({companyId, year, monthIndex})`
  → llama `regenerateInvoiceSheet` y devuelve `{driveFileId, webViewLink, fileName}`.
- `functions/src/sheet-jobs-trigger.ts` → `markSheetJobDirty` (onDocumentWritten en
  `transactions`) marca `companies/{id}/sheet-jobs/{YYYY-MM}` dirty. **Bug conocido
  v2+gcloud:** el evento llega sin decodificar → hay fallback `extractDocPath()`.
- `functions/src/sheet-jobs-dispatch.ts` → cron `dispatchSheetJobs` (cada 10 min)
  procesa los dirty (clear-then-process, idempotente vía `uploadOrReplaceFile`).
- `functions/src/combine-invoice-payment.ts` → callable `combineInvoicePaymentToDrive`
  combina `sourceFileId` (factura) + `proofFileId?` (1 comprobante) → PDF vía
  `buildCombinedPdf` (pdf-lib + sharp para imágenes) → sube a `{root}/{año}/{mes}/PDFs consolidados/`.
- `functions/src/utils/build-combined-pdf.ts` → `buildCombinedPdf(parts: PdfPart[])`
  ya fusiona N partes (PDF copyPages / imagen embed). **Ya acepta N partes** — falta
  la carátula-resumen y pasar los N comprobantes.
- `functions/src/utils/doc-naming.ts` → `MESES_ES`, `SUBFOLDER_TRACKING='Seguimiento'`,
  `SUBFOLDER_CONSOLIDATED='PDFs consolidados'`, `SUBFOLDER_LOOSE`, etc.
- `functions/src/services/drive-oauth.ts` → token a nivel **usuario** (`users/{uid}.driveAuth.refreshToken`),
  `resolveDriveUid(companyId)` → owner de la company; `runDrive()` mapea `invalid_grant`
  → `DriveTokenExpiredError`. **El refresh token muere cada 7 días porque el consent
  screen está en modo Testing** (líneas ~127-138). Publicar consent = prerequisito.

### Doble implementación (mantener en sync)
- Cliente App1: `src/modules/finance/utils/accounting-export.ts` (`ACCOUNTING_FIELDS`,
  `buildAccountingRows`) — export local xlsx/csv en `invoice-export-menu.tsx`.
- Servidor: `functions/src/invoice-sheet/accounting-rows.ts` (réplica, interfaz `AdminTx`).
  No se puede importar `src/` desde `functions/` (paquetes TS separados). Si cambian
  columnas/parsers, **actualizar ambos lados**.

### En Ecore — TODO por construir (no hay nada de Drive/PDF)
- `src/modules/invoicing/routes.tsx`: `SheetsPage()` y `ConsolidatedPage()` son
  `<PlaceholderPage />` ("Llega en F6" / "Fase posterior").
- `src/core/config/access-registry.ts`: rutas ya registradas — `inv.sheets`
  (`/facturacion/hojas`, read-only) e `inv.consolidated` (`/facturacion/consolidado`, read-only).
- `src/core/firebase/config.ts`: `getAppFunctions()` YA existe (lazy import de
  `firebase/functions`). Solo se usa para callables admin en
  `src/core/services/permissions-service.ts` (`adminCreateUser`/SetStatus/Delete).
  **No hay ninguna llamada a callables de Drive/hojas todavía.**
- `src/modules/invoicing/payments-service.ts`: `Payment`/`PaymentInput` NO tienen
  campo `proof`/comprobante; el abono no sube nada a Drive. `Transaction` sí tiene
  reservados `sourceDocument`/`paymentProof`/`combinedDocument: PayableFile`.
- Sin deps de pdf/xlsx en Ecore (todo el trabajo pesado lo hacen las functions).

---

## Plan de F6 (sub-entregables, commit por bloque)

### Bloque A — Página "Hojas / Drive" en Ecore (conectar a lo existente)
El más rápido: la maquinaria ya existe y funciona. Solo hay que llamarla desde Ecore.
1. Servicio `Ecore/src/modules/invoicing/sheets-service.ts` (nuevo): wrapper de
   `httpsCallable(fns, 'saveInvoiceSheetToDrive')` usando `getAppFunctions()` (patrón
   de `permissions-service.ts`). Tipos `{companyId, year, monthIndex}` →
   `{driveFileId, webViewLink, fileName}`.
2. `components/sheets-view.tsx` (nuevo): botón "Generar/actualizar hoja del mes"
   (mes actual Bogotá) + link a la hoja en Drive + manejo de errores
   `DriveTokenExpiredError`/`DriveScopeError` (avisar "reconecta Drive"). Clonar
   estética de las otras views (`--app-*`, page-header). Espejo de App1
   `invoice-export-menu.tsx:131`.
3. `routes.tsx`: `SheetsPage()` monta `<SheetsView />` en vez del placeholder.
4. **OJO Drive owner:** la company debe tener `driveRootFolderId` + un owner con
   Drive conectado (`users/{uid}.driveAuth`). Si el owner ya conectó Drive en App1,
   Ecore reusa el mismo token (mismo `empresas-bf`). Si no, falta UI de conexión
   (App1 la tiene en finance; portarla es trabajo aparte — ver Bloque D consent).
5. **No requiere redeploy de functions** (callable ya está LIVE).

### Bloque B — Pestañas nuevas en la hoja (regenerate.ts) [TOCA functions, redeploy]
Extender la hoja para el modelo de Ecore. Todo en `functions/src/invoice-sheet/`.
1. `accounting-rows.ts`: extender `AdminTx` y los builders para soportar
   `documentKind='receivable'`, `payeeRef.type` `customer`/`company`,
   `status='partial'`, `paidAmount`/`remainingAmount`, `interLocalGroupId`.
   Añadir builders de filas por tipo de pestaña.
2. `regenerate.ts`: además de Pendientes/Pagadas, construir `SheetSpec` para:
   **Por Pagar** (expense+invoice pending/overdue/partial, sin interLocal),
   **Por Cobrar** (income+receivable pending/overdue/partial), **Traslados** (leer
   `companies/{id}/transfers`), **Saldos** (saldo por cuenta — replicar
   `computeAccountBalances` server-side: openingBalance + abonos + transfers),
   **Entre Locales** (interLocalGroupId), **Abonos** (iterar subcolección
   `transactions/{txId}/payments` de las gestionadas por Ecore; columnas
   Abonado/Saldo/% por factura). Pasar todos los `SheetSpec` a `buildWorkbookBase64`.
3. **Reflejar columnas nuevas en el cliente** `src/modules/finance/utils/accounting-export.ts`
   si se quiere paridad en el export local (opcional; al menos documentar el drift).
4. **Redeploy** (regenerate es interna): `saveInvoiceSheetToDrive` + `dispatchSheetJobs`
   (y `markSheetJobDirty` si cambia su lógica de meses). Comandos exactos en memoria
   `reference_gcloud_sheet_functions`. **OJO `--memory=512Mi` explícito** (gcloud
   ignora el del código; el trigger hizo OOM a 256 — memoria `project_sheet_auto_update_pending`).

### Bloque C — PDF consolidado factura + N comprobantes [TOCA functions, redeploy]
1. `combine-invoice-payment.ts`: cambiar `CombineInput.proofFileId?` por
   `proofFileIds?: string[]` (mantener compat con el singular si App1 lo usa, o
   migrar las 4 llamadas de App1). Descargar los N comprobantes.
2. `build-combined-pdf.ts`: ya fusiona N partes. Añadir una **página-carátula**
   (pdf-lib) que liste cada abono (fecha, monto, % acumulado, saldo) hasta cuadrar
   el total — recibir los metadatos de abonos como parámetro.
3. Decidir disparo: se regenera al registrar cada abono. En Ecore eso implica que
   el abono guarde su comprobante (`paymentProof` en `Payment`) → **prerequisito:**
   añadir subida de comprobante al `payment-dialog.tsx` de Ecore + callable de subida
   (App1 sube vía `uploadDocumentToDrive`/`combineInvoicePaymentToDrive`). Si no se
   quiere subir comprobantes desde Ecore aún, este bloque puede quedar como mejora
   solo-App1 y Ecore consume el PDF resultante.
4. **Redeploy** `combineInvoicePaymentToDrive` con gcloud (callable, `--allow-unauthenticated`
   — ver memoria `feedback_firebase_callable_gcloud`). Si tocas drive-oauth/build-combined-pdf,
   redeploya también las que las importan.

### Bloque D — Publicar consent screen OAuth (prerequisito de confiabilidad)
- El refresh token muere cada 7 días por estar en modo **Testing**
  (memoria `project_drive_token_7day_expiry`). Para que la hoja auto-actualizada y
  el PDF sean confiables, **publicar la pantalla de consentimiento** de Google Cloud
  (proyecto `empresas-bf`, OAuth consent screen → Publish app). Es config en consola
  GCP, no código. Hacerlo antes de prometer auto-actualización.

### Cabos sueltos (no F6 estricto; decidir prioridad con el usuario)
- **Página Consolidado** (`ConsolidatedPage`): vista multi-local iterando los
  `companyId` accesibles (no hay capa `groups`; patrón `split-service` de App1).
  Sumar saldos/CxP/CxC/entre-locales por local. Read-only.
- **RR.HH.**: módulo reservado en la nav, SIN diseñar. Próximo gran módulo tras
  Facturación. NO empezar sin plan propio.
- **Deploy de Ecore**: repo local sin remote/Coolify. Para uso real: crear remote,
  dominio y rebuild Coolify (patrón `project_app2_admin_hetzner`). Sin esto, F1–F6
  solo viven local y no se pueden probar E2E de verdad.
- **Optimización** `computeAccountBalances` (lee todas las transactions + payments):
  denormalizar saldo con trigger a volumen alto.

---

## Verificación F6
- **Hojas (Bloque A/B):** desde Ecore disparar `saveInvoiceSheetToDrive` → abrir la
  hoja del mes en Drive y ver las pestañas nuevas (Por Pagar/Por Cobrar/Traslados/
  Saldos/Entre Locales/Abonos) con datos correctos. `typecheck`+`lint`+`build`
  verdes en Ecore; `npm run build` verde en `functions/` antes de cada gcloud deploy.
- **PDF (Bloque C):** registrar 2 abonos sobre una factura → el PDF consolidado
  contiene factura + ambos comprobantes + carátula con % y saldo cuadrando al total.
- **Consent (D):** tras publicar, el token no muere a los 7 días.

## Orden sugerido
A (rápido, sin deploy) → B (pestañas + redeploy) → C (PDF + redeploy) → D (consent).
Cabos sueltos según prioridad del usuario. Commit por bloque, en español, con trailer
Co-Authored-By.
