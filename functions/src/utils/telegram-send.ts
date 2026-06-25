// Helpers de envío a la API de Telegram (texto y documentos adjuntos).
// Compartidos por notify-count-diff.ts y notify-pending-payments.ts.

export async function sendMessage(
  token: string,
  chatId: string,
  text: string,
  replyMarkup?: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> },
): Promise<boolean> {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
  })
  const json = (await res.json()) as { ok?: boolean }
  return !!json.ok
}

export async function sendDocument(
  token: string,
  chatId: string,
  buffer: Buffer,
  filename: string,
  mime: string,
  caption?: string,
): Promise<boolean> {
  const form = new FormData()
  form.append('chat_id', chatId)
  form.append('document', new Blob([new Uint8Array(buffer)], { type: mime }), filename)
  if (caption) {
    form.append('caption', caption)
    form.append('parse_mode', 'HTML')
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, { method: 'POST', body: form })
  const json = (await res.json()) as { ok?: boolean }
  return !!json.ok
}
