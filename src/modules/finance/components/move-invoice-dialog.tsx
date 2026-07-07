import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, ArrowRight, CheckCircle2, AlertCircle, Building2 } from 'lucide-react'
import { modalVariants } from '@/core/animations/variants'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { formatCurrency } from '@/core/utils/format'
import { financeService } from '../services'
import type { Transaction } from '../types'

interface MoveInvoiceDialogProps {
  open: boolean
  transaction: Transaction | null
  fromCompanyId: string
  fromCompanyName: string
  toCompany: { id: string; name: string } | null
  onClose: () => void
  /** Se llama al terminar con éxito para refrescar la lista. */
  onMoved: () => void
}

// Extrae un mensaje accionable del error de una callable v2 (mismo criterio que
// transaction-form): failed-precondition trae texto listo para el usuario.
function extractError(err: unknown): string {
  const e = err as { code?: string; message?: string }
  const code = e?.code ?? ''
  const message = e?.message ?? ''
  if (
    code === 'functions/failed-precondition' ||
    code === 'functions/not-found' ||
    code === 'functions/permission-denied' ||
    code === 'functions/invalid-argument'
  ) {
    return message || 'No se pudo mover la factura.'
  }
  if (code === 'functions/unavailable' || code === 'functions/deadline-exceeded') {
    return 'No se pudo contactar al servidor. Verificá tu conexión e intentá de nuevo.'
  }
  if (message && message.toLowerCase() !== 'internal') return message
  return 'Ocurrió un error al mover la factura. Intentá de nuevo o avisá a soporte.'
}

function countFiles(t: Transaction): number {
  return [t.sourceDocument, t.paymentProof, t.combinedDocument].filter((f) => !!f?.driveFileId).length
}

export function MoveInvoiceDialog({
  open,
  transaction,
  fromCompanyId,
  fromCompanyName,
  toCompany,
  onClose,
  onMoved,
}: MoveInvoiceDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // Resetear estado al abrir/cerrar.
  useEffect(() => {
    if (!open) {
      setLoading(false)
      setError(null)
      setWarning(null)
      setDone(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !loading) onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose, loading])

  if (!transaction || !toCompany) return null

  const fileCount = countFiles(transaction)

  async function handleConfirm() {
    if (!transaction || !toCompany) return
    setLoading(true)
    setError(null)
    try {
      const res = await financeService.moveToCompany(fromCompanyId, transaction.id, toCompany.id)
      setWarning(res.sheetWarning)
      setDone(true)
      onMoved()
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20"
            onClick={loading ? undefined : onClose}
          />
          <motion.div
            variants={modalVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="relative bg-surface-elevated rounded-xl p-4 sm:p-6 shadow-lg max-w-md w-full mx-4 border border-border"
          >
            {done ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 size={18} className="text-positive-text" />
                  <h3 className="text-subheading font-semibold text-dark-graphite">Factura movida</h3>
                </div>
                <p className="text-body text-mid-gray mb-4">
                  <span className="font-medium text-graphite">{transaction.payeeRef?.name || 'La factura'}</span> ya
                  está en <span className="font-medium text-graphite">{toCompany.name}</span>
                  {fileCount > 0 && <> junto con {fileCount} archivo{fileCount === 1 ? '' : 's'}</>}. Las hojas
                  contables de ambas compañías se actualizaron.
                </p>
                {warning && (
                  <Alert variant="warning" className="mb-4">
                    <AlertCircle size={14} />
                    <AlertDescription>{warning}</AlertDescription>
                  </Alert>
                )}
                <div className="flex justify-end">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg text-body font-medium btn-primary transition-all duration-200"
                  >
                    Listo
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-subheading font-semibold text-dark-graphite mb-2">Mover a otra compañía</h3>
                <p className="text-body text-mid-gray mb-4">
                  Vas a mover la factura de{' '}
                  <span className="font-medium text-graphite">{transaction.payeeRef?.name || 'proveedor sin nombre'}</span>{' '}
                  por <span className="font-medium text-graphite tabular-nums">{formatCurrency(transaction.amount, 0)}</span>.
                </p>

                <div className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-bone px-3 py-2.5 mb-4">
                  <span className="inline-flex items-center gap-1.5 min-w-0 text-body text-graphite">
                    <Building2 size={14} strokeWidth={1.5} className="text-mid-gray shrink-0" />
                    <span className="truncate">{fromCompanyName}</span>
                  </span>
                  <ArrowRight size={16} strokeWidth={1.5} className="text-mid-gray shrink-0" />
                  <span className="inline-flex items-center gap-1.5 min-w-0 text-body font-medium text-dark-graphite">
                    <Building2 size={14} strokeWidth={1.5} className="text-mid-gray shrink-0" />
                    <span className="truncate">{toCompany.name}</span>
                  </span>
                </div>

                <p className="text-caption text-mid-gray mb-6">
                  {fileCount > 0
                    ? `Se moverán ${fileCount} archivo${fileCount === 1 ? '' : 's'} en Drive y se actualizará la hoja contable de ambas compañías.`
                    : 'Se actualizará la hoja contable de ambas compañías.'}
                </p>

                {error && (
                  <Alert variant="negative" className="mb-4">
                    <AlertCircle size={14} />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    onClick={onClose}
                    disabled={loading}
                    className="px-4 py-2 rounded-lg text-body font-medium border border-input-border text-graphite hover:bg-bone transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={loading}
                    className="px-4 py-2 rounded-lg text-body font-medium btn-primary transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {loading && <Loader2 size={14} className="animate-spin" />}
                    {loading ? 'Moviendo...' : 'Mover'}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
