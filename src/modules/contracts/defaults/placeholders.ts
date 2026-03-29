export const PLACEHOLDERS = [
  { token: '{{companyName}}', label: 'Nombre de la empresa' },
  { token: '{{companyNit}}', label: 'NIT de la empresa' },
  { token: '{{companyAddress}}', label: 'Dirección de la empresa' },
  { token: '{{companyLegalRep}}', label: 'Representante legal' },
  { token: '{{employeeName}}', label: 'Nombre del empleado' },
  { token: '{{employeeIdentification}}', label: 'Cédula del empleado' },
  { token: '{{employeeAddress}}', label: 'Dirección del empleado' },
  { token: '{{position}}', label: 'Cargo' },
  { token: '{{salary}}', label: 'Salario (número)' },
  { token: '{{salaryWords}}', label: 'Salario (letras)' },
  { token: '{{paymentFrequency}}', label: 'Frecuencia de pago' },
  { token: '{{startDate}}', label: 'Fecha de inicio' },
  { token: '{{endDate}}', label: 'Fecha de terminación' },
  { token: '{{workSchedule}}', label: 'Horario de trabajo' },
  { token: '{{probationDays}}', label: 'Días de periodo de prueba' },
  { token: '{{city}}', label: 'Ciudad' },
] as const

export function resolvePlaceholders(
  text: string,
  metadata: Record<string, string | number | undefined>
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = metadata[key]
    return value !== undefined ? String(value) : match
  })
}

const UNITS = [
  '', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete',
  'dieciocho', 'diecinueve', 'veinte', 'veintiún', 'veintidós', 'veintitrés',
  'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve',
]

const TENS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
const HUNDREDS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos']

function numberToWordsBelow1000(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cien'
  if (n < 30) return UNITS[n]
  if (n < 100) {
    const t = Math.floor(n / 10)
    const u = n % 10
    return u === 0 ? TENS[t] : `${TENS[t]} y ${UNITS[u]}`
  }
  const h = Math.floor(n / 100)
  const rest = n % 100
  return rest === 0 ? (n === 100 ? 'cien' : HUNDREDS[h]) : `${HUNDREDS[h]} ${numberToWordsBelow1000(rest)}`
}

export function numberToWords(n: number): string {
  if (n === 0) return 'cero pesos'
  const millions = Math.floor(n / 1_000_000)
  const thousands = Math.floor((n % 1_000_000) / 1000)
  const remainder = n % 1000

  let result = ''
  if (millions > 0) {
    result += millions === 1 ? 'un millón' : `${numberToWordsBelow1000(millions)} millones`
  }
  if (thousands > 0) {
    if (result) result += ' '
    result += thousands === 1 ? 'mil' : `${numberToWordsBelow1000(thousands)} mil`
  }
  if (remainder > 0) {
    if (result) result += ' '
    result += numberToWordsBelow1000(remainder)
  }
  return `${result} pesos M/CTE`
}
