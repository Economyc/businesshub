// Wave 5.2 — Delivery stub para reportes programados.
//
// TODO(integraciones reales):
//   - Email: integrar SendGrid (process.env.SENDGRID_API_KEY + SENDGRID_FROM_EMAIL).
//     Reemplazar el branch `email` por una llamada a `@sendgrid/mail`.
//   - WhatsApp: integrar Twilio (process.env.TWILIO_ACCOUNT_SID +
//     TWILIO_AUTH_TOKEN + TWILIO_WHATSAPP_FROM). Reemplazar el branch
//     `whatsapp` por twilio.messages.create({ from, to: 'whatsapp:+...', body }).
//
// Mientras no existan credenciales, todos los canales caen al mismo backend
// (`companies/{cid}/sentReports/{auto-id}`). El doc guarda el contenido
// completo + el canal solicitado original, así cuando se conecten las keys
// reales basta con cambiar el branch sin tocar nada más.

import { FieldValue } from 'firebase-admin/firestore'
import { db } from './firestore.js'

export type DeliveryChannel = 'email' | 'whatsapp' | 'firestore'

export interface DeliverReportInput {
  companyId: string
  scheduledReportId: string
  reportType: string
  channel: DeliveryChannel
  recipient: string
  subject: string
  htmlBody: string
  textBody: string
}

export interface DeliveryResult {
  ok: boolean
  channelUsed: DeliveryChannel
  // Si el canal pedido fue email/whatsapp pero cayó en firestore por falta de
  // keys, true. El cron lo loguea para que sea fácil ver en consola.
  fellBack: boolean
  reason?: string
  sentReportId?: string
}

async function writeSentReport(input: DeliverReportInput, channelUsed: DeliveryChannel, fellBack: boolean): Promise<string> {
  const ref = await db
    .collection('companies')
    .doc(input.companyId)
    .collection('sentReports')
    .add({
      scheduledReportId: input.scheduledReportId,
      reportType: input.reportType,
      requestedChannel: input.channel,
      channelUsed,
      fellBack,
      recipient: input.recipient,
      subject: input.subject,
      htmlBody: input.htmlBody,
      textBody: input.textBody,
      createdAt: FieldValue.serverTimestamp(),
    })
  return ref.id
}

export async function deliverReport(input: DeliverReportInput): Promise<DeliveryResult> {
  // Canal explícitamente firestore: siempre escribe y termina.
  if (input.channel === 'firestore') {
    const sentReportId = await writeSentReport(input, 'firestore', false)
    return { ok: true, channelUsed: 'firestore', fellBack: false, sentReportId }
  }

  if (input.channel === 'email') {
    if (!process.env.SENDGRID_API_KEY) {
      console.warn(
        `[ReportDelivery] SENDGRID_API_KEY no configurada — fallback a firestore para companyId=${input.companyId} report=${input.scheduledReportId}`,
      )
      const sentReportId = await writeSentReport(input, 'firestore', true)
      return {
        ok: true,
        channelUsed: 'firestore',
        fellBack: true,
        reason: 'SENDGRID_API_KEY no configurada',
        sentReportId,
      }
    }
    // TODO: llamar SendGrid aquí. Por ahora dejamos rastro y guardamos en
    // firestore para no perder el reporte mientras se conectan las keys.
    console.log(
      `[ReportDelivery] SENDGRID_API_KEY presente pero envío real no implementado — guardando en firestore. companyId=${input.companyId}`,
    )
    const sentReportId = await writeSentReport(input, 'firestore', true)
    return {
      ok: true,
      channelUsed: 'firestore',
      fellBack: true,
      reason: 'Envío real por SendGrid pendiente de implementar',
      sentReportId,
    }
  }

  if (input.channel === 'whatsapp') {
    const hasTwilio =
      Boolean(process.env.TWILIO_ACCOUNT_SID) &&
      Boolean(process.env.TWILIO_AUTH_TOKEN) &&
      Boolean(process.env.TWILIO_WHATSAPP_FROM)
    if (!hasTwilio) {
      console.warn(
        `[ReportDelivery] Credenciales de Twilio no configuradas — fallback a firestore para companyId=${input.companyId} report=${input.scheduledReportId}`,
      )
      const sentReportId = await writeSentReport(input, 'firestore', true)
      return {
        ok: true,
        channelUsed: 'firestore',
        fellBack: true,
        reason: 'Credenciales de Twilio no configuradas',
        sentReportId,
      }
    }
    // TODO: llamar Twilio aquí.
    console.log(
      `[ReportDelivery] Twilio presente pero envío real no implementado — guardando en firestore. companyId=${input.companyId}`,
    )
    const sentReportId = await writeSentReport(input, 'firestore', true)
    return {
      ok: true,
      channelUsed: 'firestore',
      fellBack: true,
      reason: 'Envío real por Twilio pendiente de implementar',
      sentReportId,
    }
  }

  // Canal desconocido: tratarlo como firestore para no perder el contenido.
  const sentReportId = await writeSentReport(input, 'firestore', true)
  return {
    ok: false,
    channelUsed: 'firestore',
    fellBack: true,
    reason: `Canal desconocido: ${String(input.channel)}`,
    sentReportId,
  }
}
