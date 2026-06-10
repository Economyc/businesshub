// Subset de tools del agente expuesto en Telegram.
//
// Lectura: reusa las tools server-side existentes, envueltas para aceptar un
// companyName opcional por llamada (en la web la company activa la fija la UI;
// en Telegram el usuario la nombra en el mensaje: "¿cuánto debo en Filipo?").
//
// Escritura: redefinidas SIN execute — el SDK corta el loop, el bot guarda la
// mutación pendiente y muestra botones ✅/❌; al confirmar se ejecuta
// server-side en mutations.ts. Todas aceptan targetCompanyName.

import { tool, type ToolSet } from 'ai'
import { z } from 'zod'
import { createFinanceTools } from '../tools/finance-tools.js'
import { createPayableTools } from '../tools/payable-tools.js'
import { createCollectionsTools } from '../tools/collections-tools.js'
import { createObligationsTools } from '../tools/obligations-tools.js'
import { createSupplierTools } from '../tools/supplier-tools.js'
import { resolveCompany, type CompanyInfo } from './resolve-payee.js'
import { updateChatState } from './history.js'

interface AnyTool {
  description?: string
  parameters: z.AnyZodObject
  execute?: (args: never, options: never) => PromiseLike<unknown>
}

const COMPANY_NAME_PARAM = z
  .string()
  .optional()
  .describe(
    'Nombre, slug o location del local a consultar. Si se omite, usa el local activo. ' +
      'Úsalo cuando el usuario menciona explícitamente otro local.',
  )

/**
 * Envuelve una tool de lectura existente agregando companyName opcional:
 * resuelve el local por nombre y re-instancia la tool sobre esa company.
 */
function readToolForAnyCompany(
  name: string,
  build: (companyId: string) => Record<string, unknown>,
  defaultCompanyId: string,
  companies: CompanyInfo[],
) {
  const proto = build(defaultCompanyId)[name] as AnyTool
  return {
    description: proto.description,
    parameters: proto.parameters.extend({ companyName: COMPANY_NAME_PARAM }),
    execute: async (args: Record<string, unknown>, options: unknown) => {
      const { companyName, ...rest } = args
      let companyId = defaultCompanyId
      if (typeof companyName === 'string' && companyName.trim()) {
        const resolved = resolveCompany(companyName, companies)
        if (!resolved.ok) {
          return {
            error:
              resolved.reason === 'ambiguous'
                ? `El local "${companyName}" es ambiguo. Coincide con: ${resolved.matches.map((c) => c.name).join(', ')}.`
                : `No encontré el local "${companyName}".`,
          }
        }
        companyId = resolved.company.id
      }
      const instance = build(companyId)[name] as AnyTool
      return instance.execute!(rest as never, options as never)
    },
  }
}

const TARGET_COMPANY_PARAM = z
  .string()
  .optional()
  .describe(
    'Nombre, slug o location del local donde ejecutar la operación. ' +
      'Si se omite, usa el local activo.',
  )

export function createTelegramTools(opts: {
  activeCompanyId: string
  companies: CompanyInfo[]
  chatId: number
}): ToolSet {
  const { activeCompanyId, companies, chatId } = opts

  const read = (name: string, build: (cid: string) => Record<string, unknown>) =>
    readToolForAnyCompany(name, build, activeCompanyId, companies)

  const tools = {
    // ── Lectura (ejecutan server-side de inmediato) ──────────────────────
    getTransactions: read('getTransactions', createFinanceTools),
    getPendingInvoicesBySupplier: read('getPendingInvoicesBySupplier', createFinanceTools),
    getCashFlow: read('getCashFlow', createFinanceTools),
    getExpensesByCategory: read('getExpensesByCategory', createFinanceTools),
    findMatchingPayables: read('findMatchingPayables', createPayableTools),
    getOverdueCollections: read('getOverdueCollections', createCollectionsTools),
    getWeeklyObligations: read('getWeeklyObligations', createObligationsTools),
    getSuppliers: read('getSuppliers', createSupplierTools),

    switchCompany: tool({
      description:
        'Cambia el local activo de esta conversación de Telegram. El local activo es el default ' +
        'para consultas y escrituras cuando el usuario no nombra uno explícitamente.',
      parameters: z.object({
        companyName: z.string().describe('Nombre, slug o location del local a activar.'),
      }),
      execute: async ({ companyName }) => {
        const resolved = resolveCompany(companyName, companies)
        if (!resolved.ok) {
          return {
            error:
              resolved.reason === 'ambiguous'
                ? `"${companyName}" es ambiguo. Coincide con: ${resolved.matches.map((c) => c.name).join(', ')}.`
                : `No encontré el local "${companyName}".`,
          }
        }
        await updateChatState(chatId, {
          activeCompanyId: resolved.company.id,
          activeCompanyName: resolved.company.name,
        })
        return {
          ok: true,
          message: `Local activo: ${resolved.company.name}${resolved.company.location ? ` (${resolved.company.location})` : ''}. Aplica desde el próximo mensaje; en este turno usa companyName/targetCompanyName si necesitas consultar este local.`,
        }
      },
    }),

    // ── Escritura (sin execute → confirmación con botones) ──────────────
    createTransaction: tool({
      description:
        'Crea una transacción financiera (ingreso o gasto). Requiere confirmación del usuario con botón. ' +
        'Para una CUENTA POR COBRAR usa type="income" + status="pending" + payee del deudor. ' +
        'Usa los campos payee* cuando alguien adelantó la plata, nos vendió a crédito o nos debe: ' +
        'en ese caso status debe ser "pending".',
      parameters: z.object({
        concept: z.string().describe('Concepto o descripción de la transacción'),
        category: z.string().describe('Categoría de la transacción'),
        amount: z.coerce.number().describe('Monto de la transacción'),
        type: z.enum(['income', 'expense']).describe('Tipo: income (ingreso) o expense (gasto)'),
        date: z.string().describe('Fecha de la transacción (YYYY-MM-DD)'),
        status: z
          .enum(['paid', 'pending'])
          .optional()
          .default('paid')
          .describe('Estado: paid o pending. Usar pending cuando hay payee (deuda por cobrar/pagar).'),
        notes: z.string().optional().describe('Notas adicionales'),
        payeeType: z
          .enum(['partner', 'employee', 'supplier', 'external'])
          .optional()
          .describe(
            'Tipo de tercero. partner=socio, employee=empleado, supplier=proveedor, external=tercero sin perfil (clientes a los que les cobramos suelen ser external).',
          ),
        payeeName: z
          .string()
          .optional()
          .describe('Nombre del tercero. Requerido si payeeType está definido.'),
        targetCompanyName: TARGET_COMPANY_PARAM,
      }),
    }),

    createPayableDocument: tool({
      description:
        'Crea una factura (cuenta por pagar) o una compra al contado a partir de la foto o PDF que el usuario adjuntó. ' +
        'Requiere confirmación del usuario con botón. ' +
        'Usa "invoice" cuando es una factura/cuenta de cobro que queda pendiente de pago. ' +
        'Usa "purchase" cuando es una compra ya pagada al contado (recibo, factura POS). ' +
        'Extrae los campos del documento lo mejor posible — el usuario verá el resumen antes de confirmar.',
      parameters: z.object({
        documentKind: z
          .enum(['invoice', 'purchase'])
          .describe('"invoice" = factura pendiente de pago. "purchase" = compra al contado ya pagada.'),
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
            'Solo para documentKind="invoice". "immediate" = urgente. Si el usuario dice "urgente", "pagar ya" → "immediate". Default: "waiting".',
          ),
        customSupplier: z
          .boolean()
          .optional()
          .describe(
            'true cuando el proveedor NO existe en la lista registrada y el usuario quiere usarlo como tercero ocasional. Default: false (busca el proveedor en la lista).',
          ),
        targetCompanyName: TARGET_COMPANY_PARAM,
      }),
    }),

    quickMarkInvoiceAsPaid: tool({
      description:
        'Marca una factura pendiente como pagada SIN adjuntar comprobante. Úsala cuando el usuario dice ' +
        '"ya pagué la factura X" sin mandar comprobante. Si manda foto del comprobante, usa markInvoiceAsPaid. ' +
        'Antes de invocar, resuelve el ID real con getTransactions o findMatchingPayables. Requiere confirmación.',
      parameters: z.object({
        id: z.string().describe('ID de la transacción (factura pendiente) a marcar como pagada'),
        concept: z.string().describe('Concepto/descripción de la factura (para la confirmación)'),
        amount: z.coerce.number().describe('Monto de la factura (para la confirmación)'),
        supplierName: z.string().optional().describe('Nombre del proveedor (para la confirmación)'),
        paidDate: z
          .string()
          .optional()
          .describe('Fecha del pago (YYYY-MM-DD). Si se omite, hoy.'),
        targetCompanyName: TARGET_COMPANY_PARAM,
      }),
    }),

    markInvoiceAsPaid: tool({
      description:
        'Marca una factura pendiente como pagada adjuntando el comprobante que el usuario envió (foto o PDF). ' +
        'El comprobante se archiva en Drive. Identifica primero la factura con findMatchingPayables. Requiere confirmación.',
      parameters: z.object({
        invoiceId: z.string().describe('ID de la Transaction (factura pendiente) a marcar como pagada.'),
        supplierName: z.string().describe('Nombre del proveedor (para el nombre del archivo del comprobante).'),
        docNumber: z.string().describe('Número de factura asociado.'),
        paidDate: z.string().describe('Fecha real del pago en formato YYYY-MM-DD.'),
        amount: z.coerce.number().describe('Monto del pago (para la confirmación).'),
        targetCompanyName: TARGET_COMPANY_PARAM,
      }),
    }),
  }

  return tools as unknown as ToolSet
}

/** Tools de escritura: requieren confirmación y ejecutan en mutations.ts. */
export const WRITE_TOOL_NAMES = new Set([
  'createTransaction',
  'createPayableDocument',
  'quickMarkInvoiceAsPaid',
  'markInvoiceAsPaid',
])

/** Tools de escritura que necesitan el archivo adjunto del usuario. */
export const FILE_TOOL_NAMES = new Set(['createPayableDocument', 'markInvoiceAsPaid'])
