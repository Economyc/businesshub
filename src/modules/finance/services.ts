import { doc, getDoc, setDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, getAppFunctions } from '@/core/firebase/config'
import { fetchCollection, fetchDocument, createDocument, updateDocument, removeDocument } from '@/core/firebase/helpers'
import type { Transaction, TransactionFormData, BudgetConfig } from './types'

const COLLECTION = 'transactions'

// Resultado del borrado en cascada (Firestore + Drive + hoja del mes). Lo
// devuelve la Cloud Function `deleteTransactionWithAttachments`.
//
// La función borra Firestore PRIMERO (operación más confiable) y los archivos
// de Drive después en best-effort: si la tx tenía adjuntos pero Drive falló al
// borrarlos, `driveErrors` trae los mensajes para mostrar — la tx ya está
// limpia en la app, solo quedaron huérfanos recuperables. Si la hoja contable
// no se pudo regenerar al instante (Drive desconectado), `sheetWarning` lo
// avisa y el cron la regenera en ≤10 min.
export interface DeleteWithAttachmentsResult {
  deletedFiles: number
  attemptedFiles: number
  monthRegenerated: { year: number; monthIndex: number } | null
  sheetWarning: string | null
  alreadyDeleted: boolean
  driveErrors: string[]
}

// Resultado de mover una factura pendiente a otra compañía. Lo devuelve la
// Cloud Function `moveInvoiceToCompany`: reubica el registro + los archivos en
// Drive y regenera la hoja contable de ambas compañías al instante. Si alguna
// hoja no se pudo regenerar en el momento (Drive desconectado), `sheetWarning`
// lo avisa y el cron la retomará en ≤10 min.
export interface MoveInvoiceResult {
  newTransactionId: string | null
  movedFiles: number
  attemptedFiles: number
  sheetOriginRegenerated: boolean
  sheetTargetRegenerated: boolean
  sheetWarning: string | null
  alreadyMoved: boolean
}

export const financeService = {
  getAll: (companyId: string) => fetchCollection<Transaction>(companyId, COLLECTION),
  getById: (companyId: string, id: string) => fetchDocument<Transaction>(companyId, COLLECTION, id),
  create: (companyId: string, data: TransactionFormData) => createDocument(companyId, COLLECTION, data),
  update: (companyId: string, id: string, data: Partial<TransactionFormData>) => updateDocument(companyId, COLLECTION, id, data),
  // Borrado solo de Firestore. Lo siguen usando flujos donde NO hay adjuntos
  // en Drive (nómina por splitGroupId, transacciones recurrentes). Para el
  // borrado desde el panel de facturación se usa `deleteWithAttachments`.
  remove: (companyId: string, id: string) => removeDocument(companyId, COLLECTION, id),
  // Borrado en cascada: archivos en Drive (factura, comprobante, PDF combinado)
  // + doc en Firestore + regeneración inmediata de la hoja contable del mes.
  // Si Drive está desconectado y la tx tiene adjuntos, la callable aborta sin
  // borrar nada — el caller debe propagar el error al usuario.
  deleteWithAttachments: async (
    companyId: string,
    id: string,
  ): Promise<DeleteWithAttachmentsResult> => {
    const fns = await getAppFunctions()
    const callable = httpsCallable<
      { companyId: string; transactionId: string },
      DeleteWithAttachmentsResult
    >(fns, 'deleteTransactionWithAttachments')
    const res = await callable({ companyId, transactionId: id })
    return res.data
  },
  // Mueve una factura pendiente a otra compañía (registro + archivos en Drive +
  // regeneración de ambas hojas contables). Server-side vía callable.
  moveToCompany: async (
    fromCompanyId: string,
    transactionId: string,
    toCompanyId: string,
  ): Promise<MoveInvoiceResult> => {
    const fns = await getAppFunctions()
    const callable = httpsCallable<
      { fromCompanyId: string; transactionId: string; toCompanyId: string },
      MoveInvoiceResult
    >(fns, 'moveInvoiceToCompany')
    const res = await callable({ fromCompanyId, transactionId, toCompanyId })
    return res.data
  },
}

export const budgetService = {
  async get(companyId: string): Promise<BudgetConfig> {
    const ref = doc(db, 'companies', companyId, 'settings', 'budget')
    const snap = await getDoc(ref)
    if (snap.exists()) return snap.data() as BudgetConfig
    return { items: [] }
  },
  async save(companyId: string, config: BudgetConfig): Promise<void> {
    const ref = doc(db, 'companies', companyId, 'settings', 'budget')
    await setDoc(ref, config)
  },
}
