import { useEffect } from 'react'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { X, User, ShoppingBag, CreditCard, Receipt, MessageSquare } from 'lucide-react'
import { formatCurrency } from '@/core/utils/format'
import type { PosVenta } from '../types'

function num(val: string | number | undefined): number {
  return Number(val) || 0
}

const DOC_TYPE_LABELS: Record<string, string> = {
  F: 'Factura',
  B: 'Boleta',
  NV: 'Nota de Venta',
}

const drawerVariants: Variants = {
  initial: { x: '100%' },
  animate: { x: 0, transition: { type: 'spring', damping: 25, stiffness: 300 } },
  exit: { x: '100%', transition: { duration: 0.2 } },
}

interface VentaDetailDrawerProps {
  venta: PosVenta | null
  onClose: () => void
}

export function VentaDetailDrawer({ venta, onClose }: VentaDetailDrawerProps) {
  // Escape key
  useEffect(() => {
    if (!venta) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [venta, onClose])

  // Body scroll lock
  useEffect(() => {
    if (!venta) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [venta])

  const tipoLabel = venta ? (DOC_TYPE_LABELS[venta.tipo_documento?.toUpperCase()] ?? venta.tipo_documento) : ''
  const cliente = venta?.cliente
  const detalle = venta?.detalle ?? []
  const pagos = venta?.pagosList ?? []
  const propinas = venta?.lista_propinas ?? []
  const totalPropinas = propinas.reduce((s, p) => s + num(p.montoConIgv), 0)

  return (
    <AnimatePresence>
      {venta && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            variants={drawerVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="relative w-full md:max-w-lg bg-surface shadow-lg overflow-y-auto rounded-l-xl"
          >
            {/* Header */}
            <div className="sticky top-0 bg-surface border-b border-bone px-5 py-4 z-10">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-bone transition-colors"
                aria-label="Cerrar"
              >
                <X size={18} className="text-mid-gray" />
              </button>

              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-caption bg-bone text-graphite">
                  {tipoLabel}
                </span>
                {venta.estado_txt && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-caption bg-bone text-graphite">
                    {venta.estado_txt}
                  </span>
                )}
              </div>

              <h2 className="text-subheading font-semibold text-dark-graphite">
                {venta.documento} <span className="text-mid-gray font-normal">{venta.serie}-{venta.correlativo}</span>
              </h2>

              <div className="flex items-center gap-3 mt-1 text-caption text-mid-gray">
                <span>{venta.fecha?.slice(0, 16)}</span>
                {(venta.canalventa || venta.nombre_canaldelivery) && (
                  <span>· {venta.canalventa || venta.nombre_canaldelivery}</span>
                )}
              </div>
            </div>

            <div className="divide-y divide-bone">
              {/* Cliente */}
              {cliente && (cliente.cliente_nombres || cliente.cliente_dniruc) && (
                <section className="px-5 py-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <User size={14} className="text-mid-gray" />
                    <span className="text-caption font-semibold text-dark-graphite uppercase tracking-wider">Cliente</span>
                  </div>
                  <div className="space-y-0.5 text-body text-graphite">
                    {(cliente.cliente_nombres || cliente.cliente_apellidos) && (
                      <p>{[cliente.cliente_nombres, cliente.cliente_apellidos].filter(Boolean).join(' ')}</p>
                    )}
                    {cliente.cliente_dniruc && <p className="text-caption text-mid-gray">DNI/RUC: {cliente.cliente_dniruc}</p>}
                    {cliente.cliente_email && <p className="text-caption text-mid-gray">{cliente.cliente_email}</p>}
                  </div>
                </section>
              )}

              {/* Productos */}
              <section className="px-5 py-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <ShoppingBag size={14} className="text-mid-gray" />
                  <span className="text-caption font-semibold text-dark-graphite uppercase tracking-wider">
                    Productos ({detalle.length})
                  </span>
                </div>

                {detalle.length === 0 ? (
                  <p className="text-caption text-mid-gray">Sin detalle de productos</p>
                ) : (
                  <div className="overflow-x-auto -mx-5 px-5">
                    <table className="w-full text-caption">
                      <thead>
                        <tr className="text-left text-mid-gray border-b border-bone">
                          <th className="pb-2 pr-3 font-semibold">Producto</th>
                          <th className="pb-2 pr-3 font-semibold text-right w-14">Cant.</th>
                          <th className="pb-2 pr-3 font-semibold text-right w-20">P.Unit</th>
                          <th className="pb-2 font-semibold text-right w-20">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalle.map((item, i) => (
                          <tr key={item.id_detalle ?? i} className="border-b border-bone/50 last:border-0">
                            <td className="py-2 pr-3 text-graphite">
                              <div>{item.nombre_producto}</div>
                              {item.categoria_descripcion && (
                                <div className="text-mid-gray text-[11px]">{item.categoria_descripcion}</div>
                              )}
                            </td>
                            <td className="py-2 pr-3 text-right text-graphite">{num(item.cantidad_vendida)}</td>
                            <td className="py-2 pr-3 text-right text-graphite">{formatCurrency(num(item.precio_unitario))}</td>
                            <td className="py-2 text-right font-medium text-dark-graphite">{formatCurrency(num(item.venta_total))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* Pagos */}
              {pagos.length > 0 && (
                <section className="px-5 py-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <CreditCard size={14} className="text-mid-gray" />
                    <span className="text-caption font-semibold text-dark-graphite uppercase tracking-wider">Pagos</span>
                  </div>
                  <div className="space-y-1">
                    {pagos.map((p, i) => (
                      <div key={i} className="flex items-center justify-between text-body">
                        <span className="text-graphite">{p.tipoPago || 'Pago'}</span>
                        <span className="text-dark-graphite font-medium">{formatCurrency(num(p.monto))}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Totales */}
              <section className="px-5 py-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <Receipt size={14} className="text-mid-gray" />
                  <span className="text-caption font-semibold text-dark-graphite uppercase tracking-wider">Totales</span>
                </div>
                <div className="space-y-1.5">
                  <TotalRow label="Subtotal" value={num(venta.subtotal)} />
                  {num(venta.descuento) > 0 && <TotalRow label="Descuento" value={-num(venta.descuento)} />}
                  <TotalRow label="Impuestos" value={num(venta.impuestos)} />
                  {num(venta.costoenvio) > 0 && <TotalRow label="Envío" value={num(venta.costoenvio)} />}
                  {totalPropinas > 0 && <TotalRow label="Propinas" value={totalPropinas} />}
                  <div className="flex items-center justify-between pt-2 border-t border-bone">
                    <span className="text-body font-semibold text-dark-graphite">Total</span>
                    <span className="text-kpi font-bold text-dark-graphite">{formatCurrency(num(venta.total))}</span>
                  </div>
                </div>
              </section>

              {/* Observaciones */}
              {venta.venta_observaciones && (
                <section className="px-5 py-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <MessageSquare size={14} className="text-mid-gray" />
                    <span className="text-caption font-semibold text-dark-graphite uppercase tracking-wider">Observaciones</span>
                  </div>
                  <p className="text-body text-graphite">{venta.venta_observaciones}</p>
                </section>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

function TotalRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-body">
      <span className="text-mid-gray">{label}</span>
      <span className="text-graphite">{formatCurrency(value)}</span>
    </div>
  )
}
