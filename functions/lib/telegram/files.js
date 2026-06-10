// Descarga de archivos enviados al bot (fotos de facturas, PDFs,
// comprobantes). Flujo Bot API: getFile(file_id) → file_path → download.
// Los file_path expiran (~1h) pero el file_id se puede re-resolver después,
// por eso en Firestore solo guardamos el file_id.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // mismo límite que agent-chat.ts
const MAX_PDF_BYTES = 10 * 1024 * 1024;
export class TelegramFileError extends Error {
}
export async function downloadTelegramFile(botToken, fileId, opts) {
    const infoRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`);
    const info = (await infoRes.json());
    if (!info.ok || !info.result?.file_path) {
        throw new TelegramFileError(`No pude obtener el archivo de Telegram (${info.description ?? 'getFile falló'}). ` +
            'Puede haber caducado — reenvía la foto o el documento.');
    }
    const isPdf = opts.mimeType === 'application/pdf';
    const maxBytes = isPdf ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
    if ((info.result.file_size ?? 0) > maxBytes) {
        throw new TelegramFileError(`El archivo pesa más de ${Math.round(maxBytes / 1024 / 1024)}MB — envía una versión más liviana.`);
    }
    const fileRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${info.result.file_path}`);
    if (!fileRes.ok) {
        throw new TelegramFileError('La descarga del archivo desde Telegram falló. Reenvíalo, por favor.');
    }
    const buffer = Buffer.from(await fileRes.arrayBuffer());
    if (buffer.byteLength > maxBytes) {
        throw new TelegramFileError(`El archivo pesa más de ${Math.round(maxBytes / 1024 / 1024)}MB — envía una versión más liviana.`);
    }
    const fallbackName = isPdf ? 'documento.pdf' : 'foto.jpg';
    return {
        buffer,
        fileName: opts.fileName ?? info.result.file_path.split('/').pop() ?? fallbackName,
        mimeType: opts.mimeType,
    };
}
//# sourceMappingURL=files.js.map