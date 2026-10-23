import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CircleHelp, CheckCircle2, AlertCircle, PlayCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { HoverHint } from '@/components/ui/tooltip'
import { formatCurrency } from '@/core/utils/format'
import { computeVentaTotal } from '../compute'

// Ayuda del módulo para quien hace el cierre en el local. Lo que dice sobre qué
// suma y qué resta tiene que coincidir con computeVentaTotal (../compute) y con
// syncClosingTransactions (propinas y gastos van a finanzas por aparte).

type Effect = 'suma' | 'resta' | 'info'

const EFFECT_CHIP: Record<Effect, { label: string; className: string }> = {
  suma: { label: '+ Suma', className: 'bg-positive-bg text-positive-text' },
  resta: { label: '− Resta', className: 'bg-negative-bg text-negative-text' },
  info: { label: 'Informativo', className: 'bg-bone text-mid-gray' },
}

interface HelpRow {
  field: string
  detail: string
  effect: Effect
}

const STEPS = [
  'Pon la fecha del día y el nombre de quien hace el cierre.',
  'Digita lo que marca cada medio de pago (QR, Datáfono, Rappi) y el efectivo que contaste en caja, incluida la base.',
  'Revisa la Venta Total en verde: se calcula sola.',
  'Llena los otros movimientos (propinas, gastos, entrega) y dale Guardar Cierre.',
]

const INFO_ROWS: HelpRow[] = [
  { field: 'Propinas', detail: 'Se registra como ingreso aparte en finanzas, no como venta.', effect: 'info' },
  { field: 'Gastos', detail: 'Lo que se pagó con plata de la caja. Queda como gasto en finanzas.', effect: 'info' },
  { field: 'Caja Menor', detail: 'Plata de caja menor del día. Solo queda registrada.', effect: 'info' },
  { field: 'Entrega de Efectivo', detail: 'El efectivo que se entrega al final del día. Solo queda registrado.', effect: 'info' },
  { field: 'Faltante / Sobrante', detail: 'Diferencia entre lo que debía haber y lo que hay. Se suma en el Acumulado del mes.', effect: 'info' },
]

const EXAMPLE = { ap: 500000, efectivo: 1300000, qr: 200000, datafono: 900000, rappiVentas: 150000 }

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-caption font-semibold uppercase tracking-wider text-mid-gray mb-2">{children}</h3>
}

function RowList({ rows }: { rows: HelpRow[] }) {
  return (
    <ul className="rounded-lg border border-border/60 divide-y divide-border/60">
      {rows.map((r) => (
        <li key={r.field} className="flex items-start justify-between gap-3 px-3 py-2">
          <div className="min-w-0">
            <span className="block text-body font-medium text-dark-graphite">{r.field}</span>
            <span className="block text-caption text-mid-gray">{r.detail}</span>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-caption font-medium ${EFFECT_CHIP[r.effect].className}`}>
            {EFFECT_CHIP[r.effect].label}
          </span>
        </li>
      ))}
    </ul>
  )
}

function ExampleLine({ label, amount, sign }: { label: string; amount: number; sign?: '+' | '−' }) {
  return (
    <div className="flex justify-between">
      <span className="text-mid-gray">{sign ? `${sign} ` : ''}{label}</span>
      <span className="tabular-nums text-graphite">{formatCurrency(amount)}</span>
    </div>
  )
}

export function ClosingHelp({ showDidi, tutorialsHref }: { showDidi: boolean; tutorialsHref?: string }) {
  const [open, setOpen] = useState(false)
  const headerRef = useRef<HTMLDivElement>(null)

  const saleRows: HelpRow[] = [
    { field: 'QR', detail: 'Pagos por transferencia o código QR.', effect: 'suma' },
    { field: 'Datáfono', detail: 'Pagos con tarjeta.', effect: 'suma' },
    { field: 'Rappi', detail: 'Ventas por Rappi. Suman a la venta, pero Rappi las consigna después.', effect: 'suma' },
    ...(showDidi
      ? [{ field: 'Didi', detail: 'Ventas por DiDi. Suman a la venta, pero DiDi las consigna después.', effect: 'suma' as const }]
      : []),
    { field: 'Efectivo en Caja', detail: 'Todo el efectivo contado al cierre, incluida la base.', effect: 'suma' },
    { field: 'AP (Apertura)', detail: 'La base con la que se abrió la caja. No es venta, por eso se descuenta del efectivo.', effect: 'resta' },
  ]

  const exampleTotal = computeVentaTotal(EXAMPLE)

  return (
    <>
      <HoverHint label="¿Cómo funciona el cierre?">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Cómo funciona el cierre"
          className="p-2 rounded-lg text-mid-gray hover:text-graphite hover:bg-bone transition-colors"
        >
          <CircleHelp size={18} strokeWidth={1.5} />
        </button>
      </HoverHint>

      <Dialog open={open} onOpenChange={setOpen}>
        {/* Sin initialFocus el foco cae en el link del final y el modal abre scrolleado abajo. */}
        <DialogContent className="sm:max-w-lg gap-6" initialFocus={headerRef}>
          <div ref={headerRef} tabIndex={-1} className="outline-none">
            <DialogHeader>
              <DialogTitle>Cómo funciona el cierre de caja</DialogTitle>
              <DialogDescription>Qué llenar, qué suma y qué resta en la Venta Total.</DialogDescription>
            </DialogHeader>
          </div>

          <section>
            <SectionTitle>Paso a paso</SectionTitle>
            <ol className="flex flex-col gap-2">
              {STEPS.map((step, i) => (
                <li key={i} className="flex gap-3 text-body text-graphite">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-bone text-caption font-medium text-dark-graphite flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <SectionTitle>Qué suma y qué resta en la Venta Total</SectionTitle>
            <RowList rows={saleRows} />
            <p className="mt-2 rounded-lg bg-bone px-3 py-2 text-caption text-graphite">
              QR + Datáfono + Rappi{showDidi ? ' + Didi' : ''} + Efectivo − Apertura = <span className="font-medium">Venta Total</span>
            </p>
          </section>

          <section>
            <SectionTitle>Ejemplo</SectionTitle>
            <div className="rounded-lg border border-border/60 px-3 py-2 text-body flex flex-col gap-0.5">
              <ExampleLine label="QR" amount={EXAMPLE.qr} />
              <ExampleLine label="Datáfono" amount={EXAMPLE.datafono} sign="+" />
              <ExampleLine label="Rappi" amount={EXAMPLE.rappiVentas} sign="+" />
              <ExampleLine label="Efectivo en Caja" amount={EXAMPLE.efectivo} sign="+" />
              <ExampleLine label="AP (Apertura)" amount={EXAMPLE.ap} sign="−" />
              <div className="mt-1 pt-1 border-t border-border/60 flex justify-between">
                <span className="font-medium text-positive-text">Venta Total</span>
                <span className="tabular-nums font-medium text-positive-text">{formatCurrency(exampleTotal)}</span>
              </div>
            </div>
            <p className="mt-2 text-caption text-mid-gray">
              Si el efectivo contado es menor que la apertura, la parte de efectivo cuenta como $0 (nunca resta de los otros medios).
            </p>
          </section>

          <section>
            <SectionTitle>No cambian la Venta Total</SectionTitle>
            <RowList rows={INFO_ROWS} />
          </section>

          <section>
            <SectionTitle>Íconos del historial</SectionTitle>
            <div className="flex flex-col gap-2 text-body text-graphite">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} strokeWidth={1.5} className="text-positive-text shrink-0" />
                <span><span className="font-medium">Cuadra:</span> la Venta Total guardada coincide con la fórmula.</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle size={16} strokeWidth={1.5} className="text-negative-text shrink-0" />
                <span><span className="font-medium">Descuadre:</span> no coincide. Abre el cierre, revísalo y vuelve a guardarlo.</span>
              </div>
            </div>
          </section>

          {tutorialsHref && (
            <Link
              to={tutorialsHref}
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-2 self-start text-body font-medium text-graphite hover:text-dark-graphite"
            >
              <PlayCircle size={16} strokeWidth={1.5} />
              Ver videos paso a paso
            </Link>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
