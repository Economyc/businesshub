import { tool } from 'ai'
import { z } from 'zod'
import { db } from '../firestore.js'

// Tools relacionadas a documentos de cuentas por pagar:
//  - createPayableDocument: crea Factura o Compra (mutation, confirma en cliente).
//      El cliente al confirmar hace dos cosas en orden:
//        1) toma el adjunto del último mensaje del usuario y lo sube a Drive
//           vía callable `uploadDocumentToDrive`
//        2) crea la Transaction en Firestore con sourceDocument apuntando al archivo.
//  - findMatchingPayables (query): busca CxP pendientes que matcheen un pago.
//  - markInvoiceAsPaid (mutation): cruza un comprobante con una factura
//      pendiente — sube el comprobante a Drive y marca la transacción como paid.

function tsToDate(val: unknown): Date | null {
  if (!val) return null
  if (typeof val === 'object' && val !== null && '_seconds' in val) {
    return new Date((val as { _seconds: number })._seconds * 1000)
  }
  return null
}

export function createPayableTools(companyId: string) {
  return {
    createPayableDocument: tool({
      description:
        'Crea una factura (cuenta por pagar) o una compra al contado a partir de un archivo adjunto (imagen o PDF). Requiere confirmación del usuario. ' +
        'Usa "invoice" cuando el documento es una factura/cuenta de cobro que queda pendiente de pago. ' +
        'Usa "purchase" cuando es una compra ya pagada al contado (recibo, factura POS). ' +
        'Antes de invocar esta tool, el usuario debe haber adjuntado el archivo en el mensaje. ' +
        'Extrae los campos de la imagen lo mejor posible — el usuario podrá corregirlos antes de confirmar.',
      parameters: z.object({
        documentKind: z
          .enum(['invoice', 'purchase'])
          .describe('"invoice" = factura/cuenta de cobro pendiente. "purchase" = compra al contado ya pagada.'),
        supplierName: z.string().describe('Nombre del proveedor tal como aparece en el documento.'),
        docNumber: z.string().describe('Número de factura o de compra (ej. "8821").'),
        date: z.string().describe('Fecha del documento en formato YYYY-MM-DD.'),
        amount: z.coerce.number().describe('Valor total del documento (sin separadores de miles).'),
        category: z.string().describe('Categoría de gasto sugerida (ej. "Suministros", "Servicios").'),
        notes: z.string().optional().describe('Notas adicionales si el documento incluye contexto relevante.'),
        priority: z
          .enum(['immediate', 'waiting'])
          .optional()
          .describe(
            'Solo aplica cuando documentKind="invoice". "immediate" marca la factura como urgente (rojo en la tabla). ' +
              'Si el usuario dice "urgente", "pagar ya", "no puede esperar" → usa "immediate". Default: "waiting".',
          ),
        customSupplier: z
          .boolean()
          .optional()
          .describe(
            'Pásalo true cuando el proveedor NO existe en la lista de proveedores registrados y el usuario quiere ' +
              'usarlo como tercero ocasional (equivalente al "proveedor personalizado" del UI). En ese caso el ' +
              'payee se guarda como external con el supplierName tal cual lo escribiste. Default: false (busca el ' +
              'proveedor en la lista). Antes de pasar true, confirma con el usuario que el proveedor no debe quedar ' +
              'registrado formalmente.',
          ),
      }),
      // No execute — el cliente maneja la confirmación, sube el adjunto a
      // Drive con uploadDocumentToDrive, y luego crea la Transaction.
    }),

    findMatchingPayables: tool({
      description:
        'Busca cuentas por pagar pendientes (Facturas en estado pending) que matcheen con un proveedor y un monto dados. ' +
        'Usar después de extraer datos de un comprobante de pago para encontrar la factura que cruza.',
      parameters: z.object({
        supplierName: z.string().describe('Nombre del proveedor extraído del comprobante.'),
        amount: z.coerce.number().describe('Monto del pago en pesos.'),
        amountTolerance: z
          .number()
          .optional()
          .default(0)
          .describe('Tolerancia absoluta sobre el monto (ej. 100 = ±$100). Default 0.'),
      }),
      execute: async ({ supplierName, amount, amountTolerance = 0 }) => {
        const txSnap = await db
          .collection('companies')
          .doc(companyId)
          .collection('transactions')
          .where('documentKind', '==', 'invoice')
          .where('status', '==', 'pending')
          .get()

        const search = supplierName.toLowerCase().trim()
        const matches = txSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown>))
          .filter((t) => {
            const ref = t.payeeRef as { name?: string } | undefined
            const name = (ref?.name ?? '').toLowerCase()
            if (!name.includes(search) && !search.includes(name)) return false
            const amt = Number(t.amount ?? 0)
            return Math.abs(amt - amount) <= amountTolerance
          })
          .map((t) => ({
            id: t.id,
            concept: t.concept,
            amount: t.amount,
            docNumber: t.docNumber,
            date: tsToDate(t.date)?.toISOString().split('T')[0] ?? null,
            supplierName: (t.payeeRef as { name?: string } | undefined)?.name ?? null,
            sourceDocumentLink: (t.sourceDocument as { driveWebViewLink?: string } | undefined)?.driveWebViewLink ?? null,
          }))

        return {
          count: matches.length,
          matches,
        }
      },
    }),

    markInvoiceAsPaid: tool({
      description:
        'Marca una factura pendiente como pagada y adjunta el comprobante de pago. Requiere confirmación del usuario. ' +
        'Antes de invocar esta tool, el usuario debe haber adjuntado el comprobante (imagen o PDF) en el mensaje, ' +
        'y se debe haber identificado la factura correcta con findMatchingPayables.',
      parameters: z.object({
        invoiceId: z.string().describe('ID de la Transaction (factura pendiente) a marcar como pagada.'),
        supplierName: z.string().describe('Nombre del proveedor (para construir el nombre del archivo del comprobante).'),
        docNumber: z.string().describe('Número de factura asociado (mismo que aparece en la factura original).'),
        paidDate: z.string().describe('Fecha real del pago en formato YYYY-MM-DD.'),
        amount: z.coerce.number().describe('Monto del pago (para mostrar al usuario en la confirmación).'),
      }),
    }),
  }
}
