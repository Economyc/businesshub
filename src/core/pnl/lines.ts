// Lineas del Estado de Resultados segun la plantilla que usan los socios
// ("Plantilla estado de resultados.xlsx"). Fuente unica de verdad del orden y
// los rotulos: el orden de este array ES el orden de las filas del Excel.
//
// Movido desde scripts/lib/pnl-template.mjs, que ahora re-exporta desde aca.
// El clasificador (que transaccion va a que linea) se queda en el .mjs: depende
// del barrido de Firestore y solo corre en Node.

export type LineSection = 'revenue' | 'cogs' | 'staff' | 'opex' | 'financial' | 'nonop' | 'taxes'

export interface LineDef {
  key: string
  label: string
  section: LineSection
}

export const LINES: LineDef[] = [
  { key: 'rev_food', label: 'Venta de alimentos', section: 'revenue' },
  { key: 'rev_drinks', label: 'Venta de bebidas y coctelería', section: 'revenue' },
  { key: 'rev_delivery', label: 'Ventas por domicilios', section: 'revenue' },
  { key: 'rev_other', label: 'Otros ingresos', section: 'revenue' },

  { key: 'cogs_food', label: 'Costo de alimentos y bebidas', section: 'cogs' },
  { key: 'cogs_packaging', label: 'Empaques y desechables', section: 'cogs' },
  // Ya no es solo Rappi: tambien hay DiDi y la web propia, que liquida por
  // Wompi. Llamarla "Comision Rappi" escondería las otras dos dentro de un
  // nombre que miente.
  { key: 'cogs_rappi', label: 'Comisiones de plataformas', section: 'cogs' },

  { key: 'staff_payroll', label: 'Nómina', section: 'staff' },
  { key: 'staff_social', label: 'Seguridad social', section: 'staff' },

  { key: 'op_rent', label: 'Arriendo del Local', section: 'opex' },
  { key: 'op_utilities', label: 'Servicios Públicos (Energía, Agua, Gas, internet)', section: 'opex' },
  { key: 'op_maintenance', label: 'Mantenimiento y Reparaciones Locativas', section: 'opex' },
  { key: 'op_marketing', label: 'Mercadeo y Publicidad', section: 'opex' },
  { key: 'op_cleaning', label: 'Aseo, Cafetería e Insumos No Alimenticios', section: 'opex' },
  { key: 'op_office', label: 'Papelería y Suministros Administrativos', section: 'opex' },
  { key: 'op_insurance', label: 'Seguros', section: 'opex' },
  { key: 'op_software', label: 'Software, suscripciones, POS', section: 'opex' },
  { key: 'op_accounting', label: 'Honorarios contabilidad', section: 'opex' },
  { key: 'op_legal', label: 'Honorarios legales', section: 'opex' },
  { key: 'op_hr', label: 'Honorarios recursos humanos', section: 'opex' },
  { key: 'op_admin', label: 'Gastos de Administración Central (prorrateo entre sedes)', section: 'opex' },
  { key: 'op_other', label: 'Otros Gastos Operacionales', section: 'opex' },

  { key: 'fin_expense', label: 'Gastos financieros (datáfonos, 4x1000, bancolombia)', section: 'financial' },
  { key: 'fin_income', label: 'Ingresos financieros', section: 'financial' },

  // Plata que entró y NO vino de vender comida. Va aparte de los ingresos
  // operacionales a proposito: sumarla ahi inflaria la venta del mes, dejaria
  // de cuadrar con el POS y moveria todos los porcentajes, el punto de
  // equilibrio y la comparacion contra el mes anterior. Aca suma a la utilidad
  // sin tocar nada de eso.
  //
  // Es extraordinaria por definicion: el mes siguiente no la tiene y la
  // utilidad "cae" sin que haya pasado nada. Por eso lleva linea propia y
  // rotulo explicito en vez de esconderse en "Otros ingresos".
  { key: 'nonop_asset_sale', label: 'Venta de activos', section: 'nonop' },

  { key: 'tax_impo', label: 'Provisión ipoconsumo', section: 'taxes' },
  { key: 'tax_rtf', label: 'Provisión retención en la fuente', section: 'taxes' },
  { key: 'tax_renta', label: 'Provisión impuesto de renta', section: 'taxes' },
]

export const LINE_LABEL = new Map<string, string>(LINES.map((l) => [l.key, l.label]))

export const linesOf = (section: LineSection): LineDef[] => LINES.filter((l) => l.section === section)

/** Las 4 lineas de ingreso operacional, en el orden de la plantilla. */
export const REVENUE_KEYS = ['rev_food', 'rev_drinks', 'rev_delivery', 'rev_other']

// Lineas que hoy NO se alimentan desde Ecore. Se muestran en $0 con nota al pie
// en vez de inventarles un valor.
export const LINES_SIN_FUENTE: Record<string, string> = {
  cogs_rappi: 'Las comisiones de Rappi, DiDi y la web no se registran como gasto: las ventas de esos canales entran netas. Salen del extracto, comparando el abono de la plataforma contra la venta del canal.',
  fin_expense: 'No hay gastos bancarios cargados en Ecore. Salen del extracto (scripts/consolidado-extracto-banco.mjs).',
  fin_income: 'Sin rendimientos financieros registrados.',
  op_insurance: 'Sin pólizas registradas como gasto en el período.',
  tax_renta: 'No se provisiona renta a nivel de sede.',
}

/** Mapa linea → monto con todas las lineas en 0. */
export const emptyLineAmounts = (): Record<string, number> =>
  Object.fromEntries(LINES.map((l) => [l.key, 0]))
