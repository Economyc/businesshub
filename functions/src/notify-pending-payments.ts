// Cron diario (08:30 Bogotá, después de dailyOverdueCheck que a las 08:00 marca
// overdue): envía a cada usuario vinculado a Telegram un PDF consolidado con los
// pagos pendientes de TODAS sus compañías. Sin pedirlo, sin abrir la app.
//
// Destinatarios: se resuelven desde telegramLinks/{chatId}.uid (no hay auth en el
// cron). Por cada uid, sus compañías activas vía loadUserCompanies(). Si un uid no
// tiene nada pendiente, recibe un texto corto en vez de un PDF vacío.
//
// Datos: una sola query por compañía (status in [...], sin índice compuesto) y se
// separa en memoria facturas (documentKind=='invoice') vs otras obligaciones
// (type=='expense' && documentKind!='invoice'). Espeja getPendingInvoicesBySupplier
// (finance-tools) y getWeeklyObligations (obligations-tools).
//
// Deploy SIEMPRE con gcloud (ver CLAUDE.md), región us-central1, secret TELEGRAM_BOT_TOKEN.

import { onSchedule } from 'firebase-functions/v2/scheduler'
import { db } from './firestore.js'
import { telegramBotToken } from './telegram/index.js'
import { loadUserCompanies } from './telegram/auth.js'
import { sendDocument, sendMessage } from './utils/telegram-send.js'
import { buildPendingPaymentsPdf, type PendingReport, type PendingCompany } from './utils/build-pending-payments-pdf.js'
import { buildCompanySection, buildCaption, bogotaLabel } from './utils/pending-payments-core.js'

export const notifyPendingPayments = onSchedule(
  {
    schedule: 'every day 08:30',
    timeZone: 'America/Bogota',
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 540,
    retryCount: 0,
    secrets: [telegramBotToken],
  },
  async () => {
    // 1. uid -> [chatId] desde telegramLinks.
    const links = await db.collection('telegramLinks').get()
    if (links.empty) {
      console.log('[pending-payments] sin telegramLinks, nada que enviar')
      return
    }
    const byUid = new Map<string, string[]>()
    for (const doc of links.docs) {
      const uid = (doc.data() as { uid?: string }).uid
      if (!uid) continue
      const chats = byUid.get(uid)
      if (chats) chats.push(doc.id)
      else byUid.set(uid, [doc.id])
    }

    const token = telegramBotToken.value()
    const dateLabel = bogotaLabel(new Date())
    let sent = 0

    for (const [uid, chatIds] of byUid) {
      try {
        const companies = await loadUserCompanies(uid)
        const sections: PendingCompany[] = []
        const withPending: Array<{ id: string; name: string }> = []
        for (const c of companies) {
          const section = await buildCompanySection(c.id, c.name)
          if (section) {
            sections.push(section)
            withPending.push({ id: c.id, name: c.name })
          }
        }

        // Sin pendientes en ninguna compañía → texto corto, no PDF vacío.
        if (sections.length === 0) {
          for (const chatId of chatIds) {
            await sendMessage(token, chatId, `✅ <b>Sin pagos pendientes hoy</b> — ${dateLabel}`)
          }
          continue
        }

        sections.sort((a, b) => b.companyTotal - a.companyTotal)
        const report: PendingReport = {
          dateLabel,
          companies: sections,
          grandTotal: sections.reduce((s, c) => s + c.companyTotal, 0),
        }

        const pdf = await buildPendingPaymentsPdf(report)
        const safeDate = dateLabel.replace(/[^\d]/g, '') || 'hoy'
        const caption = buildCaption(report)
        // Botones de acción: abrir el flujo de pago de cada compañía con pendientes
        // (pf:open re-consulta en caliente, sin estado obsoleto del cron).
        const payKeyboard = {
          inline_keyboard: withPending.map((c) => [
            { text: `💸 Pagar — ${c.name}`, callback_data: `pf:open:${c.id}` },
          ]),
        }
        for (const chatId of chatIds) {
          if (await sendDocument(token, chatId, pdf, `pendientes-${safeDate}.pdf`, 'application/pdf', caption)) {
            sent += 1
            await sendMessage(token, chatId, '👉 Marca pagos desde aquí:', payKeyboard)
          }
        }
      } catch (err) {
        console.error(`[pending-payments] uid=${uid} falló:`, err)
      }
    }

    console.log(`[pending-payments] enviados=${sent} uids=${byUid.size}`)
  },
)
