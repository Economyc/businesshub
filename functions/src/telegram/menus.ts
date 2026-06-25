// Builders de teclados inline y helpers de fecha. Módulo "puro": no importa los
// flujos (pay-flow/quick-entry) para evitar ciclos — ellos importan de aquí.

import { InlineKeyboard } from 'grammy'
import { formatCop } from './format.js'

// ─── Menú principal ──────────────────────────────────────────────────────

export function buildMainMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text('💸 Pagar facturas', 'm:pay')
    .text('➕ Registrar', 'm:add')
    .row()
    .text('🏢 Cambiar empresa', 'm:co')
    .text('📄 PDF pendientes', 'm:pdf')
}

export const MAIN_MENU_TEXT =
  '🏠 Menú — elige una opción:\n\n' +
  '• 💸 Pagar facturas pendientes\n' +
  '• ➕ Registrar gasto, factura o pago\n' +
  '• 🏢 Cambiar de empresa\n' +
  '• 📄 PDF de pagos pendientes'

export function backToMenuKeyboard(extra?: InlineKeyboard): InlineKeyboard {
  const kb = extra ?? new InlineKeyboard()
  return kb.row().text('⬅️ Menú', 'm:home')
}

// ─── Helpers de fecha (zona horaria Bogotá) ──────────────────────────────

/** "Hoy" en calendario de Bogotá, como YYYY-MM-DD. */
export function bogotaTodayIso(): string {
  // en-CA formatea como YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
}

/** Suma días a un ISO YYYY-MM-DD (mediodía UTC evita bordes de DST). */
export function isoAddDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

/** Etiqueta legible de una fecha ISO, ej. "21 jun 2026". */
export function isoLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`)
  return new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(d)
}

// ─── Selector de fecha (mini-calendario) ─────────────────────────────────

const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']
const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

export const DATE_PICKER_TEXT = '📅 ¿Qué fecha?'

/**
 * Teclado de selección de fecha para un flujo (stateId). Fila rápida
 * Hoy/Ayer/Antier + mini-calendario del mes (y, m con m = 1..12) con navegación.
 * callbacks: dp:set:<stateId>:<YYYY-MM-DD> y dp:nav:<stateId>:<YYYY-MM>.
 */
export function buildDatePicker(stateId: string, year?: number, month?: number): InlineKeyboard {
  const today = bogotaTodayIso()
  const kb = new InlineKeyboard()
    .text('Hoy', `dp:set:${stateId}:${today}`)
    .text('Ayer', `dp:set:${stateId}:${isoAddDays(today, -1)}`)
    .text('Antier', `dp:set:${stateId}:${isoAddDays(today, -2)}`)
    .row()

  const [ty, tm] = today.split('-').map(Number)
  const y = year ?? ty
  const m = month ?? tm // 1..12

  // Cabecera de navegación de mes.
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
  kb.text('‹', `dp:nav:${stateId}:${prev}`)
    .text(`${MONTHS[m - 1]} ${y}`, 'dp:noop')
    .text('›', `dp:nav:${stateId}:${next}`)
    .row()

  // Cabecera de días de la semana (Lunes primero).
  for (const w of WEEKDAYS) kb.text(w, 'dp:noop')
  kb.row()

  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay() // 0=Dom..6=Sab
  const offset = (firstWeekday + 6) % 7 // Lunes primero

  let col = 0
  for (let i = 0; i < offset; i++) {
    kb.text(' ', 'dp:noop')
    col++
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    kb.text(String(day), `dp:set:${stateId}:${iso}`)
    col++
    if (col === 7) {
      kb.row()
      col = 0
    }
  }
  if (col > 0) kb.row()

  return kb
}

// ─── Helper de etiquetas para botones de lista ───────────────────────────

/** Recorta un texto para que entre en una etiqueta de botón. */
export function clampLabel(s: string, max = 28): string {
  const clean = s.replace(/\s+/g, ' ').trim()
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`
}

/** "Proveedor — $monto" para botones de factura. */
export function invoiceButtonLabel(supplierName: string | null, amount: number): string {
  const name = clampLabel(supplierName || 'Sin proveedor', 20)
  return `${name} — ${formatCop(amount)}`
}
