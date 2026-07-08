---
name: pendientes-facturacion
description: "Genera el Excel de facturas por pagar pendientes de los 4 locales (datos de Ecore), una hoja por compañía"
user_invocable: true
---

# Pendientes de facturación

Genera un Excel con las facturas por pagar pendientes de cada local — una hoja por compañía: Blue Smash Manila, Blue Smash Escondite, Filippo Belén y Filippo San Lucas. Los datos salen de la misma Firestore que usa Ecore (`empresas-bf`, colección `transactions`), con el mismo filtro de la vista Por Pagar → Proveedores (facturas en estado pendiente/vencida/parcial, sin préstamos entre locales).

## Pasos

1. Desde la raíz del repo, ejecutar:
   ```
   node scripts/facturas-por-pagar-restaurantes.mjs
   ```
2. Sin argumento, o con el argumento `todos`, se generan los 4 locales (comando del paso 1 tal cual). Si el usuario pidió un solo local (ej. `/pendientes-facturacion manila`), pasar `--company <id>` usando esta tabla:

   | Local | id |
   |---|---|
   | Blue Smash Manila | `36dNFE9OH1ISyGXZ5GKe` |
   | Blue Smash Escondite | `3mU7Tld2uq1OjTLrgbQ2` |
   | Filippo Belén | `C06xQypKRqtVenO4ZLfy` |
   | Filippo San Lucas | `L3yMbGCeVgL3pQvA1hi4` |

3. Si falla con `UNAUTHENTICATED` / `invalid_grant`, pedir al usuario que corra `! gcloud auth application-default login` y reintentar.
4. Al terminar, mostrar al usuario el resumen por local que imprime el script (facturas pendientes, cuántas vencidas, saldo por pagar) y la ruta del archivo generado (`~/Downloads/Facturas-Por-Pagar_YYYY-MM-DD.xlsx`).
