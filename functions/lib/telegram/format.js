// Formateo de texto para Telegram. Enviamos texto plano (sin parse_mode):
// MarkdownV2 exige escapar 18 caracteres y el LLM genera GFM, así que
// stripeamos el markdown más común en vez de pelear con el escaping.
const TELEGRAM_MAX_MESSAGE = 4096;
export function toTelegramText(markdown) {
    let text = markdown;
    // Tablas GFM → líneas "col1 | col2" sin separadores de guiones.
    text = text.replace(/^\s*\|?[\s:|-]+\|[\s:|-]+\|?\s*$/gm, '');
    text = text.replace(/^\s*\|(.+)\|\s*$/gm, (_m, row) => row
        .split('|')
        .map((c) => c.trim())
        .filter(Boolean)
        .join(' | '));
    // Headers → línea simple en mayúscula inicial.
    text = text.replace(/^#{1,6}\s+(.+)$/gm, '$1');
    // Negrita / itálica / código.
    text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
    text = text.replace(/__([^_]+)__/g, '$1');
    text = text.replace(/(?<![\w*])\*([^*\n]+)\*(?![\w*])/g, '$1');
    text = text.replace(/```[a-z]*\n?([\s\S]*?)```/g, '$1');
    text = text.replace(/`([^`]+)`/g, '$1');
    // Links [texto](url) → "texto (url)".
    text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1 ($2)');
    // Bullets markdown → guion simple.
    text = text.replace(/^\s*[*•]\s+/gm, '- ');
    // Colapsa saltos de línea triples.
    text = text.replace(/\n{3,}/g, '\n\n');
    return text.trim();
}
export function chunkText(text, max = TELEGRAM_MAX_MESSAGE) {
    if (text.length <= max)
        return [text];
    const chunks = [];
    let rest = text;
    while (rest.length > max) {
        // Corta en el último salto de línea dentro del límite; si no hay, corta duro.
        let cut = rest.lastIndexOf('\n', max);
        if (cut < max * 0.5)
            cut = max;
        chunks.push(rest.slice(0, cut).trimEnd());
        rest = rest.slice(cut).trimStart();
    }
    if (rest)
        chunks.push(rest);
    return chunks;
}
export function formatCop(amount) {
    return `$${Math.round(amount).toLocaleString('es-CO')}`;
}
//# sourceMappingURL=format.js.map