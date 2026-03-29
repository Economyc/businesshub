import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { receiptVariants } from '@/core/animations/variants'
import { formatCurrency } from '@/core/utils/format'
import type { Closing } from '../types'

function formatDate(dateStr: string): string {
  if (!dateStr) return '--'
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })
}

interface ClosingReceiptProps {
  closing: Closing | null
  companyName: string
  onClose: () => void
}

function ReceiptLine({ label, amount, bold }: { label: string; amount: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-bold text-dark-graphite' : ''}`}>
      <span>{label}</span>
      <span className="tabular-nums">{formatCurrency(amount)}</span>
    </div>
  )
}

function Separator({ double }: { double?: boolean }) {
  return (
    <div className="text-graphite/25 select-none overflow-hidden whitespace-nowrap" aria-hidden>
      {double ? '================================' : '- - - - - - - - - - - - - - - -'}
    </div>
  )
}

export function ClosingReceipt({ closing, companyName, onClose }: ClosingReceiptProps) {
  useEffect(() => {
    if (!closing) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [closing, onClose])

  return (
    <AnimatePresence>
      {closing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/25"
            onClick={onClose}
          />

          {/* Receipt */}
          <motion.div
            variants={receiptVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="relative max-w-[320px] w-full max-h-[90vh] overflow-y-auto scrollbar-hide"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute -top-3 -right-3 z-10 p-1.5 rounded-full bg-surface-elevated border border-border text-mid-gray hover:text-graphite shadow-md transition-colors"
            >
              <X size={14} strokeWidth={2} />
            </button>

            <div className="bg-surface-elevated rounded-lg shadow-xl border border-border font-mono text-[13px] leading-relaxed text-graphite px-6 py-5 relative overflow-hidden">

              {/* Header */}
              <div className="text-center mb-1">
                <Separator double />
                <div className="font-bold text-dark-graphite uppercase tracking-widest text-[14px] mt-2">
                  Cierre de Caja
                </div>
                <div className="text-mid-gray text-[12px] mb-2">{companyName}</div>
                <Separator double />
              </div>

              {/* Date & Responsible */}
              <div className="mt-3 mb-1 space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-mid-gray">Fecha</span>
                  <span className="font-medium text-dark-graphite">{formatDate(closing.date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-mid-gray">Responsable</span>
                  <span className="font-medium text-dark-graphite">{closing.responsable || '--'}</span>
                </div>
              </div>

              <div className="my-3"><Separator /></div>

              {/* Sales Detail */}
              <div className="text-center text-[11px] uppercase tracking-wider text-mid-gray mb-2">
                Detalle de Ventas
              </div>

              <div className="space-y-0.5">
                <ReceiptLine label="Apertura (AP)" amount={closing.ap ?? 0} />
                <ReceiptLine label="QR" amount={closing.qr ?? 0} />
                <ReceiptLine label="Datafono" amount={closing.datafono ?? 0} />
                <ReceiptLine label="Rappi" amount={closing.rappiVentas ?? 0} />
                <ReceiptLine label="Efectivo" amount={closing.efectivo ?? 0} />
              </div>

              <div className="flex justify-end my-1">
                <span className="text-graphite/25 text-[12px]">----------</span>
              </div>

              <ReceiptLine label="VENTA TOTAL" amount={closing.ventaTotal ?? 0} bold />

              <div className="my-3"><Separator /></div>

              {/* Other Concepts */}
              <div className="text-center text-[11px] uppercase tracking-wider text-mid-gray mb-2">
                Otros Conceptos
              </div>

              <div className="space-y-0.5">
                <ReceiptLine label="Propinas" amount={closing.propinas ?? 0} />
                <ReceiptLine label="Gastos" amount={closing.gastos ?? 0} />
                <ReceiptLine label="Caja Menor" amount={closing.cajaMenor ?? 0} />
              </div>

              <div className="flex justify-end my-1">
                <span className="text-graphite/25 text-[12px]">----------</span>
              </div>

              <ReceiptLine label="ENTREGA EFECTIVO" amount={closing.entregaEfectivo ?? 0} bold />

              {/* Footer */}
              <div className="mt-3 text-center">
                <Separator double />
                <div className="text-[11px] text-mid-gray mt-2">
                  Generado por BusinessHub
                </div>
              </div>

              {/* Torn paper edge effect */}
              <div
                className="absolute bottom-0 left-0 right-0 h-3 -mb-px"
                style={{
                  background: `linear-gradient(135deg, var(--color-surface-elevated) 33.33%, transparent 33.33%) 0 0 / 12px 100%, linear-gradient(225deg, var(--color-surface-elevated) 33.33%, transparent 33.33%) 0 0 / 12px 100%`,
                  backgroundRepeat: 'repeat-x',
                }}
              />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
