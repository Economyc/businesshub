// Ejecución server-side de las mutaciones confirmadas desde Telegram.
// Port del subset necesario de src/modules/agent/utils/execute-mutation.ts
// (que corre client-side en la web) usando Admin SDK:
//   - createDocumentInCollection/updateDocumentInCollection ≈ helpers del cliente
//   - uploadCompanyDocument reemplaza el callable uploadDocumentToDrive
//
// Guardrail: toda escritura valida assertCompanyMember(uid, companyId).

import { Timestamp } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import {
  createDocumentInCollection,
  updateDocumentInCollection,
  fetchDocument,
} from '../firestore.js'
import { assertCompanyMember } from '../utils/company-access.js'
import { uploadCompanyDocument } from '../upload-document-to-drive.js'
import {
  resolveCompany,
  resolvePayeeOnCompany,
  type CompanyInfo,
  type PayeeRef,
  type PayeeType,
} from './resolve-payee.js'
import { formatCop } from './format.js'

export interface MutationResult {
  success: boolean
  message: string
  id?: string
}

export interface MutationAttachment {
  buffer: Buffer
  fileName: string
  mimeType: string
}

function toTimestamp(dateStr: string): Timestamp {
  return Timestamp.fromDate(new Date(dateStr))
}

type CompanyTarget =
  | { ok: true; companyId: string; label: string | null }
  | { ok: false; message: string }

function resolveTargetCompany(
  args: Record<string, unknown>,
  defaultCompanyId: string,
  companies: CompanyInfo[],
): CompanyTarget {
  const name = args.targetCompanyName
  if (typeof name !== 'string' || !name.trim()) {
    return { ok: true, companyId: defaultCompanyId, label: null }
  }
  const resolved = resolveCompany(name, companies)
  if (!resolved.ok) {
    if (resolved.reason === 'ambiguous') {
      return {
        ok: false,
        message: `El local "${name}" es ambiguo. Coincide con: ${resolved.matches.map((c) => c.name).join(', ')}. Sé más específico.`,
      }
    }
    return { ok: false, message: `No encontré el local "${name}".` }
  }
  return {
    ok: true,
    companyId: resolved.company.id,
    label: resolved.company.location ?? resolved.company.name,
  }
}

export async function executeServerMutation(opts: {
  uid: string
  defaultCompanyId: string
  toolName: string
  args: Record<string, unknown>
  companies: CompanyInfo[]
  attachment?: MutationAttachment | null
}): Promise<MutationResult> {
  const { uid, defaultCompanyId, toolName, args, companies, attachment } = opts

  const target = resolveTargetCompany(args, defaultCompanyId, companies)
  if (!target.ok) return { success: false, message: target.message }
  const companyId = target.companyId

  try {
    await assertCompanyMember(uid, companyId)
  } catch (err) {
    if (err instanceof HttpsError) return { success: false, message: err.message }
    throw err
  }

  try {
    switch (toolName) {
      case 'createTransaction': {
        let payeeRef: PayeeRef | undefined
        if (args.payeeType && args.payeeName) {
          const resolution = await resolvePayeeOnCompany(
            companyId,
            args.payeeType as PayeeType,
            String(args.payeeName),
          )
          if (!resolution.ok) {
            if (resolution.reason === 'ambiguous') {
              return {
                success: false,
                message: `Hay varios "${args.payeeName}" registrados (${resolution.matches.map((m) => m.name).join(', ')}). Sé más específico.`,
              }
            }
            return {
              success: false,
              message: `No encontré "${args.payeeName}" en ${args.payeeType === 'partner' ? 'socios' : args.payeeType === 'employee' ? 'empleados' : 'proveedores'}. Crea el registro primero, o usa payeeType="external" para terceros sin perfil.`,
            }
          }
          payeeRef = resolution.payee
        }

        const data: Record<string, unknown> = {
          concept: String(args.concept),
          category: String(args.category),
          amount: Number(args.amount),
          type: args.type as 'income' | 'expense',
          date: toTimestamp(String(args.date)),
          status: (args.status as 'paid' | 'pending') ?? (payeeRef ? 'pending' : 'paid'),
          ...(args.notes ? { notes: String(args.notes) } : {}),
          ...(payeeRef ? { payeeRef } : {}),
        }
        const id = await createDocumentInCollection(companyId, 'transactions', data)
        const localSuffix = target.label ? ` en ${target.label}` : ''
        const payeeSuffix = payeeRef
          ? args.type === 'income'
            ? ` (nos debe ${payeeRef.name})`
            : ` (debemos a ${payeeRef.name})`
          : ''
        return {
          success: true,
          message: `Transacción "${String(args.concept)}" por ${formatCop(Number(args.amount))} creada${localSuffix}${payeeSuffix}.`,
          id,
        }
      }

      case 'quickMarkInvoiceAsPaid': {
        const id = String(args.id)
        const existing = await fetchDocument(companyId, 'transactions', id)
        if (!existing) return { success: false, message: 'No encontré esa factura.' }
        if (existing.status !== 'pending') {
          return { success: false, message: 'Esa factura no está pendiente — ya está pagada o cancelada.' }
        }
        // Gasto compartido entre locales: esta factura es sólo UNA parte del
        // reparto y el bot ve una sola compañía. Marcarla pagada dejaría las
        // demás partes vivas sin ningún aviso, y encima no se sabe si el pago lo
        // hizo el local que desembolsa. Se resuelve en la app, que salda el grupo.
        const splitGroupId =
          typeof existing.splitGroupId === 'string' ? existing.splitGroupId : ''
        if (splitGroupId.startsWith('split-') || splitGroupId.startsWith('rsplit-')) {
          return {
            success: false,
            message:
              'Esa factura es un gasto compartido entre locales: hay que pagarla desde la app, en Cuentas por Pagar, para que se salde la parte de cada local.',
          }
        }
        const paidDateStr = args.paidDate
          ? String(args.paidDate)
          : new Date().toISOString().slice(0, 10)
        // Mantener los denormalizados que usan la hoja contable y los paneles de
        // saldo: sin ellos, paidParts() cae al fallback y el pendiente sale mal.
        const invoiceAmount = Number(existing.amount) || 0
        await updateDocumentInCollection(companyId, 'transactions', id, {
          status: 'paid',
          paidDate: toTimestamp(paidDateStr),
          paidAmount: invoiceAmount,
          remainingAmount: 0,
        })
        const supplier = args.supplierName ? ` de ${String(args.supplierName)}` : ''
        const amountLabel = args.amount !== undefined ? ` por ${formatCop(Number(args.amount))}` : ''
        return {
          success: true,
          message: `Factura "${String(args.concept)}"${supplier}${amountLabel} marcada como Pagada.`,
          id,
        }
      }

      case 'createPayableDocument': {
        if (!attachment) {
          return {
            success: false,
            message: 'No encuentro el archivo adjunto. Reenvía la foto o PDF de la factura y vuelve a intentarlo.',
          }
        }
        const documentKind = args.documentKind as 'invoice' | 'purchase'
        if (documentKind !== 'invoice' && documentKind !== 'purchase') {
          return { success: false, message: 'documentKind inválido — debe ser "invoice" o "purchase".' }
        }

        const supplierName = String(args.supplierName ?? '').trim()
        const docNumber = String(args.docNumber ?? '').trim()
        const dateStr = String(args.date ?? '').trim()
        const amount = Number(args.amount)
        const category = String(args.category ?? '').trim()
        if (!supplierName || !docNumber || !dateStr || !amount || !category) {
          return { success: false, message: 'Faltan campos requeridos (proveedor, número, fecha, monto, categoría).' }
        }

        const useCustomSupplier = args.customSupplier === true
        let payeeRef: PayeeRef
        // Categoría efectiva: si el proveedor está registrado y tiene categoría
        // propia, esa gana sobre la inferida por el LLM (info real del maestro).
        let effectiveCategory = category
        if (useCustomSupplier) {
          payeeRef = { type: 'external', id: 'external', name: supplierName }
        } else {
          const resolution = await resolvePayeeOnCompany(companyId, 'supplier', supplierName)
          if (!resolution.ok) {
            if (resolution.reason === 'ambiguous') {
              return { success: false, message: `Hay varios "${supplierName}" registrados. Sé más específico.` }
            }
            return {
              success: false,
              message:
                `No encontré "${supplierName}" en proveedores. ` +
                `Si es un proveedor ocasional que no quieres registrar, pídeme crearla con proveedor personalizado (customSupplier). ` +
                `Si debería quedar registrado, créalo primero desde la web.`,
            }
          }
          payeeRef = resolution.payee
          if (resolution.supplierCategory?.trim()) {
            effectiveCategory = resolution.supplierCategory.trim()
          }
        }

        const docType: 'Factura' | 'Compra' = documentKind === 'invoice' ? 'Factura' : 'Compra'
        const uploaded = await uploadCompanyDocument(uid, {
          companyId,
          docType,
          supplierName: payeeRef.name,
          docNumber,
          date: dateStr,
          fileBase64: attachment.buffer.toString('base64'),
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
        })

        const dateTs = toTimestamp(dateStr)
        const sourceDocument = {
          driveFileId: uploaded.driveFileId,
          driveWebViewLink: uploaded.webViewLink,
          fileName: uploaded.fileName,
          mimeType: attachment.mimeType,
          uploadedAt: Timestamp.now(),
        }

        const priorityArg =
          args.priority === 'immediate' || args.priority === 'waiting' ? args.priority : undefined
        const data: Record<string, unknown> = {
          concept: `${payeeRef.name} - ${docType} ${docNumber}`,
          category: effectiveCategory,
          amount,
          type: 'expense',
          date: dateTs,
          status: documentKind === 'invoice' ? 'pending' : 'paid',
          ...(args.notes ? { notes: String(args.notes) } : {}),
          payeeRef,
          documentKind,
          docNumber,
          sourceDocument,
          ...(documentKind === 'purchase' ? { paidDate: dateTs } : {}),
          ...(documentKind === 'invoice' && priorityArg ? { priority: priorityArg } : {}),
        }
        const id = await createDocumentInCollection(companyId, 'transactions', data)
        const localSuffix = target.label ? ` en ${target.label}` : ''
        return {
          success: true,
          message:
            documentKind === 'invoice'
              ? `Factura ${docNumber} de ${payeeRef.name} por ${formatCop(amount)} creada en estado Pendiente${localSuffix}. Archivo en Drive.`
              : `Compra ${docNumber} de ${payeeRef.name} por ${formatCop(amount)} registrada como pagada${localSuffix}. Archivo en Drive.`,
          id,
        }
      }

      case 'markInvoiceAsPaid': {
        if (!attachment) {
          return {
            success: false,
            message: 'No encuentro el comprobante adjunto. Reenvíalo y vuelve a intentarlo.',
          }
        }
        const invoiceId = String(args.invoiceId ?? '')
        const supplierName = String(args.supplierName ?? '').trim()
        const docNumber = String(args.docNumber ?? '').trim()
        const paidDateStr = String(args.paidDate ?? '').trim()
        if (!invoiceId || !supplierName || !docNumber || !paidDateStr) {
          return { success: false, message: 'Faltan datos para cruzar el pago (invoiceId, proveedor, número, fecha).' }
        }

        const existing = await fetchDocument(companyId, 'transactions', invoiceId)
        if (!existing) return { success: false, message: 'No encontré esa factura.' }
        if (existing.status !== 'pending') {
          return { success: false, message: 'Esa factura no está pendiente — no se puede cruzar.' }
        }

        const uploaded = await uploadCompanyDocument(uid, {
          companyId,
          docType: 'Pago',
          supplierName,
          docNumber,
          date: paidDateStr,
          fileBase64: attachment.buffer.toString('base64'),
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
        })

        await updateDocumentInCollection(companyId, 'transactions', invoiceId, {
          status: 'paid',
          paidDate: toTimestamp(paidDateStr),
          paymentProof: {
            driveFileId: uploaded.driveFileId,
            driveWebViewLink: uploaded.webViewLink,
            fileName: uploaded.fileName,
            mimeType: attachment.mimeType,
            uploadedAt: Timestamp.now(),
          },
        })

        return {
          success: true,
          message: `Factura ${docNumber} de ${supplierName} marcada como Pagada. Comprobante archivado en Drive.`,
          id: invoiceId,
        }
      }

      default:
        return { success: false, message: `Herramienta desconocida: ${toolName}` }
    }
  } catch (err) {
    // HttpsError de uploadCompanyDocument (Drive desconectado, token caducado,
    // permisos) → mensaje legible sin crear la transaction.
    if (err instanceof HttpsError) {
      return { success: false, message: err.message }
    }
    throw err
  }
}
