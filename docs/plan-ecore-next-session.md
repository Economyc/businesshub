# Ecore — Handoff próxima sesión (qué falta)

> Actualizado 2026-06-18 al cerrar **deploy de Ecore + F6 Bloque C**. Leer esto +
> memorias `project_app_tesoreria_plan`, `project_ecore_deploy_coolify` antes de arrancar.

## Repos y entorno
- **Ecore** = `C:\Users\sbdbu\Documents\Empresas\Ecore` (Vite+React18+TS strict+RR7+Tailwind v4),
  git rama **`master`**, **YA con remote** `github.com/Economyc/ecore` (PRIVADO) y **deployado** en
  Coolify/Hetzner → `https://ecore.economyc.cc`. Comparte Firebase `empresas-bf` con App1.
- **businesshub** = este repo (App1 + todas las Cloud Functions). `main` pusheado a GitHub.
  Functions se deployan con **gcloud** (NUNCA firebase-tools).
- **Cuenta de pruebas:** `claude@economyc.cc` / `123456789` (miembro de Blue Smash Brgr **Manila**).
- **Dev local Ecore:** `cd Ecore && npm run dev` (suele caer en :5177). NO `| head` (SIGPIPE mata el server).
- **Verificación estándar:** `npm run typecheck` + `npm run lint` (5 warnings preexistentes) + `npm run build`
  verdes en Ecore; `npm run build` verde en `functions/` antes de cada gcloud deploy.

## Cómo deployar (ya montado)
- **Ecore (frontend):** `git push` a `master` + disparar rebuild Coolify por API:
  `GET https://hzcol.economyc.cc/api/v1/deploy?uuid=nou8vbspjubl9yp7pg00qj7o` con
  `Authorization: Bearer <COOLIFY_API_TOKEN>` **y User-Agent de navegador** (Cloudflare bloquea el UA
  de python con error 1010). NO hay auto-deploy. Detalle/gotchas en `project_ecore_deploy_coolify`.
- **Functions:** gcloud (comandos en memorias `reference_gcloud_*`).

## Estado al cierre (todo committeado, deployado y verificado)
- **Deploy de Ecore HECHO** — LIVE, verificado en navegador (login Firebase + datos reales Por Pagar,
  0 errores), en Homepage `hz.economyc.cc`. CORS de Storage arreglado (logos). Firebase authorized
  domains NO hizo falta (login email/password).
- **F6 Bloque C HECHO + DEPLOYADO** (businesshub commit `5fbb5f7`, pusheado) — `combineInvoicePaymentToDrive`
  acepta `proofFileIds[]` + carátula-resumen (rev `00004-div` ACTIVE). **OJO: la carátula está DORMIDA**
  (ningún caller pasa `payments[]` aún); los PDFs actuales de App1 no cambian.

---

## LO QUE FALTA (en orden sugerido)

### 1. F6 Bloque C COMPLETO — subir comprobante desde Ecore + activar carátula
Hoy la capacidad server-side existe pero nadie la usa. Para que rinda:
- **Ecore `payment-dialog.tsx`**: añadir subida de comprobante (`paymentProof`) al registrar un abono
  (hoy `Payment`/`PaymentInput` NO tienen campo proof). Patrón App1: subir a Drive + guardar `PayableFile`.
- **Callable de subida** desde Ecore (App1 usa `uploadDocumentToDrive`/`combineInvoicePaymentToDrive`).
- Al registrar abono N, llamar `combineInvoicePaymentToDrive` con **`proofFileIds[]`** (todos los
  comprobantes de la factura) + **`payments[]`** (fecha+monto de cada abono) + `invoiceTotal` → genera
  el PDF con carátula. Guardar el resultado en `combinedDocument` de la tx.
- **E2E:** factura + 2 abonos con comprobante → PDF consolidado = carátula (% y saldo cuadran) + factura
  + 2 comprobantes.
- (Opcional App1) cablear el botón retroactivo de `transaction-form.tsx` para pasar `payments[]` también.

### 2. Página Consolidado real (`ConsolidatedPage` es placeholder)
Vista multi-local iterando los `companyId` accesibles (no hay capa `groups`; patrón `split-service` de
App1). Suma saldos/CxP/CxC/entre-locales por local. Read-only.

### 3. Cabos sueltos de plataforma
- **Optimización `computeAccountBalances`** (lee todas las transactions + payments): denormalizar saldo
  con trigger a volumen alto.
- **RR.HH.**: módulo reservado en la nav, SIN diseñar. Próximo gran módulo tras Facturación.
  **NO empezar sin plan propio.**

### 4. E2E manual pendientes (usuario — escriben en prod `empresas-bf`)
Acumulados F1–F6, ahora **probables de verdad porque Ecore está LIVE**:
- F1–F4: crear factura→abonar→pagar; traslados; CxC cobrar; préstamo entre locales (verificar
  neutralidad P&L en App1).
- F5: crear costo fijo mensual fecha pasada → recargar Por Pagar → ver CxP generada.
- F6 A/B: desde `/facturacion/hojas` generar la hoja del mes → abrir en Drive y ver las pestañas nuevas
  (Por Pagar/Por Cobrar/Traslados/Saldos/Entre Locales/Abonos) con datos. Requiere company con
  `driveRootFolderId` + owner con Drive conectado.

## Tareas operativas (usuario)
- **Rotar/revocar** los tokens de Coolify y Cloudflare usados en el deploy (ya no se necesitan).

## Verificación general
typecheck+lint+build verdes en Ecore; build verde en functions antes de cada gcloud deploy; UI en
navegador con la cuenta de pruebas (Playwright MCP). Commit por bloque, en español, trailer
`Co-Authored-By`. Mostrar resumen y preguntar guardar/deploy.
